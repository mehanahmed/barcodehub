import { useState } from 'react';
import { api } from 'zitejs/api';

/**
 * Drop-in replacement for zitejs/upload's `useUpload` hook.
 * Generates a presigned Cloudflare R2 URL server-side and uploads directly
 * from the browser — no data passes through the Zite backend.
 */
export function useR2Upload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file: File): Promise<{ url: string }> => {
    setIsUploading(true);
    try {
      const { uploadUrl, publicUrl } = await api.getUploadUrl({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      });

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      if (!res.ok) {
        throw new Error(`R2 upload failed: ${res.status} ${res.statusText}`);
      }

      return { url: publicUrl };
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading };
}
