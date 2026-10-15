import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { AppNotification, AppUser, ApplicantType, CabinetRole, InvestmentRequest, InvestorProfile, Land, UserPreferences } from '../types/agro';
import { db, mutate, subscribe } from './db';
import { syncMinistryLands } from './ministryLands';
import { backend, BackendError, TOKEN_KEY, type AuthResponse, type BackendUser, type MessageResponse, type RegistrationResponse, type SignupStatus } from './backend';

/* Backend API adapter. The in-memory store only helps existing React views refresh. */

const SESSION_KEY = 'agroinvest_session';
const CHOICE_KEY = 'agroinvest_cabinet_choice';

export class ApiError extends Error {
  /** code = translation key; detail = message sent by the server (shown when present) */
  constructor(public code: string, public detail = '', public status = 0) { super(code); }
}

/** Text to show for any error thrown by the services. */
export function errorText(t: (k: string) => string, x: unknown): string {
  if (x instanceof ApiError) return x.detail || t(x.code);
  return t('form.error');
}

/** Turns a backend failure into an ApiError with a translated fallback. */
function fromBackend(x: unknown, fallback = 'form.error'): ApiError {
  if (x instanceof BackendError) {
    if (x.status === 0) return new ApiError('auth.errors.server', '', 0);
    return new ApiError(fallback, x.message, x.status);
  }
  return new ApiError(fallback);
}


/* ---------------- auth ---------------- */

