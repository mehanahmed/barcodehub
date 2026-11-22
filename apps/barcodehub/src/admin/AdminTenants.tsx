import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import { adminListTenants, adminListPackages, adminUpdateTenant } from '@/lib/api';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { DatePicker } from '@project/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { PageHeader } from '../components/Shell';
import { errMsg } from '../lib/errors';

type T = { id: string; companyName: string; slug: string; status: string; subscriptionEnds: string | null; ownerEmail: string; packageId: string | null; packageName: string; products: number };

function EditSheet({ t, onClose, packages }: { t: T | null; onClose: () => void; packages: any[] }) {
  const qc = useQueryClient();
  const [pkg, setPkg] = useState<string | undefined>();
  const [ends, setEnds] = useState<Date | undefined>();
  const [status, setStatus] = useState<'Active' | 'Suspended'>('Active');
  const [busy, setBusy] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (t && loadedId !== t.id) {
    setLoadedId(t.id); setPkg(t.packageId ?? undefined); setEnds(t.subscriptionEnds ? new Date(t.subscriptionEnds + 'T00:00:00') : undefined);
    setStatus(t.status === 'Suspended' ? 'Suspended' : 'Active');
  }
  const save = async () => {
    if (!t) return;
    setBusy(true);
    try {
      await adminUpdateTenant({ id: t.id, packageId: pkg ?? null, subscriptionEnds: ends ? format(ends, 'yyyy-MM-dd') : null, status });
      toast.success('Tenant updated'); qc.invalidateQueries({ queryKey: ['admin-tenants'] }); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!t} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>{t?.companyName}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5 text-sm">
          <div className="text-muted-foreground">{t?.ownerEmail}<br />{t?.products} products · <a className="underline" href={`/brand/${t?.slug}`} target="_blank" rel="noreferrer">/brand/{t?.slug} <ExternalLink className="inline w-3 h-3" /></a></div>
          <div><Label>Package</Label><Select value={pkg} onValueChange={setPkg}><SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Subscription ends</Label><div className="mt-1.5"><DatePicker value={ends} onChange={setEnds} /></div></div>
          <div><Label>Status</Label><Select value={status} onValueChange={(v) => setStatus(v as 'Active' | 'Suspended')}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Suspended">Suspended</SelectItem></SelectContent></Select>
            <p className="text-xs text-muted-foreground mt-1">Suspended tenants can't sign in and their public pages are hidden.</p></div>
          <Button className="w-full" onClick={save} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Save changes</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminTenants() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-tenants'], queryFn: async () => (await adminListTenants({})).tenants as T[] });
  const { data: pk } = useQuery({ queryKey: ['admin-packages'], queryFn: async () => (await adminListPackages({})).packages });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [pkg, setPkg] = useState('all');
  const [edit, setEdit] = useState<T | null>(null);
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (data ?? []).filter((t) => {
    const s = q.toLowerCase();
    return (!s || t.companyName.toLowerCase().includes(s) || t.ownerEmail.toLowerCase().includes(s))
      && (status === 'all' || t.status === status) && (pkg === 'all' || t.packageId === pkg);
  }), [data, q, status, pkg]);
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const view = rows.slice(page * 20, page * 20 + 20);
  return (
    <>
      <PageHeader title="Tenants" sub={`${data?.length ?? 0} companies`} />
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search company or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}><SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Status: All</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Suspended">Suspended</SelectItem></SelectContent></Select>
        <Select value={pkg} onValueChange={(v) => { setPkg(v); setPage(0); }}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Package: All</SelectItem>{(pk ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Package</TableHead><TableHead>Products</TableHead><TableHead>Ends</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5}><Skeleton className="h-10" /></TableCell></TableRow>}
            {!isLoading && !view.length && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No tenants found.</TableCell></TableRow>}
            {view.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setEdit(t)}>
                <TableCell><div className="font-medium">{t.companyName}</div><div className="text-xs text-muted-foreground">{t.ownerEmail}</div></TableCell>
                <TableCell>{t.packageName}</TableCell><TableCell>{t.products}</TableCell>
                <TableCell>{t.subscriptionEnds ? format(new Date(t.subscriptionEnds), 'd MMM yyyy') : '—'}</TableCell>
                <TableCell><Badge variant={t.status === 'Suspended' ? 'destructive' : 'default'}>{t.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex justify-end items-center gap-2 text-sm text-muted-foreground">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button><span>{page + 1} / {pages}</span>
        <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
      <EditSheet t={edit} onClose={() => setEdit(null)} packages={pk ?? []} />
    </>
  );
}
