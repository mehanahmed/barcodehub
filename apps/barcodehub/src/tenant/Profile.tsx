import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth, updateProfile } from 'zitejs/auth';
import { logout } from '../lib/auth';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { PageHeader } from '../components/Shell';
import ImageUpload from '../components/ImageUpload';
import { errMsg } from '../lib/errors';

export default function Profile() {
  const { user } = useAuth();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) { setFirst(user.firstName ?? ''); setLast(user.lastName ?? ''); setImage(user.image); } }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!first.trim()) return toast.error('First name is required');
    setBusy(true);
    try {
      // updateProfile returns failures instead of throwing them.
      const result = await updateProfile({ firstName: first.trim(), lastName: last.trim(), name: `${first} ${last}`.trim(), image } as Parameters<typeof updateProfile>[0]);
      if (result?.error) return toast.error(result.error.message || 'Could not save your profile.');
      toast.success('Profile saved');
    } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Profile" />
      <form onSubmit={save} className="max-w-lg p-6 bg-card border border-border rounded-xl space-y-5">
        <ImageUpload value={image} onChange={setImage} label="Change photo" round />
        <div className="grid grid-cols-2 gap-4">
          <div><Label>First name</Label><Input className="mt-1.5" value={first} onChange={(e) => setFirst(e.target.value)} /></div>
          <div><Label>Last name</Label><Input className="mt-1.5" value={last} onChange={(e) => setLast(e.target.value)} /></div>
        </div>
        <div><Label>Email</Label><Input className="mt-1.5" value={user?.email ?? ''} disabled /></div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => logout()}><LogOut className="w-4 h-4" />Sign out</Button>
        </div>
      </form>
    </>
  );
}
