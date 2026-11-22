import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireTenant, fail, toImageUrl } from '../server/helpers';

export default createEndpoint({
  description: "Updates the signed-in tenant's company settings",
  authenticated: true,
  inputSchema: z.object({
    companyName: z.string(),
    slug: z.string(),
    gs1CompanyPrefix: z.string().optional(),
    website: z.string(),
    phone: z.string(),
    address: z.string(),
    logoUrl: z.string().nullable(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    const slug = input.slug.trim().toLowerCase();
    if (input.companyName.trim().length < 2) fail('Company name is too short.');
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) fail('Slug must be 3–40 lowercase letters, digits or dashes.');
    const prefix = input.gs1CompanyPrefix?.trim() ?? '';
    // No minimum length; at most 11 digits so an EAN-13 still has room for an item number and the check digit.
    if (prefix && !/^\d{1,11}$/.test(prefix)) fail('Company prefix must be digits only, at most 11.');
    const clash = await zite.tenants.findOne({ filters: { slug } });
    if (clash && clash.id !== tenant.id) fail('That URL slug is already taken.');

    const currentLogo = toImageUrl(tenant.logo);
    await zite.tenants.update({
      id: tenant.id,
      record: {
        companyName: input.companyName.trim(),
        slug,
        // Older clients that don't send the field leave the saved prefix untouched.
        ...(input.gs1CompanyPrefix !== undefined ? { gs1CompanyPrefix: prefix || null } : {}),
        website: input.website.trim() || null,
        phone: input.phone.trim() || null,
        address: input.address.trim() || null,
        ...(input.logoUrl !== currentLogo ? { logo: input.logoUrl ? [input.logoUrl] : null } : {}),
      },
    });
    return { ok: true };
  },
});
