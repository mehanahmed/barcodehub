import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireTenant, getPackage, isExpired, first, toImageUrls, fail } from '../server/helpers';
import { validateBarcode, withCheckDigit } from '../lib/barcode';

export default createEndpoint({
  description: 'Creates or updates a product for the signed-in tenant',
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    title: z.string(),
    barcodeNumber: z.string(),
    barcodeType: z.enum(['EAN-13', 'UPC-A', 'System Code128']),
    description: z.string(),
    brand: z.string(),
    manufacturer: z.string(),
    category: z.string(),
    netWeight: z.string(),
    countryOfOrigin: z.string(),
    ingredients: z.string(),
    certifications: z.string(),
    mrp: z.number().nullable(),
    images: z.array(z.string()),
    status: z.enum(['Draft', 'Published']),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    const pkg = await getPackage(first(tenant.package));
    const barcode = withCheckDigit(input.barcodeType, input.barcodeNumber);
    if (input.title.trim().length < 2) fail('Title is required.');
    const err = validateBarcode(input.barcodeType, barcode);
    if (err) fail(err);

    const dup = await zite.products.findOne({ filters: { barcodeNumber: barcode } });
    if (dup && dup.id !== input.id) fail('This barcode number is already used by another product.');

    let existingImages: { url: string }[] = [];
    if (input.id) {
      const cur = await zite.products.findOne({ id: input.id });
      if (!cur || first(cur.tenant) !== tenant.id) fail('Product not found.');
      existingImages = cur.images ?? [];
    } else {
      if (!pkg) fail('No active subscription plan found. Please subscribe to a package to add products.');
      if (isExpired(tenant, pkg)) fail('Your subscription has expired. Renew it to add products.');
      const limit = pkg?.productLimit ?? 0;
      if (limit > 0) {
        const { rows } = await zite.sql({
          query: `SELECT COUNT(*) AS n FROM "ProductsTenants" WHERE "tenantsId" = $1`,
          params: [tenant.id],
        });
        if (Number(rows[0]?.n ?? 0) >= limit) fail(`Your package allows ${limit} products. Upgrade to add more.`);
      }
    }

    const images = toImageUrls(input.images);
    const record = {
      title: input.title.trim(),
      tenant: tenant.id,
      barcodeNumber: barcode,
      barcodeType: input.barcodeType,
      description: input.description,
      brand: input.brand.trim() || (tenant.companyName ?? ''),
      manufacturer: input.manufacturer.trim(),
      category: input.category.trim(),
      netWeight: input.netWeight.trim(),
      countryOfOrigin: input.countryOfOrigin.trim(),
      ingredients: input.ingredients,
      certifications: input.certifications.trim(),
      mrp: input.mrp,
      images,
      status: input.status,
    };
    if (input.id) {
      await zite.products.update({ id: input.id, record });
      return { id: input.id };
    }
    const created = await zite.products.create({ record });
    return { id: created.id };
  },
});
