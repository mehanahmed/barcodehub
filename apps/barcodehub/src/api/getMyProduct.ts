import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireTenant, first, toImageUrls, fail } from '../server/helpers';

export default createEndpoint({
  description: "Loads one of the signed-in tenant's products for editing",
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ product: z.any() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    const p = await db.products.findOne({ id: input.id });
    if (!p || first(p.tenant) !== tenant.id) fail('Product not found.');
    return {
      product: {
        id: p.id,
        title: p.title ?? '',
        barcodeNumber: p.barcodeNumber ?? '',
        barcodeType: p.barcodeType ?? 'EAN-13',
        description: p.description ?? '',
        brand: p.brand ?? '',
        manufacturer: p.manufacturer ?? '',
        category: p.category ?? '',
        netWeight: p.netWeight ?? '',
        countryOfOrigin: p.countryOfOrigin ?? '',
        ingredients: p.ingredients ?? '',
        certifications: p.certifications ?? '',
        mrp: p.mrp ?? null,
        images: toImageUrls(p.images),
        status: p.status ?? 'Draft',
      },
    };
  },
});
