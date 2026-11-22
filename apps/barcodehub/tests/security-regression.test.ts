import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { uploadFile } from '../src/server/upload';
import { createPgTableClient } from '../src/server/pgClient';
import { db as pgDb } from '../src/server/db';
import {
  createSessionToken,
  verifySessionToken,
  hashPassword,
  verifyPassword,
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
  MAX_LOGIN_FAILURES,
  LOGIN_LOCK_MS,
} from '../src/server/session';
import { checkIsAdmin, requireAdmin } from '../src/server/helpers';
import adminOverview from '../src/api/adminOverview';
import getPublicProduct from '../src/api/getPublicProduct';
import {
  shouldRecordView,
  recordProductView,
  resetViewTrackingCache,
  MAX_VIEWS_PER_WINDOW,
} from '../src/server/viewTracker';
import {
  SECURITY_HEADERS,
  applySecurityHeaders,
  securityHeadersMiddleware,
} from '../src/server/securityHeaders';
import { viteApiPlugin } from '../src/server/viteApiPlugin';
import { withCheckDigit, validateBarcode } from '../src/lib/barcode';
import saveProduct from '../src/api/saveProduct';
import { errMsg } from '../src/lib/errors';
import createTenant from '../src/api/createTenant';
import getMyAccount from '../src/api/getMyAccount';
import { yearlySaving } from '../src/components/PackageCard';
import { renderHead, injectSeo, productBody, brandBody } from '../src/server/seoHtml';
import { productSeo, productNotFoundSeo, lookupSeo, type PublicProduct } from '../src/lib/seoData';
import { SITE_URL } from '../src/lib/config';
import { nextBarcode } from '../src/server/nextBarcode';
import searchProductsEndpoint from '../src/api/searchProducts';
import { normalizePhone } from '../src/lib/phone';

/** A random valid Bangladeshi mobile number, so each sign-up in the shared test database is unique. */
const testPhone = () => '017' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

describe('FIND-001: uploadFile Security Regressions', () => {
  const createdFiles: string[] = [];

  after(async () => {
    for (const f of createdFiles) {
      try {
        await rm(path.resolve(process.cwd(), 'public/uploads', f), { force: true });
      } catch {
        // cleanup ignore
      }
    }
  });

  test('valid PNG image upload succeeds with server-generated UUID filename', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const file = new File([pngHeader], 'my-product.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadFile(formData);

    assert.equal(result.success, true);
    assert.ok(result.fileName);
    assert.ok(result.url?.startsWith('/uploads/'));
    assert.ok(result.fileName.endsWith('.png'));
    assert.notEqual(result.fileName, 'my-product.png');
    assert.match(result.fileName, /^\d+-[a-f0-9-]+\.png$/);

    if (result.fileName) createdFiles.push(result.fileName);
  });

  test('path traversal in filename is completely mitigated', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngHeader], '../../etc/evil.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadFile(formData);

    assert.equal(result.success, true);
    assert.ok(result.fileName);
    assert.equal(result.fileName.includes('/'), false);
    assert.equal(result.fileName.includes('..'), false);

    if (result.fileName) createdFiles.push(result.fileName);
  });

  test('disguised file (.png extension but executable/text content) is rejected', async () => {
    const fakeContent = Buffer.from('console.log("malicious script disguised as png")');
    const file = new File([fakeContent], 'fake.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadFile(formData);

    assert.equal(result.success, undefined);
    assert.equal(result.error, 'File content does not match a valid image format.');
  });

  test('disallowed MIME type is rejected', async () => {
    const content = Buffer.from('<html><body>Hello</body></html>');
    const file = new File([content], 'page.html', { type: 'text/html' });

    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadFile(formData);

    assert.equal(result.success, undefined);
    assert.match(result.error || '', /Invalid file type/);
  });

  test('file exceeding 10MB size limit is rejected', async () => {
    const largeBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'image/png' });
    const file = new File([largeBlob], 'huge.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadFile(formData);

    assert.equal(result.success, undefined);
    assert.match(result.error || '', /exceeds maximum size limit/);
  });
});

describe('FIND-002: createPgTableClient SQL ORDER BY Security Regressions', () => {
  const client = createPgTableClient('Packages');

  test('accepts valid sortable column and ASC direction', async () => {
    const res = await client.findAll({
      sort: [{ field: 'sortOrder', direction: 'asc' }],
      limit: 2,
    });
    assert.ok(Array.isArray(res.records));
  });

  test('accepts valid sortable column and DESC direction', async () => {
    const res = await client.findAll({
      sort: [{ field: 'name', direction: 'desc' }],
      limit: 2,
    });
    assert.ok(Array.isArray(res.records));
  });

  test('malicious SQL injection in sort.field is dropped by allowlist', async () => {
    const res = await client.findAll({
      sort: [{ field: 'name"; DROP TABLE "Packages";--', direction: 'asc' }],
      limit: 2,
    });
    assert.ok(Array.isArray(res.records));
  });

  test('malicious SQL injection in sort.direction is sanitized to ASC/DESC', async () => {
    const res = await client.findAll({
      sort: [{ field: 'name', direction: ('desc; SELECT 1;--' as any) }],
      limit: 2,
    });
    assert.ok(Array.isArray(res.records));
  });

  test('unlisted/non-existent column is ignored by allowlist', async () => {
    const res = await client.findAll({
      sort: [{ field: 'nonExistentColumnXYZ', direction: 'asc' }],
      limit: 2,
    });
    assert.ok(Array.isArray(res.records));
  });
});

