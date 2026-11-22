import { Fragment, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, PackageX } from 'lucide-react';
import { getPublicProduct } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import PublicHeader, { PublicFooter } from '../components/PublicHeader';
import BarcodeSvg from '../components/BarcodeSvg';
import { useSeo } from '../lib/seo';
import { productSeo, productNotFoundSeo, type PublicProduct } from '../lib/seoData';
import { formatTk } from '../lib/config';

function detectSource(src: string | null): 'Search' | 'Direct' | 'QR Scan' | 'Lookup' {
  if (src === 'qr') return 'QR Scan';
  if (src === 'lookup') return 'Lookup';
  if (/google\.|bing\.|yahoo\.|duckduckgo\./i.test(document.referrer)) return 'Search';
  return 'Direct';
}

export default function ProductPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const [source] = useState(() => {
    const key = `viewed:${number}`;
    if (sessionStorage.getItem(key)) return undefined;
    sessionStorage.setItem(key, '1');
    return detectSource(params.get('src'));
  });
  const { data, isLoading } = useQuery({
    queryKey: ['public-product', number],
    queryFn: () => getPublicProduct({ barcode: number, source }),
    staleTime: Infinity,
  });
  const p = data?.product as PublicProduct | null | undefined;
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [number]);

  // Same builder the server uses for the raw HTML, so crawlers and browsers see identical tags.
  useSeo(p ? productSeo(p) : isLoading ? { ...productNotFoundSeo(number), noindex: false } : productNotFoundSeo(number));

  const specs: [string, string][] = p ? ([
    ['Brand', p.brand], ['Manufacturer', p.manufacturer], ['Category', p.category], ['Net weight', p.netWeight],
    ['Country of origin', p.countryOfOrigin], ['Certifications', p.certifications], ['MRP', p.mrp ? formatTk(p.mrp) : ''],
  ] as [string, string][]).filter(([, v]) => v) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-10"><Skeleton className="aspect-square rounded-xl" /><div className="space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div></div>
        ) : !p ? (
          <div className="text-center py-24">
            <PackageX className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="text-2xl font-bold mt-4">No product found for barcode <span className="font-mono">{number}</span></h1>
            <Button className="mt-6" asChild><Link to={`/lookup?q=${encodeURIComponent(number)}`}>Search again</Link></Button>
          </div>
        ) : (
          <>
            <nav className="text-sm text-muted-foreground flex items-center gap-1 mb-6 flex-wrap">
              <Link to="/">BarcodeHub</Link><ChevronRight className="w-3 h-3" />
              <Link to={`/brand/${p.tenant.slug}`}>{p.tenant.name}</Link><ChevronRight className="w-3 h-3" />
              <span className="text-foreground">{p.title}</span>
            </nav>
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                {p.images.length ? <img src={p.images[active]} alt={`${p.title} — barcode ${p.barcodeNumber}`} className="w-full aspect-square object-contain bg-card border border-border rounded-xl" />
                  : <div className="w-full aspect-square bg-muted rounded-xl" />}
                {p.images.length > 1 && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {p.images.map((u: string, i: number) => (
                      <button key={u} onClick={() => setActive(i)} className={`aspect-square rounded-md overflow-hidden border-2 ${i === active ? 'border-primary' : 'border-transparent'}`}>
                        <img src={u} alt={`${p.title} photo ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Link to={`/brand/${p.tenant.slug}`} className="text-sm text-muted-foreground flex items-center gap-2">
                  {p.tenant.logo && <img src={p.tenant.logo} alt={p.tenant.name} className="w-6 h-6 rounded object-cover" />}
                  {p.brand || p.tenant.name}{p.manufacturer && ` · ${p.manufacturer}`}
                </Link>
                <h1 className="text-3xl md:text-4xl font-extrabold mt-2 leading-tight">{p.title}</h1>
                <div className="mt-5 p-4 border border-border rounded-xl bg-card flex items-center justify-center">
                  <BarcodeSvg value={p.barcodeNumber} type={p.barcodeType} height={60} className="max-w-full" />
                </div>
                {p.description && <p className="mt-5 text-muted-foreground whitespace-pre-line leading-relaxed">{p.description}</p>}
                <dl className="mt-6 grid grid-cols-2 gap-y-2.5 text-sm border-t border-border pt-5">
                  {specs.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></Fragment>))}
                </dl>
                {p.ingredients && <div className="mt-6 text-sm"><span className="font-semibold">Ingredients: </span><span className="text-muted-foreground">{p.ingredients}</span></div>}
              </div>
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
