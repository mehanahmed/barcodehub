import { z } from 'zod';
import path from 'path';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireTenant, first, toImageUrl, fail } from '../server/helpers';
import { isGlobalGtin, validateBarcode } from '../lib/barcode';
import { offWriteConfig, publishToOff, OffRefused } from '../server/openFoodFacts';

/** The product's first photo, read from public/uploads. Photos hosted elsewhere are skipped. */
async function localPhoto(images: unknown) {
  const url = toImageUrl(images);
  if (!url?.startsWith('/uploads/')) return null;
  const dir = path.resolve(process.cwd(), 'public/uploads');
  const file = path.resolve(dir, decodeURIComponent(url.slice('/uploads/'.length)));
  if (!file.startsWith(dir + path.sep)) return null;
  try {
    return { data: new Blob([await readFile(file)]), name: path.basename(file) };
  } catch {
    return null;
  }
}

export default createEndpoint({
  description: "Publishes one of the signed-in tenant's products to Open Food Facts",
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ url: z.string(), photoUploaded: z.boolean(), photoError: z.string().nullable(), production: z.boolean() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    const p = await db.products.findOne({ id: input.id });
    if (!p || first(p.tenant) !== tenant.id) fail('Product not found.');
    if (p.status !== 'Published') fail('Publish the product on BarcodeHub first.');
    const type = p.barcodeType ?? '';
    const barcode = p.barcodeNumber ?? '';
    if (validateBarcode(type, barcode) || !isGlobalGtin(type, barcode)) {
      fail('Only products with a GS1-licensed EAN-13 or UPC-A number can go to Open Food Facts. Internal-use numbers are shared by many shops.');
    }
    if (!p.title?.trim()) fail('Add a product name first.');

    const cfg = offWriteConfig();
    if (!cfg) fail('Open Food Facts publishing is not set up on this server yet. Please contact support.');

    // Stable per brand and not reversible to the tenant id, as OFF asks for app_uuid.
    const appUuid = createHash('sha256').update(`barcodehub-off:${tenant.id}`).digest('hex').slice(0, 32);
    try {
      const result = await publishToOff(cfg, appUuid, {
        barcode, title: p.title ?? '', brand: p.brand || tenant.companyName || '', netWeight: p.netWeight ?? '', category: p.category ?? '',
        ingredients: p.ingredients ?? '', countryOfOrigin: p.countryOfOrigin ?? '', certifications: p.certifications ?? '',
      }, await localPhoto(p.images));
      return { ...result, production: cfg.production };
    } catch (e) {
      return fail(e instanceof OffRefused ? e.message : 'Could not reach Open Food Facts. Try again in a minute.');
    }
  },
});
