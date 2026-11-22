import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireAdmin } from '../server/helpers';

export default createEndpoint({
  description: 'Lists every tenant with owner email, package and product count',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ tenants: z.array(z.any()) }),
  execute: async ({ context }) => {
    await requireAdmin(context);
    const { rows } = await db.sql({
      query: `
        SELECT t.id, t."companyName", t."slug", t."status", t."subscriptionEnds", t.created_at AS "createdAt",
               u."email" AS "ownerEmail",
               (SELECT pk.id FROM "PackagesTenants" lp JOIN "Packages" pk ON pk.id = lp."packagesId" WHERE lp."tenantsId" = t.id LIMIT 1) AS "packageId",
               (SELECT pk."name" FROM "PackagesTenants" lp JOIN "Packages" pk ON pk.id = lp."packagesId" WHERE lp."tenantsId" = t.id LIMIT 1) AS "packageName",
               (SELECT COUNT(*) FROM "ProductsTenants" l WHERE l."tenantsId" = t.id) AS products
        FROM "Tenants" t
        LEFT JOIN "ziteUsers" u ON u.id = t."owner"->>0
        ORDER BY t.created_at DESC
        LIMIT 2000`,
    });
    return {
      tenants: rows.map((r) => ({
        id: String(r.id),
        companyName: String(r.companyName ?? ''),
        slug: String(r.slug ?? ''),
        status: String(r.status ?? 'Active'),
        subscriptionEnds: r.subscriptionEnds ? String(r.subscriptionEnds).slice(0, 10) : null,
        createdAt: String(r.createdAt ?? ''),
        ownerEmail: String(r.ownerEmail ?? ''),
        packageId: r.packageId ? String(r.packageId) : null,
        packageName: String(r.packageName ?? '—'),
        products: Number(r.products ?? 0),
      })),
    };
  },
});
