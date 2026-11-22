import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../server/helpers';

export default createEndpoint({
  description: 'Lists subscription payments for review',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ payments: z.array(z.any()) }),
  execute: async ({ context }) => {
    await requireAdmin(context);
    const { rows } = await zite.sql({
      query: `
        SELECT p.id, p."transactionId", p."method", p."billingPeriod", p."amount", p."senderNumber", p."status",
               p."adminNote", p.created_at AS "submittedAt", p."reviewedAt",
               (SELECT t."companyName" FROM "PaymentsTenants" l JOIN "Tenants" t ON t.id = l."tenantsId" WHERE l."paymentsId" = p.id LIMIT 1) AS tenant,
               (SELECT k."name" FROM "PackagesPayments" l JOIN "Packages" k ON k.id = l."packagesId" WHERE l."paymentsId" = p.id LIMIT 1) AS package
        FROM "Payments" p
        ORDER BY (p."status" = 'Pending') DESC, p.created_at DESC
        LIMIT 500`,
    });
    return {
      payments: rows.map((r) => ({
        id: String(r.id),
        transactionId: String(r.transactionId ?? ''),
        method: String(r.method ?? ''),
        billingPeriod: String(r.billingPeriod ?? ''),
        amount: Number(r.amount ?? 0),
        senderNumber: String(r.senderNumber ?? ''),
        status: String(r.status ?? 'Pending'),
        adminNote: String(r.adminNote ?? ''),
        submittedAt: String(r.submittedAt ?? ''),
        tenant: String(r.tenant ?? ''),
        package: String(r.package ?? ''),
      })),
    };
  },
});
