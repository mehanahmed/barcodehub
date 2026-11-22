import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { jsBarcodeFormat } from '../lib/barcode';

interface Props {
  value: string;
  type: string;
  height?: number;
  width?: number;
  className?: string;
  id?: string;
  onError?: (bad: boolean) => void;
}

export default function BarcodeSvg({ value, type, height = 70, width = 2, className, id, onError }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: jsBarcodeFormat(type),
        height,
        width,
        fontSize: 16,
        margin: 8,
        font: 'JetBrains Mono',
        background: '#ffffff',
        lineColor: '#000000',
      });
      onError?.(false);
    } catch {
      ref.current.innerHTML = '';
      onError?.(true);
    }
  }, [value, type, height, width, onError]);
  return <svg ref={ref} id={id} className={className} />;
}

function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

export function downloadSvg(svg: SVGSVGElement, name: string) {
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  download(url, `${name}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBarcodePng(value: string, type: string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, value, { format: jsBarcodeFormat(type), height: 70, width: 2, fontSize: 16, margin: 8, background: '#ffffff' });
    downloadPng(svg, value);
  } catch {
    /* invalid barcode — nothing to download */
  }
}

export function downloadPng(svg: SVGSVGElement, name: string) {
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const scale = 3;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    download(canvas.toDataURL('image/png'), `${name}.png`);
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
}
