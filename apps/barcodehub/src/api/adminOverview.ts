import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireAdmin } from '../server/helpers';

export default createEndpoint({
  description: 'Platform-wide stats for the SaaS owner',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ overview: z.any() }),
  execute: async ({ context }) => {
    await requireAdmin(context);
    const [t, r, p, v, pend, rev, nt] = await Promise.all([
      db.sql({ query: `SELECT COUNT(*) FILTER (WHERE "status" IS NULL OR "status" <> 'Suspended') AS n, COUNT(*) AS total FROM "Tenants"` }),
      db.sql({ query: `SELECT COALESCE(SUM("amount"),0) AS n FROM "Payments" WHERE "status" = 'Approved' AND "reviewedAt" >= now() - interval '30 days'` }),
      db.sql({ query: `SELECT COUNT(*) AS n FROM "Products"` }),
      db.sql({ query: `SELECT COUNT(*) AS n FROM "ProductViews" WHERE created_at >= now() - interval '30 days'` }),
      db.sql({ query: `SELECT COUNT(*) AS n FROM "Payments" WHERE "status" = 'Pending'` }),
      db.sql({ query: `SELECT to_char(date_trunc('month', "reviewedAt"), 'YYYY-MM') AS month, SUM("amount") AS total
                         FROM "Payments" WHERE "status" = 'Approved' AND "reviewedAt" >= date_trunc('month', now()) - interval '5 months'
                         GROUP BY 1 ORDER BY 1` }),
      db.sql({ query: `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*) AS total
                         FROM "Tenants" WHERE created_at >= date_trunc('month', now()) - interval '5 months'
                         GROUP BY 1 ORDER BY 1` }),
    ]);
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    const fill = (rows: Record<string, unknown>[]) => {
      const m = new Map(rows.map((x) => [String(x.month), Number(x.total)]));
      return months.map((month) => ({ month, total: m.get(month) ?? 0 }));
    };
    return {
      overview: {
        activeTenants: Number(t.rows[0]?.n ?? 0),
        totalTenants: Number(t.rows[0]?.total ?? 0),
        revenue30: Number(r.rows[0]?.n ?? 0),
        products: Number(p.rows[0]?.n ?? 0),
        views30: Number(v.rows[0]?.n ?? 0),
        pendingPayments: Number(pend.rows[0]?.n ?? 0),
        revenueByMonth: fill(rev.rows),
        tenantsByMonth: fill(nt.rows),
      },
    };
  },
});
