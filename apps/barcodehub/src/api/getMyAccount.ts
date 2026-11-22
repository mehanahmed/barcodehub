import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { findMyTenant, getPackage, isExpired, checkIsAdmin, first, toImageUrl } from '../server/helpers';

export default createEndpoint({
  description: "Returns the signed-in user's company, package and admin status",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ account: z.any() }),
  execute: async ({ context }) => {
    const isAdmin = await checkIsAdmin(context.user.id);
    const { records: anyAdmin } = await db.admins.findAll({ limit: 1 });
    const tenant = await findMyTenant(context.user.id);
    if (!tenant) return { account: { tenant: null, isAdmin, noAdminsYet: anyAdmin.length === 0 } };

    const pkg = await getPackage(first(tenant.package));
    const { rows } = await db.sql({
      query: `SELECT COUNT(*) AS n FROM "ProductsTenants" WHERE "tenantsId" = $1`,
      params: [tenant.id],
    });
    const productCount = Number(rows[0]?.n ?? 0);
    const limit = pkg?.productLimit ?? 0;
    return {
      account: {
        isAdmin,
        noAdminsYet: anyAdmin.length === 0,
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName ?? '',
          slug: tenant.slug ?? '',
          logo: toImageUrl(tenant.logo),
          website: tenant.website ?? '',
          phone: tenant.phone ?? '',
          address: tenant.address ?? '',
          gs1CompanyPrefix: tenant.gs1CompanyPrefix ?? '',
          status: tenant.status ?? 'Active',
          subscriptionEnds: tenant.subscriptionEnds ?? null,
        },
        package: pkg
          ? { id: pkg.id, name: pkg.name ?? '', productLimit: limit, analyticsEnabled: !!pkg.analyticsEnabled, isFree: Number(pkg.monthlyPrice ?? 0) <= 0 }
          : null,
        productCount,
        expired: isExpired(tenant, pkg),
        atLimit: !pkg ? true : limit > 0 && productCount >= limit,
      },
    };
  },
});
