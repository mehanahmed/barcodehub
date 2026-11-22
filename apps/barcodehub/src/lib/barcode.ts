export type BarcodeType = 'EAN-13' | 'UPC-A' | 'System Code128';

export const BARCODE_TYPES: BarcodeType[] = ['EAN-13', 'UPC-A', 'System Code128'];

/** GS1 mod-10 check digit for a digit string (without its check digit). */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  const digits = body.split('').reverse();
  digits.forEach((d, i) => {
    sum += Number(d) * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10;
}

/**
 * Normalizes a typed barcode: trims, uppercases, and for EAN-13 / UPC-A appends the
 * check digit when exactly one digit short (12 or 11 digits). Anything else is returned unchanged.
 */
export function withCheckDigit(type: string, value: string): string {
  const v = value.trim().toUpperCase();
  if (!isGtin(type) || !/^\d+$/.test(v)) return v;
  const len = type === 'EAN-13' ? 13 : 12;
  return v.length === len - 1 ? v + gs1CheckDigit(v) : v;
}

export function validateBarcode(type: string, value: string): string | null {
  const v = value.trim();
  if (!v) return 'Barcode number is required';
  if (type === 'EAN-13' || type === 'UPC-A') {
    const len = type === 'EAN-13' ? 13 : 12;
    if (!/^\d+$/.test(v)) return 'Only digits are allowed';
    if (v.length !== len) return `${type} must be ${len} digits, or ${len - 1} to have the check digit added`;
    if (gs1CheckDigit(v.slice(0, -1)) !== Number(v.slice(-1))) {
      return `Check digit is wrong — it should end in ${gs1CheckDigit(v.slice(0, -1))}`;
    }
    return null;
  }
  if (!/^[A-Z0-9\-]{4,40}$/.test(v)) return 'Use 4–40 capital letters, digits or dashes';
  return null;
}

export function jsBarcodeFormat(type: string): string {
  if (type === 'EAN-13') return 'EAN13';
  if (type === 'UPC-A') return 'UPC';
  return 'CODE128';
}

export function isGtin(type?: string) {
  return type === 'EAN-13' || type === 'UPC-A';
}

/**
 * True for a real, globally unique GTIN: EAN-13 / UPC-A outside GS1's restricted-circulation ranges
 * (EAN 020–029, 040–049, 200–299, 980–999 coupons/refunds; UPC number system 2, 4, 5).
 * Restricted numbers are reused by many shops, so they must never be published as a GTIN.
 */
export function isGlobalGtin(type: string | undefined, value: string) {
  if (type === 'EAN-13') return !/^(0[24]|2|9[89])/.test(value);
  if (type === 'UPC-A') return !/^[245]/.test(value);
  return false;
}
