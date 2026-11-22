/**
 * Browser-side callers for the endpoints in src/api/*.ts. Each posts { inputs } to /api/<name>;
 * the session cookie goes along automatically. Input and output types come straight from the
 * endpoint files (type-only imports, so no server code reaches the browser bundle).
 */
import type { z } from 'zod';

type AnyEndpoint = { inputSchema: z.ZodTypeAny; execute: (...args: any[]) => unknown };
type InputOf<E extends AnyEndpoint> = z.input<E['inputSchema']>;
type OutputOf<E extends AnyEndpoint> = Awaited<ReturnType<E['execute']>>;

async function post(name: string, input: unknown) {
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ inputs: input }),
  });
  if (!res.ok) {
    // errMsg() (lib/errors.ts) pulls the server's message out of this exact format.
    throw new Error(`API call failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

const caller =
  <E extends AnyEndpoint>(name: string) =>
  (input: InputOf<E>): Promise<OutputOf<E>> =>
    post(name, input);

export const adminDeletePackage = caller<typeof import('../api/adminDeletePackage').default>('adminDeletePackage');
export const adminListPackages = caller<typeof import('../api/adminListPackages').default>('adminListPackages');
export const adminListPayments = caller<typeof import('../api/adminListPayments').default>('adminListPayments');
export const adminListTenants = caller<typeof import('../api/adminListTenants').default>('adminListTenants');
export const adminManageAdmins = caller<typeof import('../api/adminManageAdmins').default>('adminManageAdmins');
export const adminOverview = caller<typeof import('../api/adminOverview').default>('adminOverview');
export const adminReviewPayment = caller<typeof import('../api/adminReviewPayment').default>('adminReviewPayment');
export const adminSavePackage = caller<typeof import('../api/adminSavePackage').default>('adminSavePackage');
export const adminUpdateTenant = caller<typeof import('../api/adminUpdateTenant').default>('adminUpdateTenant');
export const createTenant = caller<typeof import('../api/createTenant').default>('createTenant');
export const deleteProduct = caller<typeof import('../api/deleteProduct').default>('deleteProduct');
export const getAnalytics = caller<typeof import('../api/getAnalytics').default>('getAnalytics');
export const getBrand = caller<typeof import('../api/getBrand').default>('getBrand');
export const getMyAccount = caller<typeof import('../api/getMyAccount').default>('getMyAccount');
export const getMyProduct = caller<typeof import('../api/getMyProduct').default>('getMyProduct');
export const getPublicProduct = caller<typeof import('../api/getPublicProduct').default>('getPublicProduct');
export const listMyPayments = caller<typeof import('../api/listMyPayments').default>('listMyPayments');
export const listMyProducts = caller<typeof import('../api/listMyProducts').default>('listMyProducts');
export const listPackages = caller<typeof import('../api/listPackages').default>('listPackages');
export const saveProduct = caller<typeof import('../api/saveProduct').default>('saveProduct');
export const searchProducts = caller<typeof import('../api/searchProducts').default>('searchProducts');
export const submitPayment = caller<typeof import('../api/submitPayment').default>('submitPayment');
export const suggestBarcode = caller<typeof import('../api/suggestBarcode').default>('suggestBarcode');
export const updateTenant = caller<typeof import('../api/updateTenant').default>('updateTenant');

export type SaveProductInputType = InputOf<typeof import('../api/saveProduct').default>;
