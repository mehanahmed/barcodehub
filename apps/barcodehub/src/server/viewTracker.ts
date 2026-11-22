import { db } from './db';

export interface ViewContext {
  ip?: string;
  userAgent?: string;
}

// In-memory deduplication cache: `${ip}:${productId}` -> timestamp (ms)
const recentProductVisits = new Map<string, number>();

// In-memory rate-limit cache: `${ip}` -> { count, windowStart }
const ipRateLimits = new Map<string, { count: number; windowStart: number }>();

export const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes deduplication window
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
export const MAX_VIEWS_PER_WINDOW = 30; // Max 30 recorded views per minute per IP

const BOT_USER_AGENTS =
  /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|spider|crawler/i;

/**
 * Resets the in-memory tracking caches (used by tests or on server restart).
 */
export function resetViewTrackingCache() {
  recentProductVisits.clear();
  ipRateLimits.clear();
}

/**
 * Determines whether a view should be written to the database.
 */
export function shouldRecordView(
  productId: string,
  context?: ViewContext
): { shouldRecord: boolean; reason?: string } {
  const ip = context?.ip?.trim() || '127.0.0.1';
  const ua = context?.userAgent || '';

  // 1. Filter known web crawlers / bots
  if (BOT_USER_AGENTS.test(ua)) {
    return { shouldRecord: false, reason: 'bot_filtered' };
  }

  const now = Date.now();

  // 2. IP-level rate limiting
  let ipRecord = ipRateLimits.get(ip);
  if (!ipRecord || now - ipRecord.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRecord = { count: 0, windowStart: now };
    ipRateLimits.set(ip, ipRecord);
  }

  if (ipRecord.count >= MAX_VIEWS_PER_WINDOW) {
    return { shouldRecord: false, reason: 'rate_limited' };
  }

  // 3. Deduplicate repeat visits to the same product by the same client IP
  const dedupKey = `${ip}:${productId}`;
  const lastVisit = recentProductVisits.get(dedupKey);
  if (lastVisit && now - lastVisit < DEDUP_WINDOW_MS) {
    return { shouldRecord: false, reason: 'deduplicated' };
  }

  // Update tracking state
  ipRecord.count += 1;
  recentProductVisits.set(dedupKey, now);

  // Evict expired entries if cache gets large
  if (recentProductVisits.size > 5000) {
    for (const [key, timestamp] of recentProductVisits.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        recentProductVisits.delete(key);
      }
    }
  }

  return { shouldRecord: true };
}

/**
 * Non-blocking view recorder that safely logs product visits without disrupting page rendering.
 */
export async function recordProductView(
  productId: string,
  tenantId: string,
  source: string,
  context?: ViewContext
): Promise<{ recorded: boolean; reason?: string }> {
  try {
    const decision = shouldRecordView(productId, context);
    if (!decision.shouldRecord) {
      return { recorded: false, reason: decision.reason };
    }

    await db.productViews.create({
      record: {
        product: productId,
        tenant: tenantId,
        source,
      },
    });

    return { recorded: true };
  } catch (err) {
    console.warn(`[ViewTracker] Could not record view for product ${productId}:`, err);
    return { recorded: false, reason: 'write_error' };
  }
}
