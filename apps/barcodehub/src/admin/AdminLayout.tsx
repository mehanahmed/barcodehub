import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LayoutDashboard, Building2, Wallet, Package, ShieldCheck, Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { adminManageAdmins, adminOverview } from '@/lib/api';
import { logout } from '../lib/auth';
import { Button } from '@project/components/ui/button';
import Shell from '../components/Shell';
import { useAccount } from '../hooks/useAccount';
import { errMsg } from '../lib/errors';

function NotAdmin({ canClaim }: { canClaim: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const claim = async () => {
    setBusy(true);
    try { await adminManageAdmins({ action: 'claim' }); toast.success('You are now the admin'); await qc.invalidateQueries({ queryKey: ['account'] }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div className="max-w-sm">
        <ShieldAlert className="w-10 h-10 mx-auto text-accent" />
        <h1 className="text-2xl font-bold mt-3">{canClaim ? 'Set up the admin account' : 'Admin access only'}</h1>
        <p className="text-muted-foreground mt-2">{canClaim ? 'No admin exists yet. Claim it now to manage tenants, payments and packages.' : 'This account does not have admin access.'}</p>
        <div className="mt-6 flex gap-2 justify-center">
          <Button variant="outline" asChild><Link to="/"><ArrowLeft className="w-4 h-4" />Home</Link></Button>
          {!canClaim && <Button onClick={() => logout('/admin/login')}>Use another account</Button>}
          {canClaim && <Button onClick={claim} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Make me admin</Button>}
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { data, isLoading, error } = useAccount();
  const location = useLocation();

  useEffect(() => {
    if (error) {
      const msg = (error as Error)?.message || '';
      if (msg.includes('401') || msg.includes('UNAUTHORIZED') || msg.includes('API call failed')) {
        const redirectUrl = encodeURIComponent(location.pathname + location.search);
        logout(`/admin/login?redirectUrl=${redirectUrl}`);
      }
    }
  }, [error, location]);

  const { data: ov } = useQuery({ queryKey: ['admin-overview'], queryFn: async () => (await adminOverview({})).overview, enabled: !!data?.isAdmin });

  if (isLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-4">
        <div>
          <h1 className="text-xl font-bold">Session Expired</h1>
          <p className="text-muted-foreground mt-2">Please sign in to access the admin panel.</p>
          <Button className="mt-4" onClick={() => logout('/admin/login')}>Sign in</Button>
        </div>
      </div>
    );
  }

  if (!data.isAdmin) return <NotAdmin canClaim={data.noAdminsYet} />;
  const nav = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
    { to: '/admin/payments', label: 'Payments', icon: Wallet, badge: ov?.pendingPayments },
    { to: '/admin/packages', label: 'Packages', icon: Package },
    { to: '/admin/admins', label: 'Admins', icon: ShieldCheck },
  ];
  return (
    <Shell title="BarcodeHub Admin" nav={nav} signOutTo="/admin/login"
      footer={<Link to="/app" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60"><ArrowLeft className="w-4 h-4" />Tenant dashboard</Link>}>
      <div className="w-full p-4 md:p-6"><Outlet /></div>
    </Shell>
  );
}
