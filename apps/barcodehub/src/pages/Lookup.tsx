import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, PackageSearch, ExternalLink } from 'lucide-react';
import { searchProducts, lookupOpenFoodFacts } from '@/lib/api';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import PublicHeader, { PublicFooter } from '../components/PublicHeader';
import { useSeo } from '../lib/seo';
import { lookupSeo } from '../lib/seoData';

export default function Lookup() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const navigate = useNavigate();
  useSeo(lookupSeo(q));

  const { data, isFetching } = useQuery({ queryKey: ['search', q], queryFn: () => searchProducts({ q }), enabled: q.length >= 2 });
  const results = data?.results ?? [];
  // Not in BarcodeHub: fall back to Open Food Facts for real GTINs (the server skips internal-use numbers).
  const code = q.trim();
  const { data: off, isFetching: offLoading } = useQuery({
    queryKey: ['off', code],
    queryFn: () => lookupOpenFoodFacts({ barcode: code }),
    enabled: !!data && results.length === 0 && /^\d{12,13}$/.test(code),
    staleTime: Infinity,
  });
  const offProduct = off?.product;

  useEffect(() => {
    const exact = results.find((r: any) => r.barcodeNumber === q.trim().toUpperCase());
    if (exact) navigate(`/barcode/${encodeURIComponent(exact.barcodeNumber)}?src=lookup`, { replace: true });
  }, [results, q, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold">Barcode lookup</h1>
        <p className="text-muted-foreground mt-2">Type a barcode number or product name.</p>
        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); setParams(text.trim() ? { q: text.trim() } : {}); }}>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="8941100511234" className="pl-9 h-12 font-mono" autoFocus />
          </div>
          <Button type="submit" size="lg" className="h-12">Search</Button>
        </form>
        <div className="mt-8 space-y-3">
          {isFetching && [0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          {offLoading && <Skeleton className="h-20 rounded-lg" />}
          {!isFetching && !offLoading && offProduct && (
            <a href={offProduct.url} target="_blank" rel="noopener noreferrer" className="p-4 border border-border rounded-lg flex items-center gap-4 bg-card hover:border-primary transition-colors">
              {offProduct.image ? <img src={offProduct.image} alt={offProduct.name} className="w-14 h-14 object-contain rounded bg-white" /> : <div className="w-14 h-14 bg-muted rounded" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{offProduct.name}{offProduct.quantity && <span className="font-normal text-muted-foreground"> · {offProduct.quantity}</span>}</div>
                <div className="text-sm text-muted-foreground font-mono truncate">{offProduct.barcode}{offProduct.brand && ` · ${offProduct.brand}`}</div>
                <div className="text-xs text-muted-foreground mt-1">Not on BarcodeHub. Data from Open Food Facts (ODbL).</div>
              </div>
              <ExternalLink className="w-5 h-5 text-muted-foreground" />
            </a>
          )}
          {!isFetching && !offLoading && !offProduct && q.length >= 2 && results.length === 0 && (
            <div className="text-center py-14 text-muted-foreground"><PackageSearch className="w-10 h-10 mx-auto mb-3" />No products found for “{q}”.</div>
          )}
          {!isFetching && results.map((r: any) => (
            <Link key={r.id} to={`/barcode/${encodeURIComponent(r.barcodeNumber)}?src=lookup`} className="p-4 border border-border rounded-lg flex items-center gap-4 bg-card hover:border-primary transition-colors">
              {r.image ? <img src={r.image} alt={r.title} className="w-14 h-14 object-cover rounded" /> : <div className="w-14 h-14 bg-muted rounded" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.title}</div>
                <div className="text-sm text-muted-foreground font-mono">{r.barcodeNumber} · {r.brand}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
