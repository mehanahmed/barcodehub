import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { findMyTenant, fail } from '../server/helpers';

export default createEndpoint({
  description: 'Creates the company (tenant) for a newly signed-up user on the free package',
  authenticated: true,
  inputSchema: z.object({ companyName: z.string(), slug: z.string(), logoUrl: z.string().optional() }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    if (await findMyTenant(context.user.id)) fail('You already have a company.');
    const name = input.companyName.trim();
    const slug = input.slug.trim().toLowerCase();
    if (name.length < 2) fail('Company name is too short.');
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) fail('Slug must be 3–40 lowercase letters, digits or dashes.');
    if (await zite.tenants.findOne({ filters: { slug } })) fail('That URL slug is already taken.');

    const { records: free } = await zite.packages.findAll({
      filters: { isActive: true, monthlyPrice: 0 },
      sort: [{ field: 'sortOrder', direction: 'asc' }],
      limit: 1,
    });
    const t = await zite.tenants.create({
      record: {
        companyName: name,
        slug,
        owner: context.user.id,
        status: 'Active',
        package: free[0]?.id ?? null,
        logo: input.logoUrl ? [input.logoUrl] : null,
      },
    });
    return { id: t.id };
  },
});