interface Session { userId: string; remember: boolean; token?: string | null }

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export const authService = {
  currentUser(): AppUser | null {
    const s = readSession();
    return s ? db().users.find(u => u.id === s.userId) ?? null : null;
  },

  /** Sign in using the API; user details are refreshed from the server on reload. */
  async login(identifier: string, password: string, remember: boolean, recaptchaToken: string): Promise<AppUser> {
    const id = identifier.trim().toLowerCase().replace(/\s/g, '');
    let res: AuthResponse;
    try {
      res = await backend<AuthResponse>('POST', '/auth/login', { email: id, password, recaptchaToken });
    } catch (x) {
      const e = fromBackend(x, 'auth.errors.invalid');
      if (e.status === 403) throw new ApiError('auth.errors.notConfirmed', e.detail, 403);
      throw e;
    }
    return adoptSession(res, remember);
  },

  /** Sign-up step 1 for any applicant type. The backend emails a confirmation link (Mailpit in development). */
  async signup(input: SignupInput): Promise<RegistrationResponse> {
    try {
      const r = await backend<RegistrationResponse>('POST', '/auth/register', {
        applicantType: input.applicantType, firstName: input.firstName?.trim(), lastName: input.lastName?.trim(), fullName: input.fullName?.trim(), email: input.email.trim().toLowerCase(),
        phone: input.phone, companyName: input.companyName?.trim(), taxIdentificationNumber: input.voen?.trim(),
        foreignTaxNumber: input.foreignTaxNumber?.trim(), password: input.password, confirmPassword: input.confirmPassword,
        acceptTerms: input.acceptTerms, recaptchaToken: input.recaptchaToken,
      });
      if (r.signupToken) savePendingSignup({ token: r.signupToken, email: input.email.trim().toLowerCase(), type: input.applicantType });
      return r;
    } catch (x) {
      const e = fromBackend(x);
      if (e.status === 409) throw new ApiError('auth.errors.emailTaken', e.detail, 409);
      throw e;
    }
  },

  /** The sign-up this browser started (kept until it is finished). */
  pendingSignup(): PendingSignup | null { return readPendingSignup(); },
  forgetPendingSignup() { try { localStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* ignore */ } },

  /** Is the email of the pending sign-up confirmed yet? */
  async signupStatus(token: string): Promise<SignupStatus> {
    try { return await backend<SignupStatus>('POST', '/auth/signup/status', { signupToken: token }); }
    catch (x) {
      const e = fromBackend(x);
      if (e.status === 404) authService.forgetPendingSignup();
      throw e;
    }
  },

  /** Last sign-up step: the additional information. Signs the applicant in and returns the user. */
  async completeSignup(details: Record<string, unknown>): Promise<AppUser> {
    const pending = readPendingSignup();
    let res: AuthResponse;
    try { res = await backend<AuthResponse>('POST', '/auth/signup/details', { ...details, signupToken: pending?.token }); }
    catch (x) { throw fromBackend(x); }
    authService.forgetPendingSignup();
    return adoptSession(res, true);
  },

  async updateInvestorProfile(patch: Partial<InvestorProfile>) {
    try {
      await backend<InvestorProfile>('PATCH', '/auth/investor-profile', patch);
      await authService.refreshRole();
    } catch (x) { throw fromBackend(x); }
  },

  async uploadInvestorProfileDocument(file: File, category: string) {
    const body = new FormData(); body.set('file', file); body.set('category', category);
    try { return await backend<InvestorProfileDocument>('POST', '/auth/investor-profile/documents', body); }
    catch (x) { throw fromBackend(x); }
  },

  async deleteInvestorProfileDocument(id: string) {
    try { await backend('DELETE', '/auth/investor-profile/documents/' + encodeURIComponent(id)); }
    catch (x) { throw fromBackend(x); }
  },

  /** Confirms the email with the token from the link in the confirmation email. */
  async confirmEmail(token: string): Promise<string> {
    try { return (await backend<MessageResponse>('POST', '/auth/confirm-email', { token })).message; }
    catch (x) { throw fromBackend(x, 'auth.errors.linkInvalid'); }
  },

  /** Sends a new confirmation link (the server limits how often). Always answers with a generic message. */
  async resendConfirmation(email: string, recaptchaToken: string): Promise<string> {
    try { return (await backend<MessageResponse>('POST', '/auth/resend-confirmation', { email: email.trim().toLowerCase(), recaptchaToken })).message; }
    catch (x) { throw fromBackend(x); }
  },

  async sendResetLink(email: string, recaptchaToken: string): Promise<string> {
    try { return (await backend<MessageResponse>('POST', '/auth/forgot-password', { email: email.trim().toLowerCase(), recaptchaToken })).message; }
    catch (x) { throw fromBackend(x); }
  },

  async resetPassword(token: string, password: string): Promise<string> {
    try { return (await backend<MessageResponse>('POST', '/auth/reset-password', { token, newPassword: password, confirmNewPassword: password })).message; }
    catch (x) { throw fromBackend(x, 'auth.errors.linkInvalid'); }
  },

  async addRole(role: CabinetRole) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    if (role !== 'investor') throw new ApiError('form.error');
    mutate(d => { d.users.find(x => x.id === me.id)!.roles = ['investor']; });
  },

  async updateProfile(patch: Partial<AppUser> & { currentPassword?: string }) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    const { currentPassword, ...userPatch } = patch;
    const parts = (patch.fullName ?? me.fullName).trim().split(/\s+/);
    try {
      await backend('PATCH', '/auth/profile', { firstName: parts.shift(), lastName: parts.join(' '), phone: patch.phone ?? me.phone, companyName: patch.companyName ?? me.companyName ?? '', currentPassword });
      mutate(d => { Object.assign(d.users.find(x => x.id === me.id)!, userPatch); });
    } catch (x) { throw fromBackend(x); }
  },

  async updatePreferences(patch: Partial<UserPreferences>) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    mutate(d => {
      const u = d.users.find(x => x.id === me.id)!;
      u.preferences = { ...u.preferences, ...patch };
    });
  },

  async changePassword(current: string, next: string) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    if (readSession()?.token) {
      try { await backend<MessageResponse>('POST', '/auth/change-password', { currentPassword: current, newPassword: next, confirmNewPassword: next }); }
      catch (x) { throw fromBackend(x, 'settings.errors.currentPassword'); }
      // The backend ends every session after a password change.
      authService.logout();
      return;
    }
    throw new ApiError('auth.errors.notSignedIn');
  },

  /** Re-reads the role from the server (an admin may have been promoted while signed in). */
  async refreshRole(): Promise<boolean> {
    const session = readSession();
    if (!session?.token) return false;
    try {
      const me = await backend<{ user: BackendUser; profile: InvestorProfile | null }>('GET', '/auth/me');
      const b = me.user;
      if (readSession()?.userId !== b.id) return false;
      const user = toAppUser(b, me.profile, db().users.find(u => u.id === b.id));
      mutate(d => { d.users = [user]; });
      notifyAuth();
      return !!user.isAdmin;
    } catch (x) {
      if (x instanceof BackendError && x.status === 401) { authService.clearLocalSession(); return false; }
      throw x;
    }
  },

  /** True when signed in with a real backend session (needed for admin pages). */
  hasBackendSession(): boolean { return !!readSession()?.token; },

  logout() {
    if (readSession()?.token) void backend('POST', '/auth/logout').catch(() => undefined);
    authService.clearLocalSession();
  },

  clearLocalSession() {
    try {
      localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
    mutate(d => { d.users = []; d.requests = []; d.notifications = []; d.saved = {}; });
    notifyAuth();
  },

  rememberedCabinet(): CabinetRole | null {
    try { return localStorage.getItem(CHOICE_KEY) as CabinetRole | null; } catch { return null; }
  },
  rememberCabinet(role: CabinetRole | null) {
    try { if (role) localStorage.setItem(CHOICE_KEY, role); else localStorage.removeItem(CHOICE_KEY); } catch { /* ignore */ }
  },
};

