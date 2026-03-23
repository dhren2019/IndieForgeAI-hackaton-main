/**
 * GET /api/health
 */
import { ok } from "../utils/response";
import { ENV } from "../config/env";

export function healthRoute(): Response {
  return ok({
    status:    "ok",
    version:   "1.0.0",
    env:       ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
