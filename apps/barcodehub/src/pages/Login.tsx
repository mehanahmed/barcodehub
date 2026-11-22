import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Loader2,
  Building2,
  Shield,
  ArrowRight,
  ScanBarcode,
  CheckCircle2,
  QrCode,
  Printer,
  BarChart3,
  ArrowLeft,
  Phone,
} from 'lucide-react';
import { signIn, signUp } from 'zitejs/auth';
import { normalizePhone, isEmailIdentifier } from '../lib/phone';
import { toast } from 'sonner';
import { setStoredSession } from '../lib/auth';
import { useSeo } from '../lib/seo';

function parseDestinationPath(rawUrl: string | null, fallback = '/app'): string {
  if (!rawUrl) return fallback;
  try {
    let cleaned = rawUrl.trim();
    if (cleaned.startsWith('http:/') && !cleaned.startsWith('http://')) {
      cleaned = cleaned.replace('http:/', 'http://');
    } else if (cleaned.startsWith('https:/') && !cleaned.startsWith('https://')) {
      cleaned = cleaned.replace('https:/', 'https://');
    }
    const parsed = new URL(cleaned, window.location.origin);
    if (
      parsed.pathname === '/auth/login' ||
      parsed.pathname === '/login' ||
      parsed.pathname.startsWith('/auth/login')
    ) {
      return fallback;
    }
    return parsed.pathname + parsed.search + parsed.hash || fallback;
  } catch {
    if (
      rawUrl.startsWith('/') &&
      !rawUrl.startsWith('/auth/login') &&
      !rawUrl.startsWith('/login')
    ) {
      return rawUrl;
    }
    return fallback;
  }
}

