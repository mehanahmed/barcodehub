import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, ScanBarcode, ShieldCheck } from 'lucide-react';
import { signIn, signOut } from 'zitejs/auth';
import { getMyAccount } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { setStoredSession } from '../lib/auth';
import { useSeo } from '../lib/seo';

/** Only same-site admin paths are allowed as a post-login destination. */
function adminDestination(raw: string | null): string {
  return raw && raw.startsWith('/admin') && !raw.startsWith('/admin/login') ? raw : '/admin';
}

/**
 * Sign-in for the SaaS owner. Sign-in only: admins are made by claiming the first admin
 * or by another admin. The admin API checks rights on every call; this page just routes.
 */
export default function AdminLogin() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useSeo({ title: 'Admin sign in | BarcodeHub', description: 'Sign in to the BarcodeHub admin panel.' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      const res = await signIn.email({ email: email.trim().toLowerCase(), password });
      if (res?.error) return setError(res.error.message || 'Could not sign in.');
      const user = (res?.data as any)?.user;
      await setStoredSession(user);

      if (!user?.isAdmin) {
        // Before the first admin exists, let this account reach the "Make me admin" screen.
        const { account } = await getMyAccount({});
        if (!account?.noAdminsYet) {
          await signOut();
          localStorage.removeItem('barcodehub_user');
          return setError('This account does not have admin access.');
        }
      }
      // Full page load: the auth gate's session cache and React Query's account cache would
      // otherwise still hold the signed-out state and bounce straight back here.
      window.location.replace(adminDestination(params.get('redirectUrl')));
    } catch (err: any) {
      setError(err?.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  // Same dark green + lime palette as the brand sign-in, without its marketing column.
  const field =
    'h-11 bg-white/5 border-white/15 text-white placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-[#c8f049] focus-visible:ring-offset-0 focus-visible:border-transparent';

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1611] text-gray-100">
      <header className="w-full px-4 sm:px-8 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-[#c8f049] text-gray-950 grid place-items-center">
            <ScanBarcode className="w-4 h-4" strokeWidth={2.4} />
          </span>
          <span className="font-semibold tracking-tight text-white">BarcodeHub</span>
        </Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-2 py-1 rounded-md">
          <ArrowLeft className="w-4 h-4" />Back to site
        </Link>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-white/10 bg-[#111d16] p-6 sm:p-8 shadow-2xl shadow-black/40">
            <div className="w-11 h-11 rounded-xl bg-[#c8f049]/15 text-[#c8f049] grid place-items-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white mt-5">Admin console</h1>
            <p className="text-sm text-gray-400 mt-1.5">Restricted area. Sign in with an administrator account.</p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <div>
                <Label htmlFor="admin-email" className="text-gray-300">Email</Label>
                <Input id="admin-email" type="email" autoComplete="username" placeholder="you@company.com" className={`mt-1.5 ${field}`}
                  value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div>
                <Label htmlFor="admin-password" className="text-gray-300">Password</Label>
                <div className="relative mt-1.5">
                  <Input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className={`pr-11 ${field}`}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 w-11 grid place-items-center text-gray-400 hover:text-white rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8f049]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
                </p>
              )}
              <Button type="submit" disabled={busy}
                className="w-full h-11 bg-[#c8f049] text-gray-950 font-semibold hover:bg-[#d6f56f] focus-visible:ring-2 focus-visible:ring-[#c8f049] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111d16]">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}Sign in
              </Button>
            </form>

            <p className="mt-6 pt-5 border-t border-white/10 text-xs text-gray-500 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />Locked for 15 minutes after 10 failed attempts.
            </p>
          </div>
          <p className="text-center text-sm text-gray-400 mt-5">
            Brand account? <Link to="/login" className="text-[#c8f049] hover:underline">Sign in here</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
