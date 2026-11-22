import { useState } from 'react';

export function useLocalUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file: File): Promise<{ url: string; fileName: string }> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      return {
        url: data.url || `/uploads/${file.name}`,
        fileName: data.fileName || file.name,
      };
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading };
}
