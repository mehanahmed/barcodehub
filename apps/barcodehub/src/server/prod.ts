/**
 * Production server: the built site (dist/), live uploads, the API and server-rendered SEO pages, using the
 * same middlewares as the Vite dev server. `npm run build` bundles this file to dist-server/prod.js;
 * `npm start` runs it from apps/barcodehub (dist/ and public/uploads/ are found from the working directory).
 * Settings come from the environment, or from .env next to package.json (see .env.example). SESSION_SECRET is required.
 */
import http, { type IncomingMessage, type ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { createAppMiddlewares, type AppHost } from './viteApiPlugin';
import { applySecurityHeaders } from './securityHeaders';
import * as seoData from '../lib/seoData';

process.env.NODE_ENV ??= 'production';

const root = process.cwd();
const dist = path.join(root, 'dist');
const uploads = path.join(root, 'public', 'uploads');
const shellFile = path.join(dist, 'index.html');
if (!fs.existsSync(shellFile)) throw new Error(`${shellFile} not found: run npm run build first, and start from apps/barcodehub.`);
const shell = fs.readFileSync(shellFile, 'utf8');

// Every module the middlewares may ask for, bundled in. Keys are relative to this file.
const modules: Record<string, unknown> = { ...import.meta.glob('../api/*.ts', { eager: true }), '../lib/seoData.ts': seoData };
const host: AppHost = {
  loadModule: async (file) => modules[file.replace(/^src\//, '../')] ?? {},
  readShell: async () => shell,
};
const stack = createAppMiddlewares(host);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

/** Sends base + urlPath if it is a file inside base. Returns false when there is no such file. */
function sendFile(req: IncomingMessage, res: ServerResponse, base: string, urlPath: string): boolean {
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return false;
  }
  const file = path.resolve(base, '.' + rel);
  if (!file.startsWith(base + path.sep) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return false;
  res.statusCode = 200;
  res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  // Vite puts a content hash in /assets/ file names, so those never change.
  res.setHeader('Cache-Control', urlPath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
  return true;
}

/** After the middlewares: static files, then the app shell for client-side routes (/app, /admin, /login, …). */
function fallback(req: IncomingMessage, res: ServerResponse) {
  applySecurityHeaders(res);
  const urlPath = new URL(req.url || '/', 'http://local').pathname;
  if (req.method === 'GET' || req.method === 'HEAD') {
    // Uploads are read live: files added after the build are not in dist/.
    if (urlPath.startsWith('/uploads/') && sendFile(req, res, uploads, urlPath.slice('/uploads'.length))) return;
    if (sendFile(req, res, dist, urlPath)) return;
    if (!/\.[a-z0-9]+$/i.test(urlPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(shell);
    }
  }
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  let i = 0;
  const next = (err?: unknown) => {
    if (err) {
      console.error('[server]', err);
      if (!res.headersSent) res.statusCode = 500;
      return res.end();
    }
    const handler = stack[i++];
    if (handler) return handler(req, res, next);
    fallback(req, res);
  };
  next();
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => console.log(`BarcodeHub running on http://localhost:${port}`));
