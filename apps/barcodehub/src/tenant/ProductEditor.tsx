import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChevronLeft, Loader2, Upload, X, Wand2, ExternalLink } from 'lucide-react';
import { useLocalUpload } from '@/hooks/useLocalUpload';
import { getMyProduct, saveProduct, suggestBarcode, type SaveProductInputType } from '@/lib/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import BarcodeSvg, { downloadPng, downloadSvg } from '../components/BarcodeSvg';
import QrCode from '../components/QrCode';
import { BARCODE_TYPES, validateBarcode, withCheckDigit, type BarcodeType } from '../lib/barcode';
import { errMsg } from '../lib/errors';

type Form = Omit<SaveProductInputType, 'mrp' | 'id'> & { mrp: string };
const empty: Form = { title: '', barcodeNumber: '', barcodeType: 'EAN-13', description: '', brand: '', manufacturer: '', category: '', netWeight: '', countryOfOrigin: 'Bangladesh', ingredients: '', certifications: '', mrp: '', images: [], status: 'Draft' };
const schema = z.object({ title: z.string().trim().min(2, 'Title is required'), mrp: z.string().regex(/^\d*(\.\d+)?$/, 'Enter a number') });

const fields: [keyof Form, string, string][] = [
  ['brand', 'Brand', 'Radhuni'], ['manufacturer', 'Manufacturer', 'Square Food & Beverage Ltd.'], ['category', 'Category', 'Spices'],
  ['netWeight', 'Net weight', '200 gm'], ['countryOfOrigin', 'Country of origin', 'Bangladesh'], ['mrp', 'MRP (৳)', '85'],
];

