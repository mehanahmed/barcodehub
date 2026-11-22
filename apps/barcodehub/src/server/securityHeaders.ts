import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Standard HTTP Security Headers configuration (FIND-005)
 * Defends against XSS, clickjacking, MIME sniffing, protocol downgrades, and unauthorized browser APIs.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  // CWE-693: Prevent MIME-type confusion attacks and drive-by execution
  'X-Content-Type-Options': 'nosniff',

  // CWE-1021: Prevent Clickjacking by restricting framing to same origin
  'X-Frame-Options': 'SAMEORIGIN',

  // CWE-319: Enforce HTTPS for 1 year including subdomains
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

  // Protect sensitive user URLs and tokens in referrer headers
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Explicitly restrict access to sensitive device features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

  // Disable buggy legacy XSS filter in favor of CSP
  'X-XSS-Protection': '0',

  // CWE-79 / CWE-352: Comprehensive Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://server.zite.com",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' ws: wss: https:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
});

/**
 * Applies all security headers to any ServerResponse or mock response object.
 */
export function applySecurityHeaders(res: ServerResponse | any): void {
  if (!res || typeof res.setHeader !== 'function') return;
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(header, value);
  }
}

/**
 * Connect/Vite compatible middleware that attaches security headers to every response.
 */
export function securityHeadersMiddleware() {
  return (_req: IncomingMessage, res: ServerResponse, next: () => void) => {
    applySecurityHeaders(res);
    next();
  };
}
