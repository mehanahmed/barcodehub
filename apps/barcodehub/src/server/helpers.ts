import { ZiteError, type ZiteRequestContext } from 'zitejs/backend';
import { zite, type TenantsRecordType, type PackagesRecordType } from 'zitejs/db';

import { checkIsAdmin } from './session';

export { checkIsAdmin };

export const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

export function toImageUrl(img: any): string | null {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return toImageUrl(img[0]);
  if (typeof img === 'object' && typeof img.url === 'string') return img.url;
  return null;
}

export function toImageUrls(images: any): string[] {
  if (!images) return [];
  if (!Array.isArray(images)) {
    const single = toImageUrl(images);
    return single ? [single] : [];
  }
  return images.map(toImageUrl).filter((u): u is string => typeof u === 'string' && u.length > 0);
}

export async function findMyTenant(userId: string) {
  const { records } = await zite.tenants.findAll({ filters: { owner: userId }, limit: 1 });
  return records[0] as TenantsRecordType | undefined;
}

export async function requireTenant(context: ZiteRequestContext) {
  const tenant = await findMyTenant(context.user.id);
  if (!tenant) {
    throw new ZiteError({ code: 'NOT_FOUND', message: 'No tenant', userFacingMessage: 'Please set up your company first.' });
  }
  if (tenant.status === 'Suspended') {
    throw new ZiteError({ code: 'FORBIDDEN', message: 'Suspended', userFacingMessage: 'This account is suspended. Please contact support.' });
  }
  return tenant;
}

export async function getPackage(id?: string) {
  if (!id) return undefined;
  return (await zite.packages.findOne({ id })) as PackagesRecordType | undefined;
}

export function isExpired(tenant: TenantsRecordType, pkg?: PackagesRecordType) {
  if (!pkg) return true;
  const price = Number(pkg.monthlyPrice ?? 0);
  if (price <= 0) return false;
  if (!tenant.subscriptionEnds) return true;
  return tenant.subscriptionEnds < new Date().toISOString().slice(0, 10);
}

export async function requireAdmin(context: ZiteRequestContext) {
  if (!context?.user?.id) {
    throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Authentication required', userFacingMessage: 'Please sign in to continue.' });
  }
  if (!(await checkIsAdmin(context.user.id))) {
    throw new ZiteError({ code: 'FORBIDDEN', message: 'Not admin', userFacingMessage: 'Admin access only.' });
  }
}

export function fail(message: string): never {
  throw new ZiteError({ code: 'BAD_REQUEST', message, userFacingMessage: message });
}
