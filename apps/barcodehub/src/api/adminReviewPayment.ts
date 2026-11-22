import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin, first, fail } from '../server/helpers';

export default createEndpoint({
  description: 'Approves or rejects a payment; approval activates the package',
  authenticated: true,
  inputSchema: z.object({ id: z.string(), approve: z.boolean(), note: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context);
    const pay = await zite.payments.findOne({ id: input.id });
    if (!pay) fail('Payment not found.');
    if (pay.status !== 'Pending') fail('This payment was already reviewed.');
    if (!input.approve && !input.note.trim()) fail('Add a note explaining the rejection.');

    const tenantId = first(pay.tenant);
    const tenant = input.approve && tenantId ? await zite.tenants.findOne({ id: tenantId }) : undefined;
    if (input.approve && !tenant) fail('Tenant not found.');

    // Claim the payment in one conditional write, so a double-click or a second admin can't apply it twice.
    const { rows } = await zite.sql({
      query: `UPDATE "Payments" SET "status" = $2, "adminNote" = $3, "reviewedBy" = $4, "reviewedAt" = now()
              WHERE "id" = $1 AND "status" = 'Pending' RETURNING "id"`,
      params: [pay.id, input.approve ? 'Approved' : 'Rejected', input.note.trim() || null, context.user.id],
    });
    if (!rows[0]) fail('This payment was already reviewed.');

    if (input.approve && tenant) {
      const today = new Date().toISOString().slice(0, 10);
      const samePkg = first(tenant.package) === first(pay.package);
      const startStr = samePkg && tenant.subscriptionEnds && tenant.subscriptionEnds > today ? tenant.subscriptionEnds : today;
      const start = new Date(startStr + 'T00:00:00Z');
      if (pay.billingPeriod === 'Yearly') start.setUTCFullYear(start.getUTCFullYear() + 1);
      else start.setUTCMonth(start.getUTCMonth() + 1);
      try {
        await zite.tenants.update({
          id: tenant.id,
          record: { package: first(pay.package) ?? null, subscriptionEnds: start.toISOString().slice(0, 10) },
        });
      } catch (err) {
        // Put the payment back so the admin can retry instead of it showing Approved with no time added.
        await zite.payments.update({ id: pay.id, record: { status: 'Pending', adminNote: null, reviewedBy: null, reviewedAt: null } });
        throw err;
      }
    }
    return { ok: true };
  },
});
