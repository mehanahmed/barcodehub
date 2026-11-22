import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ScanBarcode, Globe, ArrowRight, Check,
  QrCode, Menu, X as XIcon, ChevronRight, TrendingUp, Sparkles,
  ShieldCheck, Printer, BarChart3,
} from 'lucide-react';
import { useAuth } from 'zitejs/auth';
import { getStoredUser } from '../lib/auth';
import { listPackages } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@project/components/ui/accordion';
import { useSeo } from '../lib/seo';
import { homeSeo } from '../lib/seoData';
import { formatTk } from '../lib/config';
import { BillingToggle, PackageCard, yearlySaving } from '../components/PackageCard';

// three.js (~600 KB) loads in its own chunk, only on the landing page, after the rest of the page.
const FuzzyCritterFooter = lazy(() => import('@/components/ui/fuzzy-critter-footer'));

const FOOTER_COLUMNS = [
  { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Benefits', href: '#benefits' }, { label: 'Pricing', href: '#pricing' }] },
  { title: 'For brands', links: [{ label: 'Create account', href: '/login?mode=signup' }, { label: 'Sign in', href: '/login' }, { label: 'Dashboard', href: '/app' }] },
  { title: 'Help', links: [{ label: 'Barcode lookup', href: '/lookup' }, { label: 'FAQ', href: '#faq' }] },
];

const start = (pkg?: string) => {
  const dest = pkg ? `/app/subscription?package=${pkg}` : '/app';
  window.location.href = `/login?redirectUrl=${encodeURIComponent(dest)}`;
};

const DARK_HERO = '#111b15';
const LIME = '#c8f049';

/* ─────────────────────────────────────────────
   AUTHENTIC LOGO SVGs (PAYMENT & INTEGRATIONS)
───────────────────────────────────────────── */
function BkashLogo() {
  return (
    <div className="bg-white h-8 sm:h-9 px-2.5 py-1 rounded-lg flex items-center justify-center shadow-sm shrink-0 hover:opacity-95 transition-opacity" title="bKash">
      <img src="/logos/bkash.png" alt="bKash" className="h-full w-auto object-contain max-h-6" />
    </div>
  );
}

function NagadLogo() {
  return (
    <div className="bg-white h-8 sm:h-9 px-2.5 py-1 rounded-lg flex items-center justify-center shadow-sm shrink-0 hover:opacity-95 transition-opacity" title="Nagad">
      <img src="/logos/nagad.png" alt="Nagad" className="h-full w-auto object-contain max-h-6" />
    </div>
  );
}

function RocketLogo() {
  return (
    <div className="bg-white h-8 sm:h-9 px-2.5 py-1 rounded-lg flex items-center justify-center shadow-sm shrink-0 hover:opacity-95 transition-opacity" title="Rocket">
      <img src="/logos/rocket.webp" alt="Rocket" className="h-full w-auto object-contain max-h-6" />
    </div>
  );
}

function BankTransferLogo() {
  return (
    <div className="flex items-center gap-2 h-8 sm:h-9 px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-white font-semibold text-xs tracking-tight shrink-0">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 7 10-5 10 5" stroke="#c8f049" />
        <path d="M12 2v20" stroke="rgba(255,255,255,0.4)" />
        <path d="M5 10v7" stroke="#ffffff" />
        <path d="M9 10v7" stroke="#ffffff" />
        <path d="M15 10v7" stroke="#ffffff" />
        <path d="M19 10v7" stroke="#ffffff" />
        <path d="M2 17h20" stroke="#c8f049" />
        <path d="M2 21h20" stroke="#ffffff" />
      </svg>
      <span>Bank Transfer</span>
    </div>
  );
}

function GoogleLensLogo() {
  return (
    <div className="flex items-center gap-2 h-8 sm:h-9 px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-white font-semibold text-xs tracking-tight shrink-0">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M6 3C4.34315 3 3 4.34315 3 6V9H5V6C5 5.44772 5.44772 5 6 5H9V3H6Z" fill="#4285F4" />
        <path d="M15 3V5H18C18.5523 5 19 5.44772 19 6V9H21V6C21 4.34315 19.6569 3 18 3H15Z" fill="#EA4335" />
        <path d="M21 15H19V18C19 18.5523 18.5523 19 18 19H15V21H18C19.6569 21 21 19.6569 21 18V15Z" fill="#FBBC04" />
        <path d="M9 21V19H6C5.44772 19 5 18.5523 5 18V15H3V18C3 19.6569 4.34315 21 6 21H9Z" fill="#34A853" />
        <circle cx="12" cy="12" r="3.5" stroke="#4285F4" strokeWidth="2" />
        <circle cx="16" cy="8" r="1.2" fill="#EA4335" />
      </svg>
      <span>Google Lens</span>
    </div>
  );
}

export default function Landing() {
  useSeo(homeSeo);

  const { user: authUser } = useAuth();
  const user = getStoredUser() || authUser;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fbfbf9] text-gray-900 font-sans selection:bg-[#c8f049] selection:text-black">
      {/* ─────────────────────────────────────────────
          1. HERO SECTION (FULL WIDTH WITH VIDEO BACKGROUND)
      ───────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden text-white border-b border-white/10 bg-[#111b15]">
        {/* Full-bleed ambient video background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <video
            src="/hero_video.mp4"
            autoPlay
            loop
            muted
            playsInline
            poster="/barcode_scanner_hero.jpg"
            className="w-full h-full object-cover object-center filter brightness-[0.42] contrast-[1.12] scale-105"
          />
          {/* Subtle gradient overlay to blend into dark forest green and ensure text readability */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 80% 30%, rgba(200, 240, 73, 0.14) 0%, transparent 60%),
                linear-gradient(to right, rgba(17, 27, 21, 0.94) 0%, rgba(17, 27, 21, 0.82) 50%, rgba(17, 27, 21, 0.7) 100%),
                linear-gradient(to bottom, rgba(17, 27, 21, 0.5) 0%, rgba(17, 27, 21, 0.95) 100%)
              `,
            }}
          />
        </div>

        {/* Ambient lime/cyan glows */}
        <div
          className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-20"
          style={{ background: '#a2e842' }}
        />
        <div
          className="absolute bottom-10 left-1/4 w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-15"
          style={{ background: '#38bdf8' }}
        />

        {/* ─── EMBEDDED TOP NAVBAR ─── */}
        <header className="relative z-30 border-b border-white/10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white group">
              <span className="text-[#c8f049] font-extrabold text-2xl leading-none">//</span>
              <span>BarcodeHub</span>
            </Link>

            {/* Floating Nav Pill (Centered) */}
            <nav className="hidden lg:flex items-center gap-1 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-sm text-gray-300">
              <a href="#" className="px-4 py-1.5 rounded-full text-white font-medium hover:text-white transition-colors">
                Home
              </a>
              <a href="#features" className="px-4 py-1.5 rounded-full hover:text-white transition-colors">
                Features
              </a>
              <a href="#benefits" className="px-4 py-1.5 rounded-full hover:text-white transition-colors">
                Benefits
              </a>
              <a href="#pricing" className="px-4 py-1.5 rounded-full hover:text-white transition-colors">
                Pricing
              </a>
              <Link to="/lookup" className="px-4 py-1.5 rounded-full hover:text-white transition-colors">
                Lookup
              </Link>
            </nav>

            {/* Right Action */}
            <div className="flex items-center gap-3">
              {user ? (
                <Link
                  to="/app"
                  className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-950 transition-transform active:scale-95"
                  style={{ backgroundColor: LIME }}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => start()}
                    className="hidden sm:inline-block text-sm text-gray-300 hover:text-white px-3 font-medium transition-colors"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => start()}
                    className="px-6 py-2.5 rounded-full text-sm font-bold text-gray-950 transition-all hover:brightness-105 active:scale-95 shadow-md shadow-lime-500/10"
                    style={{ backgroundColor: LIME }}
                  >
                    Sign up
                  </button>
                </>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg bg-white/10 text-white"
                aria-label="Toggle Navigation"
              >
                {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden relative z-40 px-6 pb-6 pt-2 bg-black/90 backdrop-blur-xl border-b border-white/10 flex flex-col gap-3 text-sm">
            <a href="#" onClick={() => setMobileMenuOpen(false)} className="py-2 text-white font-medium">Home</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-gray-300">Features</a>
            <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="py-2 text-gray-300">Benefits</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-gray-300">Pricing</a>
            <Link to="/lookup" onClick={() => setMobileMenuOpen(false)} className="py-2 text-gray-300">Lookup</Link>
          </div>
        )}

        {/* ─── HERO MAIN CONTENT ─── */}
        <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-10 pt-10 md:pt-16 lg:pt-20 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 max-w-2xl"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.4rem] font-bold tracking-tight text-white leading-[1.08] mb-6 drop-shadow-sm">
              Effortless Barcodes <br />
              <span className="text-white/95 font-normal">for Bangladeshi Brands</span>
            </h1>

            <p className="text-gray-200/90 text-base sm:text-lg leading-relaxed mb-8 max-w-xl font-normal drop-shadow-sm">
              Add your product once. Generate verified EAN-13, UPC, and QR barcodes, print label sheets, and publish a public page that appears when anyone searches or scans it.
            </p>

            {/* Lime CTA Button with Arrow Badge */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => start()}
                className="group flex items-center gap-3 pl-6 pr-2 py-2 rounded-full font-bold text-gray-950 text-sm sm:text-base transition-all hover:brightness-105 active:scale-95 shadow-lg shadow-lime-400/20"
                style={{ backgroundColor: LIME }}
              >
                <span>Get Started</span>
                <span className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="w-4 h-4 text-gray-950" />
                </span>
              </button>

              <Link
                to="/lookup"
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white/90 border border-white/20 bg-black/20 hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                <ScanBarcode className="w-4 h-4 text-[#c8f049]" />
                <span>Look up a barcode</span>
              </Link>
            </div>
          </motion.div>

          {/* Right Column (Live Verified Barcode & Product Glass Card) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="lg:col-span-5 relative flex justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-[440px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl text-white">
              {/* Card top badge */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-300">GS1 Verified Active</span>
                </div>
                <span className="text-[10px] font-mono font-semibold bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                  EAN-13
                </span>
              </div>

              {/* Product preview */}
              <div className="mb-4">
                <div className="text-lg font-bold text-white mb-0.5">Sylhet Reserve Black Tea 250g</div>
                <div className="text-xs text-gray-300">Square Consumer Products Ltd • Bangladesh</div>
              </div>

              {/* Realistic SVG Barcode Graphic */}
              <div className="bg-white rounded-2xl p-4 text-gray-950 mb-5 shadow-inner">
                <div className="flex items-end justify-center gap-0.5 h-16 mb-2 px-2">
                  {[3,1,4,2,1,3,2,1,4,2,3,1,2,4,1,3,2,4,1,2,3,1,4,2,3,1,2,4,3,1,2,1,3,4,2,1,3,2,4,1].map((h, i) => (
                    <div
                      key={i}
                      className="bg-gray-950 rounded-sm"
                      style={{
                        width: i % 4 === 0 ? '3px' : '1.5px',
                        height: `${h * 13}px`,
                      }}
                    />
                  ))}
                </div>
                <div className="text-center font-mono font-bold text-sm tracking-[0.25em] text-gray-900">
                  8 941100 511234
                </div>
              </div>

              {/* Status details grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-gray-400 text-[10px]">Google Lens Status</div>
                  <div className="text-white font-bold mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Indexed & Live
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-gray-400 text-[10px]">Packaging Format</div>
                  <div className="text-white font-bold mt-0.5">Vector SVG & Label</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ─── BOTTOM HERO STRIP ─── */}
        <div className="relative z-20 border-t border-white/10 bg-gradient-to-b from-transparent to-black/40">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold text-white leading-none">
                  GS1 Bangladesh Standard
                </div>
                <div className="text-xs text-gray-400 mt-1 max-w-sm leading-snug">
                  Official EAN-13 & UPC prefixes verified for retail POS checkouts and Google indexing.
                </div>
              </div>
            </div>

            <div className="flex flex-col md:items-end">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-gray-400 mb-2.5">
                Supported Integrations & Payment Methods
              </div>
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap opacity-95">
                <BkashLogo />
                <NagadLogo />
                <RocketLogo />
                <BankTransferLogo />
                <GoogleLensLogo />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          2. CORE CAPABILITIES BAR
      ───────────────────────────────────────────── */}
      <section className="py-12 md:py-16 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 md:divide-x md:divide-gray-200">
            <div className="md:px-8 first:pl-0 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight leading-none">
                EAN-13 & UPC
              </div>
              <div className="text-sm font-medium text-gray-500 mt-2">
                Retail & supermarket barcode generation
              </div>
            </div>

            <div className="md:px-8 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight leading-none">
                Google Indexed
              </div>
              <div className="text-sm font-medium text-gray-500 mt-2">
                Public pages structured for Google Lens & Search
              </div>
            </div>

            <div className="md:px-8 last:pr-0 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight leading-none">
                1-Click Export
              </div>
              <div className="text-sm font-medium text-gray-500 mt-2">
                Printable A4 label sheets, SVG & PNG formats
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          3. FEATURE SHOWCASE
      ───────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 bg-[#fbfbf9]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Text */}
          <div className="lg:col-span-5">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-950 tracking-tight leading-[1.15] mb-6">
              Smarter Barcodes <br />
              <span className="text-gray-700 font-bold">Better Brand Visibility</span>
            </h2>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-900 mt-2 shrink-0" />
                <p className="text-sm text-gray-600 leading-relaxed">
                  Generate official GS1-standard EAN-13 and UPC-A codes guaranteed to scan at checkout counters across Bangladesh and export destinations.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-900 mt-2 shrink-0" />
                <p className="text-sm text-gray-600 leading-relaxed">
                  Automatic public product landing pages formatted with JSON-LD schema so search engines index your brand and product specifications.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-900 mt-2 shrink-0" />
                <p className="text-sm text-gray-600 leading-relaxed">
                  Export packaging-ready vector SVG files or generate printable A4 sticker label sheets directly from your dashboard.
                </p>
              </div>
            </div>

            <button
              onClick={() => start()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-gray-950 transition-all hover:brightness-105 active:scale-95 shadow-sm"
              style={{ backgroundColor: LIME }}
            >
              <span>Explore Features</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Floating UI Cards Mockup */}
          <div className="lg:col-span-7 relative flex justify-center">
            <div className="w-full max-w-lg space-y-4">
              {/* Card A: Scans this month chart */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-lg relative max-w-sm ml-auto mr-4"
              >
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Scans tracked this month</span>
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+24% vs last month</span>
                </div>
                <div className="text-2xl font-extrabold text-gray-950 mb-3">
                  1,420 <span className="text-xs font-normal text-gray-400">verified scans</span>
                </div>

                <svg className="w-full h-16 overflow-visible" viewBox="0 0 200 60" fill="none">
                  <path
                    d="M 0 45 C 30 50, 50 15, 80 30 C 110 45, 130 10, 160 25 C 180 35, 190 20, 200 15"
                    stroke="#16231c"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="80" cy="30" r="4" fill="#c8f049" stroke="#16231c" strokeWidth="2" />
                </svg>
              </motion.div>

              {/* Card B: Available Products Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                  <span className="text-xs font-bold text-gray-900">Your Registered Products</span>
                  <Link to="/app" className="text-[11px] font-semibold text-gray-400 hover:text-gray-900">View in dashboard</Link>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-xs">
                        RT
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">Radhuni Turmeric Powder 200g</div>
                        <div className="text-[11px] font-mono text-gray-400">8941100511234 • EAN-13</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-900">Google Indexed</div>
                      <span className="inline-block text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Published</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-800 font-bold text-xs">
                        AC
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">ACI Fresh Ginger Paste 300g</div>
                        <div className="text-[11px] font-mono text-gray-400">8941100522341 • GS1 Verified</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-900">Labels Printed</div>
                      <span className="inline-block text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Published</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          4. BENEFITS CARDS
      ───────────────────────────────────────────── */}
      <section id="benefits" className="py-20 md:py-28 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-950 tracking-tight leading-tight mb-3">
              Simple, Fast & Reliable
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              Add your product details once, generate verified retail barcodes, and let Google do the discovery work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Card 1: Packaged goods showcase */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-[#f7f8f6] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-gray-200/70 shadow-sm"
            >
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-950 mb-2">
                  Sync your catalog and prefix securely.
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-6">
                  Enter your GS1 EAN-13 or UPC-A number (the check digit is added for you), or auto-generate EAN-13/UPC-A from your company prefix (internal-use numbers if you have none) and system Code128 codes. Download high-res vector files for any packaging size.
                </p>
              </div>

              <div className="relative pt-2 pb-2">
                <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-gray-200/80 shadow-md group">
                  <img
                    src="/barcode_products_showcase.jpg"
                    alt="Consumer products with retail barcodes"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md rounded-lg px-2.5 py-1 text-[10px] font-bold text-gray-900 border border-white/60 shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Sylhet Tea & Sundarbans Honey</span>
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 bg-[#111b15]/90 backdrop-blur-md rounded-lg px-2.5 py-1 text-[10px] font-mono text-[#c8f049] border border-white/10 shadow-sm">
                    EAN-13 • GS1 Active
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Scan channels */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-[#f7f8f6] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-gray-200/70 shadow-sm"
            >
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-950 mb-2">
                  Track scan channels and search visibility.
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-6">
                  Know how consumers discover your products—whether through Google Lens scans, direct web searches, or retail POS checks.
                </p>
              </div>

              <div className="space-y-2 py-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Google Lens</div>
                      <div className="text-[10px] text-gray-400">Direct camera scans</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">Active Index</div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                      <Globe className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Retail POS Checkouts</div>
                      <div className="text-[10px] text-gray-400">Standard laser scanners</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-full">EAN-13 Ready</div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-gray-900">QR Catalog Page</div>
                      <div className="text-[10px] text-gray-400">Consumer product profile</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-full">Live Page</div>
                </div>
              </div>
            </motion.div>

            {/* Card 3: Brand Setup */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-[#f7f8f6] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-gray-200/70 shadow-sm"
            >
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-950 mb-2">
                  Launch in under five minutes.
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-6">
                  Set up your brand profile, upload high-res product photos, and export printable label sheets with zero design software required.
                </p>
              </div>

              <div className="relative h-44 rounded-2xl bg-white border border-gray-200/80 p-4 overflow-hidden flex flex-col justify-between">
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #000 1.2px, transparent 1.2px)',
                    backgroundSize: '12px 12px',
                  }}
                />

                <div className="text-[11px] font-semibold text-gray-400 z-10">Export & Label Ready</div>

                <div className="self-end z-10 bg-[#16231c] text-white p-3.5 rounded-2xl shadow-xl border border-white/10 max-w-[200px]">
                  <div className="text-sm font-extrabold text-[#c8f049]">GS1 Bangladesh</div>
                  <div className="text-[11px] text-gray-300 font-medium leading-tight mt-0.5">
                    Official prefix validation and check digit calculation.
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-400">
                    <Check className="w-3 h-3" /> Ready for Retail Shelves
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          5. PRICING SECTION (MATCHING SCREENSHOT UI)
      ───────────────────────────────────────────── */}
      <section id="pricing" className="py-20 md:py-28 bg-[#e8e8ea] border-y border-gray-300/60">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-950 tracking-tight leading-tight mb-3">
              Simple, Transparent Pricing
            </h2>
            <p className="text-gray-600 text-sm sm:text-base">
              Choose the right plan for your brand. Pay easily via bKash, Nagad, Rocket, or Bank Transfer.
            </p>
          </div>

          <PricingCards />
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          7. DARK CTA BOX
      ───────────────────────────────────────────── */}
      <section className="py-12 md:py-20 px-6 sm:px-8 max-w-6xl mx-auto">
        <div
          className="rounded-3xl md:rounded-[2.5rem] p-10 sm:p-14 md:p-16 text-center text-white relative overflow-hidden shadow-2xl"
          style={{
            backgroundColor: DARK_HERO,
            backgroundImage: `
              radial-gradient(circle at 50% 0%, rgba(200, 240, 73, 0.15), transparent 70%),
              linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Take Control of Your <br />
            <span className="text-white/95">Barcodes Today!</span>
          </h2>

          <p className="text-sm sm:text-base text-gray-300/80 max-w-md mx-auto mb-8 font-normal">
            Generate retail-compliant barcodes, print label sheets, and get indexed on Google without technical hassle.
          </p>

          <button
            onClick={() => start()}
            className="px-8 py-3.5 rounded-full font-bold text-gray-950 text-sm sm:text-base transition-all hover:brightness-105 active:scale-95 shadow-xl shadow-lime-400/20"
            style={{ backgroundColor: LIME }}
          >
            Get Started Now
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          8. FAQ SECTION
      ───────────────────────────────────────────── */}
      <section id="faq" className="py-16 md:py-24 bg-[#fbfbf9] border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 sm:px-8">
          <h2 className="text-3xl font-extrabold text-gray-950 tracking-tight text-center mb-10">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {[
              [
                'Will my products show up on Google and Google Lens?',
                'Yes. Every barcode created in BarcodeHub automatically gets a dedicated, SEO-optimized public landing page formatted with JSON-LD product schema. Search engines scan this to index your product name, image, and barcode.',
              ],
              [
                'Do I need an official GS1 company prefix?',
                'If you intend to sell products in major retail supermarkets (e.g. Shwapno, Meena Bazar, Agora), an official GS1 Bangladesh company prefix is required. If you sell direct-to-consumer or online, our system Code128 and QR barcodes are immediately ready.',
              ],
              [
                'Can I download vector format barcodes for packaging?',
                'Yes. You can export high-resolution SVG, PNG, and print-ready A4 label sheets directly from your dashboard at any time.',
              ],
              [
                'Which payment methods are accepted in Bangladesh?',
                'We accept direct payments via bKash, Nagad, Rocket, as well as institutional bank transfers. Verification typically completes within minutes.',
              ],
            ].map(([q, a]) => (
              <AccordionItem key={q} value={q} className="bg-white border border-gray-200/80 rounded-2xl px-5">
                <AccordionTrigger className="text-left font-bold text-gray-900 text-sm sm:text-base py-4 hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-sm leading-relaxed pb-4">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          9. FOOTER
      ───────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <FuzzyCritterFooter
          wordmark="BarcodeHub"
          name="BarcodeHub"
          tagline="Barcodes, label sheets and Google-ready product pages for Bangladeshi brands."
          columns={FOOTER_COLUMNS}
          legal={[]}
          copyright={`© ${new Date().getFullYear()} BarcodeHub · Made in Bangladesh`}
        />
      </Suspense>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PRICING CARDS COMPONENT (1:1 ACCURATE TO REFERENCE DESIGN)
───────────────────────────────────────────── */
function PricingCards() {
  const [yearly, setYearly] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['packages'], queryFn: () => listPackages({}) });
  const rawPkgs = data?.packages ?? [];

  // Default tiers mirroring the screenshot's exact 3-tier hierarchy & content
  const fallbackTiers = [
    {
      id: 'tier-starter',
      badge: 'PREMIUM',
      price: 499,
      subtitle: 'For agile startups',
      features: [
        'Organization-wide collaboration',
        'Up to 50 active product barcodes',
        'GS1 EAN-13 & UPC barcode generator',
        'Download high-res PNG & vector SVG',
        'Public Google-friendly product page',
        'Printable A4 barcode label sheets',
        'Standard email & technical support',
      ],
      buttonText: 'Get Premium',
      isCenter: false,
    },
    {
      id: 'tier-pro',
      badge: 'PRO',
      price: 999,
      subtitle: 'For rapidly scaling businesses',
      features: [
        'Unlimited external collaborators',
        'Up to 500 active product barcodes',
        'Automatic EAN-13 & UPC-A check digits',
        'Auto schema markup for Google Lens',
        'Live scan analytics & view tracking',
        'Custom brand profile page',
        'Batch print label studio (A4 & thermal)',
        'Data loss protection & exports',
        'Priority verification & phone support',
        'Password policy & role enforcement',
      ],
      buttonText: 'Get Pro',
      isCenter: true,
    },
    {
      id: 'tier-ultra',
      badge: 'ULTRA',
      price: 1999,
      subtitle: 'For large organizations',
      features: [
        'Unlimited external collaborators',
        'Unlimited active product barcodes',
        'EAN-13, UPC-A & Code128 barcodes',
        'Automated Google indexing priority',
        'Multi-user role & access controls',
        'Custom packaging metadata & labels',
        'Full REST API & webhook integration',
        'Data loss protection',
        'Dedicated account manager in BD',
      ],
      buttonText: 'Get Ultra',
      isCenter: false,
    },
  ];

  // If backend packages exist, blend them into the 3-tier visual template
  const cards = fallbackTiers.map((tier, idx) => {
    const backendPkg = rawPkgs[idx];
    if (!backendPkg) return tier;

    // Defensively split on literal '\n', escaped newlines '\\n', or actual newlines
    const rawFeats = backendPkg.features ?? [];
    const featArray = (Array.isArray(rawFeats) ? rawFeats : [rawFeats])
      .flatMap((f: any) =>
        typeof f === 'string'
          ? f.replace(/\\n/g, '\n').replace(/\r/g, '').split('\n')
          : []
      )
      .map((s: string) => s.trim())
      .filter(Boolean);

    return {
      ...tier,
      id: backendPkg.id ?? tier.id,
      badge: backendPkg.name ? backendPkg.name.toUpperCase() : tier.badge,
      price: yearly ? (backendPkg.yearlyPrice ?? tier.price * 10) : (backendPkg.monthlyPrice ?? tier.price),
      features: featArray.length > 0 ? featArray : tier.features,
      buttonText: `Get ${backendPkg.name ?? tier.badge}`,
    };
  });

  // The real best yearly discount from the packages, not a fixed claim.
  const bestSaving = Math.max(0, ...rawPkgs.map(yearlySaving));

  return (
    <div>
      <div className="flex justify-center mb-12">
        <BillingToggle yearly={yearly} onChange={setYearly} yearlyBadge={bestSaving > 0 ? `−${bestSaving}%` : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-center max-w-5xl mx-auto">
        {cards.map((card) => (
          <PackageCard
            key={card.id}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            badge={card.badge}
            price={formatTk(card.price)}
            unit={yearly ? '/year' : '/month'}
            subtitle={card.subtitle}
            features={card.features}
            featured={card.isCenter}
            action={{ label: card.buttonText, onClick: () => start(card.id.startsWith("tier-") ? undefined : card.id) }}
          />
        ))}
      </div>
    </div>
  );
}