describe('FIND-003: Session Verification & Server-Side Admin Role Check Regressions', () => {
  test('missing session token returns null', () => {
    assert.equal(verifySessionToken(null), null);
    assert.equal(verifySessionToken(undefined), null);
    assert.equal(verifySessionToken(''), null);
  });

  test('legacy dev bypass token (dev_token_admin) is completely rejected', () => {
    assert.equal(verifySessionToken('dev_token_admin'), null);
    assert.equal(verifySessionToken('admin'), null);
    assert.equal(verifySessionToken('Bearer dev_token_admin'), null);
  });

  test('tampered session signature is rejected', () => {
    const validToken = createSessionToken({
      id: 'usr_test_1',
      email: 'user@example.com',
      role: 'user',
    });
    const parts = validToken.split('.');
    // Tamper with payload
    const tampered = `${parts[0]}.${parts[1]}xyz.${parts[2]}`;
    assert.equal(verifySessionToken(tampered), null);
  });

  test('expired session token is rejected', () => {
    // Negative TTL creates already-expired token
    const expiredToken = createSessionToken(
      { id: 'usr_test_exp', email: 'user@example.com', role: 'user' },
      -1000
    );
    assert.equal(verifySessionToken(expiredToken), null);
  });

  test('validly signed session token decodes verified identity', () => {
    const token = createSessionToken({
      id: 'brand_01',
      email: 'brand@apexbd.com',
      name: 'Apex Foods Ltd.',
      role: 'user',
    });
    const session = verifySessionToken(token);
    assert.ok(session);
    assert.equal(session.id, 'brand_01');
    assert.equal(session.email, 'brand@apexbd.com');
  });

  test('password hash verifies the right password only', async () => {
    const stored = await hashPassword('secret123');
    assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    assert.equal(await verifyPassword('secret123', stored), true);
    assert.equal(await verifyPassword('secret124', stored), false);
    assert.equal(await verifyPassword('secret123', 'garbage'), false);
  });

  test('sign-in locks after too many failures and unlocks after the window', () => {
    const email = 'lock@example.com';
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) recordLoginFailure(email, t0);
    assert.equal(isLoginLocked(email, t0), false);
    recordLoginFailure(email, t0);
    assert.equal(isLoginLocked(email, t0), true);
    assert.equal(isLoginLocked(email, t0 + LOGIN_LOCK_MS + 1), false);
    recordLoginFailure(email, t0);
    clearLoginFailures(email);
    assert.equal(isLoginLocked(email, t0), false);
  });

  test('setup admin account (admin rights belong to the user id)', async () => {
    await pgDb.sql({ query: `INSERT INTO "ziteUsers" ("id", "email") VALUES ('adm_user', 'admin@barcodehub.com')` });
    await pgDb.admins.create({ record: { email: 'admin@barcodehub.com', userId: 'adm_user', name: 'Super Admin' } });
    // An email-only row (no account behind it) must grant nothing to whoever signs up with that email later.
    await pgDb.admins.create({ record: { email: 'unclaimed@barcodehub.com', userId: null, name: 'Unclaimed' } });
  });

  test('server-side database check accepts the admin account id', async () => {
    assert.equal(await checkIsAdmin('adm_user'), true);
  });

  test('server-side database check rejects non-admin and unknown ids', async () => {
    assert.equal(await checkIsAdmin('brand_01'), false);
    assert.equal(await checkIsAdmin(''), false);
    assert.equal(await checkIsAdmin(null), false);
  });

  test('a new account using an admin email does not become admin', async () => {
    await assert.rejects(
      () => requireAdmin({ user: { id: 'squatter_1', email: 'admin@barcodehub.com' } } as any),
      (err: any) => err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () => requireAdmin({ user: { id: 'squatter_2', email: 'unclaimed@barcodehub.com' } } as any),
      (err: any) => err.code === 'FORBIDDEN'
    );
  });

  test('requireAdmin rejects unauthenticated context with UNAUTHORIZED', async () => {
    await assert.rejects(
      async () => {
        await requireAdmin({ user: null } as any);
      },
      (err: any) => {
        return err.code === 'UNAUTHORIZED';
      }
    );
  });

  test('requireAdmin rejects authenticated non-admin user with FORBIDDEN', async () => {
    await assert.rejects(
      async () => {
        await requireAdmin({
          user: { id: 'brand_01', email: 'brand@apexbd.com', name: 'Brand User' },
        } as any);
      },
      (err: any) => {
        return err.code === 'FORBIDDEN';
      }
    );
  });

  test('requireAdmin rejects token claiming admin when email is not in Admins table (privilege escalation prevention)', async () => {
    await assert.rejects(
      async () => {
        await requireAdmin({
          user: { id: 'attacker_1', email: 'attacker@spoofed.com', role: 'admin' },
        } as any);
      },
      (err: any) => {
        return err.code === 'FORBIDDEN';
      }
    );
  });

  test('requireAdmin allows verified admin from database Admins table', async () => {
    // Should resolve cleanly without throwing
    await requireAdmin({
      user: { id: 'adm_user', email: 'admin@barcodehub.com', name: 'Super Admin' },
    } as any);
  });

  test('adminOverview API endpoint rejects non-admin caller with 403 FORBIDDEN', async () => {
    await assert.rejects(
      async () => {
        await adminOverview.execute({
          input: {},
          context: {
            user: { id: 'brand_01', email: 'brand@apexbd.com', name: 'Regular User' },
          } as any,
          step: { run: async (_: string, fn: () => any) => fn(), sleep: async () => {} },
        });
      },
      (err: any) => {
        return err.code === 'FORBIDDEN';
      }
    );
  });

  test('adminOverview API endpoint succeeds for verified admin', async () => {
    const result = await adminOverview.execute({
      input: {},
      context: {
        user: { id: 'adm_user', email: 'admin@barcodehub.com', name: 'Super Admin' },
      } as any,
      step: { run: async (_: string, fn: () => any) => fn(), sleep: async () => {} },
    });
    assert.ok(result.overview);
    assert.equal(typeof result.overview.totalTenants, 'number');
  });
});

