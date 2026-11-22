import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Building2, Check, Clock, Loader2 } from 'lucide-react';
import { listPackages, listMyPayments, submitPayment } from '@/lib/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { PageHeader } from '../components/Shell';
import { useAccount } from '../hooks/useAccount';
import { PAYMENT_ACCOUNTS, PAYMENT_METHODS, formatTk } from '../lib/config';
import { errMsg } from '../lib/errors';
import { BillingToggle, PackageCard, yearlySaving } from '../components/PackageCard';
import { cn } from '@project/components/lib/utils';

type Period = 'Monthly' | 'Yearly';
type Method = (typeof PAYMENT_METHODS)[number];
type Pkg = { id: string; name: string; monthlyPrice: number; yearlyPrice: number; productLimit: number; features: string[]; analyticsEnabled: boolean };

const METHOD_LOGO: Partial<Record<Method, string>> = { bKash: '/logos/bkash.png', Nagad: '/logos/nagad.png', Rocket: '/logos/rocket.webp' };
const statusVariant = (s: string) => (s === 'Approved' ? 'default' : s === 'Rejected' ? 'destructive' : 'secondary') as 'default' | 'destructive' | 'secondary';
/** Whole-percent saving of paying yearly instead of 12 monthly payments (0 when there is none). */

export default function Subscription() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const { data: acc } = useAccount();
  const { data: pk, isLoading: pkgsLoading } = useQuery({ queryKey: ['packages'], queryFn: () => listPackages({}) });
  const { data: pays, isLoading: paysLoading } = useQuery({ queryKey: ['my-payments'], queryFn: async () => (await listMyPayments({})).payments });
  const packages = (pk?.packages ?? []) as Pkg[];
  const [pkgId, setPkgId] = useState('');
  const [period, setPeriod] = useState<Period>('Monthly');
  const [method, setMethod] = useState<Method>('bKash');
  const [sender, setSender] = useState('');
  const [txn, setTxn] = useState('');
  const [busy, setBusy] = useState(false);
  const checkoutRef = useRef<HTMLFormElement>(null);

  // Preselect the plan from the pricing page (?package=…), else the current paid plan.
  useEffect(() => {
    if (pkgId || !packages.length) return;
    const want = params.get('package') ?? acc?.package?.id;
    const match = packages.find((p) => p.id === want && p.monthlyPrice > 0);
    if (match) setPkgId(match.id);
  }, [packages, pkgId, params, acc]);

  const sel = packages.find((p) => p.id === pkgId);
  const amount = sel ? (period === 'Yearly' ? sel.yearlyPrice : sel.monthlyPrice) : 0;
  const pendingPay = (pays ?? []).find((p: any) => p.status === 'Pending');
  const bestSaving = Math.max(0, ...packages.map(yearlySaving));
  const currentId = acc?.package?.id;
  const ends = acc?.tenant?.subscriptionEnds;

  const choose = (id: string) => {
    setPkgId(id);
    // Bring the checkout into view on narrow screens, where it sits below the cards.
    requestAnimationFrame(() => {
      const el = checkoutRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Only when it is off screen (stacked layout); beside the cards it is already in view.
      if (r.top > window.innerHeight - 120 || r.bottom < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel) return toast.error('Choose a package first');
    if (sender.trim().length < 5 || txn.trim().length < 4) return toast.error('Enter the sender number and transaction ID');
    setBusy(true);
    try {
      await submitPayment({ packageId: sel.id, billingPeriod: period, method, senderNumber: sender, transactionId: txn });
      toast.success('Payment submitted. We will verify it shortly.');
      setSender('');
      setTxn('');
      qc.invalidateQueries({ queryKey: ['my-payments'] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Subscription" />

      {/* Current plan */}
      <div className="p-5 bg-card border border-border rounded-xl flex justify-between items-center gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Current plan</div>
          <div className="font-bold text-lg">{acc?.package?.name ?? 'No package'}</div>
          <div className="text-sm text-muted-foreground">
            {acc?.package?.isFree ? 'Free forever' : ends ? `${acc?.expired ? 'Expired' : 'Active until'} ${format(new Date(ends), 'd MMM yyyy')}` : 'Not active'}
            {acc?.package && ` · ${acc.productCount} of ${acc.package.productLimit || '∞'} products used`}
          </div>
        </div>
        <Badge variant={acc?.expired ? 'destructive' : 'default'}>{acc?.expired ? 'Expired' : 'Active'}</Badge>
      </div>

      {/* Wide screens (1600px+): cards on the left, checkout and history in a sticky column on the right.
          Narrower: everything stacks. */}
      <div className="mt-8 grid gap-8 min-[1600px]:grid-cols-[minmax(0,1fr)_400px] min-[1600px]:items-start">
      <div>
      {/* Package picker */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Choose a package</h2>
          <p className="text-sm text-muted-foreground">Upgrade, or renew your current plan to extend it.</p>
        </div>
        <BillingToggle yearly={period === 'Yearly'} onChange={(y) => setPeriod(y ? 'Yearly' : 'Monthly')} yearlyBadge={bestSaving > 0 ? `−${bestSaving}%` : undefined} />
      </div>

      {/* Same cards as the landing page pricing section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
        {pkgsLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-[2rem]" />)}
        {packages.map((p, i) => {
          const free = p.monthlyPrice <= 0;
          const isCurrent = p.id === currentId;
          const isSelected = p.id === pkgId;
          const saving = yearlySaving(p);
          const limit = p.productLimit > 0 ? `Up to ${p.productLimit} products` : 'Unlimited products';
          return (
            <PackageCard
              key={p.id}
              badge={p.name}
              tag={isCurrent ? 'Current plan' : undefined}
              price={free ? 'Free' : formatTk(period === 'Yearly' ? p.yearlyPrice : p.monthlyPrice)}
              unit={free ? undefined : period === 'Yearly' ? '/year' : '/month'}
              subtitle={!free && period === 'Yearly' && saving > 0 ? `${limit} · save ${saving}%` : limit}
              features={p.features.filter((f) => !/^up to \d+ products$/i.test(f))}
              featured={packages.length >= 3 && i === 1}
              selected={isSelected}
              uniform
              action={
                free
                  ? { label: isCurrent ? 'Your plan' : 'Free plan', disabled: true }
                  : {
                      label: isSelected ? <><Check className="w-4 h-4" />Selected</> : isCurrent ? 'Renew' : `Get ${p.name}`,
                      onClick: () => choose(p.id),
                      pressed: isSelected,
                    }
              }
            />
          );
        })}
      </div>

      </div>

      {/* Checkout + history */}
      <div className="grid lg:grid-cols-5 gap-6 items-start min-[1600px]:grid-cols-1 min-[1600px]:sticky min-[1600px]:top-6">
        <form ref={checkoutRef} onSubmit={submit} className="lg:col-span-3 min-[1600px]:col-span-1 p-5 bg-card border border-border rounded-xl space-y-5 scroll-mt-20 md:scroll-mt-6">
          <div className="font-bold text-lg">Checkout</div>

          {pendingPay ? (
            <div className="flex gap-3 p-4 rounded-lg bg-secondary text-secondary-foreground text-sm">
              <Clock className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Payment waiting for review</div>
                <div className="mt-0.5">{pendingPay.packageName} · {pendingPay.billingPeriod} · {formatTk(pendingPay.amount)} · {pendingPay.method} · <span className="font-mono">{pendingPay.transactionId}</span></div>
                <div className="mt-1 text-muted-foreground">You can submit another payment once this one is approved or rejected.</div>
              </div>
            </div>
          ) : !sel ? (
            <p className="text-sm text-muted-foreground">Choose a paid package above to continue.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border">
                <div>
                  <div className="font-semibold">{sel.name} · {period}</div>
                  <div className="text-sm text-muted-foreground">{sel.id === currentId && !acc?.expired ? 'Added on to your current end date' : 'Starts when the payment is approved'}</div>
                </div>
                <div className="text-xl font-extrabold">{formatTk(amount)}</div>
              </div>

              <div>
                <Label id="method-label">Payment method</Label>
                <div role="radiogroup" aria-labelledby="method-label" className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 min-[1600px]:grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                      className={cn('h-14 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        method === m ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted')}>
                      {/* The logo already shows the name, so it doubles as the button's label */}
                      {METHOD_LOGO[m] ? <img src={METHOD_LOGO[m]} alt={m} className="h-7 w-auto object-contain" /> : <><Building2 className="w-5 h-5" /><span>{m}</span></>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-secondary text-secondary-foreground text-sm">
                <div className="font-semibold">1. Send {formatTk(amount)} by {method}</div>
                <div className="mt-1">To <b className="font-mono">{PAYMENT_ACCOUNTS[method]}</b></div>
                <div className="mt-2 font-semibold">2. Enter the payment details below</div>
              </div>

              <div className="grid sm:grid-cols-2 min-[1600px]:grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="pay-sender">{method === 'Bank Transfer' ? 'Your account / name' : 'Sender number'}</Label>
                  <Input id="pay-sender" className="mt-1.5" value={sender} onChange={(e) => setSender(e.target.value)} placeholder={method === 'Bank Transfer' ? 'Account name or number' : '01XXXXXXXXX'} autoComplete="off" />
                </div>
                <div>
                  <Label htmlFor="pay-txn">Transaction ID</Label>
                  <Input id="pay-txn" className="mt-1.5 font-mono uppercase" value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="8H2PQ1XYZ" autoComplete="off" />
                </div>
              </div>

              <Button type="submit" className="w-full h-11" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}Submit payment of {formatTk(amount)}
              </Button>
              <p className="text-xs text-muted-foreground text-center">We check the transaction and activate your plan, usually within a few hours.</p>
            </>
          )}
        </form>

        <div className="lg:col-span-2 min-[1600px]:col-span-1 p-5 bg-card border border-border rounded-xl">
          <div className="font-bold mb-3">Payment history</div>
          {paysLoading ? <Skeleton className="h-24" /> : !pays?.length ? <p className="text-sm text-muted-foreground">No payments yet.</p> : pays.map((p: any) => (
            <div key={p.id} className="py-3 border-b border-border last:border-0 text-sm">
              <div className="flex justify-between gap-2"><span className="font-mono">{p.transactionId}</span><Badge variant={statusVariant(p.status)}>{p.status}</Badge></div>
              <div className="text-muted-foreground mt-0.5">{p.packageName} · {p.billingPeriod} · {formatTk(p.amount)} · {p.method}{p.submittedAt && ` · ${format(new Date(p.submittedAt), 'd MMM yyyy')}`}</div>
              {p.adminNote && <div className="mt-1 text-xs italic">Note: {p.adminNote}</div>}
            </div>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
