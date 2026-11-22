import path from 'path';
import fs from 'fs';
import { renderHead, injectSeo, productBody, brandBody, notFoundBody } from './seoHtml';
import { normalizePhone, isEmailIdentifier } from '../lib/phone';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import { createPgTableClient, createPgSqlClient, createPgAuthClient } from './pgClient';
import {
  verifySessionToken,
  createSessionToken,
  checkIsAdmin,
  hashPassword,
  verifyPassword,
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from './session';
import { SECURITY_HEADERS, applySecurityHeaders, securityHeadersMiddleware } from './securityHeaders';

export { SECURITY_HEADERS, applySecurityHeaders, securityHeadersMiddleware };

// Initialize PostgreSQL SDK Bridge for Zite Endpoints
const sqlClient = createPgSqlClient();
const authClient = createPgAuthClient();
const tableClients = new Map<string, any>();

function getTable(name: string) {
  const tableMap: Record<string, string> = {
    packages: 'Packages',
    Packages: 'Packages',
    tenants: 'Tenants',
    Tenants: 'Tenants',
    products: 'Products',
    Products: 'Products',
    payments: 'Payments',
    Payments: 'Payments',
    productViews: 'ProductViews',
    ProductViews: 'ProductViews',
    admins: 'Admins',
    Admins: 'Admins',
    ziteUsers: 'ziteUsers',
  };

  const normalized = tableMap[name] || name;
  if (!tableClients.has(normalized)) {
    tableClients.set(normalized, createPgTableClient(normalized));
  }
  return tableClients.get(normalized);
}

// Hook into Zite's internal SDK runner so every endpoint queries PostgreSQL
(globalThis as any).__wrapSdkCall = async (_integrationId: string, className: string, method: string, args: any) => {
  if (className === 'Db' && method === 'executeSql') {
    return sqlClient({ query: args.query, params: args.params });
  }
  if (className === 'Auth') {
    const fn = (authClient as any)[method];
    if (typeof fn === 'function') {
      return fn(args);
    }
  }
  const client = getTable(className);
  if (client && typeof client[method] === 'function') {
    return client[method](args);
  }
  throw new Error(`PostgreSQL handler for ${className}.${method} not found`);
};

export function viteApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-local-api',
    configureServer(server: ViteDevServer) {
      // Security Headers middleware: enforces CSP, HSTS, X-Content-Type-Options, etc. on all responses
      server.middlewares.use(securityHeadersMiddleware());

      // Serve /sitemap.xml by calling the sitemap endpoint
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/sitemap.xml' || req.url === '/sitemap.xml?') {
          try {
            applySecurityHeaders(res);
            const mod = await server.ssrLoadModule(
              path.resolve(server.config.root, 'src/api/sitemap.ts')
            );
            const endpoint = mod.default || mod;
            const result = await endpoint.execute({ input: {}, context: { user: null, headers: req.headers, ip: req.socket.remoteAddress }, step: { run: async (_: string, fn: () => any) => fn(), sleep: async () => {} } });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.end(result.xml);
          } catch (err: any) {
            res.statusCode = 500;
            return res.end('<!-- sitemap generation error -->');
          }
        }
        return next();
      });

      const handleApi = async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        // Ensure security headers are also explicitly guaranteed on API responses
        applySecurityHeaders(res);

        const urlPath = req.url.split('?')[0];
        const endpointName = urlPath.replace('/api/', '');

        if (!endpointName) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: 'Endpoint not found' }));
        }

        // Read request body, refusing anything above the 10 MB upload limit plus multipart overhead
        const MAX_BODY_BYTES = 11 * 1024 * 1024;
        const chunks: Buffer[] = [];
        let bodyBytes = 0;
        for await (const chunk of req) {
          const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          bodyBytes += buf.length;
          if (bodyBytes > MAX_BODY_BYTES) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Connection', 'close');
            res.end(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large.' } }));
            (req as any).destroy?.();
            return;
          }
          chunks.push(buf);
        }
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        let body: any = {};
        try {
          body = bodyStr ? JSON.parse(bodyStr) : {};
        } catch {
          body = {};
        }

        // Determine user identity from token / headers / cookies
        const parseCookie = (header: string, name: string) => {
          const match = header.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
          if (!match) return '';
          try {
            return decodeURIComponent(match[2]);
          } catch {
            return ''; // malformed %-encoding: treat as no cookie, not a server error
          }
        };

        const authHeader = req.headers.authorization || '';
        const cookieHeader = req.headers.cookie || '';
        const sessionCookie = parseCookie(cookieHeader, 'barcodehub_session') || parseCookie(cookieHeader, 'better-auth.session_token');
        // The HttpOnly cookie wins, so a stale token left in an old browser's storage can't shadow a valid session.
        const token = (sessionCookie || body.usageToken || body.ziteAuthToken || authHeader.replace(/^Bearer\s+/i, '') || '').trim();

        let user: any = null;
        if (token) {
          // Cryptographically verify session token - NO dev token bypass permitted
          const session = verifySessionToken(token);
          if (session) {
            // Server-side database verification of admin role
            const isAdmin = await checkIsAdmin(session.id);
            user = {
              id: session.id,
              email: session.email,
              name: session.name || session.email.split('@')[0],
              firstName: session.firstName,
              lastName: session.lastName,
              image: session.image,
              role: isAdmin ? 'admin' : 'user',
              isAdmin,
            };
          }
        }

        const sendJson = (status: number, data: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(data));
        };

        // Signs a session for a user row whose identity the server has verified.
        const startSession = async (u: { id: string; email: string; name?: string | null; firstName?: string | null; lastName?: string | null; image?: string | null }) => {
          const isAdmin = await checkIsAdmin(u.id);
          const name = u.name || u.email.split('@')[0];
          const sessionToken = createSessionToken({
            id: u.id,
            email: u.email,
            name,
            firstName: u.firstName || undefined,
            lastName: u.lastName || undefined,
            image: u.image || undefined,
            role: isAdmin ? 'admin' : 'user',
          });
          res.setHeader('Set-Cookie', [
            `barcodehub_session=${sessionToken}; Path=/; Max-Age=604800; SameSite=Lax; HttpOnly`,
          ]);
          return sendJson(200, {
            token: sessionToken,
            user: { id: u.id, email: u.email, name, role: isAdmin ? 'admin' : 'user', isAdmin },
          });
        };

        if (endpointName === 'auth/sign-up/email') {
          const email = String(body.email ?? '').trim().toLowerCase();
          const password = String(body.password ?? '');
          if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
            return sendJson(400, { code: 'INVALID_INPUT', message: 'Enter a valid email and password.' });
          }
          if (password.length < 6) {
            return sendJson(400, { code: 'PASSWORD_TOO_SHORT', message: 'Password must be at least 6 characters.' });
          }
          const phone = normalizePhone(String(body.phone ?? ''));
          if (!phone) {
            return sendJson(400, { code: 'INVALID_PHONE', message: 'Enter a valid mobile number, for example 01712345678.' });
          }
          const name = String(body.name ?? '').trim() || email.split('@')[0];
          try {
            // One statement, so a user row never exists without its password.
            // ON CONFLICT with no target: a taken email OR phone both mean "account exists", race-free.
            const { rows } = await sqlClient({
              query: `WITH u AS (INSERT INTO "ziteUsers" ("email", "name", "phone") VALUES ($1, $2, $4)
                                 ON CONFLICT DO NOTHING RETURNING *),
                           p AS (INSERT INTO "UserPasswords" ("userId", "hash") SELECT id, $3 FROM u)
                      SELECT id, email, name, "firstName", "lastName" FROM u`,
              params: [email, name, await hashPassword(password), phone],
            });
            if (!rows[0]) {
              return sendJson(409, { code: 'USER_EXISTS', message: 'An account with this email or phone number already exists. Sign in instead.' });
            }
            return startSession(rows[0]);
          } catch (err: any) {
            console.error('[auth] sign-up failed:', err);
            return sendJson(500, { code: 'SIGN_UP_FAILED', message: 'Could not create the account. Please try again.' });
          }
        }

        if (endpointName === 'auth/sign-in/email') {
          // better-auth's signIn.email posts the identifier as "email"; it may be an email or a phone number.
          const identifier = String(body.email ?? '').trim();
          const password = String(body.password ?? '');
          if (!identifier || !password) {
            return sendJson(400, { code: 'INVALID_INPUT', message: 'Enter your email or phone number and your password.' });
          }
          const byEmail = isEmailIdentifier(identifier);
          const lookup = byEmail ? identifier.toLowerCase() : normalizePhone(identifier);
          const { rows } = lookup
            ? await sqlClient({
                query: `SELECT u.id, u.email, u.name, u."firstName", u."lastName", u.image, p.hash
                        FROM "ziteUsers" u JOIN "UserPasswords" p ON p."userId" = u.id
                        WHERE ${byEmail ? 'u.email' : 'u.phone'} = $1`,
                params: [lookup],
              })
            : { rows: [] };
          if (!rows[0]) {
            return sendJson(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email, phone number or password.' });
          }
          // One lockout per account, whichever identifier was used, so switching email/phone can't reset it.
          const account = String(rows[0].email);
          // Check and count in one synchronous step, before the slow hash: parallel guesses each take a slot,
          // so a burst can't all pass the check while earlier guesses are still hashing.
          if (isLoginLocked(account)) {
            return sendJson(429, { code: 'TOO_MANY_ATTEMPTS', message: 'Too many failed sign-ins. Try again in 15 minutes.' });
          }
          recordLoginFailure(account);
          if (!(await verifyPassword(password, rows[0].hash))) {
            return sendJson(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email, phone number or password.' });
          }
          clearLoginFailures(account);
          return startSession(rows[0]);
        }

        // Better-auth's updateUser (Profile page). Only these columns can change, and only for the caller.
        if (endpointName === 'auth/update-user') {
          if (!user) {
            return sendJson(401, { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' });
          }
          const maxLength: Record<string, number> = { firstName: 100, lastName: 100, name: 255, image: 2000 };
          const params: unknown[] = [user.id];
          const sets: string[] = [];
          for (const [col, max] of Object.entries(maxLength)) {
            if (!(col in body)) continue;
            params.push(body[col] == null ? null : String(body[col]).trim().slice(0, max));
            sets.push(`"${col}" = $${params.length}`);
          }
          if (!sets.length) {
            return sendJson(400, { code: 'NOTHING_TO_UPDATE', message: 'Nothing to update.' });
          }
          const { rows } = await sqlClient({
            query: `UPDATE "ziteUsers" SET ${sets.join(', ')}, "updated_at" = now() WHERE id = $1
                    RETURNING id, email, name, "firstName", "lastName", image`,
            params,
          });
          if (!rows[0]) {
            return sendJson(401, { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' });
          }
          // Re-issue the session so the new name and photo show up on the next page load.
          return startSession(rows[0]);
        }

        // Returns the caller's current session. Identity comes only from a verified token, never from the body.
        if (endpointName === 'auth/session') {
          if (!user) {
            return sendJson(401, { error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } });
          }
          return sendJson(200, { token, user });
        }

        // Handle Better-Auth session endpoints directly
        if (endpointName === 'auth/get-session') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          if (user) {
            return res.end(
              JSON.stringify({
                user,
                session: {
                  id: `sess_${user.id}`,
                  userId: user.id,
                  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
                },
              })
            );
          }
          return res.end(JSON.stringify(null));
        }

        if (endpointName === 'auth/sign-out') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Set-Cookie', [
            'barcodehub_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; HttpOnly',
            'better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; HttpOnly',
          ]);
          return res.end(JSON.stringify({ success: true }));
        }

        // Handle multipart file uploads (saves to public/uploads/)
        if (endpointName === 'upload' || endpointName === 'uploadFile') {
          if (!user) {
            return sendJson(401, { error: 'Please sign in to upload files.' });
          }
          try {
            const dummyResponse = new Response(Buffer.concat(chunks), {
              headers: {
                'content-type': req.headers['content-type'] || '',
              },
            });
            const formData = await dummyResponse.formData();
            const { uploadFile } = await import('./upload');
            const result = await uploadFile(formData);
            res.statusCode = (result as any).error ? 400 : 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message || 'File upload failed' }));
          }
        }

        // Endpoint files are flat camelCase names; anything else (e.g. `../`) must never reach the module loader.
        if (!/^[A-Za-z0-9]+$/.test(endpointName)) {
          return sendJson(404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
        }

        try {
          // Dynamically load the endpoint via Vite's SSR pipeline
          const endpointFile = path.resolve(server.config.root, `src/api/${endpointName}.ts`);
          const mod = await server.ssrLoadModule(endpointFile);
          const endpoint = mod.default || mod;

          if (!endpoint || typeof endpoint.execute !== 'function') {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `Endpoint ${endpointName} not implemented` }));
          }

          if (endpoint.authenticated && !user) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } }));
          }

          const context = {
            user,
            headers: req.headers,
            ip: req.socket.remoteAddress,
          };

          const step = {
            run: async (_name: string, fn: () => any) => fn(),
            sleep: async () => {},
          };

          const result = await endpoint.execute({
            input: body.inputs ?? body ?? {},
            context,
            step,
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(result));
        } catch (err: any) {
          console.error(`[API Error] ${endpointName}:`, err);
          const code = err.code || 'INTERNAL_ERROR';
          const message = err.userFacingMessage || err.message || 'API execution error';
          
          res.statusCode = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: { code, message } }));
        }
      };

      // Connect does not await async middleware: an uncaught rejection here would exit the whole process.
      server.middlewares.use((req, res, next) =>
        handleApi(req, res, next).catch((err) => {
          console.error('[API Error] unhandled:', err);
          if (res.headersSent) return res.end();
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }));
        })
      );

      // Public pages get their real title, canonical, JSON-LD and a plain-HTML summary in the first response,
      // so crawlers that never run JavaScript see the product, not the homepage shell. Unknown pages get 404 + noindex.
      const renderPage = async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const accept = String(req.headers.accept ?? '');
        const url = new URL(req.url || '/', 'http://local');
        const p = url.pathname;
        const wantsHtml = !accept || accept.includes('text/html') || accept.includes('*/*');
        // Assets, Vite internals and the signed-in app keep the normal shell.
        if (!wantsHtml || p.startsWith('/@') || p.startsWith('/api/') || /\.[a-z0-9]+$/i.test(p) || /^\/(app|admin|login|auth)(\/|$)/.test(p)) {
          return next();
        }
        const root = server.config.root;
        const seoData = await server.ssrLoadModule(path.resolve(root, 'src/lib/seoData.ts'));
        const callEndpoint = async (name: string, input: unknown) => {
          const mod = await server.ssrLoadModule(path.resolve(root, `src/api/${name}.ts`));
          return (mod.default || mod).execute({
            input,
            context: { user: null, headers: req.headers, ip: req.socket.remoteAddress },
            step: { run: async (_: string, fn: () => any) => fn(), sleep: async () => {} },
          });
        };
        const segment = (re: RegExp) => {
          const m = re.exec(p);
          if (!m) return null;
          try {
            return decodeURIComponent(m[1]);
          } catch {
            return ''; // malformed %-encoding: treated as not found
          }
        };

        let seo;
        let body = '';
        let status = 200;
        const barcode = segment(/^\/barcode\/([^/]+)\/?$/);
        const slug = segment(/^\/brand\/([^/]+)\/?$/);
        if (p === '/') seo = seoData.homeSeo;
        else if (p === '/lookup') seo = seoData.lookupSeo(url.searchParams.get('q') ?? '');
        else if (barcode !== null) {
          // No "source" input, so crawler fetches are not counted as product views.
          const { product } = barcode ? await callEndpoint('getPublicProduct', { barcode }) : { product: null };
          if (product) [seo, body] = [seoData.productSeo(product), productBody(product)];
          else [seo, body, status] = [seoData.productNotFoundSeo(barcode), notFoundBody(`No product found for barcode ${barcode}`), 404];
        } else if (slug !== null) {
          const { brand } = slug ? await callEndpoint('getBrand', { slug }) : { brand: null };
          if (brand) [seo, body] = [seoData.brandSeo(brand, slug), brandBody(brand)];
          else [seo, body, status] = [seoData.brandNotFoundSeo(slug), notFoundBody('Brand not found'), 404];
        } else {
          [seo, body, status] = [seoData.notFoundSeo(p), notFoundBody('Page not found'), 404];
        }

        const shell = await server.transformIndexHtml(req.url || '/', fs.readFileSync(path.resolve(root, 'index.html'), 'utf8'));
        res.statusCode = status;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        applySecurityHeaders(res);
        res.end(injectSeo(shell, renderHead(seo), body));
      };
      server.middlewares.use((req, res, next) =>
        renderPage(req, res, next).catch((err) => {
          // Never break a page over SEO: fall back to the plain app shell.
          console.error('[SEO render] falling back to shell:', err);
          next();
        })
      );
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(securityHeadersMiddleware());
    },
  };
}
