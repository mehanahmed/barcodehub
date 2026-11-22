import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Printer, Search, MoreHorizontal, ArrowUpDown, Pencil, ExternalLink, Download, Copy, Trash2, Package } from 'lucide-react';
import { listMyProducts, deleteProduct } from '@/lib/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { PageHeader } from '../components/Shell';
import BarcodeSvg, { downloadBarcodePng } from '../components/BarcodeSvg';
import { useAccount } from '../hooks/useAccount';
import { errMsg } from '../lib/errors';

type Row = { id: string; title: string; barcodeNumber: string; barcodeType: string; status: string; category: string; image: string | null; views: number; updatedAt: string };
type SortKey = 'title' | 'barcodeNumber' | 'status' | 'views' | 'updatedAt';
const PAGE = 15;

export default function Products() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: acc } = useAccount();
  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: async () => (await listMyProducts({})).products as Row[] });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: 'updatedAt', asc: false });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [del, setDel] = useState<Row | null>(null);

  const all = data ?? [];
  const cats = useMemo(() => [...new Set(all.map((p) => p.category).filter(Boolean))].sort(), [all]);
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    const f = all.filter((p) => (!s || p.title.toLowerCase().includes(s) || p.barcodeNumber.toLowerCase().includes(s))
      && (status === 'all' || p.status === status) && (cat === 'all' || p.category === cat));
    return f.sort((a, b) => {
      const x = a[sort.k], y = b[sort.k];
      const c = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
      return sort.asc ? c : -c;
    });
  }, [all, q, status, cat, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const blocked = acc?.expired || acc?.atLimit;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const head = (k: SortKey, label: string) => (
    <button className="flex items-center gap-1 font-semibold" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))}>{label}<ArrowUpDown className="w-3 h-3" /></button>
  );
  const remove = async () => {
    if (!del) return;
    const id = del.id;
    setDel(null);
    qc.setQueryData<Row[]>(['products'], (old) => old?.filter((p) => p.id !== id));
    try { await deleteProduct({ id }); toast.success('Product deleted'); qc.invalidateQueries({ queryKey: ['account'] }); }
    catch (e) { toast.error(errMsg(e)); qc.invalidateQueries({ queryKey: ['products'] }); }
  };

  return (
    <>
      <PageHeader title="Products" sub={`${all.length} total`} actions={<>
        <Button variant="outline" disabled={!sel.size} onClick={() => navigate(`/app/labels?ids=${[...sel].join(',')}`)}><Printer className="w-4 h-4" />Print labels{sel.size ? ` (${sel.size})` : ''}</Button>
        <Button disabled={blocked} onClick={() => navigate('/app/products/new')}><Plus className="w-4 h-4" />New product</Button>
      </>} />
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search title or barcode…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}><SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Status: All</SelectItem><SelectItem value="Published">Published</SelectItem><SelectItem value="Draft">Draft</SelectItem></SelectContent></Select>
        <Select value={cat} onValueChange={(v) => { setCat(v); setPage(0); }}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Category: All</SelectItem>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-10"><Checkbox checked={view.length > 0 && view.every((r) => sel.has(r.id))} onCheckedChange={(c) => setSel((s) => { const n = new Set(s); view.forEach((r) => (c ? n.add(r.id) : n.delete(r.id))); return n; })} /></TableHead>
            <TableHead className="w-14" /><TableHead>{head('title', 'Title')}</TableHead><TableHead>{head('barcodeNumber', 'Barcode')}</TableHead>
            <TableHead>{head('status', 'Status')}</TableHead><TableHead>{head('views', 'Views')}</TableHead><TableHead className="w-10" />
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && [0, 1, 2].map((i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10" /></TableCell></TableRow>)}
            {!isLoading && !view.length && <TableRow><TableCell colSpan={7} className="text-center py-14 text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-2" />{all.length ? 'No matching products.' : 'No products yet — add your first one.'}</TableCell></TableRow>}
            {view.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/app/products/${r.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                <TableCell>{r.image ? <img src={r.image} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-muted" />}</TableCell>
                <TableCell className="font-medium">{r.title}<div className="text-xs text-muted-foreground">{r.category}</div></TableCell>
                <TableCell className="font-mono text-sm"><BarcodeSvg value={r.barcodeNumber} type={r.barcodeType} height={36} width={1.2} className="h-14 w-auto max-w-[180px]" /></TableCell>
                <TableCell><Badge variant={r.status === 'Published' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                <TableCell>{r.views.toLocaleString()}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to={`/app/products/${r.id}`}><Pencil className="w-4 h-4" />Edit</Link></DropdownMenuItem>
                      <DropdownMenuItem disabled={r.status !== 'Published'} onClick={() => window.open(`/barcode/${encodeURIComponent(r.barcodeNumber)}`, '_blank')}><ExternalLink className="w-4 h-4" />View public page</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadBarcodePng(r.barcodeNumber, r.barcodeType)}><Download className="w-4 h-4" />Download barcode</DropdownMenuItem>
                      <DropdownMenuItem disabled={blocked} onClick={() => navigate(`/app/products/new?from=${r.id}`)}><Copy className="w-4 h-4" />Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDel(r)}><Trash2 className="w-4 h-4" />Delete</DropdownMenuItem>
                    </DropdownMenuContent></DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex justify-between items-center text-sm text-muted-foreground">
        <span>{view.length} of {rows.length}</span>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
          <span>{page + 1} / {pages}</span><Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>
      </div>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete “{del?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>Its public page at /barcode/{del?.barcodeNumber} will stop working. This can't be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
