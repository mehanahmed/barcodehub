import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { updateTenant } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader } from '../components/Shell';
import ImageUpload from '../components/ImageUpload';
import { useAccount } from '../hooks/useAccount';
import { errMsg } from '../lib/errors';

export default function Settings() {
  const qc = useQueryClient();
  const { data } = useAccount();
  const t = data?.tenant;
  const [f, setF] = useState({ companyName: '', slug: '', gs1CompanyPrefix: '', website: '', phone: '', address: '', logoUrl: null as string | null });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (t) setF({ companyName: t.companyName, slug: t.slug, gs1CompanyPrefix: t.gs1CompanyPrefix, website: t.website, phone: t.phone, address: t.address, logoUrl: t.logo }); }, [t]);
  const set = (k: keyof typeof f, v: string | null) => setF((x) => ({ ...x, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.companyName.trim().length < 2) er.companyName = 'Company name is required';
    if (!/^[a-z0-9-]{3,40}$/.test(f.slug)) er.slug = '3–40 lowercase letters, digits or dashes';
    if (!/^\d{0,11}$/.test(f.gs1CompanyPrefix)) er.gs1CompanyPrefix = 'Digits only, at most 11';
    if (f.website && !/^https?:\/\//.test(f.website)) er.website = 'Start with https://';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { await updateTenant(f); toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['account'] }); }
    catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  const field = (k: 'companyName' | 'website' | 'phone', label: string, ph: string) => (
    <div><Label>{label}</Label><Input className="mt-1.5" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} />
      {err[k] && <p className="text-xs text-destructive mt-1">{err[k]}</p>}</div>
  );

  return (
    <>
      <PageHeader title="Company settings" sub="Shown on your public product and brand pages." />
      <form onSubmit={save} className="max-w-2xl p-6 bg-card border border-border rounded-xl space-y-5">
        <ImageUpload value={f.logoUrl} onChange={(u) => set('logoUrl', u)} />
        {field('companyName', 'Company name', 'Radhuni')}
        <div><Label>Public URL slug</Label>
          <div className="flex mt-1.5 text-sm"><span className="px-3 h-10 grid place-items-center bg-muted border border-r-0 border-input rounded-l-md text-muted-foreground">/brand/</span>
            <Input className="rounded-l-none" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} /></div>
          {err.slug && <p className="text-xs text-destructive mt-1">{err.slug}</p>}</div>
        <div><Label htmlFor="gs1-prefix">Company prefix</Label>
          <Input id="gs1-prefix" className="mt-1.5 font-mono" inputMode="numeric" maxLength={11} placeholder="8941100"
            value={f.gs1CompanyPrefix} onChange={(e) => set('gs1CompanyPrefix', e.target.value.replace(/\D/g, ''))} />
          {err.gs1CompanyPrefix && <p className="text-xs text-destructive mt-1">{err.gs1CompanyPrefix}</p>}</div>
        <div className="grid sm:grid-cols-2 gap-4">{field('website', 'Website', 'https://radhuni.com')}{field('phone', 'Phone', '+880…')}</div>
        <div><Label>Address</Label><Textarea className="mt-1.5" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
        <Button type="submit" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
      </form>
    </>
  );
}
