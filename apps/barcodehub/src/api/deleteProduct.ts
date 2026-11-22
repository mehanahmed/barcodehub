import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireTenant, first, fail } from '../server/helpers';

export default createEndpoint({
  description: "Deletes one of the signed-in tenant's products",
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    const p = await db.products.findOne({ id: input.id });
    if (!p || first(p.tenant) !== tenant.id) fail('Product not found.');
    await db.products.delete({ id: input.id });
    return { ok: true };
  },
});
