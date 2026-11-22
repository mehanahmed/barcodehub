import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireTenant, toImageUrl } from '../server/helpers';

export default createEndpoint({
  description: "Lists all of the signed-in tenant's products with view counts",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ products: z.array(z.any()) }),
  execute: async ({ context }) => {
    const tenant = await requireTenant(context);
    const { rows } = await db.sql({
      query: `
        SELECT p.id, p."title", p."barcodeNumber", p."barcodeType", p."status", p."category", p."images",
               p."netWeight", p."mrp", p."brand", p.updated_at AS "updatedAt",
               (SELECT COUNT(*) FROM "ProductViewsProducts" v WHERE v."productsId" = p.id) AS views
        FROM "Products" p
        JOIN "ProductsTenants" l ON l."productsId" = p.id
        WHERE l."tenantsId" = $1
        ORDER BY p.updated_at DESC
        LIMIT 2000`,
      params: [tenant.id],
    });
    return {
      products: rows.map((r) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        barcodeNumber: String(r.barcodeNumber ?? ''),
        barcodeType: String(r.barcodeType ?? ''),
        status: String(r.status ?? 'Draft'),
        category: String(r.category ?? ''),
        brand: String(r.brand ?? ''),
        netWeight: String(r.netWeight ?? ''),
        mrp: r.mrp == null ? null : Number(r.mrp),
        image: toImageUrl(r.images),
        views: Number(r.views ?? 0),
        updatedAt: String(r.updatedAt ?? ''),
      })),
    };
  },
});
