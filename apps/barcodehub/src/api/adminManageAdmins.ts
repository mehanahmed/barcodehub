import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { db } from '../server/db';
import { requireAdmin, fail } from '../server/helpers';

export default createEndpoint({
  description: 'Lists, adds or removes admins; the first user can claim admin when none exist',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'add', 'remove', 'claim']),
    email: z.string().optional(),
    name: z.string().optional(),
    id: z.string().optional(),
  }),
  outputSchema: z.object({ admins: z.array(z.object({ id: z.string(), email: z.string(), name: z.string() })) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    if (input.action === 'claim') {
      const { records } = await db.admins.findAll({ limit: 1 });
      if (records.length) fail('An admin already exists. Ask them to add you.');
      await db.admins.create({
        record: {
          email: context.user.email.toLowerCase(),
          userId: me,
          name: [context.user.firstName, context.user.lastName].filter(Boolean).join(' '),
        },
      });
    } else {
      await requireAdmin(context);
      if (input.action === 'add') {
        const email = (input.email ?? '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) fail('Enter a valid email.');
        // Admin rights attach to an existing account, never to a bare email anyone could sign up with later.
        const { rows } = await db.sql({ query: `SELECT id, name FROM "ziteUsers" WHERE "email" = $1`, params: [email] });
        const account = rows[0];
        if (!account) fail('No account uses this email yet. Ask them to sign up first, then add them.');
        if (await db.admins.findOne({ filters: { userId: String(account.id) } })) fail('Already an admin.');
        await db.admins.create({
          record: { email, userId: String(account.id), name: input.name?.trim() || (account.name ? String(account.name) : null) },
        });
      }
      if (input.action === 'remove' && input.id) {
        const a = await db.admins.findOne({ id: input.id });
        if (a?.userId === me) fail("You can't remove yourself.");
        await db.admins.delete({ id: input.id });
      }
    }
    const { records } = await db.admins.findAll({ sort: [{ field: 'email', direction: 'asc' }] });
    return { admins: records.map((a) => ({ id: a.id, email: a.email ?? '', name: a.name ?? '' })) };
  },
});
