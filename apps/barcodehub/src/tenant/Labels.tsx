import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Printer } from 'lucide-react';
import { listMyProducts } from '@/lib/api';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import BarcodeSvg from '../components/BarcodeSvg';

export default function Labels() {
  const [params] = useSearchParams();
  const ids = new Set((params.get('ids') ?? '').split(',').filter(Boolean));
  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: async () => (await listMyProducts({})).products });
  const items = (data ?? []).filter((p: any) => ids.has(p.id));
  return (
    <>
      <div className="no-print flex justify-between items-center mb-6">
        <Link to="/app/products" className="text-sm text-muted-foreground flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Products</Link>
        <Button onClick={() => window.print()} disabled={!items.length}><Printer className="w-4 h-4" />Print A4 sheet</Button>
      </div>
      {isLoading ? <Skeleton className="h-96" /> : (
        <div className="bg-white text-black mx-auto grid grid-cols-3 gap-3 p-4 max-w-[210mm] border border-border print:border-0">
          {items.map((p: any) => (
            <div key={p.id} className="border border-dashed border-gray-300 rounded p-2 text-center break-inside-avoid">
              <div className="text-[11px] font-semibold truncate">{p.title}</div>
              <BarcodeSvg value={p.barcodeNumber} type={p.barcodeType} height={45} width={1.4} className="w-full h-auto" />
              {(p.netWeight || p.mrp) && <div className="text-[10px]">{[p.netWeight, p.mrp ? `MRP ৳${p.mrp}` : ''].filter(Boolean).join(' · ')}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
