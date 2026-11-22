import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { SITE_URL } from '../lib/config';
import { productPath, brandPath } from '../lib/seoData';

const escXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));

const entry = (loc: string, priority: string, lastmod?: string | null) =>
  `  <url>\n    <loc>${escXml(loc)}</loc>\n${lastmod ? `    <lastmod>${escXml(lastmod)}</lastmod>\n` : ''}    <priority>${priority}</priority>\n  </url>`;

/**
 * XML sitemap: every published product of a non-suspended brand, every non-suspended brand, and the static public pages.
 * Served by the /sitemap.xml middleware in viteApiPlugin.ts.
 * shortcut: one file, fine up to the sitemap limit of 50,000 URLs; split into a sitemap index before the catalogue gets that big.
 */
export default createEndpoint({
  description: 'Generates an XML sitemap with canonical URLs for published products and active brands',
  inputSchema: z.object({}),
  outputSchema: z.object({ xml: z.string() }),
  execute: async () => {
    // One query each, no row limit: the old findAll() stopped at 500 and listed suspended brands' products.
    const { rows: products } = await db.sql({
      query: `SELECT p."barcodeNumber" AS barcode, to_char(p.updated_at, 'YYYY-MM-DD') AS lastmod
              FROM "Products" p
              JOIN "ProductsTenants" l ON l."productsId" = p.id
              JOIN "Tenants" t ON t.id = l."tenantsId"
              WHERE p."status" = 'Published' AND (t."status" IS NULL OR t."status" <> 'Suspended')
              ORDER BY p."barcodeNumber"`,
    });
    const { rows: brands } = await db.sql({
      query: `SELECT "slug", to_char(updated_at, 'YYYY-MM-DD') AS lastmod
              FROM "Tenants" WHERE "slug" IS NOT NULL AND ("status" IS NULL OR "status" <> 'Suspended')
              ORDER BY "slug"`,
    });

    const urls = [
      entry(`${SITE_URL}/`, '1.0'),
      entry(`${SITE_URL}/lookup`, '0.9'),
      // lastmod is the row's real update date, not the day the sitemap was generated.
      ...products.map((r) => entry(SITE_URL + productPath(String(r.barcode)), '0.8', r.lastmod as string | null)),
      ...brands.map((r) => entry(SITE_URL + brandPath(String(r.slug)), '0.6', r.lastmod as string | null)),
    ];
    return { xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>` };
  },
});