export default function ProductEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { upload, isUploading } = useLocalUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const svgWrap = useRef<HTMLDivElement>(null);
  const [f, setF] = useState<Form>(empty);
  const [loading, setLoading] = useState(!!(id || from));
  const [saving, setSaving] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const suggest = async (type: BarcodeType, quiet = false) => {
    setSuggesting(true);
    try { set('barcodeNumber', (await suggestBarcode({ type })).barcode); }
    catch (e) { if (!quiet) toast.error(errMsg(e)); }
    finally { setSuggesting(false); }
  };

  useEffect(() => {
    const src = id || from;
    if (!src) { suggest('EAN-13', true).then(() => {}); return; }
    getMyProduct({ id: src }).then(({ product }) => {
      const p = product as unknown as Omit<Form, 'mrp'> & { mrp: number | null };
      const base: Form = { ...p, mrp: p.mrp == null ? '' : String(p.mrp) };
      if (from) { setF({ ...base, title: `${p.title} (copy)`, barcodeNumber: '', status: 'Draft' }); suggest(p.barcodeType as BarcodeType, true); }
      else setF(base);
    }).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, from]);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all([...files].map(async (file) => (await upload(file)).url));
      setF((x) => ({ ...x, images: [...x.images, ...urls] }));
    } catch { toast.error('Image upload failed'); }
  };

  const save = async (status: 'Draft' | 'Published') => {
    const errs: Record<string, string> = {};
    const r = schema.safeParse(f);
    if (!r.success) r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    const barcode = withCheckDigit(f.barcodeType, f.barcodeNumber);
    const be = validateBarcode(f.barcodeType, barcode);
    if (be) errs.barcodeNumber = be;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('Please fix the highlighted fields');
    set('barcodeNumber', barcode);
    setSaving(status);
    try {
      const res = await saveProduct({ ...f, id: id || undefined, status, barcodeNumber: barcode, mrp: f.mrp ? Number(f.mrp) : null });
      toast.success(status === 'Published' ? 'Published — page is live' : 'Draft saved');
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['account'] });
      if (!id) navigate(`/app/products/${res.id}`, { replace: true });
      else set('status', status);
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(null); }
  };

  if (loading) return <Skeleton className="h-[600px] rounded-xl" />;
  // What will be saved: the typed number, plus the check digit when it was left off.
  const fullBarcode = withCheckDigit(f.barcodeType, f.barcodeNumber);
  const barcodeErr = f.barcodeNumber ? validateBarcode(f.barcodeType, fullBarcode) : null;
  const addedCheckDigit = !barcodeErr && fullBarcode !== f.barcodeNumber.trim().toUpperCase() ? fullBarcode.slice(-1) : null;
  // Same GS1 restricted-circulation ranges the wand uses (server/nextBarcode.ts INTERNAL_RANGES).
  const isInternal = (f.barcodeType === 'EAN-13' && fullBarcode.startsWith('200')) || (f.barcodeType === 'UPC-A' && fullBarcode.startsWith('4'));
  const svg = () => svgWrap.current?.querySelector('svg') as SVGSVGElement | null;

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <Link to="/app/products" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground"><ChevronLeft className="w-4 h-4" />Products</Link>
        <div className="flex gap-2">
          {id && f.status === 'Published' && <Button variant="ghost" asChild><a href={`/barcode/${f.barcodeNumber}`} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" />View page</a></Button>}
          <Button variant="outline" disabled={!!saving} onClick={() => save('Draft')}>{saving === 'Draft' && <Loader2 className="w-4 h-4 animate-spin" />}{f.status === 'Published' && id ? 'Unpublish' : 'Save draft'}</Button>
          <Button disabled={!!saving} onClick={() => save('Published')}>{saving === 'Published' && <Loader2 className="w-4 h-4 animate-spin" />}{f.status === 'Published' && id ? 'Save' : 'Publish'}</Button>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5 bg-card border border-border rounded-xl p-5">
          <div><Label>Images</Label>
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
              {f.images.map((u) => (
                <div key={u} className="relative aspect-square group"><img src={u} alt="" className="w-full h-full object-cover rounded-lg border border-border" />
                  <button onClick={() => set('images', f.images.filter((x) => x !== u))} className="absolute top-1 right-1 bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button></div>
              ))}
              <button onClick={() => fileRef.current?.click()} disabled={isUploading} className="aspect-square border-2 border-dashed border-border rounded-lg grid place-items-center text-muted-foreground hover:border-primary">
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}</button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">The first image shows on Google and the product page. Clear front-of-pack photos help Google Lens match it.</p></div>
          <div><Label>Title</Label><Input className="mt-1.5" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Radhuni Haleem Mix (200 gm)" />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}</div>
          <div><Label>Description</Label><Textarea className="mt-1.5" rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Ready spice mix for traditional haleem…" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map(([k, l, ph]) => (
              <div key={k}><Label>{l}</Label><Input className="mt-1.5" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} placeholder={ph} />
                {errors[k] && <p className="text-xs text-destructive mt-1">{errors[k]}</p>}</div>
            ))}
          </div>
          <div><Label>Certifications</Label><Input className="mt-1.5" value={f.certifications} onChange={(e) => set('certifications', e.target.value)} placeholder="BSTI, Halal" /></div>
          <div><Label>Ingredients</Label><Textarea className="mt-1.5" rows={3} value={f.ingredients} onChange={(e) => set('ingredients', e.target.value)} placeholder="Coriander, cumin, chili, turmeric…" /></div>
        </div>
        <div className="space-y-4 bg-card border border-border rounded-xl p-5 h-fit lg:sticky lg:top-6">
          <div className="font-bold">Barcode</div>
          <div className="flex bg-muted rounded-lg p-1 text-xs">
            {BARCODE_TYPES.map((t) => (
              <button key={t} onClick={() => { set('barcodeType', t); if (!id) suggest(t, true); }} className={`flex-1 py-1.5 rounded-md ${f.barcodeType === t ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'}`}>{t === 'System Code128' ? 'System' : t}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input className="font-mono" value={f.barcodeNumber} onChange={(e) => set('barcodeNumber', e.target.value.toUpperCase())} onBlur={() => { if (addedCheckDigit) set('barcodeNumber', fullBarcode); }} placeholder={f.barcodeType === 'System Code128' ? 'BH-RAD-000001' : f.barcodeType === 'UPC-A' ? '03600029145' : '894110051123'} />
            <Button variant="outline" size="icon" title="Auto-generate next number" aria-label="Auto-generate next number" disabled={suggesting} onClick={() => suggest(f.barcodeType as BarcodeType)}>
              {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}</Button>
          </div>
          {(errors.barcodeNumber || barcodeErr) && <p className="text-xs text-destructive">{barcodeErr || errors.barcodeNumber}</p>}
          {addedCheckDigit && <p className="text-xs font-medium">Check digit {addedCheckDigit} added: <span className="font-mono">{fullBarcode}</span></p>}
          {f.barcodeType !== 'System Code128' && (
            <p className="text-xs text-muted-foreground">
              Type a number from your own GS1 licence (all {f.barcodeType === 'UPC-A' ? 12 : 13} digits, or the first {f.barcodeType === 'UPC-A' ? 11 : 12} and the check digit is added), or use the wand: it numbers from your company prefix in Settings, or gives an internal-use number if none is set.
            </p>
          )}
          {isInternal && !barcodeErr && (
            <p className="text-xs rounded-md bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1.5">
              Internal-use number (starts with {f.barcodeType === 'UPC-A' ? '4' : '200'}): it belongs to no other brand and works on BarcodeHub and in your own shop, but supermarkets need a GS1-licensed barcode.
            </p>
          )}
          <div ref={svgWrap} className="bg-white rounded-lg border border-border p-2 grid place-items-center min-h-24">
            {f.barcodeNumber && !barcodeErr ? <BarcodeSvg value={fullBarcode} type={f.barcodeType} className="max-w-full" /> : <span className="text-xs text-muted-foreground">Preview</span>}
          </div>
          {f.barcodeNumber && !barcodeErr && (
            <>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { const s = svg(); if (s) downloadPng(s, fullBarcode); }}>PNG</Button>
                <Button variant="outline" className="flex-1" onClick={() => { const s = svg(); if (s) downloadSvg(s, fullBarcode); }}>SVG</Button>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-border"><QrCode barcode={fullBarcode} size={88} />
                <p className="text-xs text-muted-foreground">QR opens the public product page. Right-click to save.</p></div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
