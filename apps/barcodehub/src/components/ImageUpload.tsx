import { useRef } from 'react';
import { useLocalUpload } from '@/hooks/useLocalUpload';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@project/components/ui/button';

export default function ImageUpload({ value, onChange, label = 'Change logo', round }: { value: string | null; onChange: (url: string | null) => void; label?: string; round?: boolean }) {
  const { upload, isUploading } = useLocalUpload();
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f?: File) => {
    if (!f) return;
    try { onChange((await upload(f)).url); } catch { toast.error('Upload failed'); }
  };
  return (
    <div className="flex items-center gap-3">
      {value ? <img src={value} alt="" className={`w-14 h-14 object-cover ${round ? 'rounded-full' : 'rounded-lg'}`} /> : <div className={`w-14 h-14 bg-muted ${round ? 'rounded-full' : 'rounded-lg'}`} />}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => input.current?.click()}>
        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{label}
      </Button>
      {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Remove</Button>}
    </div>
  );
}
