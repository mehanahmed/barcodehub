import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireTenant, fail } from '../server/helpers';

export default createEndpoint({
  description: 'Submits a bKash/Nagad/bank payment for review by the SaaS owner',
  authenticated: true,
  inputSchema: z.object({
    packageId: z.string(),
    billingPeriod: z.enum(['Monthly', 'Yearly']),
    method: z.enum(['bKash', 'Nagad', 'Rocket', 'Bank Transfer']),
    senderNumber: z.string(),
    transactionId: z.string(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    const txn = input.transactionId.trim().toUpperCase();
    if (txn.length < 4) fail('Enter a valid transaction ID.');
    if (input.senderNumber.trim().length < 5) fail('Enter the number or account you paid from.');
    const pkg = await db.packages.findOne({ id: input.packageId });
    if (!pkg || !pkg.isActive) fail('Package not found.');
    const amount = input.billingPeriod === 'Yearly' ? pkg.yearlyPrice ?? 0 : pkg.monthlyPrice ?? 0;
    if (amount <= 0) fail('This package is free — no payment needed.');

    if (await db.payments.findOne({ filters: { transactionId: txn } })) fail('This transaction ID was already submitted.');
    const pending = await db.payments.findOne({ filters: { tenant: tenant.id, status: 'Pending' } });
    if (pending) fail('You already have a payment waiting for review.');

    await db.payments.create({
      record: {
        transactionId: txn,
        tenant: tenant.id,
        package: pkg.id,
        method: input.method,
        billingPeriod: input.billingPeriod,
        amount,
        senderNumber: input.senderNumber.trim(),
        status: 'Pending',
      },
    });
    return { ok: true };
  },
});