describe('FIND-004: Analytics Deduplication & Rate Limiting Regressions', () => {
  let testTenantId = '';
  let testProductId = '';
  const testBarcode = '8949999888776';

  after(async () => {
    resetViewTrackingCache();
    if (testProductId) {
      await pgDb.products.delete({ id: testProductId }).catch(() => {});
    }
    if (testTenantId) {
      await pgDb.tenants.delete({ id: testTenantId }).catch(() => {});
    }
    // Clean up created test views
    await pgDb.sql({
      query: `DELETE FROM "ProductViews" WHERE "product" = $1`,
      params: [testProductId],
    }).catch(() => {});
  });

  test('setup test tenant and published product', async () => {
    resetViewTrackingCache();
    const tenant = await pgDb.tenants.create({
      record: {
        companyName: 'Analytics Test Brand',
        slug: `test-brand-${Date.now()}`,
        status: 'Active',
      },
    });
    testTenantId = tenant.id;

    const prod = await pgDb.products.create({
      record: {
        title: 'Organic Mango Juice',
        barcodeNumber: testBarcode,
        barcodeType: 'EAN-13',
        tenant: tenant.id,
        status: 'Published',
      },
    });
    testProductId = prod.id;

    assert.ok(testTenantId);
    assert.ok(testProductId);
  });

  test('first visit records view successfully', () => {
    const decision = shouldRecordView(testProductId, {
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    assert.equal(decision.shouldRecord, true);
  });

  test('repeat visit within deduplication window is skipped (does not inflate counts)', () => {
    const decision = shouldRecordView(testProductId, {
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    assert.equal(decision.shouldRecord, false);
    assert.equal(decision.reason, 'deduplicated');
  });

  test('different product visited by same IP records a new view', () => {
    const decision = shouldRecordView('another_product_id_99', {
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    assert.equal(decision.shouldRecord, true);
  });

  test('different IP visiting original product records a view', () => {
    const decision = shouldRecordView(testProductId, {
      ip: '10.0.0.2',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    assert.equal(decision.shouldRecord, true);
  });

  test('known bot / crawler user-agent is filtered from recording views', () => {
    const decision = shouldRecordView(testProductId, {
      ip: '10.0.0.3',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    assert.equal(decision.shouldRecord, false);
    assert.equal(decision.reason, 'bot_filtered');
  });

  test('rapid repeat requests exceeding rate limit are throttled', () => {
    const spamIp = '10.0.0.99';
    // Fill quota up to limit with unique product visits
    for (let i = 0; i < MAX_VIEWS_PER_WINDOW; i++) {
      shouldRecordView(`flood_prod_${i}`, { ip: spamIp });
    }

    // Next visit should be rate limited
    const decision = shouldRecordView('flood_prod_overflow', { ip: spamIp });
    assert.equal(decision.shouldRecord, false);
    assert.equal(decision.reason, 'rate_limited');
  });

  test('getPublicProduct endpoint returns product data and records initial view', async () => {
    const ip = '172.16.0.10';
    const res = await getPublicProduct.execute({
      input: { barcode: testBarcode, source: 'QR Scan' },
      context: { ip, headers: { 'user-agent': 'Chrome/120' } } as any,
    });

    assert.ok(res.product);
    assert.equal(res.product.title, 'Organic Mango Juice');
    assert.equal(res.product.barcodeNumber, testBarcode);

    // Verify exactly 1 view recorded
    const { rows } = await pgDb.sql({
      query: `SELECT COUNT(*) AS c FROM "ProductViews" WHERE "product" = $1`,
      params: [testProductId],
    });
    assert.equal(Number(rows[0].c), 1);
  });

  test('getPublicProduct repeat visit returns full product data WITHOUT inflating view count', async () => {
    const ip = '172.16.0.10'; // Same IP as previous test
    const res = await getPublicProduct.execute({
      input: { barcode: testBarcode, source: 'QR Scan' },
      context: { ip, headers: { 'user-agent': 'Chrome/120' } } as any,
    });

    // Page must still load cleanly
    assert.ok(res.product);
    assert.equal(res.product.title, 'Organic Mango Juice');

    // View count must NOT inflate (still 1)
    const { rows } = await pgDb.sql({
      query: `SELECT COUNT(*) AS c FROM "ProductViews" WHERE "product" = $1`,
      params: [testProductId],
    });
    assert.equal(Number(rows[0].c), 1);
  });

  test('getPublicProduct still loads when rate-limited or view recording is skipped', async () => {
    const rateLimitedIp = '10.0.0.99'; // Already at rate limit
    const res = await getPublicProduct.execute({
      input: { barcode: testBarcode, source: 'Search' },
      context: { ip: rateLimitedIp, headers: { 'user-agent': 'Chrome/120' } } as any,
    });

    // Public product page is never blocked by rate limiting
    assert.ok(res.product);
    assert.equal(res.product.title, 'Organic Mango Juice');
    assert.equal(res.product.tenant.name, 'Analytics Test Brand');
  });

  test('getPublicProduct loads without source parameter (no view recorded)', async () => {
    const res = await getPublicProduct.execute({
      input: { barcode: testBarcode },
      context: { ip: '10.0.0.25' } as any,
    });

    assert.ok(res.product);
    assert.equal(res.product.title, 'Organic Mango Juice');
  });
});

describe('FIND-005: HTTP Security Headers Regressions', () => {
  function createMockResponse() {
    const headers: Record<string, string | string[]> = {};
    return {
      statusCode: 200,
      headers,
      setHeader(name: string, value: string | string[]) {
        headers[name.toLowerCase()] = value;
        headers[name] = value;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()] || headers[name];
      },
      end(body?: string) {
        (this as any).body = body;
        return this;
      },
    };
  }

  test('SECURITY_HEADERS contains X-Content-Type-Options: nosniff to prevent MIME sniffing (CWE-693)', () => {
    assert.equal(SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff');
  });

  test('SECURITY_HEADERS contains X-Frame-Options: SAMEORIGIN to prevent Clickjacking (CWE-1021)', () => {
    assert.equal(SECURITY_HEADERS['X-Frame-Options'], 'SAMEORIGIN');
  });

  test('SECURITY_HEADERS contains Strict-Transport-Security (HSTS) with at least 1 year max-age', () => {
    const hsts = SECURITY_HEADERS['Strict-Transport-Security'];
    assert.ok(hsts);
    assert.ok(hsts.includes('max-age=31536000'));
    assert.ok(hsts.includes('includeSubDomains'));
  });

  test('SECURITY_HEADERS contains strict Referrer-Policy and Permissions-Policy', () => {
    assert.equal(SECURITY_HEADERS['Referrer-Policy'], 'strict-origin-when-cross-origin');
    const perm = SECURITY_HEADERS['Permissions-Policy'];
    assert.ok(perm);
    assert.ok(perm.includes('camera=()'));
    assert.ok(perm.includes('microphone=()'));
    assert.ok(perm.includes('geolocation=()'));
  });

  test('SECURITY_HEADERS contains Content-Security-Policy with defensive controls', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    assert.ok(csp, 'CSP header should be defined');
    assert.ok(csp.includes("default-src 'self'"), 'CSP requires default-src');
    assert.ok(csp.includes("frame-ancestors 'self'"), 'CSP requires frame-ancestors');
    assert.ok(csp.includes("base-uri 'self'"), 'CSP requires base-uri');
    assert.ok(csp.includes("form-action 'self'"), 'CSP requires form-action');
    assert.ok(!csp.includes('zite'), 'no third-party runtime script is allowed');
  });

  test('applySecurityHeaders attaches all security headers to a response object', () => {
    const res = createMockResponse();
    applySecurityHeaders(res);

    assert.equal(res.getHeader('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.getHeader('X-Frame-Options'), 'SAMEORIGIN');
    assert.ok(res.getHeader('Strict-Transport-Security'));
    assert.ok(res.getHeader('Content-Security-Policy'));
    assert.equal(res.getHeader('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.equal(res.getHeader('X-XSS-Protection'), '0');
  });

  test('securityHeadersMiddleware applies security headers and continues pipeline via next()', () => {
    const middleware = securityHeadersMiddleware();
    const res = createMockResponse();
    let nextCalled = false;

    middleware({} as any, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.getHeader('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.getHeader('X-Frame-Options'), 'SAMEORIGIN');
    assert.ok(res.getHeader('Strict-Transport-Security'));
  });

  test('viteApiPlugin provides both configureServer and configurePreviewServer hooks', () => {
    const plugin = viteApiPlugin();
    assert.equal(plugin.name, 'vite-plugin-local-api');
    assert.equal(typeof plugin.configureServer, 'function');
    assert.equal(typeof (plugin as any).configurePreviewServer, 'function');
  });

  test('viteApiPlugin middleware attaches security headers to non-API and API requests', async () => {
    const plugin = viteApiPlugin();
    const middlewares: Array<(req: any, res: any, next: () => void) => void> = [];
    const mockServer: any = {
      config: { root: process.cwd() },
      middlewares: {
        use: (fn: any) => middlewares.push(fn),
      },
    };

    plugin.configureServer!(mockServer);
    assert.ok(middlewares.length >= 2, 'Should register security header and api middlewares');

    // Test non-API request pass-through has security headers attached
    const resNonApi = createMockResponse();
    let nextCalled = false;
    middlewares[0]({ url: '/index.html' }, resNonApi, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(resNonApi.getHeader('X-Content-Type-Options'), 'nosniff');
    assert.equal(resNonApi.getHeader('X-Frame-Options'), 'SAMEORIGIN');
    assert.ok(resNonApi.getHeader('Strict-Transport-Security'));
  });

  test('viteApiPlugin auth/session refuses to mint a session from an identity in the request body', async () => {
    const plugin = viteApiPlugin();
    const middlewares: Array<(req: any, res: any, next: () => void) => void> = [];
    plugin.configureServer!({ config: { root: process.cwd() }, middlewares: { use: (fn: any) => middlewares.push(fn) } } as any);

    const res = createMockResponse();
    const req = {
      url: '/api/auth/session',
      headers: { 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify({ id: 'x', email: 'admin@barcodehub.com' }));
      },
    };
    await middlewares[2](req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.equal(res.getHeader('Set-Cookie'), undefined);
  });

  test('viteApiPlugin sign-up issues cookie with HttpOnly flag', async () => {
    const plugin = viteApiPlugin();
    const middlewares: Array<(req: any, res: any, next: () => void) => void> = [];
    const mockServer: any = {
      config: { root: process.cwd() },
      middlewares: {
        use: (fn: any) => middlewares.push(fn),
      },
    };
    plugin.configureServer!(mockServer);

    const apiMiddleware = middlewares[2];
    const res = createMockResponse();
    const req = {
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify({ email: `signup_${Date.now()}@example.com`, phone: testPhone(), password: 'secret123', name: 'Tester' }));
      },
    };

    await apiMiddleware(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const setCookie = res.getHeader('Set-Cookie');
    assert.ok(setCookie);
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
    assert.ok(cookieStr.includes('barcodehub_session='));
    assert.ok(cookieStr.includes('HttpOnly'), 'Session cookie must have HttpOnly flag');
    assert.ok(cookieStr.includes('SameSite=Lax'), 'Session cookie must have SameSite=Lax flag');
    assert.equal(res.getHeader('X-Content-Type-Options'), 'nosniff');
  });

  test('viteApiPlugin profile update saves for the signed-in user and refreshes the session', async () => {
    const middlewares: Array<(req: any, res: any, next: () => void) => void> = [];
    viteApiPlugin().configureServer!({ config: { root: process.cwd() }, middlewares: { use: (fn: any) => middlewares.push(fn) } } as any);
    const call = async (url: string, body: object, cookie = '') => {
      const res = createMockResponse();
      await middlewares[2](
        { url, headers: { 'content-type': 'application/json', cookie }, [Symbol.asyncIterator]: async function* () { yield Buffer.from(JSON.stringify(body)); } },
        res,
        () => {}
      );
      const setCookie = res.getHeader('Set-Cookie');
      return { res, cookie: (Array.isArray(setCookie) ? setCookie[0] : String(setCookie ?? '')).split(';')[0] };
    };

    const email = `profile_${Date.now()}@example.com`;
    const signUp = await call('/api/auth/sign-up/email', { email, phone: testPhone(), password: 'secret123' });
    assert.equal(signUp.res.statusCode, 200);

    assert.equal((await call('/api/auth/update-user', { firstName: 'Nope' })).res.statusCode, 401);

    const update = await call('/api/auth/update-user', { firstName: 'Rahim', lastName: 'Uddin', name: 'Rahim Uddin', image: '/uploads/a.png', email: 'hijack@example.com' }, signUp.cookie);
    assert.equal(update.res.statusCode, 200);
    const { rows } = await pgDb.sql({ query: `SELECT "firstName", "lastName", image, email FROM "ziteUsers" WHERE email = $1`, params: [email] });
    assert.deepEqual(rows[0], { firstName: 'Rahim', lastName: 'Uddin', image: '/uploads/a.png', email }, 'email must not be changeable here');
    assert.equal(verifySessionToken(update.cookie.replace('barcodehub_session=', ''))?.firstName, 'Rahim');
  });

  test('viteApiPlugin auth/sign-out clears session cookies with HttpOnly flag', async () => {
    const plugin = viteApiPlugin();
    const middlewares: Array<(req: any, res: any, next: () => void) => void> = [];
    const mockServer: any = {
      config: { root: process.cwd() },
      middlewares: {
        use: (fn: any) => middlewares.push(fn),
      },
    };
    plugin.configureServer!(mockServer);

    const apiMiddleware = middlewares[2];
    const res = createMockResponse();
    const req = {
      url: '/api/auth/sign-out',
      headers: {},
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from('');
      },
    };

    await apiMiddleware(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const setCookie = res.getHeader('Set-Cookie') as string[];
    assert.ok(Array.isArray(setCookie));
    const barcodeSession = setCookie.find((c) => c.startsWith('barcodehub_session='));
    assert.ok(barcodeSession?.includes('HttpOnly'));
    assert.ok(barcodeSession?.includes('Expires=Thu, 01 Jan 1970'));
    assert.equal(res.getHeader('X-Content-Type-Options'), 'nosniff');
  });
});

describe('API server resilience and sign-in lockout', () => {
  const middlewares: Array<(req: any, res: any, next: () => void) => Promise<void> | void> = [];
  // ssrLoadModule serves the one real endpoint the validation test needs.
  const endpoints: Record<string, unknown> = { searchProducts: { default: searchProductsEndpoint } };
  viteApiPlugin().configureServer!({
    config: { root: process.cwd() },
    middlewares: { use: (fn: any) => middlewares.push(fn) },
    ssrLoadModule: async (file: string) => endpoints[path.basename(file, '.ts')] ?? {},
  } as any);
  const api = middlewares[2];
  const mockRes = () => {
    const headers: Record<string, unknown> = {};
    return {
      statusCode: 200, headersSent: false, body: '',
      setHeader(k: string, v: unknown) { headers[k.toLowerCase()] = v; },
      getHeader(k: string) { return headers[k.toLowerCase()]; },
      end(b?: string) { this.body = b ?? ''; return this; },
    };
  };
  const call = async (url: string, body: object, extraHeaders: Record<string, string> = {}) => {
    const res = mockRes();
    await api({ url, headers: { 'content-type': 'application/json', ...extraHeaders }, socket: {}, [Symbol.asyncIterator]: async function* () { yield Buffer.from(JSON.stringify(body)); } }, res, () => {});
    return res;
  };

  test('every endpoint request is checked against its input schema before it runs', async () => {
    const bad = await call('/api/searchProducts', { inputs: { q: 12345 } });
    assert.equal(bad.statusCode, 400);
    assert.match(bad.body, /Invalid request\. q: /);
    const good = await call('/api/searchProducts', { inputs: { q: 'zz-no-such-product' } });
    assert.equal(good.statusCode, 200);
    assert.deepEqual(JSON.parse(good.body), { results: [] });
  });

  test('a malformed session cookie is treated as signed out, not a crash', async () => {
    const res = await call('/api/auth/session', {}, { cookie: 'barcodehub_session=%E0%A4%A' });
    assert.equal(res.statusCode, 401);
  });

  test('an unexpected error becomes a 500 response instead of a rejected promise', async () => {
    const res = mockRes();
    const req = { url: '/api/auth/session', headers: {}, socket: {}, [Symbol.asyncIterator]: async function* () { throw new Error('socket closed'); } };
    await assert.doesNotReject(async () => { await api(req, res, () => {}); });
    assert.equal(res.statusCode, 500);
    assert.match(res.body, /INTERNAL_ERROR/);
  });

  test('a burst of parallel wrong passwords is checked at most MAX_LOGIN_FAILURES times', async () => {
    const email = `burst_${Date.now()}@example.com`;
    assert.equal((await call('/api/auth/sign-up/email', { email, phone: testPhone(), password: 'secret123' })).statusCode, 200);
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => call('/api/auth/sign-in/email', { email, password: `wrong${i}` })));
    const checked = results.filter((r) => r.statusCode === 401).length;
    assert.equal(checked, MAX_LOGIN_FAILURES);
    assert.equal(results.filter((r) => r.statusCode === 429).length, 40 - MAX_LOGIN_FAILURES);
    assert.equal((await call('/api/auth/sign-in/email', { email, password: 'secret123' })).statusCode, 429, 'still locked for the right password');
  });

  test('phone numbers normalize to one stored form', () => {
    for (const v of ['01712345678', '+8801712345678', '8801712345678', '017-1234-5678', '+880 1712 345678']) {
      assert.equal(normalizePhone(v), '+8801712345678', v);
    }
    assert.equal(normalizePhone('+447911123456'), '+447911123456', 'international E.164 kept');
    for (const bad of ['', '12345', '01212345678', '+880123', 'abc', '0171234567']) assert.equal(normalizePhone(bad), null, bad);
  });

  test('sign-up needs a phone; sign-in works with email or phone in any format; duplicates are refused', async () => {
    const email = `phone_${Date.now()}@example.com`;
    const phone = testPhone();
    assert.equal((await call('/api/auth/sign-up/email', { email, password: 'secret123' })).statusCode, 400, 'phone required');
    assert.equal((await call('/api/auth/sign-up/email', { email, phone, password: 'secret123' })).statusCode, 200);
    assert.equal((await call('/api/auth/sign-up/email', { email: `other_${email}`, phone, password: 'secret123' })).statusCode, 409, 'phone taken');

    assert.equal((await call('/api/auth/sign-in/email', { email, password: 'secret123' })).statusCode, 200, 'email');
    assert.equal((await call('/api/auth/sign-in/email', { email: phone, password: 'secret123' })).statusCode, 200, 'local phone');
    assert.equal((await call('/api/auth/sign-in/email', { email: `+88${phone}`, password: 'secret123' })).statusCode, 200, '+88 phone');
    assert.equal((await call('/api/auth/sign-in/email', { email: phone, password: 'wrong' })).statusCode, 401);
    assert.equal((await call('/api/auth/sign-in/email', { email: '01999999999', password: 'secret123' })).statusCode, 401, 'unknown phone');
  });

  test('a brand logo uploaded at onboarding comes back in the account', async () => {
    const step = { run: async (_: string, fn: () => any) => fn(), sleep: async () => {} };
    const context = { user: { id: 'logo_owner', email: 'logo@example.com' } } as any;
    await createTenant.execute({ input: { companyName: 'Logo Co', slug: 'logo-co', logoUrl: '/uploads/logo.png' }, context, step } as any);
    const { account } = await getMyAccount.execute({ input: {}, context, step } as any);
    assert.equal(account.tenant.logo, '/uploads/logo.png');
  });

  test('yearly saving is computed from real prices', () => {
    assert.equal(yearlySaving({ monthlyPrice: 999, yearlyPrice: 9990 }), 17);
    assert.equal(yearlySaving({ monthlyPrice: 0, yearlyPrice: 0 }), 0);
    assert.equal(yearlySaving({ monthlyPrice: 100, yearlyPrice: 1500 }), 0, 'never a negative "saving"');
  });
});

describe('Server-rendered SEO for crawlers', () => {
  const product: PublicProduct = {
    id: 'p1', title: 'Mix <b>"x"</b> & co', barcodeNumber: '8941234000017', barcodeType: 'EAN-13',
    description: 'Tasty </script><script>alert(1)</script>', brand: '', manufacturer: 'Maker Ltd', category: 'Spices',
    netWeight: '200 gm', countryOfOrigin: 'Bangladesh', ingredients: '', certifications: '', mrp: 120, images: [],
    tenant: { name: 'Brand Co', slug: 'brand-co', logo: null, website: '' },
  };

  test('product SEO uses the fixed site URL and only facts the page shows', () => {
    const seo = productSeo(product);
    assert.equal(seo.canonical, `${SITE_URL}/barcode/8941234000017`);
    const ld = seo.jsonLd as any;
    assert.equal(ld.url, seo.canonical);
    assert.equal(ld.gtin13, '8941234000017');
    assert.equal(ld.image, undefined, 'no empty image array');
    assert.equal(ld.offers.availability, undefined, 'stock is never shown on the page, so it is not claimed');
    assert.equal(lookupSeo('anything').canonical, `${SITE_URL}/lookup`);
    assert.equal(productNotFoundSeo('123').noindex, true);
  });

  test('head and body are escaped, and JSON-LD cannot close its script tag', () => {
    const head = renderHead(productSeo(product));
    assert.ok(!head.includes('<b>'), 'title escaped in tags');
    assert.ok(head.includes('Mix &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; co'));
    const ld = /<script type="application\/ld\+json" id="seo-jsonld">([\s\S]*?)<\/script>/.exec(head)![1];
    assert.ok(!ld.includes('</script'), 'no raw </script> inside JSON-LD');
    assert.equal(JSON.parse(ld).description, product.description, 'still valid JSON with the original text');
    assert.ok(!productBody(product).includes('<script>'), 'body escaped');
    assert.ok(renderHead(productNotFoundSeo('1')).includes('<meta name="robots" content="noindex" />'));
  });

  test('injectSeo replaces the marked head block and fills #root', () => {
    const shell = '<head><!-- seo:start --><title>Old</title><!-- seo:end --></head><body><div id="root"></div></body>';
    const html = injectSeo(shell, '<title>New</title>', '<main>Hi</main>');
    assert.ok(html.includes('<title>New</title>') && !html.includes('Old'));
    assert.ok(html.includes('<div id="root"><main>Hi</main></div>'));
  });

  test('brand website becomes a link only for http(s) addresses', () => {
    const brand = { name: 'B', logo: null, phone: '', address: '', products: [] };
    assert.ok(brandBody({ ...brand, website: 'https://b.com' }).includes('<a href="https://b.com"'));
    assert.ok(!brandBody({ ...brand, website: 'javascript:alert(1)' }).includes('<a href="javascript'));
  });
});

describe('Barcode auto-numbering', () => {
  test('EAN-13 / UPC-A come only from GS1 internal-use ranges, with valid check digits, never reusing a number', async () => {
    const tenant = { id: 't-auto', slug: 'auto-brand' } as any;
    assert.equal(await nextBarcode(tenant, 'System Code128'), 'BH-AUT-000001');

    const ean = await nextBarcode(tenant, 'EAN-13');
    assert.match(ean, /^200\d{10}$/);
    assert.equal(validateBarcode('EAN-13', ean), null);
    const upc = await nextBarcode(tenant, 'UPC-A');
    assert.match(upc, /^4\d{11}$/);
    assert.equal(validateBarcode('UPC-A', upc), null);

    // Once a product uses the number, the next suggestion moves on (numbering is shared by all brands).
    await pgDb.products.create({ record: { title: 'Taken', barcodeNumber: ean, barcodeType: 'EAN-13', status: 'Draft' } });
    const next = await nextBarcode(tenant, 'EAN-13');
    assert.notEqual(next, ean);
    assert.equal(Number(next.slice(3, 12)), Number(ean.slice(3, 12)) + 1);
  });

  test('with a company prefix set, the wand numbers inside it (any length up to 11)', async () => {
    const short = await nextBarcode({ id: 't-p1', slug: 'p1', gs1CompanyPrefix: '57' } as any, 'EAN-13');
    assert.match(short, /^57\d{11}$/);
    assert.equal(validateBarcode('EAN-13', short), null);
    const longest = await nextBarcode({ id: 't-p2', slug: 'p2', gs1CompanyPrefix: '89412345678' } as any, 'EAN-13');
    assert.match(longest, /^89412345678\d{2}$/, '11-digit prefix leaves one item digit plus the check digit');
    // UPC-A needs a prefix starting with 0 (dropped in UPC-A); otherwise it falls back to the internal range.
    assert.match(await nextBarcode({ id: 't-p3', slug: 'p3', gs1CompanyPrefix: '0123' } as any, 'UPC-A'), /^123\d{9}$/);
    assert.match(await nextBarcode({ id: 't-p4', slug: 'p4', gs1CompanyPrefix: '8941' } as any, 'UPC-A'), /^4\d{11}$/);
  });
});

describe('Error messages shown to users', () => {
  test('errMsg shows the server message, never the raw API response', () => {
    const api = (status: number, body: string) => new Error(`API call failed (${status}): ${body}`);
    assert.equal(errMsg(api(400, '{"error":{"code":"BAD_REQUEST","message":"Use EAN-13."}}')), 'Use EAN-13.');
    assert.equal(errMsg(api(401, '{"code":"INVALID_CREDENTIALS","message":"Invalid email or password."}')), 'Invalid email or password.');
    assert.equal(errMsg(api(401, '{"error":"Please sign in to upload files."}')), 'Please sign in to upload files.');
    assert.equal(errMsg(api(502, '<html>Bad Gateway</html>')), 'Something went wrong');
    assert.equal(errMsg(api(500, '{}'), 'Could not save'), 'Could not save');
    assert.equal(errMsg({ userFacingMessage: 'Friendly', message: 'raw' }), 'Friendly');
    assert.equal(errMsg(new Error('Plain failure')), 'Plain failure');
    assert.equal(errMsg(undefined), 'Something went wrong');
  });
});

describe('Barcode check digit completion', () => {
  test('adds the check digit when one digit short, otherwise leaves input alone', () => {
    assert.equal(withCheckDigit('UPC-A', '03600029145'), '036000291452');
    assert.equal(withCheckDigit('UPC-A', ' 03600029145 '), '036000291452');
    assert.equal(withCheckDigit('EAN-13', '400638133393'), '4006381333931');
    assert.equal(withCheckDigit('UPC-A', '036000291452'), '036000291452', 'full number unchanged');
    assert.equal(withCheckDigit('UPC-A', '036000291453'), '036000291453', 'wrong check digit is not "fixed"');
    assert.equal(withCheckDigit('UPC-A', '0360002914'), '0360002914', 'too short stays invalid');
    assert.equal(withCheckDigit('System Code128', 'bh-abc-1'), 'BH-ABC-1');
    assert.equal(validateBarcode('UPC-A', withCheckDigit('UPC-A', '036000291453')), 'Check digit is wrong — it should end in 2');
  });

  test('saveProduct stores an 11-digit UPC-A with its check digit', async () => {
    await pgDb.tenants.create({ record: { id: 'upc_tenant', companyName: 'UPC Co', slug: 'upc-co', owner: 'upc_owner', status: 'Active', package: 'pkg_free' } });
    const input = {
      title: 'UPC Test', barcodeNumber: '03600029145', barcodeType: 'UPC-A' as const, description: '', brand: '', manufacturer: '',
      category: '', netWeight: '', countryOfOrigin: '', ingredients: '', certifications: '', mrp: null, images: [], status: 'Draft' as const,
    };
    const step = { run: async (_: string, fn: () => any) => fn(), sleep: async () => {} };
    const { id } = await saveProduct.execute({ input, context: { user: { id: 'upc_owner', email: 'upc@example.com' } } as any, step } as any);
    const saved = await pgDb.products.findOne({ id });
    assert.equal(saved?.barcodeNumber, '036000291452');
  });
});

describe('FIND-006: Outdated Dependencies (Zod, Minimatch, Archiver) Regressions', () => {
  test('zod installed package version is >= 4.6.6 (mitigates GHSA-mrhx-c7xc-m3w5)', async () => {
    const pkgPath = path.resolve(process.cwd(), 'node_modules/zod/package.json');
    let pkgJson: any;
    try {
      const content = await readFile(pkgPath, 'utf8');
      pkgJson = JSON.parse(content);
    } catch {
      // Check parent workspace node_modules
      const parentPkgPath = path.resolve(process.cwd(), '../../node_modules/zod/package.json');
      const content = await readFile(parentPkgPath, 'utf8');
      pkgJson = JSON.parse(content);
    }

    const version = pkgJson.version;
    assert.ok(version, 'Zod package.json must provide a version');

    // Parse semver numbers
    const [major, minor, patch] = version.split('.').map((n: string) => parseInt(n, 10));
    const isPatched = major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6)));
    assert.ok(
      isPatched,
      `Expected zod version >= 4.6.6 to protect against memory exhaustion, but found ${version}`
    );
  });

  test('apps/barcodehub/package.json specifies patched zod and archiver versions', async () => {
    const appPkg = JSON.parse(await readFile(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    assert.ok(appPkg.dependencies.zod);
    assert.ok(
      appPkg.dependencies.zod.includes('4.6.') || appPkg.dependencies.zod.includes('^4.6'),
      'barcodehub dependencies must specify zod ^4.6.7'
    );
    assert.ok(
      appPkg.dependencies.archiver.includes('8.0.') || appPkg.dependencies.archiver.includes('^8.0'),
      'archiver must be updated to ^8.0.0 to eliminate vulnerable glob/minimatch dependency paths'
    );
    assert.ok(appPkg.overrides?.zod, 'package.json must contain zod override');
  });

  test('root workspace package.json specifies overrides for zod', async () => {
    const rootPkg = JSON.parse(await readFile(path.resolve(process.cwd(), '../../package.json'), 'utf8'));
    assert.ok(rootPkg.overrides?.zod, 'root package.json must enforce zod override');
  });

  test('zod runtime schema correctly validates barcode and product structures', () => {
    const schema = z.object({
      barcode: z.string().min(8).max(14),
      source: z.enum(['Search', 'Direct', 'QR Scan', 'Lookup']).optional(),
      quantity: z.number().int().positive().default(1),
    });

    const valid = schema.safeParse({ barcode: '123456789012', source: 'Search' });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.barcode, '123456789012');
      assert.equal(valid.data.quantity, 1);
    }

    const invalid = schema.safeParse({ barcode: 'short', source: 'InvalidSource' });
    assert.equal(invalid.success, false);
  });

  test('zod safely handles edge cases and oversized strings without crashing', () => {
    const schema = z.object({
      title: z.string().max(100),
    });

    // 100KB string to test against ReDoS and catastrophic backtracking
    const largeStr = 'A'.repeat(100_000);
    const result = schema.safeParse({ title: largeStr });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.length > 0);
    }
  });
});



