import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireTenant, getPackage, first } from '../server/helpers';

export default createEndpoint({
  description: "Page-view analytics for the signed-in tenant's products",
  authenticated: true,
  inputSchema: z.object({ days: z.number() }),
  outputSchema: z.object({ analytics: z.any() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    const pkg = await getPackage(first(tenant.package));
    const days = Math.min(Math.max(Math.round(input.days), 1), 366);
    const base = `FROM "ProductViews" v JOIN "ProductViewsTenants" lt ON lt."productViewsId" = v.id
                  WHERE lt."tenantsId" = $1 AND v.created_at >= now() - ($2 || ' days')::interval`;
    const params = [tenant.id, String(days)];

    const totals = await db.sql({
      query: `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE v."source" = 'QR Scan') AS qr,
                COUNT(*) FILTER (WHERE v."source" = 'Search') AS search ${base}`,
      params,
    });
    const counts = await db.sql({
      query: `SELECT COUNT(*) AS products, COUNT(*) FILTER (WHERE p."status" = 'Published') AS published
              FROM "Products" p JOIN "ProductsTenants" l ON l."productsId" = p.id WHERE l."tenantsId" = $1`,
      params: [tenant.id],
    });
    const top = await db.sql({
      query: `SELECT p."title", p."barcodeNumber", COUNT(*) AS views ${base.replace('WHERE', `JOIN "ProductViewsProducts" lp ON lp."productViewsId" = v.id JOIN "Products" p ON p.id = lp."productsId" WHERE`)}
              GROUP BY p.id ORDER BY views DESC LIMIT 5`,
      params,
    });
    const t = totals.rows[0] ?? {};
    const c = counts.rows[0] ?? {};
    const result = {
      enabled: !!pkg?.analyticsEnabled,
      total: Number(t.total ?? 0),
      qr: Number(t.qr ?? 0),
      search: Number(t.search ?? 0),
      products: Number(c.products ?? 0),
      published: Number(c.published ?? 0),
      top: top.rows.map((r) => ({ title: String(r.title ?? ''), barcodeNumber: String(r.barcodeNumber ?? ''), views: Number(r.views) })),
      daily: [] as { date: string; views: number }[],
      bySource: [] as { source: string; views: number }[],
    };
    if (result.enabled) {
      const daily = await db.sql({
        query: `SELECT to_char(v.created_at, 'YYYY-MM-DD') AS date, COUNT(*) AS views ${base} GROUP BY 1 ORDER BY 1`,
        params,
      });
      const src = await db.sql({
        query: `SELECT COALESCE(v."source", 'Direct') AS source, COUNT(*) AS views ${base} GROUP BY 1`,
        params,
      });
      const map = new Map(daily.rows.map((r) => [String(r.date), Number(r.views)]));
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        result.daily.push({ date: d, views: map.get(d) ?? 0 });
      }
      result.bySource = src.rows.map((r) => ({ source: String(r.source), views: Number(r.views) }));
    }
    return { analytics: result };
  },
});
