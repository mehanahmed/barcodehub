import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { gs1CheckDigit, isGlobalGtin } from '../lib/barcode';

export type OffProduct = { barcode: string; name: string; brand: string; quantity: string; category: string; image: string | null; url: string };

// shortcut: in-process cache, fine for the single dev-server process; move to a DB table if the API runs on several instances.
const cache = new Map<string, { at: number; product: OffProduct | null }>();
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const httpsUrl = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : null);

/** Fetches one product from Open Food Facts. Returns null when OFF has nothing or does not answer. */
export async function fetchOpenFoodFacts(barcode: string, fetchImpl: typeof fetch = fetch): Promise<OffProduct | null> {
  const fields = 'product_name,brands,quantity,categories,image_front_small_url';
  try {
    const res = await fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
      // OFF asks every client to identify itself.
      headers: { 'User-Agent': 'BarcodeHub/1.0 (barcode lookup)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    const p = body.product;
    if (body.status !== 1 || !p || !str(p.product_name)) return null;
    return {
      barcode,
      name: str(p.product_name),
      brand: str(p.brands).split(',')[0].trim(),
      quantity: str(p.quantity),
      category: str(p.categories).split(',')[0].trim(),
      image: httpsUrl(p.image_front_small_url),
      url: `https://world.openfoodfacts.org/product/${barcode}`,
    };
  } catch {
    return null;
  }
}

export default createEndpoint({
  description: 'Looks up a barcode on Open Food Facts when it is not in BarcodeHub',
  inputSchema: z.object({ barcode: z.string().trim().regex(/^\d{12,13}$/) }),
  outputSchema: z.object({ product: z.any() }),
  execute: async ({ input }) => {
    const code = input.barcode;
    const type = code.length === 13 ? 'EAN-13' : 'UPC-A';
    // Internal-use numbers are reused by many shops, so an OFF hit would describe someone else's product.
    if (gs1CheckDigit(code.slice(0, -1)) !== Number(code.slice(-1)) || !isGlobalGtin(type, code)) return { product: null };

    const hit = cache.get(code);
    if (hit && Date.now() - hit.at < TTL_MS) return { product: hit.product };
    const product = await fetchOpenFoodFacts(code);
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(code, { at: Date.now(), product });
    return { product };
  },
});
