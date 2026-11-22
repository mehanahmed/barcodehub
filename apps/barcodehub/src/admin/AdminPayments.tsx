import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { adminListPayments, adminReviewPayment } from '@/lib/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { PageHeader } from '../components/Shell';
import { formatTk } from '../lib/config';
import { errMsg } from '../lib/errors';

export default function AdminPayments() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-payments'], queryFn: async () => (await adminListPayments({})).payments });
  const [filter, setFilter] = useState('Pending');
  const [review, setReview] = useState<{ p: any; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = (data ?? []).filter((p: any) => filter === 'all' || p.status === filter);

  const submit = async () => {
    if (!review) return;
    if (!review.approve && !note.trim()) return toast.error('Add a note for the tenant');
    setBusy(true);
    try {
      await adminReviewPayment({ id: review.p.id, approve: review.approve, note });
      toast.success(review.approve ? 'Approved — plan activated' : 'Payment rejected');
      setReview(null); setNote('');
      ['admin-payments', 'admin-overview', 'admin-tenants'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Payments" actions={
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{['Pending', 'Approved', 'Rejected'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}<SelectItem value="all">All</SelectItem></SelectContent></Select>} />
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>Package</TableHead><TableHead>Method</TableHead><TableHead>Txn ID</TableHead><TableHead>Amount</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>}
            {!isLoading && !rows.length && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No payments here.</TableCell></TableRow>}
            {rows.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.tenant}</TableCell>
                <TableCell>{p.package} · {p.billingPeriod}</TableCell>
                <TableCell>{p.method}<div className="text-xs text-muted-foreground">{p.senderNumber}</div></TableCell>
                <TableCell className="font-mono">{p.transactionId}</TableCell>
                <TableCell>{formatTk(p.amount)}</TableCell>
                <TableCell className="text-sm">{p.submittedAt ? format(new Date(p.submittedAt), 'd MMM, h:mm a') : ''}</TableCell>
                <TableCell><Badge variant={p.status === 'Approved' ? 'default' : p.status === 'Rejected' ? 'destructive' : 'secondary'}>{p.status}</Badge></TableCell>
                <TableCell>{p.status === 'Pending' && <div className="flex gap-1">
                  <Button size="sm" onClick={() => setReview({ p, approve: true })}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setReview({ p, approve: false })}>Reject</Button></div>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{review?.approve ? 'Approve' : 'Reject'} payment {review?.p.transactionId}</DialogTitle>
            <DialogDescription>{review?.approve ? `Verify ${formatTk(review?.p.amount)} arrived in your ${review?.p.method} account. ${review?.p.tenant} will get ${review?.p.package} for one ${review?.p.billingPeriod === 'Yearly' ? 'year' : 'month'}.` : 'Tell the tenant why — they see this note.'}</DialogDescription></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={review?.approve ? 'Optional note' : 'e.g. Transaction ID not found'} />
          <DialogFooter><Button variant="outline" onClick={() => setReview(null)}>Cancel</Button>
            <Button variant={review?.approve ? 'default' : 'destructive'} onClick={submit} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{review?.approve ? 'Approve' : 'Reject'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
