import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, Phone, MapPin } from 'lucide-react';
import { getBrand } from '@/lib/api';
import { Skeleton } from '@project/components/ui/skeleton';
import PublicHeader, { PublicFooter } from '../components/PublicHeader';
import { useSeo } from '../lib/seo';
import { brandSeo, brandNotFoundSeo, type PublicBrand } from '../lib/seoData';

export default function BrandPage() {
  const { slug = '' } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['brand', slug], queryFn: () => getBrand({ slug }) });
  const b = data?.brand;
  useSeo(b ? brandSeo(b as PublicBrand, slug) : isLoading ? { ...brandNotFoundSeo(slug), title: 'Brand | BarcodeHub', noindex: false } : brandNotFoundSeo(slug));
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-10">
        {isLoading ? <Skeleton className="h-32 rounded-xl" /> : !b ? (
          <div className="text-center py-24 text-muted-foreground">Brand not found.</div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center gap-5 p-6 bg-card border border-border rounded-xl">
              {b.logo ? <img src={b.logo} alt={b.name} className="w-20 h-20 rounded-lg object-cover" /> : <div className="w-20 h-20 rounded-lg bg-secondary grid place-items-center text-2xl font-bold text-primary">{b.name[0]}</div>}
              <div>
                <h1 className="text-3xl font-extrabold">{b.name}</h1>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {b.website && <a href={b.website} target="_blank" rel="noreferrer" className="flex items-center gap-1"><Globe className="w-4 h-4" />{b.website.replace(/^https?:\/\//, '')}</a>}
                  {b.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{b.phone}</span>}
                  {b.address && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{b.address}</span>}
                </div>
              </div>
            </div>
            <h2 className="text-xl font-bold mt-10 mb-4">{b.products.length} products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {b.products.map((p: any) => (
                <Link key={p.id} to={`/barcode/${encodeURIComponent(p.barcodeNumber)}`} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary transition-colors">
                  {p.image ? <img src={p.image} alt={p.title} className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-muted" />}
                  <div className="p-3"><div className="font-semibold text-sm line-clamp-2">{p.title}</div><div className="text-xs font-mono text-muted-foreground mt-1">{p.barcodeNumber}</div></div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
