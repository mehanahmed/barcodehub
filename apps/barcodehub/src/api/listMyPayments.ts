import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireTenant, first } from '../server/helpers';

export default createEndpoint({
  description: "Lists the signed-in tenant's subscription payments",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ payments: z.array(z.any()) }),
  execute: async ({ context }) => {
    const tenant = await requireTenant(context);
    const { records } = await zite.payments.findAll({
      filters: { tenant: tenant.id },
      // The table has no "submittedAt" column; the submission time is created_at (same as adminListPayments).
      sort: [{ field: 'created_at', direction: 'desc' }],
      limit: 100,
    });
    const { records: pkgs } = await zite.packages.findAll({});
    const names = new Map(pkgs.map((p) => [p.id, p.name ?? '']));
    return {
      payments: records.map((p) => ({
        id: p.id,
        transactionId: p.transactionId ?? '',
        packageName: names.get(first(p.package) ?? '') ?? '',
        method: p.method ?? '',
        billingPeriod: p.billingPeriod ?? '',
        amount: p.amount ?? 0,
        status: p.status ?? 'Pending',
        adminNote: p.adminNote ?? '',
        submittedAt: String((p as { created_at?: unknown }).created_at ?? ''),
      })),
    };
  },
});
