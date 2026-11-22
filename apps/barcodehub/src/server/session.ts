import crypto from 'node:crypto';
import { pgDb } from './pgClient';

// Resolved on first use, not at import: `vite build` imports this file through vite.config.ts
// in production mode but never signs a session, so it must not need the secret.
let sessionSecret = '';
function secret(): string {
  if (sessionSecret) return sessionSecret;
  if (process.env.SESSION_SECRET) return (sessionSecret = process.env.SESSION_SECRET);
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be set in production.');
  console.warn('[session] SESSION_SECRET not set: using a random secret; sessions end when the server restarts.');
  return (sessionSecret = crypto.randomBytes(32).toString('hex'));
}
const SESSION_VERSION = 'bhub_s1';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Admin rights belong to an account id. Emails are unverified, so they never grant admin. */
export async function checkIsAdmin(userId?: string | null): Promise<boolean> {
  if (!userId || typeof userId !== 'string') return false;
  const admin = await pgDb.admins.findOne({ filters: { userId } });
  return !!admin;
}

// Async scrypt runs on libuv's thread pool, so hashing never blocks other requests.
function scrypt(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

/** Hashes a password as `scrypt$<salt>$<hash>` (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, saltHex, hashHex] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// shortcut: in-memory, so limits reset on restart and aren't shared between processes; move to the DB if the API ever runs on more than one process.
// Callers record failures only for existing accounts, so the map never grows past the number of users.
export const MAX_LOGIN_FAILURES = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; since: number }>();

/** True while an email has too many recent failed sign-ins. */
export function isLoginLocked(email: string, now = Date.now()): boolean {
  const f = loginFailures.get(email);
  if (f && now - f.since > LOGIN_LOCK_MS) loginFailures.delete(email);
  return (loginFailures.get(email)?.count ?? 0) >= MAX_LOGIN_FAILURES;
}

export function recordLoginFailure(email: string, now = Date.now()) {
  const f = loginFailures.get(email);
  if (!f || now - f.since > LOGIN_LOCK_MS) loginFailures.set(email, { count: 1, since: now });
  else f.count += 1;
}

export function clearLoginFailures(email: string) {
  loginFailures.delete(email);
}

export interface SessionPayload {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  role?: 'admin' | 'user';
  iat?: number;
  exp?: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

function sign(data: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Creates a cryptographically signed session token.
 */
export function createSessionToken(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  ttlMs = DEFAULT_TTL_MS
): string {
  const now = Date.now();
  const fullPayload: SessionPayload = {
    ...payload,
    email: payload.email.toLowerCase().trim(),
    iat: now,
    exp: now + ttlMs,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${SESSION_VERSION}.${encodedPayload}`;
  const signature = sign(dataToSign, secret());

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies a signed session token. Returns the payload if valid and not expired, null otherwise.
 */
export function verifySessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [version, encodedPayload, receivedSig] = parts;
  if (version !== SESSION_VERSION) {
    return null;
  }

  const dataToSign = `${version}.${encodedPayload}`;
  const expectedSig = sign(dataToSign, secret());

  // Timing-safe comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expectedSig);
  const receivedBuf = Buffer.from(receivedSig);

  if (expectedBuf.length !== receivedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return null;
  }

  try {
    const json = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(json) as SessionPayload;

    if (!payload.id || !payload.email || !payload.exp) {
      return null;
    }

    if (Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
