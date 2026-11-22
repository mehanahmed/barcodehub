/**
 * Browser auth: talks to the /api/auth/* routes in src/server/viteApiPlugin.ts.
 * The session itself is an HttpOnly cookie; this module only mirrors "who is signed in" for the UI.
 */
import { useSyncExternalStore } from 'react';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string | null;
  role?: 'admin' | 'user';
  isAdmin?: boolean;
};
export type AuthResult = { data?: any; error?: { message: string; code?: string } };

// One shared snapshot for every useAuth() caller; replaced (never mutated) so React sees changes.
let state: { user: AuthUser | null; isLoading: boolean } = { user: null, isLoading: true };
let requested = false;
const listeners = new Set<() => void>();
const setState = (next: typeof state) => {
  state = next;
  listeners.forEach((l) => l());
};

export async function refreshSession() {
  try {
    const res = await fetch('/api/auth/get-session', { credentials: 'same-origin' });
    const body = res.ok ? await res.json() : null;
    setState({ user: body?.user ?? null, isLoading: false });
  } catch {
    setState({ user: null, isLoading: false });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    void refreshSession();
  }
  return () => listeners.delete(listener);
}

/** { user, isLoading } for the current browser session. */
export function useAuth() {
  return useSyncExternalStore(subscribe, () => state);
}

async function postAuth(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(`/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { error: { message: json?.message || json?.error?.message || 'Request failed. Please try again.', code: json?.code || json?.error?.code } };
    }
    return { data: json };
  } catch {
    return { error: { message: 'Network error. Check your connection and try again.' } };
  }
}

const signedIn = (res: AuthResult) => {
  if (res.data?.user) setState({ user: res.data.user, isLoading: false });
  return res;
};

export const signIn = {
  /** `email` may also be a phone number; the server accepts either. */
  email: async (body: { email: string; password: string }) => signedIn(await postAuth('sign-in/email', body)),
};

export const signUp = {
  email: async (body: { email: string; password: string; name?: string; phone?: string }) => signedIn(await postAuth('sign-up/email', body)),
};

export async function signOut() {
  await postAuth('sign-out', {});
  setState({ user: null, isLoading: false });
}

export async function updateProfile(data: { firstName?: string; lastName?: string; name?: string; image?: string | null }) {
  const res = await postAuth('update-user', data);
  if (!res.error) await refreshSession(); // the server re-issued the session; read back the full user
  return res;
}

export function loginWithRedirect({ redirectUrl }: { redirectUrl: string }) {
  window.location.href = `/login?redirectUrl=${encodeURIComponent(redirectUrl)}`;
}
