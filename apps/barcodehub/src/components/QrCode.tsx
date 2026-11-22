import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function productUrl(barcode: string) {
  return `${window.location.origin}/barcode/${encodeURIComponent(barcode)}`;
}

export default function QrCode({ barcode, size = 120, className }: { barcode: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!barcode) return setSrc('');
    QRCode.toDataURL(`${productUrl(barcode)}?src=qr`, { width: size * 2, margin: 1 }).then(setSrc).catch(() => setSrc(''));
  }, [barcode, size]);
  if (!src) return <div style={{ width: size, height: size }} className="bg-muted rounded" />;
  return <img src={src} width={size} height={size} alt={`QR code for ${barcode}`} className={className} />;
}
