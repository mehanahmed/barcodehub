import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireAdmin } from '../server/helpers';

export default createEndpoint({
  description: "Changes a tenant's package, end date or status",
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
    packageId: z.string().nullable(),
    subscriptionEnds: z.string().nullable(),
    status: z.enum(['Active', 'Suspended']),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context);
    await db.tenants.update({
      id: input.id,
      record: { package: input.packageId, subscriptionEnds: input.subscriptionEnds, status: input.status },
    });
    return { ok: true };
  },
});