export interface SignupInput {
  applicantType: ApplicantType; email: string; password: string; confirmPassword: string; acceptTerms: boolean; recaptchaToken: string;
  firstName?: string; lastName?: string; fullName?: string; phone?: string; companyName?: string; voen?: string; foreignTaxNumber?: string;
}
export interface PendingSignup { token: string; email: string; type: ApplicantType }

/* Kept in localStorage so the tab opened from the confirmation email can continue the sign-up too. */
const PENDING_SIGNUP_KEY = 'agroinvest_pending_signup';
function readPendingSignup(): PendingSignup | null {
  try { const raw = localStorage.getItem(PENDING_SIGNUP_KEY); return raw ? JSON.parse(raw) as PendingSignup : null; } catch { return null; }
}
function savePendingSignup(p: PendingSignup) { try { localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(p)); } catch { /* ignore */ } }

/** View model for the cabinet components, built from the backend user. */
function toAppUser(b: BackendUser, profile: InvestorProfile | null | undefined, old?: AppUser): AppUser {
  const isAdmin = String(b.role).toUpperCase() === 'ADMIN' || b.role === 1;
  const company = b.applicantType === 'LEGAL_ENTITY' || b.applicantType === 'FOREIGN_ENTITY';
  return {
    id: b.id, fullName: `${b.firstName} ${b.lastName}`.trim(), email: b.email, phone: b.phone ?? '',
    avatar: old?.avatar ?? null, roles: ['investor'], verified: !!b.isVerified, isAdmin,
    applicantType: isAdmin ? null : b.applicantType ?? null, needsOnboarding: !isAdmin && !!b.needsOnboarding,
    investorProfile: profile ?? null,
    investorType: company ? 'company' : 'individual', companyName: profile?.companyName || old?.companyName,
    preferences: old?.preferences ?? { budgetMin: 0, budgetMax: 1500000, fieldTypes: [], regions: [], riskTolerance: 'medium' },
    notify: old?.notify,
  };
}

/** Starts the local session from a login / sign-up response. */
function adoptSession(res: AuthResponse, remember: boolean): AppUser {
  const old = db().users.find(u => u.id === res.user.id || u.email.toLowerCase() === res.user.email.toLowerCase());
  const user = toAppUser(res.user, res.profile, old);
  mutate(d => { d.users = [user]; d.requests = []; d.notifications = []; d.saved = {}; });
  startSession(user.id, remember, res.token);
  void refreshPortal().catch(() => undefined);
  return user;
}

