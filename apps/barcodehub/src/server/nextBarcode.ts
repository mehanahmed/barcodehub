import { db } from './db';
import type { TenantsRecordType } from './db';
import { gs1CheckDigit } from '../lib/barcode';
import { fail } from './helpers';

/**
 * GS1 restricted-circulation ranges, used when a brand has no GS1 licence of its own.
 * Numbers here are never assigned to another company's products, so auto-numbering can't steal a real barcode.
 * They are only valid inside BarcodeHub and the brand's own shop; supermarkets need a GS1-licensed number.
 */
export const INTERNAL_RANGES = {
  'EAN-13': { prefix: '200', bodyLen: 12 }, // 200–299 restricted circulation
  'UPC-A': { prefix: '4', bodyLen: 11 }, // number system 4: in-store use
} as const;

/**
 * Which number range a tenant's EAN-13 / UPC-A auto-numbering uses: its own company prefix from Settings when set
 * (UPC-A needs one starting with 0, which UPC-A drops), otherwise the internal-use range.
 */
export function rangeFor(tenant: TenantsRecordType, type: keyof typeof INTERNAL_RANGES): { prefix: string; bodyLen: number } {
  const own = (tenant.gs1CompanyPrefix ?? '').trim();
  const internal = INTERNAL_RANGES[type];
  if (!/^\d{1,11}$/.test(own)) return internal;
  if (type === 'EAN-13') return { prefix: own, bodyLen: 12 };
  return own.startsWith('0') && own.length > 1 ? { prefix: own.slice(1), bodyLen: 11 } : internal;
}

/** true when another database already uses the number, false when free, null when it could not be checked. */
export type TakenCheck = (barcode: string) => Promise<boolean | null>;

/**
 * Returns the next free number for a tenant and type: BH-XXX-000001 for System Code128, otherwise from rangeFor().
 * With isTaken (e.g. Open Food Facts), EAN-13 / UPC-A numbers it reports as used are skipped; checked is false
 * when it could not answer, so the number is free in BarcodeHub but unverified outside it.
 */
export async function nextBarcode(tenant: TenantsRecordType, type: string, isTaken?: TakenCheck): Promise<{ barcode: string; checked: boolean }> {
  if (type === 'System Code128') {
    const code = (tenant.slug ?? 'XXX').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    const prefix = `BH-${code}-`;
    const { rows } = await db.sql({
      query: `SELECT MAX(CAST(SUBSTRING("barcodeNumber" FROM $2) AS INTEGER)) AS m FROM "Products"
              WHERE "barcodeNumber" LIKE $1 AND "barcodeNumber" ~ '^BH-[A-Z0-9]{3}-[0-9]{6}$'`,
      params: [`${prefix}%`, prefix.length + 1],
    });
    const n = Number(rows[0]?.m ?? 0) + 1;
    return { barcode: `${prefix}${String(n).padStart(6, '0')}`, checked: true };
  }

  if (!(type in INTERNAL_RANGES)) fail('Unknown barcode type.');
  const { prefix, bodyLen } = rangeFor(tenant, type as keyof typeof INTERNAL_RANGES);
  const refLen = bodyLen - prefix.length;
  // Numbering is shared by all brands: barcodeNumber is unique across BarcodeHub.
  const { rows } = await db.sql({
    // ::int casts: untyped FROM/FOR params make Postgres pick the regex form of SUBSTRING.
    query: `SELECT MAX(CAST(SUBSTRING("barcodeNumber" FROM $2::int FOR $3::int) AS BIGINT)) AS m FROM "Products"
            WHERE "barcodeNumber" LIKE $1 AND "barcodeNumber" ~ '^[0-9]+$' AND LENGTH("barcodeNumber") = $4`,
    params: [`${prefix}%`, prefix.length + 1, refLen, bodyLen + 1],
  });
  let next = Number(rows[0]?.m ?? 0) + 1;
  // Bounded so a long run of used numbers can't turn one click into hundreds of outside requests.
  for (let tries = 0; tries < 25; tries++, next++) {
    if (String(next).length > refLen) break;
    const body = prefix + String(next).padStart(refLen, '0');
    const barcode = body + gs1CheckDigit(body);
    const taken = isTaken ? await isTaken(barcode) : false;
    if (taken === null) return { barcode, checked: false };
    if (!taken) return { barcode, checked: true };
  }
  if (String(next).length > refLen) fail(`All ${type} numbers in the ${prefix}… range are used. Type a number yourself, or use a longer-range company prefix.`);
  return fail('The next 25 numbers are already used outside BarcodeHub. Type a number yourself.');
}
