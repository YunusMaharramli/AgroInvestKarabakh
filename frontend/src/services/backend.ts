/* ------------------------------------------------------------------ *
 * Real backend (ASP.NET, /api/...). Used for account actions that need
 * a real email: sign-up, email confirmation link, login, password reset.
 * Everything else still uses the mock layer in api.ts.
 * Errors from the server come as { error: "..." } (Azerbaijani text).
 * ------------------------------------------------------------------ */

export const TOKEN_KEY = 'agro_token';

export class BackendError extends Error {
  /** status 0 = server not reachable */
  constructor(public status: number, message: string) { super(message); }
}

export function backendToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export async function backend<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = backendToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new BackendError(0, '');
  }
  const type = res.headers.get('content-type') ?? '';
  // No JSON (e.g. the dev proxy's 502/504, or index.html) means the API is not running.
  if (!type.includes('json')) throw new BackendError(res.ok || res.status >= 500 ? 0 : res.status, '');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BackendError(res.status, typeof data?.error === 'string' ? data.error : '');
  return data as T;
}

export interface BackendUser { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: string | number }
export interface MessageResponse { message: string }
export interface RegistrationResponse { message: string; requiresEmailConfirmation: boolean; emailDeliveryFailed: boolean }
export interface AuthResponse { message: string; token: string; user: BackendUser }

/** Address of the local mail catcher (Mailpit) that receives emails in development. */
export const MAILPIT_URL = 'http://localhost:8025';
export const isLocalDev = () => import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
