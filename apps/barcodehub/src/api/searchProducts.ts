import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { toImageUrl } from '../server/helpers';

export default createEndpoint({
  description: 'Searches published products by barcode number or name',
  inputSchema: z.object({ q: z.string() }),
  outputSchema: z.object({ results: z.array(z.any()) }),
  execute: async ({ input }) => {
    const q = input.q.trim();
    if (q.length < 2) return { results: [] };
    const { rows } = await zite.sql({
      query: `
        SELECT p.id, p."title", p."barcodeNumber", p."brand", p."images", t."companyName"
        FROM "Products" p
        JOIN "ProductsTenants" l ON l."productsId" = p.id
        JOIN "Tenants" t ON t.id = l."tenantsId"
        WHERE p."status" = 'Published' AND (t."status" IS NULL OR t."status" <> 'Suspended')
          AND (p."barcodeNumber" ILIKE $1 OR p."title" ILIKE $1 OR p."brand" ILIKE $1)
        ORDER BY (p."barcodeNumber" = $2) DESC, p."title" ASC
        LIMIT 20`,
      params: [`%${q}%`, q.toUpperCase()],
    });
    return {
      results: rows.map((r) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        barcodeNumber: String(r.barcodeNumber ?? ''),
        brand: String(r.brand ?? r.companyName ?? ''),
        image: toImageUrl(r.images),
      })),
    };
  },
});
