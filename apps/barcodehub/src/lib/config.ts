/** The one public address of the site: canonicals, sitemap and JSON-LD always use it, whatever host served the page. */
export const SITE_URL = String(import.meta.env.VITE_SITE_URL || 'https://barcodehub.com').replace(/\/+$/, '');

/** Where tenants send subscription payments. Change these to your real accounts. */
export const PAYMENT_ACCOUNTS: Record<string, string> = {
  bKash: '01XXXXXXXXX (Merchant)',
  Nagad: '01XXXXXXXXX (Merchant)',
  Rocket: '01XXXXXXXXXX',
  'Bank Transfer': 'BarcodeHub Ltd · A/C 0000000000 · Your Bank, Dhaka',
};

export const PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank Transfer'] as const;

export function formatTk(n?: number | null) {
  return `৳${Math.round(n ?? 0).toLocaleString('en-IN')}`;
}