function startSession(userId: string, remember: boolean, token: string | null) {
  const data = JSON.stringify({ userId, remember, token });
  try {
    localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    const store = remember ? localStorage : sessionStorage;
    store.setItem(SESSION_KEY, data);
    if (token) store.setItem(TOKEN_KEY, token);
  } catch { /* ignore */ }
  notifyAuth();
}

const authListeners = new Set<() => void>();
function notifyAuth() { authListeners.forEach(l => l()); }

/** React hook: the signed-in user (re-renders on login/logout and profile changes). */
export function useCurrentUser(): AppUser | null {
  const sub = useCallback((cb: () => void) => {
    authListeners.add(cb);
    const un = subscribe(cb);
    return () => { authListeners.delete(cb); un(); };
  }, []);
  const last = useRef<{ key: string; user: AppUser | null }>({ key: '', user: null });
  return useSyncExternalStore(sub, () => {
    const u = authService.currentUser();
    const key = u ? JSON.stringify(u) : '';
    if (key !== last.current.key) last.current = { key, user: u };
    return last.current.user;
  });
}

/** React hook: re-read any value from the mock db whenever it changes. */
export function useDbValue<T>(read: () => T): T {
  const last = useRef<{ key: string; value: T } | null>(null);
  return useSyncExternalStore(subscribe, () => {
    const v = read();
    const key = JSON.stringify(v);
    if (!last.current || last.current.key !== key) last.current = { key, value: v };
    return last.current.value;
  });
}

