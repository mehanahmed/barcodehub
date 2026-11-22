import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, BarChart3, CreditCard, Settings, User, Shield, Loader2, Ban } from 'lucide-react';
import { logout } from '../lib/auth';
import { Button } from '@project/components/ui/button';
import Shell, { type NavItem } from '../components/Shell';
import { useAccount } from '../hooks/useAccount';
import Onboarding from './Onboarding';

const nav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/products', label: 'Products', icon: Package },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/profile', label: 'Profile', icon: User },
];

export default function TenantLayout() {
  const { data, isLoading, error } = useAccount();
  const location = useLocation();

  useEffect(() => {
    if (error) {
      const msg = (error as Error)?.message || '';
      if (msg.includes('401') || msg.includes('UNAUTHORIZED') || msg.includes('API call failed')) {
        const redirectUrl = encodeURIComponent(location.pathname + location.search);
        logout(`/login?redirectUrl=${redirectUrl}`);
      }
    }
  }, [error, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-4">
        <div>
          <h1 className="text-xl font-bold">Session Expired</h1>
          <p className="text-muted-foreground mt-2">Please sign in to access your dashboard.</p>
          <Button className="mt-4" onClick={() => logout('/login')}>Sign in</Button>
        </div>
      </div>
    );
  }
  if (!data.tenant) return <Onboarding />;
  if (data.tenant.status === 'Suspended') {
    return (
      <div className="min-h-screen grid place-items-center text-center px-4">
        <div><Ban className="w-10 h-10 mx-auto text-destructive" /><h1 className="text-2xl font-bold mt-3">Account suspended</h1>
          <p className="text-muted-foreground mt-2">Please contact BarcodeHub support to restore access.</p>
          <Button variant="outline" className="mt-6" onClick={() => logout()}>Sign out</Button></div>
      </div>
    );
  }
  return (
    <Shell title={data.tenant.companyName} logo={data.tenant.logo} nav={nav}
      footer={data.isAdmin ? <Link to="/admin" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60"><Shield className="w-4 h-4" />Admin panel</Link> : null}>
      {data.expired && (
        <div className="no-print bg-amber-500/15 border-b border-amber-500/25 text-amber-900 dark:text-amber-200 px-6 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2">
          <span>
            {data.package
              ? `Your ${data.package.name} subscription has expired. New product creation is blocked until renewed.`
              : 'You do not have an active subscription package. Please subscribe to a plan to start creating product barcodes.'}
          </span>
          <Link to="/app/subscription" className="font-bold underline text-primary hover:opacity-80">
            {data.package ? 'Renew subscription' : 'Choose a package'}
          </Link>
        </div>
      )}
      <div className="w-full p-4 md:p-6"><Outlet /></div>
    </Shell>
  );
}
