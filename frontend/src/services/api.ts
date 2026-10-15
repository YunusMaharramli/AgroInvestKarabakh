import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { AppNotification, AppUser, CabinetRole, InvestmentRequest, Land, UserPreferences } from '../types/agro';
import { db, delay, mutate, newId, subscribe } from './db';
import { TEST_PASSWORD, SEED_USERS } from '../mocks/seed';
import { backend, BackendError, TOKEN_KEY, type AuthResponse, type MessageResponse, type RegistrationResponse } from './backend';
import { syncOwnerLands, toLand, type BackendLand } from './ministryLands';
import { syncPortalProposals } from './portalProposals';

/* ------------------------------------------------------------------ *
 * Mock API layer. Every function returns a Promise like a real HTTP
 * call would, so components do not change when the backend is wired.
 * ------------------------------------------------------------------ */

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

const SEED_EMAILS = new Set(SEED_USERS.map(u => u.email.toLowerCase()));

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

  /**
   * Seed test accounts (both@ / owner@ / investor@agroinvest.az) log in against mock data.
   * Every other account logs in against the real backend, which refuses accounts
   * whose email is not confirmed yet (403).
   */
  async login(identifier: string, password: string, remember: boolean, recaptchaToken: string): Promise<AppUser> {
    const id = identifier.trim().toLowerCase().replace(/\s/g, '');
    if (SEED_EMAILS.has(id)) {
      await delay(null, 400);
      const user = db().users.find(u => u.email.toLowerCase() === id);
      const pw = (user && localStorage.getItem(`agroinvest_pw_${user.id}`)) || TEST_PASSWORD;
      if (!user || password !== pw) throw new ApiError('auth.errors.invalid');
      startSession(user.id, remember, null);
      return user;
    }
    let res: AuthResponse;
    try {
      res = await backend<AuthResponse>('POST', '/auth/login', { email: id, password, recaptchaToken });
    } catch (x) {
      const e = fromBackend(x, 'auth.errors.invalid');
      if (e.status === 403) throw new ApiError('auth.errors.notConfirmed', e.detail, 403);
      throw e;
    }
    // The cabinets still run on mock data, so keep a local mirror of the backend user.
    const b = res.user;
    const isAdmin = String(b.role).toUpperCase() === 'ADMIN' || b.role === 1;
    let user = db().users.find(u => u.id === b.id || u.email.toLowerCase() === b.email.toLowerCase());
    if (!user) {
      user = {
        id: b.id, fullName: `${b.firstName} ${b.lastName}`.trim(), email: b.email, phone: b.phone ?? '', avatar: null, roles: [], verified: true, isAdmin,
        preferences: { budgetMin: 50000, budgetMax: 500000, fieldTypes: [], regions: [], riskTolerance: 'medium' },
      };
      const created = user;
      mutate(d => { d.users.push(created); });
    } else if (!!user.isAdmin !== isAdmin) {
      const id = user.id;
      mutate(d => { const u = d.users.find(x => x.id === id); if (u) u.isAdmin = isAdmin; });
      user = { ...user, isAdmin };
    }
    startSession(user.id, remember, res.token);
    return user;
  },

  /** Creates the account on the backend; the backend emails a confirmation link (Mailpit in development). */
  async signup(input: { fullName: string; email: string; phone: string; password: string; recaptchaToken: string }): Promise<RegistrationResponse> {
    const parts = input.fullName.trim().split(/\s+/);
    const firstName = parts.shift() ?? '';
    const lastName = parts.join(' ');
    try {
      return await backend<RegistrationResponse>('POST', '/auth/register', {
        firstName, lastName, email: input.email.trim().toLowerCase(), phone: input.phone,
        password: input.password, confirmPassword: input.password,
        recaptchaToken: input.recaptchaToken,
      });
    } catch (x) {
      const e = fromBackend(x);
      if (e.status === 409) throw new ApiError('auth.errors.emailTaken', e.detail, 409);
      throw e;
    }
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
    await delay(null, 400);
    mutate(d => {
      const u = d.users.find(x => x.id === me.id)!;
      if (!u.roles.includes(role)) u.roles.push(role);
    });
  },

  async updateProfile(patch: Partial<AppUser>) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    await delay(null, 400);
    mutate(d => { Object.assign(d.users.find(x => x.id === me.id)!, patch); });
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
    await delay(null, 500);
    const pw = localStorage.getItem(`agroinvest_pw_${me.id}`) || TEST_PASSWORD;
    if (current !== pw) throw new ApiError('settings.errors.currentPassword');
    localStorage.setItem(`agroinvest_pw_${me.id}`, next);
  },

  /** Re-reads the role from the server (an admin may have been promoted while signed in). */
  async refreshRole(): Promise<boolean> {
    const me = authService.currentUser();
    if (!me || !readSession()?.token) return false;
    try {
      const b = (await backend<{ user: { role: string | number } }>('GET', '/auth/me')).user;
      const isAdmin = String(b.role).toUpperCase() === 'ADMIN' || b.role === 1;
      if (!!me.isAdmin !== isAdmin) mutate(d => { const u = d.users.find(x => x.id === me.id); if (u) u.isAdmin = isAdmin; });
      return isAdmin;
    } catch { return !!me.isAdmin; }
  },

  /** True when signed in with a real backend session (needed for admin pages). */
  hasBackendSession(): boolean { return !!readSession()?.token; },

  logout() {
    if (readSession()?.token) void backend('POST', '/auth/logout').catch(() => undefined);
    try {
      localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
    notifyAuth();
  },

  rememberedCabinet(): CabinetRole | null {
    try { return localStorage.getItem(CHOICE_KEY) as CabinetRole | null; } catch { return null; }
  },
  rememberCabinet(role: CabinetRole | null) {
    try { if (role) localStorage.setItem(CHOICE_KEY, role); else localStorage.removeItem(CHOICE_KEY); } catch { /* ignore */ }
  },
};