/* Server data is mirrored in memory so the existing components keep their layout. */
export interface BackendApplication {
  id: string; referenceNumber: string; userId: string; opportunityId: string;
  proposedInvestmentAmount: number; businessPlanSummary: string; estimatedImplementationPeriod: string;
  projectCosts?: number | null; fundingGap?: number | null; additionalFinancingRequested?: number | null; expectedAnnualRevenue?: number | null; expectedProduction?: string | null;
  status: string; submittedAt: string; updatedAt: string; applicantType: string; applicantName: string; taxNumber: string | null;
  land: { id: string } | null; statusHistory: NonNullable<InvestmentRequest['history']>;
  documents: NonNullable<InvestmentRequest['documents']>;
}
const statusMap: Record<string, InvestmentRequest['status']> = { OPEN: 'pending', UNDER_REVIEW: 'underReview', INFORMATION_REQUESTED: 'informationRequested', SELECTED: 'selected', NOT_SELECTED: 'notSelected', REJECTED: 'rejected', CANCELLED: 'cancelled' };
export function toRequest(b: BackendApplication): InvestmentRequest {
  return { id: b.id, referenceNumber: b.referenceNumber, opportunityId: b.opportunityId, landId: b.land?.id ?? '', investorId: b.userId,
    amount: b.proposedInvestmentAmount, message: b.businessPlanSummary, durationMonths: parseInt(b.estimatedImplementationPeriod) || 0,
    investmentModel: 'lease', status: statusMap[b.status] ?? 'pending', viewedByOwner: b.status !== 'OPEN',
    projectCosts: b.projectCosts, fundingGap: b.fundingGap, additionalFinancingRequested: b.additionalFinancingRequested,
    expectedAnnualRevenue: b.expectedAnnualRevenue, expectedProduction: b.expectedProduction,
    createdAt: b.submittedAt, updatedAt: b.updatedAt, applicantType: b.applicantType, applicantName: b.applicantName, taxNumber: b.taxNumber,
    history: b.statusHistory, documents: b.documents };
}
export async function refreshPortal() {
  await syncMinistryLands();
  const me = authService.currentUser();
  if (!me || !authService.hasBackendSession() || me.isAdmin) return;
  const [applications, notifications, saved] = await Promise.all([
    backend<BackendApplication[]>('GET', '/proposals/sent'),
    backend<{ id: string; userId: string; title: string; message: string; isRead: boolean; createdAt: string }[]>('GET', '/notifications'),
    backend<{ landId: string }[]>('GET', '/favorites'),
  ]);
  if (authService.currentUser()?.id !== me.id) return;
  mutate(d => {
    d.requests = applications.map(toRequest);
    d.notifications = notifications.map(n => ({ id: n.id, userId: n.userId, title: n.title, message: n.message, textKey: '', type: 'system', read: n.isRead, createdAt: n.createdAt, link: '/investor/investments' }));
    d.saved[me.id] = saved.map(f => f.landId);
  });
}
export const landService = {
  publicLands(): Land[] { return db().lands.filter(l => l.status === 'active' || l.status === 'closed'); },
  async list(): Promise<Land[]> { await syncMinistryLands(); return landService.publicLands(); },
  get(id: string): Land | undefined { return db().lands.find(l => l.id === id); },
  addView(_id: string) {},
  savedIds(userId: string): string[] { return db().saved[userId] ?? []; },
  async toggleSaved(_userId: string, landId: string) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    try { await backend(landService.savedIds(me.id).includes(landId) ? 'DELETE' : 'POST', landService.savedIds(me.id).includes(landId) ? '/favorites/' + landId : '/favorites', { landId }); await refreshPortal(); }
    catch(x) { throw fromBackend(x); }
  },
};
export const requestService = {
  forInvestor(id: string): InvestmentRequest[] { return db().requests.filter(r => r.investorId === id); },
  forLand(id: string) { return db().requests.filter(r => r.landId === id); },
  async create(input: { landId: string; amount: number; investmentModel: InvestmentRequest['investmentModel']; durationMonths: number; message: string; applicantType?: string; applicantName?: string; taxNumber?: string; contactPhone?: string; documents?: File[]; projectCosts?: number | null; fundingGap?: number | null; additionalFinancingRequested?: number | null; expectedAnnualRevenue?: number | null; expectedProduction?: string }) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    const land = landService.get(input.landId);
    if (!land?.opportunityId || !land.acceptingApplications) throw new ApiError('requests.errors.closed');
    const form = new FormData();
    form.set('opportunityId', land.opportunityId); form.set('proposedInvestmentAmount', String(input.amount));
    form.set('businessPlanSummary', input.message); form.set('estimatedImplementationPeriod', input.durationMonths + ' ay');
    form.set('applicantType', input.applicantType ?? 'individual'); form.set('applicantName', input.applicantName ?? me.fullName);
    form.set('taxNumber', input.taxNumber ?? ''); form.set('contactPhone', input.contactPhone ?? me.phone);
    if (input.projectCosts != null) form.set('projectCosts', String(input.projectCosts));
    if (input.fundingGap != null) form.set('fundingGap', String(input.fundingGap));
    if (input.additionalFinancingRequested != null) form.set('additionalFinancingRequested', String(input.additionalFinancingRequested));
    if (input.expectedAnnualRevenue != null) form.set('expectedAnnualRevenue', String(input.expectedAnnualRevenue));
    if (input.expectedProduction) form.set('expectedProduction', input.expectedProduction);
    input.documents?.forEach(file => form.append('documents', file));
    try { const created = await backend<BackendApplication>('POST', '/proposals', form); await refreshPortal(); return toRequest(created); }
    catch(x) { throw fromBackend(x); }
  },
  async supplement(id: string, message: string, files: File[]) {
    const form = new FormData(); form.set('message', message); files.forEach(file => form.append('documents', file));
    try { await backend('POST', '/proposals/' + id + '/supplements', form); await refreshPortal(); }
    catch(x) { throw fromBackend(x); }
  },
};
export const notificationService = {
  forUser(userId: string): AppNotification[] { return db().notifications.filter(n => n.userId === userId); },
  async markAllRead(_userId: string) { await backend('POST', '/notifications/read-all'); await refreshPortal(); },
  async markRead(id: string) { await backend('PATCH', '/notifications/' + id + '/read'); await refreshPortal(); },
};
export const userById = (id: string) => db().users.find(u => u.id === id);
