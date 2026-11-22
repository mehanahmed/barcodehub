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
      // The token stays in the server's HttpOnly cookie only; drop copies older versions left where scripts can read them.
      localStorage.removeItem('zite.auth.token');
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
    localStorage.removeItem('zite.auth.token');
    localStorage.removeItem('better-auth.session_token');
    sessionStorage.clear();
    delete (window as any)._ziteUsageToken;
  } catch (err) {
    console.error('Error clearing local storage:', err);
  }

  // 2. Clear browser cookies
  try {
    document.cookie = 'barcodehub_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    document.cookie = 'better-auth.session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  } catch {
    // ignore
  }

  // 3. Clear server session
  try {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch {
    // ignore network errors
  }

  // 4. Hard redirect to login page
  window.location.href = returnTo;
}
