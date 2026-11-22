import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { toImageUrl } from '../server/helpers';

export default createEndpoint({
  description: 'Shows a brand profile with its published products',
  inputSchema: z.object({ slug: z.string() }),
  outputSchema: z.object({ brand: z.any().nullable() }),
  execute: async ({ input }) => {
    const tenant = await db.tenants.findOne({ filters: { slug: input.slug.toLowerCase() } });
    if (!tenant || tenant.status === 'Suspended') return { brand: null };
    const { records } = await db.products.findAll({
      filters: { tenant: tenant.id, status: 'Published' },
      sort: [{ field: 'title', direction: 'asc' }],
      limit: 500,
    });
    return {
      brand: {
        name: tenant.companyName ?? '',
        logo: toImageUrl(tenant.logo),
        website: tenant.website ?? '',
        phone: tenant.phone ?? '',
        address: tenant.address ?? '',
        products: records.map((p) => ({
          id: p.id,
          title: p.title ?? '',
          barcodeNumber: p.barcodeNumber ?? '',
          image: toImageUrl(p.images),
          netWeight: p.netWeight ?? '',
        })),
      },
    };
  },
});
