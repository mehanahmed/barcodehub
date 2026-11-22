import { z } from 'zod';
import { createEndpoint, type RequestContext } from '../server/endpoint';
import { db } from '../server/db';
import { first, toImageUrl, toImageUrls } from '../server/helpers';
import { recordProductView } from '../server/viewTracker';

export default createEndpoint({
  description: 'Shows a published product page by barcode number and records the visit with deduplication and rate limiting',
  inputSchema: z.object({
    barcode: z.string(),
    source: z.enum(['Search', 'Direct', 'QR Scan', 'Lookup']).optional(),
  }),
  outputSchema: z.object({ product: z.any().nullable() }),
  execute: async ({ input, context }) => {
    const p = await db.products.findOne({
      filters: { barcodeNumber: input.barcode.trim().toUpperCase(), status: 'Published' },
    });
    if (!p) return { product: null };
    const tenantId = first(p.tenant);
    const tenant = tenantId ? await db.tenants.findOne({ id: tenantId }) : undefined;
    if (!tenant || tenant.status === 'Suspended') return { product: null };

    // Record visit non-blockingly with deduplication and rate limiting
    if (input.source) {
      const ctx = context as (RequestContext & {
        headers?: Record<string, string | string[] | undefined>;
        ip?: string;
      }) | undefined;

      const forwarded = ctx?.headers?.['x-forwarded-for'];
      const clientIp =
        (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : Array.isArray(forwarded) ? forwarded[0]?.trim() : undefined) ||
        ctx?.ip ||
        '127.0.0.1';
      const rawUserAgent = ctx?.headers?.['user-agent'];
      const userAgent = typeof rawUserAgent === 'string' ? rawUserAgent : Array.isArray(rawUserAgent) ? rawUserAgent[0] || '' : '';

      await recordProductView(p.id, tenant.id, input.source, {
        ip: clientIp,
        userAgent,
      });
    }

    return {
      product: {
        id: p.id,
        title: p.title ?? '',
        barcodeNumber: p.barcodeNumber ?? '',
        barcodeType: p.barcodeType ?? '',
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
        tenant: {
          name: tenant.companyName ?? '',
          slug: tenant.slug ?? '',
          logo: toImageUrl(tenant.logo),
          website: tenant.website ?? '',
        },
      },
    };
  },
});
