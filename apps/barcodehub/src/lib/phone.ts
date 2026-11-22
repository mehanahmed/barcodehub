/**
 * Normalizes a phone number to one stored form, so "01712345678", "+880 1712-345678" and "8801712345678"
 * all find the same account. Bangladeshi mobiles become +8801XXXXXXXXX; other countries must start with "+".
 * Returns null when the input is not a usable phone number.
 * Pure (no env, no DOM): the server plugin imports it outside Vite's transform.
 */
export function normalizePhone(raw: string): string | null {
  const v = String(raw ?? '').replace(/[\s\-().]/g, '');
  if (/^01[3-9]\d{8}$/.test(v)) return `+88${v}`;
  if (/^8801[3-9]\d{8}$/.test(v)) return `+${v}`;
  if (/^\+8801[3-9]\d{8}$/.test(v)) return v;
  if (/^\+88/.test(v)) return null; // a Bangladeshi number in the wrong shape
  if (/^\+[1-9]\d{7,14}$/.test(v)) return v; // international, E.164
  return null;
}

/** True when a sign-in identifier is an email rather than a phone number. */
export const isEmailIdentifier = (id: string) => id.includes('@');
