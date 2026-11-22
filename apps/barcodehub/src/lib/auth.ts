/**
 * Authentication and session helpers for BarcodeHub
 */

export function getStoredUser(): any | null {
  try {
    const raw = localStorage.getItem('barcodehub_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setStoredSession(user: any, _role?: 'admin' | 'brand') {
  if (!user) return;
  try {
    // The server reads identity from the session cookie set at sign-in, never from this body.
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('barcodehub_user', JSON.stringify(data.user));
      return data;
    }
  } catch (err) {
    console.error('Error establishing session:', err);
  }
}

export async function logout(returnTo = '/login') {
  // 1. Wipe client storage
  try {
    localStorage.removeItem('barcodehub_user');
    sessionStorage.clear();
  } catch (err) {
    console.error('Error clearing local storage:', err);
  }

  // 2. Clear the server session (the HttpOnly cookie can only be cleared by the server)
  try {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch {
    // ignore network errors
  }

  // 3. Hard redirect to login page
  window.location.href = returnTo;
}
