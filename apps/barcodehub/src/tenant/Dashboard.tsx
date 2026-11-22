import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Plus,
  Package,
  Globe,
  TrendingUp,
  QrCode,
  Printer,
  ExternalLink,
  Sparkles,
  ArrowUpRight,
  Barcode,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/authClient';
import { getAnalytics } from '@/lib/api';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Progress } from '@project/components/ui/progress';
import { Badge } from '@project/components/ui/badge';
import { PageHeader, Stat } from '../components/Shell';
import { useAccount } from '../hooks/useAccount';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: acc } = useAccount();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 30],
    queryFn: async () => (await getAnalytics({ days: 30 })).analytics,
  });

  const limit = acc?.package?.productLimit ?? 0;
  const count = acc?.productCount ?? 0;
  const blocked = acc?.expired || acc?.atLimit;
  const percentUsed = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const brandSlug = acc?.tenant?.slug;

  const topMaxViews = data?.top?.length
    ? Math.max(...data.top.map((t: any) => t.views || 1))
    : 1;

  return (
    <div className="space-y-6">
      {/* ─── MODERN HERO HEADER ─── */}
      <PageHeader
        title={`Welcome back, ${user?.firstName || user?.name || 'there'}`}
        sub={acc?.tenant?.companyName ? `Managing catalog for ${acc.tenant.companyName}` : undefined}
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Catalog Active
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {brandSlug && (
              <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl text-xs h-9">
                <Link to={`/brand/${brandSlug}`} target="_blank">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Storefront
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl text-xs h-9">
              <Link to="/app/labels">
                <Printer className="w-3.5 h-3.5" />
                Print Labels
              </Link>
            </Button>
            <Button asChild disabled={blocked} size="sm" className="gap-1.5 rounded-xl text-xs h-9 shadow-sm">
              <Link to={blocked ? '/app/subscription' : '/app/products/new'}>
                <Plus className="w-4 h-4" />
                {blocked ? 'Upgrade to add' : 'New product'}
              </Link>
            </Button>
          </div>
        }
      />

      {/* ─── PLAN USAGE BANNER CARD ─── */}
      <div className="p-5 bg-card border border-border/80 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground">
                {acc?.package?.name ?? 'Free'} Plan
              </span>
              <Badge variant={acc?.expired ? 'destructive' : 'secondary'} className="text-[11px] px-2 py-0.5">
                {acc?.expired ? 'Expired' : 'Active'}
              </Badge>
              {acc?.tenant?.subscriptionEnds && !acc.package?.isFree && (
                <span className="text-xs text-muted-foreground">
                  · {acc.expired ? 'Expired on' : 'Renews'}{' '}
                  {format(new Date(acc.tenant.subscriptionEnds), 'd MMM yyyy')}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {count} of {limit > 0 ? limit : 'unlimited'} product barcodes generated ({100 - percentUsed}% remaining)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end">
          {limit > 0 && (
            <div className="flex flex-col gap-1 w-36">
              <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                <span>Quota used</span>
                <span>{percentUsed}%</span>
              </div>
              <Progress value={percentUsed} className="h-2 rounded-full" />
            </div>
          )}
          <Button variant="outline" size="sm" asChild className="rounded-xl text-xs h-8">
            <Link to="/app/subscription">
              {acc?.package?.isFree ? 'Upgrade plan' : 'Manage subscription'}
            </Link>
          </Button>
        </div>
      </div>

      {/* ─── 4 MODERN METRICS CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !data ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <Stat
              label="Products"
              value={data.products}
              hint="Catalog items in system"
              icon={Package}
              trend={{ value: `${data.products} registered` }}
            />
            <Stat
              label="Published"
              value={data.published}
              hint="Publicly accessible on web"
              icon={Globe}
              trend={{ value: 'Google Lens Ready' }}
            />
            <Stat
              label="Views (30d)"
              value={data.total.toLocaleString()}
              hint="Total customer impressions"
              icon={TrendingUp}
              trend={{ value: 'Active traffic' }}
            />
            <Stat
              label="QR Scans (30d)"
              value={data.qr.toLocaleString()}
              hint="In-store & mobile scans"
              icon={QrCode}
              trend={{ value: 'POS & labels' }}
            />
          </>
        )}
      </div>

      {/* ─── QUICK WORKFLOW SHORTCUTS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Link
          to="/app/products/new"
          className="group p-4 bg-card hover:bg-card/90 border border-border/80 hover:border-primary/40 rounded-2xl shadow-sm flex items-center gap-3.5 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary group-hover:scale-105 flex items-center justify-center transition-transform">
            <Barcode className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
              Create New Barcode
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </h4>
            <p className="text-xs text-muted-foreground truncate mt-0.5">Generate EAN-13, UPC, or QR codes</p>
          </div>
        </Link>

        <Link
          to="/app/labels"
          className="group p-4 bg-card hover:bg-card/90 border border-border/80 hover:border-primary/40 rounded-2xl shadow-sm flex items-center gap-3.5 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary group-hover:scale-105 flex items-center justify-center transition-transform">
            <Printer className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
              Print Label Sheets
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </h4>
            <p className="text-xs text-muted-foreground truncate mt-0.5">Format A4 & thermal label grids</p>
          </div>
        </Link>

        <Link
          to="/app/analytics"
          className="group p-4 bg-card hover:bg-card/90 border border-border/80 hover:border-primary/40 rounded-2xl shadow-sm flex items-center gap-3.5 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary group-hover:scale-105 flex items-center justify-center transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
              Scan & View Analytics
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </h4>
            <p className="text-xs text-muted-foreground truncate mt-0.5">Inspect device & scan geographies</p>
          </div>
        </Link>
      </div>

      {/* ─── TOP PERFORMING PRODUCTS ─── */}
      <div className="p-6 bg-card border border-border/80 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-foreground">Top Scanned Products</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Leading items by scan and page view volume</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs h-8">
            <Link to="/app/products">View all products →</Link>
          </Button>
        </div>

        {data?.top?.length ? (
          <div className="space-y-3">
            {data.top.map((t: any, index: number) => {
              const relativeWidth = Math.max(8, Math.round(((t.views || 0) / topMaxViews) * 100));
              return (
                <div
                  key={t.barcodeNumber}
                  className="group p-3 hover:bg-muted/40 rounded-xl border border-transparent hover:border-border transition-all flex items-center gap-4"
                >
                  <span className="w-6 text-xs font-bold text-muted-foreground text-center">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <Link
                        to={`/barcode/${t.barcodeNumber}`}
                        target="_blank"
                        className="text-sm font-semibold text-foreground hover:text-primary flex items-center gap-1.5 truncate"
                      >
                        <span className="truncate">{t.title}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                      <span className="text-xs font-semibold text-foreground shrink-0">
                        {t.views.toLocaleString()} views
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {t.barcodeNumber}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${relativeWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 px-4 border border-dashed border-border/80 rounded-xl bg-muted/20">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <Package className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-sm text-foreground">No views recorded yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              Publish your first product to generate verified barcodes and start receiving verified scans.
            </p>
            <Button size="sm" asChild className="rounded-xl text-xs gap-1.5">
              <Link to="/app/products/new">
                <Plus className="w-4 h-4" />
                Add your first product
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
