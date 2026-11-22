import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Sparkles, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { adminListPackages, adminSavePackage, adminDeletePackage } from '@/lib/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { PageHeader } from '../components/Shell';
import { formatTk } from '../lib/config';
import { errMsg } from '../lib/errors';

type P = { id?: string; name: string; monthlyPrice: number; yearlyPrice: number; productLimit: number; features: string; analyticsEnabled: boolean; isActive: boolean; sortOrder: number };
const blank: P = { name: '', monthlyPrice: 0, yearlyPrice: 0, productLimit: 10, features: '', analyticsEnabled: false, isActive: true, sortOrder: 10 };

export default function AdminPackages() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-packages'], queryFn: async () => (await adminListPackages({})).packages as P[] });
  const [edit, setEdit] = useState<P | null>(null);
  const [deleting, setDeleting] = useState<P | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof P>(k: K, v: P[K]) => setEdit((e) => (e ? { ...e, [k]: v } : e));
  const num = (k: 'monthlyPrice' | 'yearlyPrice' | 'productLimit' | 'sortOrder', l: string) => (
    <div><Label>{l}</Label><Input type="number" min={0} className="mt-1.5" value={edit?.[k] ?? 0} onChange={(e) => set(k, Number(e.target.value))} /></div>
  );

  const save = async () => {
    if (!edit?.name.trim()) return toast.error('Name is required');
    setBusy(true);
    try {
      await adminSavePackage(edit);
      toast.success('Package saved');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['admin-packages'] });
      qc.invalidateQueries({ queryKey: ['packages'] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting?.id) return;
    setBusy(true);
    try {
      await adminDeletePackage({ id: deleting.id });
      toast.success('Package deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['admin-packages'] });
      qc.invalidateQueries({ queryKey: ['packages'] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const freePkg = data?.find((p) => Number(p.monthlyPrice) <= 0);
  const freeTrialActive = Boolean(freePkg?.isActive);

  const toggleFreeTrial = async () => {
    if (!freePkg) {
      setEdit({
        name: 'Free Starter',
        monthlyPrice: 0,
        yearlyPrice: 0,
        productLimit: 5,
        features: 'Up to 5 products\nSystem Code128 barcodes\nPublic product verification page',
        analyticsEnabled: false,
        isActive: true,
        sortOrder: 1,
      });
      return;
    }
    setBusy(true);
    try {
      await adminSavePackage({ ...freePkg, isActive: !freeTrialActive });
      toast.success(freeTrialActive ? 'Free trial disabled' : 'Free trial enabled');
      qc.invalidateQueries({ queryKey: ['admin-packages'] });
      qc.invalidateQueries({ queryKey: ['packages'] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Packages & Pricing"
        sub="Control subscription plans, pricing, and free trial access for your SaaS."
        actions={
          <Button onClick={() => setEdit({ ...blank })}>
            <Plus className="w-4 h-4" />New package
          </Button>
        }
      />

      {/* Free Trial Policy Card */}
      <div className="mb-6 p-5 bg-card border border-border rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${freeTrialActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
            {freeTrialActive ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Free Trial / Starter Mode</span>
              <Badge variant={freeTrialActive ? 'default' : 'secondary'} className="text-[11px]">
                {freeTrialActive ? 'Free Trial Active' : 'No Free Trial (Pay First)'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              {freeTrialActive
                ? 'New users get assigned the Free Starter package upon signup. They can create limited products without paying.'
                : 'Free trial is disabled. New users must select a paid plan and submit payment before they can create or publish products.'}
            </p>
          </div>
        </div>

        <Button
          variant={freeTrialActive ? 'destructive' : 'default'}
          size="sm"
          onClick={toggleFreeTrial}
          disabled={busy || isLoading}
          className="rounded-xl text-xs h-9 shrink-0 gap-1.5"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {freeTrialActive ? 'Disable Free Trial' : 'Enable Free Trial'}
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        {data?.map((p) => {
          const isFree = Number(p.monthlyPrice) <= 0;
          return (
            <div key={p.id} className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-lg flex items-center gap-2">
                    {p.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEdit(p)} title="Edit package">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(p)}
                      title="Delete package"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-semibold text-primary mt-1">
                  {isFree ? 'Free (৳0)' : `${formatTk(p.monthlyPrice)}/mo · ${formatTk(p.yearlyPrice)}/yr`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {p.productLimit ? `${p.productLimit} products` : 'Unlimited products'}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
                <Badge variant={p.isActive ? 'default' : 'secondary'}>
                  {p.isActive ? 'Active' : 'Hidden'}
                </Badge>
                {isFree && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10">
                    Trial Package
                  </Badge>
                )}
                {p.analyticsEnabled && <Badge variant="outline">Analytics</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / New Package Dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? 'Edit package' : 'New package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input className="mt-1.5" value={edit?.name ?? ''} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {num('monthlyPrice', 'Monthly price (৳)')}
              {num('yearlyPrice', 'Yearly price (৳)')}
              {num('productLimit', 'Product limit (0 = unltd)')}
              {num('sortOrder', 'Sort order')}
            </div>
            <div>
              <Label>Features (one per line)</Label>
              <Textarea className="mt-1.5" rows={4} value={edit?.features ?? ''} onChange={(e) => set('features', e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Analytics charts</Label>
              <Switch checked={edit?.analyticsEnabled} onCheckedChange={(v) => set('analyticsEnabled', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active (shown on pricing & available to users)</Label>
              <Switch checked={edit?.isActive} onCheckedChange={(v) => set('isActive', v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete package</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the <strong>{deleting?.name}</strong> package?
              If any tenants are currently assigned to this package, deletion will be rejected for safety.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