export default function Login() {
  useSeo({
    title: 'Sign In | BarcodeHub',
    description: 'Sign in to BarcodeHub to manage your barcodes and products.',
    noindex: true,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirectUrl') || '/app';

  // Determine initial mode (signin vs signup) from URL path or param
  const initialMode =
    location.pathname.includes('signup') || searchParams.get('mode') === 'signup'
      ? 'signup'
      : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  // Sign-in: email or phone number. Sign-up: email only (phone has its own field).
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Auto-redirect if user already has an active local session
  useEffect(() => {
    try {
      const stored = localStorage.getItem('barcodehub_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.id) navigate(parseDestinationPath(redirectUrl, '/app'), { replace: true });
      }
    } catch {
      // ignore parse error
    }
  }, [navigate, redirectUrl]);

  const handleAuthSuccess = (user?: any) => {
    toast.success(
      mode === 'signin' ? 'Welcome back to BarcodeHub!' : 'Account created successfully!'
    );
    if (user) {
      setStoredSession(user);
    }
    // Admins sign in at /admin/login; brand sign-in always goes to the brand dashboard (or redirectUrl).
    navigate(parseDestinationPath(redirectUrl, '/app'), { replace: true });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your email or phone number and your password.');
      return;
    }
    const id = email.trim();

    setIsLoading(true);
    try {
      // The server accepts an email or a phone number in the "email" field.
      const res = await signIn.email({
        email: isEmailIdentifier(id) ? id.toLowerCase() : id,
        password,
      });

      if ((res as any)?.error) {
        toast.error((res as any).error.message || 'Failed to sign in.');
      } else {
        handleAuthSuccess((res as any)?.data?.user);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      toast.error('Enter a valid mobile number, for example 01712345678.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim() || email.split('@')[0],
        phone: normalizedPhone,
      } as Parameters<typeof signUp.email>[0]);

      if ((res as any)?.error) {
        toast.error((res as any).error.message || 'Failed to create account.');
      } else {
        handleAuthSuccess((res as any)?.data?.user);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error('Please enter your email first.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn.magicLink({
        email: email.trim().toLowerCase(),
        callbackURL: redirectUrl,
      });
      setMagicLinkSent(true);
      toast.success('Sign-in verification link sent to your email!');
    } catch (err: any) {
      toast.error(err.message || 'Could not send verification link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1611] text-gray-100 flex flex-col justify-between selection:bg-[#c8f049] selection:text-black">
      {/* ─── TOP NAVIGATION HEADER ─── */}
      <header className="relative z-30 w-full px-6 py-4 sm:px-10 sm:py-5 flex items-center justify-between border-b border-white/10 bg-[#0d1611]/80 backdrop-blur-md">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#c8f049] text-gray-950 flex items-center justify-center font-bold shadow-md shadow-[#c8f049]/20 group-hover:scale-105 transition-transform">
            <ScanBarcode className="w-5 h-5 text-gray-950 stroke-[2.4]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5 leading-none">
              <span className="text-[#c8f049]">//</span> BarcodeHub
            </span>
            <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase mt-0.5">
              Barcode & Product Passport Platform
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* ─── MAIN CONTENT AREA ─── */}
      <main className="relative z-20 flex-1 grid lg:grid-cols-12 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 gap-8 items-center">
        {/* LEFT COLUMN: PRODUCT CAPABILITIES SHOWCASE */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between rounded-3xl overflow-hidden relative min-h-[560px] p-8 lg:p-10 border border-white/10 shadow-2xl">
          {/* Background image: Authentic Barcode & Scanner Hero */}
          <img
            src="/barcode_scanner_hero.jpg"
            alt="Barcode Scanning and Packaging"
            className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.38] contrast-[1.15]"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1611] via-[#0d1611]/80 to-[#111b15]/60" />

          {/* Ambient glow */}
          <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-[#c8f049]/15 blur-3xl pointer-events-none" />

          {/* Top Pill & Title */}
          <div className="relative z-10 space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#c8f049]/15 border border-[#c8f049]/30 text-[#c8f049] text-xs font-semibold uppercase tracking-wider">
              <ScanBarcode className="w-3.5 h-3.5" />
              <span>GS1 Standard Barcodes & Digital Passports</span>
            </div>

            <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Retail-ready barcodes and verified product pages.
            </h2>

            <p className="text-sm text-gray-300 leading-relaxed">
              Generate GS1-compliant EAN-13, UPC-A, Code-128, and QR barcodes for your products. Print packaging labels and publish digital product passports.
            </p>
          </div>

          {/* Feature Badges Grid */}
          <div className="relative z-10 grid grid-cols-2 gap-3.5 my-6 max-w-lg">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#c8f049]/20 text-[#c8f049] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">GS1 EAN-13 & UPC</p>
                <p className="text-[11px] text-gray-400">Retail shelf-ready standards</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Smart QR Passports</p>
                <p className="text-[11px] text-gray-400">Instant lookup & verification</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Packaging & Thermal</p>
                <p className="text-[11px] text-gray-400">Multi-label sheet export</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Scan Analytics</p>
                <p className="text-[11px] text-gray-400">Real-time scan metrics</p>
              </div>
            </div>
          </div>

          {/* Standards & Platform Specifications Footer (Factual) */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#c8f049]" />
              <span>Supported Standards: GS1 EAN-13, UPC-A, Code 128, QR Code</span>
            </div>
            <span className="text-[#c8f049] font-mono text-[11px]">BarcodeHub</span>
          </div>
        </div>

        {/* RIGHT COLUMN: AUTH FORM CARD */}
        <div className="lg:col-span-5 w-full flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[430px] rounded-3xl bg-[#141f18]/90 border border-white/15 p-7 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden"
          >
            {/* Top Barcode Icon Badge */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#c8f049]/15 border border-[#c8f049]/30 text-[#c8f049] flex items-center justify-center shadow-lg shadow-[#c8f049]/10">
                <ScanBarcode className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            {/* Segmented Mode Selector (Sign In vs Create Account) */}
            <div className="flex bg-[#0d1611]/80 p-1 rounded-xl border border-white/10 mb-6">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-[#c8f049] text-gray-950 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#c8f049] text-gray-950 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Heading & Subtitle */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'signin' ? 'Sign in to BarcodeHub' : 'Create an Account'}
              </h1>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                {mode === 'signin'
                  ? 'Access your product barcodes, digital passports, and packaging labels.'
                  : 'Start generating barcodes and managing your product catalog.'}
              </p>
            </div>

            {/* Magic Link Confirmation State */}
            {magicLinkSent ? (
              <div className="p-4 bg-[#c8f049]/10 border border-[#c8f049]/25 rounded-2xl text-center space-y-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#c8f049]/20 text-[#c8f049] flex items-center justify-center mx-auto">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sm text-white">Check your email</h3>
                <p className="text-xs text-gray-300">
                  We sent a sign-in link to <span className="font-bold text-[#c8f049]">{email}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setMagicLinkSent(false)}
                  className="text-xs text-[#c8f049] hover:underline pt-2 block mx-auto font-medium cursor-pointer"
                >
                  Use password instead
                </button>
              </div>
            ) : (
              <form
                onSubmit={mode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                className="space-y-3.5"
              >
                {/* Full Name (Sign Up mode only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="autofill-dark w-full h-11 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#c8f049] focus:ring-1 focus:ring-[#c8f049]/40 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label htmlFor="login-id" className="block text-xs font-medium text-gray-300 mb-1">
                    {mode === 'signup' ? 'Email Address' : 'Email or Phone Number'}
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                    </svg>
                    <input
                      id="login-id"
                      type={mode === 'signup' ? 'email' : 'text'}
                      autoComplete={mode === 'signup' ? 'email' : 'username'}
                      placeholder={mode === 'signup' ? 'name@company.com' : 'name@company.com or 01712345678'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="autofill-dark w-full h-11 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#c8f049] focus:ring-1 focus:ring-[#c8f049]/40 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Mobile number (Sign Up mode only): lets the user sign in with phone or email */}
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="signup-phone" className="block text-xs font-medium text-gray-300 mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        id="signup-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="01712345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="autofill-dark w-full h-11 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#c8f049] focus:ring-1 focus:ring-[#c8f049]/40 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-300">Password</label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={handleMagicLink}
                        className="text-[11px] text-[#c8f049] hover:underline transition-colors font-medium cursor-pointer"
                      >
                        Email sign-in link?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="autofill-dark w-full h-11 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#c8f049] focus:ring-1 focus:ring-[#c8f049]/40 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-[#c8f049] hover:bg-[#d8f56e] active:scale-[0.985] text-gray-950 font-bold text-sm shadow-lg shadow-[#c8f049]/20 flex items-center justify-center gap-2 transition-all cursor-pointer mt-4"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-950" />
                  ) : (
                    <>
                      <span>{mode === 'signin' ? 'Sign in to Dashboard' : 'Create Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Toggle Between Sign In & Sign Up */}
            <div className="mt-5 text-center pt-3 border-t border-white/10">
              {mode === 'signin' ? (
                <p className="text-xs text-gray-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="font-bold text-[#c8f049] hover:underline cursor-pointer ml-1"
                  >
                    Create one
                  </button>
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="font-bold text-[#c8f049] hover:underline cursor-pointer ml-1"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>

            {/* Standards & Security Note */}
            <div className="mt-4 pt-3 flex items-center justify-center gap-2 text-[11px] text-gray-500">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <span>GS1 Standard Barcode System</span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-20 w-full py-4 text-center border-t border-white/10 bg-[#0d1611]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-2">
          <span>© {new Date().getFullYear()} BarcodeHub. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/lookup" className="hover:text-white transition-colors">
              Public Barcode Lookup
            </Link>
            <span>•</span>
            <Link to="/" className="hover:text-[#c8f049] transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
