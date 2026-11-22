import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists active subscription packages for the pricing page',
  inputSchema: z.object({}),
  outputSchema: z.object({ packages: z.array(z.any()) }),
  execute: async () => {
    const { records } = await zite.packages.findAll({
      filters: { isActive: true },
      sort: [{ field: 'sortOrder', direction: 'asc' }],
    });
    return {
      packages: records.map((p) => ({
        id: p.id,
        name: p.name ?? '',
        monthlyPrice: p.monthlyPrice ?? 0,
        yearlyPrice: p.yearlyPrice ?? 0,
        productLimit: p.productLimit ?? 0,
        features: (p.features ?? '')
          .replace(/\\n/g, '\n')
          .replace(/\r/g, '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        analyticsEnabled: !!p.analyticsEnabled,
      })),
    };
  },
});
