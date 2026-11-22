import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createTenant } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Logo } from '../components/PublicHeader';
import ImageUpload from '../components/ImageUpload';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export default function Onboarding() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Enter your company name.');
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return setError('URL slug must be 3–40 lowercase letters, digits or dashes.');
    setSaving(true);
    try {
      await createTenant({ companyName: name, slug, logoUrl: logo ?? undefined });
      await qc.invalidateQueries({ queryKey: ['account'] });
      toast.success('Company created');
    } catch (err: any) {
      setError(err?.userFacingMessage ?? err?.message ?? 'Could not create company');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-muted/50">
      <form onSubmit={submit} className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm space-y-5">
        <Logo />
        <div><h1 className="text-2xl font-extrabold">Set up your company</h1><p className="text-sm text-muted-foreground mt-1">Set up your brand profile and start generating barcodes.</p></div>
        <div className="space-y-2"><Label>Company / brand name</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} placeholder="Radhuni" /></div>
        <div className="space-y-2"><Label>Public URL</Label>
          <div className="flex items-center text-sm"><span className="px-3 h-10 grid place-items-center bg-muted border border-r-0 border-input rounded-l-md text-muted-foreground">/brand/</span>
            <Input className="rounded-l-none" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} placeholder="radhuni" /></div></div>
        <div className="space-y-2"><Label>Logo (optional)</Label><ImageUpload value={logo} onChange={setLogo} label="Upload logo" /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create company</Button>
      </form>
    </div>
  );
}
