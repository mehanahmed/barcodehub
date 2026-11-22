import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../server/helpers';

export default createEndpoint({
  description: 'Lists all packages, including inactive ones, for the admin',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ packages: z.array(z.any()) }),
  execute: async ({ context }) => {
    await requireAdmin(context);
    const { records } = await zite.packages.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }] });
    return {
      packages: records.map((p) => ({
        id: p.id,
        name: p.name ?? '',
        monthlyPrice: p.monthlyPrice ?? 0,
        yearlyPrice: p.yearlyPrice ?? 0,
        productLimit: p.productLimit ?? 0,
        features: p.features ?? '',
        analyticsEnabled: !!p.analyticsEnabled,
        isActive: !!p.isActive,
        sortOrder: p.sortOrder ?? 0,
      })),
    };
  },
});
