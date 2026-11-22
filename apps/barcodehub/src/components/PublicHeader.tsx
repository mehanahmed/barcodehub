import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanBarcode, Menu, X } from 'lucide-react';
import { useAuth, loginWithRedirect } from '@/lib/authClient';
import { Button } from '@project/components/ui/button';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="grid place-items-center w-8 h-8 rounded-md bg-foreground text-background">
        <ScanBarcode className="w-4 h-4" />
      </span>
      BarcodeHub
    </Link>
  );
}

export default function PublicHeader() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/40">
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
        <Logo />

        {/* Desktop nav — centered */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground absolute left-1/2 -translate-x-1/2">
          <a href="/#features" className="hover:text-foreground transition-colors relative group">
            Features
            <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
          </a>
          <a href="/#pricing" className="hover:text-foreground transition-colors relative group">
            Pricing
            <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
          </a>
          <Link to="/lookup" className="hover:text-foreground transition-colors relative group">
            Lookup
            <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
          </Link>
          <a href="/#faq" className="hover:text-foreground transition-colors relative group">
            FAQ
            <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
          </a>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <Button size="sm" asChild><Link to="/app">Dashboard</Link></Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => loginWithRedirect({ redirectUrl: '/app' })}>
                Sign in
              </Button>
              <Button
                size="sm"
                className="rounded-full px-4 bg-foreground text-background hover:bg-foreground/85 hidden sm:inline-flex"
                onClick={() => loginWithRedirect({ redirectUrl: '/app' })}
              >
                Get started
              </Button>
            </>
          )}
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background px-5 py-4 flex flex-col gap-3 text-sm">
          <a href="/#features" className="text-muted-foreground hover:text-foreground py-1" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="/#pricing" className="text-muted-foreground hover:text-foreground py-1" onClick={() => setMobileOpen(false)}>Pricing</a>
          <Link to="/lookup" className="text-muted-foreground hover:text-foreground py-1" onClick={() => setMobileOpen(false)}>Lookup</Link>
          <a href="/#faq" className="text-muted-foreground hover:text-foreground py-1" onClick={() => setMobileOpen(false)}>FAQ</a>
          <div className="pt-2 flex gap-2">
            {user ? (
              <Button size="sm" asChild className="w-full"><Link to="/app">Dashboard</Link></Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => loginWithRedirect({ redirectUrl: '/app' })}>Sign in</Button>
                <Button size="sm" className="flex-1 bg-foreground text-background hover:bg-foreground/85" onClick={() => loginWithRedirect({ redirectUrl: '/app' })}>Get started</Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border/40 mt-24">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row gap-6 justify-between text-sm text-muted-foreground">
        <Logo className="text-foreground" />
        <div className="flex gap-6 flex-wrap">
          <Link to="/lookup" className="hover:text-foreground transition-colors">Barcode lookup</Link>
          <a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="/#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </div>
        <span>© {new Date().getFullYear()} BarcodeHub · Made in Bangladesh</span>
      </div>
      {/* Required credit for the Open Food Facts data and photos shown on barcode pages (ODbL / CC BY-SA). */}
      <p className="max-w-6xl mx-auto px-5 md:px-8 pb-6 text-[7px] text-muted-foreground/50">
        Some product data and photos from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="hover:underline">Open Food Facts</a> contributors, under ODbL and CC BY-SA.
      </p>
    </footer>
  );
}


