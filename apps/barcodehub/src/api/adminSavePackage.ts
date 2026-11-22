import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireAdmin, fail } from '../server/helpers';

export default createEndpoint({
  description: 'Creates or updates a subscription package',
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    name: z.string(),
    monthlyPrice: z.number(),
    yearlyPrice: z.number(),
    productLimit: z.number(),
    features: z.string(),
    analyticsEnabled: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context);
    if (!input.name.trim()) fail('Name is required.');
    if (input.monthlyPrice < 0 || input.yearlyPrice < 0 || input.productLimit < 0) fail('Values cannot be negative.');
    const { id, ...rest } = input;
    const record = { ...rest, name: rest.name.trim() };
    if (id) await db.packages.update({ id, record });
    else await db.packages.create({ record });
    return { ok: true };
  },
});
