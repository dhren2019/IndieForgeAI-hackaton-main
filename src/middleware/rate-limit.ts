import { RATE_LIMIT } from "../config/constants";
import { err } from "../utils/response";

interface RateLimitRecord {
  count: number;
  reset: number;
}

const store = new Map<string, RateLimitRecord>();

export function checkRateLimit(sessionId: string): boolean {
  const now    = Date.now();
  const record = store.get(sessionId);

  if (!record || now > record.reset) {
    store.set(sessionId, { count: 1, reset: now + RATE_LIMIT.windowMs });
    return true;
  }

  if (record.count >= RATE_LIMIT.maxRequests) return false;
  record.count++;
  return true;
}

export function rateLimitResponse(): Response {
  return err("Rate limit exceeded. Please wait before generating again.", 429);
}
