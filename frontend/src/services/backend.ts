import type { ApplicantType, InvestorProfile } from '../types/agro';

/* ------------------------------------------------------------------ *
 * Real backend (ASP.NET, /api/...). Used for account actions that need
 * a real email: sign-up, email confirmation link, login, password reset.
 * Everything else still uses the mock layer in api.ts.
 * Errors from the server come as { error: "..." } (Azerbaijani text).
 * ------------------------------------------------------------------ */

export const TOKEN_KEY = 'agro_token';

export class BackendError extends Error {
  /** status 0 = server not reachable */
  /** data = the full error body (admin forms: { fields, blockers }) */
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) { super(message); }
}

export function backendToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export async function backend<T>(method: 'GET' | 'POST' | 'DELETE' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const token = backendToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new BackendError(0, '');
  }
  const type = res.headers.get('content-type') ?? '';
  // No JSON (e.g. the dev proxy's 502/504, or index.html) means the API is not running.
  if (!type.includes('json')) throw new BackendError(res.ok || res.status >= 500 ? 0 : res.status, '');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BackendError(res.status, typeof data?.error === 'string' ? data.error : '', data && typeof data === 'object' ? data : {});
  return data as T;
}

export interface BackendUser {
  id: string; firstName: string; lastName: string; email: string; phone: string | null; role: string | number;
  applicantType?: ApplicantType | null; needsOnboarding?: boolean;
}
export interface MessageResponse { message: string }
export interface RegistrationResponse { message: string; requiresEmailConfirmation: boolean; emailDeliveryFailed: boolean; signupToken?: string | null }
export interface AuthResponse { message: string; token: string; user: BackendUser; profile?: InvestorProfile | null }
export interface SignupStatus { email: string; applicantType: ApplicantType | null; emailConfirmed: boolean; needsOnboarding: boolean }

/** Address of the local mail catcher (Mailpit) that receives emails in development. */
export const MAILPIT_URL = 'http://localhost:8025';
export const isLocalDev = () => import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
