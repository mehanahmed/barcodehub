/**
 * Read-only client for the Open Food Facts product API: product details for Lookup and the barcode page,
 * and a "does OFF already know this number" check for auto-numbering.
 */
export type OffProduct = {
  barcode: string; name: string; brand: string; quantity: string; category: string;
  ingredients: string; countries: string; image: string | null; url: string;
};
/** exists: OFF has a record for the number (even an empty one). product: only when it has a name to show. */
export type OffRecord = { exists: boolean; product: OffProduct | null };

// shortcut: in-process cache, fine for the single dev-server process; move to a DB table if the API runs on several instances.
const cache = new Map<string, { at: number; record: OffRecord }>();
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const first = (v: unknown) => str(v).split(',')[0].trim();
const httpsUrl = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : null);

/** Asks OFF about one barcode. Returns null when OFF does not answer, so callers can tell "unknown" from "not there". */
export async function fetchOffRecord(barcode: string, fetchImpl: typeof fetch = fetch): Promise<OffRecord | null> {
  const fields = 'product_name,brands,quantity,categories,ingredients_text,countries,image_front_url';
  try {
    const res = await fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
      // OFF asks every client to identify itself.
      headers: { 'User-Agent': 'BarcodeHub/1.0 (barcode lookup)' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return { exists: false, product: null };
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    const p = body.product;
    if (body.status !== 1 || !p) return { exists: false, product: null };
    if (!str(p.product_name)) return { exists: true, product: null };
    return {
      exists: true,
      product: {
        barcode,
        name: str(p.product_name),
        brand: first(p.brands),
        quantity: str(p.quantity),
        category: first(p.categories),
        ingredients: str(p.ingredients_text),
        countries: str(p.countries),
        image: httpsUrl(p.image_front_url),
        url: `https://world.openfoodfacts.org/product/${barcode}`,
      },
    };
  } catch {
    return null;
  }
}

/** fetchOffRecord with a 24h cache. Failures are not cached, so the next call tries OFF again. */
export async function getOffRecord(barcode: string): Promise<OffRecord | null> {
  const hit = cache.get(barcode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.record;
  const record = await fetchOffRecord(barcode);
  if (!record) return null;
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(barcode, { at: Date.now(), record });
  return record;
}

/** true when OFF already has the number, false when it does not, null when OFF could not be reached. */
export async function isOnOpenFoodFacts(barcode: string): Promise<boolean | null> {
  return (await getOffRecord(barcode))?.exists ?? null;
}

// ---- Writing: a brand publishes its own product to Open Food Facts ----

/** What BarcodeHub sends for one product. */
export type OffPublishInput = {
  barcode: string; title: string; brand: string; netWeight: string; category: string;
  ingredients: string; countryOfOrigin: string; certifications: string;
};

/**
 * OFF_USER_ID / OFF_PASSWORD: the shared BarcodeHub account (a username, never an email).
 * OFF_SERVER=production writes to world.openfoodfacts.org; anything else uses the staging server, so dev
 * and test runs never touch the public database. Staging and production have separate accounts.
 */
export function offWriteConfig(env: NodeJS.ProcessEnv = process.env) {
  const userId = env.OFF_USER_ID?.trim();
  const password = env.OFF_PASSWORD;
  if (!userId || !password) return null;
  const production = env.OFF_SERVER === 'production';
  return {
    userId, password, production,
    base: production ? 'https://world.openfoodfacts.org' : 'https://world.openfoodfacts.net',
    // The staging server sits behind basic auth off:off so search engines don't index it.
    headers: { 'User-Agent': 'BarcodeHub/1.0 (barcode publishing)', ...(production ? {} : { Authorization: 'Basic ' + btoa('off:off') }) } as Record<string, string>,
  };
}
export type OffConfig = NonNullable<ReturnType<typeof offWriteConfig>>;

/** OFF product fields for a BarcodeHub product. Empty values are left out so they never wipe what OFF already has. */
export function buildOffFields(p: OffPublishInput): Record<string, string> {
  const fields: Record<string, string> = {
    code: p.barcode,
    // Bengali script means Bengali is the main language, otherwise English.
    lang: /[ঀ-৿]/.test(p.title + p.ingredients) ? 'bn' : 'en',
    product_name: p.title,
    brands: p.brand,
    quantity: p.netWeight,
    categories: p.category,
    ingredients_text: p.ingredients,
    manufacturing_places: p.countryOfOrigin,
    add_labels: p.certifications,
    // BarcodeHub serves Bangladeshi brands; add_ keeps any countries OFF already lists.
    add_countries: 'Bangladesh',
    comment: 'Added by the brand owner via BarcodeHub',
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim()));
}

function offForm(cfg: OffConfig, appUuid: string, fields: Record<string, string>) {
  const fd = new FormData();
  // OFF asks apps to send app_* so moderators can block one bad user without blocking the whole app account.
  const all = { user_id: cfg.userId, password: cfg.password, app_name: 'BarcodeHub', app_version: '1.0', app_uuid: appUuid, ...fields };
  for (const [k, v] of Object.entries(all)) fd.append(k, v);
  return fd;
}

/**
 * Saves the product on OFF, then uploads the front photo when there is one.
 * Throws with OFF's reason when the product itself is refused; a refused photo only sets photoError.
 */
export async function publishToOff(
  cfg: OffConfig, appUuid: string, p: OffPublishInput, photo: { data: Blob; name: string } | null, fetchImpl: typeof fetch = fetch,
): Promise<{ url: string; photoUploaded: boolean; photoError: string | null }> {
  const fields = buildOffFields(p);
  const res = await fetchImpl(`${cfg.base}/cgi/product_jqm2.pl`, {
    method: 'POST', headers: cfg.headers, body: offForm(cfg, appUuid, fields), signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: number; status_verbose?: string };
  if (!res.ok || body.status !== 1) throw new OffRefused(`Open Food Facts refused the product: ${body.status_verbose || `HTTP ${res.status}`}`);
  cache.delete(p.barcode);

  let photoUploaded = false;
  let photoError: string | null = null;
  if (photo) {
    const imagefield = `front_${fields.lang}`;
    const fd = offForm(cfg, appUuid, { code: p.barcode, imagefield });
    fd.append(`imgupload_${imagefield}`, photo.data, photo.name);
    try {
      const img = await fetchImpl(`${cfg.base}/cgi/product_image_upload.pl`, { method: 'POST', headers: cfg.headers, body: fd, signal: AbortSignal.timeout(30000) });
      const ib = (await img.json().catch(() => ({}))) as { status?: string; error?: string; debug?: string };
      photoUploaded = img.ok && ib.status === 'status ok';
      if (!photoUploaded) photoError = ib.error || ib.debug || `HTTP ${img.status}`;
    } catch (e) {
      photoError = e instanceof Error ? e.message : 'upload failed';
    }
  }
  return { url: `${cfg.base}/product/${p.barcode}`, photoUploaded, photoError };
}

/** OFF answered and said no (as opposed to not answering). */
export class OffRefused extends Error {}
