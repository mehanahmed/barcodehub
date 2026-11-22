import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireAdmin, fail } from '../server/helpers';

export default createEndpoint({
  description: 'Deletes a package if no tenants are actively using it',
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context);
    const pkg = await db.packages.findOne({ id: input.id });
    if (!pkg) fail('Package not found.');

    const { records: tenantsUsing } = await db.tenants.findAll({
      filters: { package: input.id },
      limit: 1,
    });
    if (tenantsUsing.length > 0) {
      fail('Cannot delete this package because it is currently assigned to one or more tenants. Deactivate (hide) it instead.');
    }

    await db.packages.delete({ id: input.id });
    return { ok: true };
  },
});