function startSession(userId: string, remember: boolean, token: string | null) {
  const data = JSON.stringify({ userId, remember, token });
  try {
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

/* ---------------- lands ---------------- */

export const landService = {
  publicLands(): Land[] {
    return db().lands.filter(l => l.status === 'active' || l.status === 'funded');
  },
  async list(): Promise<Land[]> { return delay(landService.publicLands()); },
  get(id: string): Land | undefined { return db().lands.find(l => l.id === id); },
  byOwner(ownerId: string): Land[] { return db().lands.filter(l => l.ownerId === ownerId); },

  async create(form: FormData): Promise<void> {
    const me = authService.currentUser();
    if (!me || !authService.hasBackendSession()) throw new ApiError('auth.errors.notSignedIn');
    try {
      const created = await backend<{ land: BackendLand }>('POST', '/my/lands', form);
      try { await syncOwnerLands(me.id); }
      catch {
        const land = toLand(created.land);
        land.ownerId = me.id; land.source = 'ownerPortal'; land.status = 'underReview';
        mutate(d => { d.lands = [land, ...d.lands.filter(l => l.id !== land.id)]; });
      }
    } catch (x) { throw fromBackend(x); }
  },

  async setStatus(id: string, status: Land['status']) {
    await delay(null, 300);
    mutate(d => { d.lands.find(l => l.id === id)!.status = status; });
  },

  async remove(id: string) {
    await delay(null, 300);
    mutate(d => {
      d.lands = d.lands.filter(l => l.id !== id);
      d.requests = d.requests.filter(r => r.landId !== id);
    });
  },

  addView(id: string) {
    mutate(d => { const l = d.lands.find(x => x.id === id); if (l) l.views += 1; });
  },

  savedIds(userId: string): string[] { return db().saved[userId] ?? []; },
  toggleSaved(userId: string, landId: string) {
    mutate(d => {
      const list = d.saved[userId] ?? [];
      d.saved[userId] = list.includes(landId) ? list.filter(x => x !== landId) : [...list, landId];
    });
  },
};

/* ---------------- investment requests ---------------- */

export const requestService = {
  forOwner(ownerId: string): InvestmentRequest[] {
    const mine = new Set(landService.byOwner(ownerId).map(l => l.id));
    return db().requests.filter(r => mine.has(r.landId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  forInvestor(investorId: string): InvestmentRequest[] {
    return db().requests.filter(r => r.investorId === investorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  forLand(landId: string) { return db().requests.filter(r => r.landId === landId); },

  async create(input: { landId: string; amount: number; investmentModel: InvestmentRequest['investmentModel']; durationMonths: number; message: string; documents?: File[] }) {
    const me = authService.currentUser();
    if (!me) throw new ApiError('auth.errors.notSignedIn');
    const land = landService.get(input.landId);
    if (!land || land.status !== 'active') throw new ApiError('requests.errors.closed');
    if (land.ownerId === me.id) throw new ApiError('requests.errors.own');
    if (!authService.hasBackendSession() || !land.source) throw new ApiError('form.error', 'Demo elanına real təklif göndərmək mümkün deyil.');
    try {
      const detail = await backend<{ activeOpportunity: { id: string } | null }>('GET', `/lands/${land.id}`);
      if (!detail.activeOpportunity) throw new ApiError('requests.errors.closed');
      const form = new FormData();
      form.append('opportunityId', detail.activeOpportunity.id);
      form.append('proposedInvestmentAmount', String(input.amount));
      form.append('businessPlanSummary', input.message);
      form.append('estimatedImplementationPeriod', `${input.durationMonths} ay`);
      form.append('contactPhone', me.phone);
      input.documents?.forEach(file => form.append('documents', file));
      const created = await backend<{ id: string; submittedAt: string; updatedAt: string }>('POST', '/proposals', form);
      try { await syncPortalProposals(); }
      catch {
        mutate(d => { d.requests = [{ landId: input.landId, amount: input.amount, investmentModel: input.investmentModel,
          durationMonths: input.durationMonths, message: input.message, id: created.id, investorId: me.id, status: 'pending',
          viewedByOwner: false, source: 'portal', createdAt: created.submittedAt, updatedAt: created.updatedAt }, ...d.requests.filter(r => r.id !== created.id)]; });
      }
    } catch (x) { if (x instanceof ApiError) throw x; throw fromBackend(x); }
  },

  markViewed(id: string) {
    mutate(d => { const r = d.requests.find(x => x.id === id); if (r) r.viewedByOwner = true; });
  },

};

/* ---------------- notifications ---------------- */

export const notificationService = {
  forUser(userId: string): AppNotification[] {
    return db().notifications.filter(n => n.userId === userId).slice(0, 20);
  },
  markAllRead(userId: string) {
    mutate(d => d.notifications.forEach(n => { if (n.userId === userId) n.read = true; }));
  },
  markRead(id: string) {
    mutate(d => { const n = d.notifications.find(x => x.id === id); if (n) n.read = true; });
  },
};

export const userById = (id: string) => db().users.find(u => u.id === id);
