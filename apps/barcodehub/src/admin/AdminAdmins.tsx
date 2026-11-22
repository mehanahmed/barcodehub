import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { adminManageAdmins } from 'zitejs/api';
import { useAuth } from 'zitejs/auth';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { PageHeader } from '../components/Shell';
import { errMsg } from '../lib/errors';

export default function AdminAdmins() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['admins'], queryFn: async () => (await adminManageAdmins({ action: 'list' })).admins });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<{ id: string; email: string } | null>(null);

  const run = async (input: Parameters<typeof adminManageAdmins>[0], ok: string) => {
    setBusy(true);
    try { const r = await adminManageAdmins(input); qc.setQueryData(['admins'], r.admins); toast.success(ok); return true; }
    catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Enter a valid email');
    if (await run({ action: 'add', email, name }, 'Admin added')) { setEmail(''); setName(''); }
  };
  return (
    <>
      <PageHeader title="Admins" sub="People with these emails can open /admin after signing in." />
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 max-w-2xl mb-6">
        <Input placeholder="email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Add admin</Button>
      </form>
      <div className="max-w-2xl bg-card border border-border rounded-xl divide-y divide-border">
        {isLoading && <Skeleton className="h-14" />}
        {data?.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div><div className="font-medium">{a.email}</div>{a.name && <div className="text-muted-foreground">{a.name}</div>}</div>
            {a.email !== user?.email.toLowerCase() && <Button variant="ghost" size="icon" onClick={() => setDel(a)}><Trash2 className="w-4 h-4" /></Button>}
          </div>
        ))}
      </div>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {del?.email}?</AlertDialogTitle><AlertDialogDescription>They will lose access to the admin panel.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (del) run({ action: 'remove', id: del.id }, 'Admin removed'); setDel(null); }}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
