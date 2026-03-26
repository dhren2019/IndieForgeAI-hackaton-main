import { verifyToken } from "@clerk/backend";
import { SESSION_COOKIE } from "../config/constants";
import { newSessionId } from "../utils/ids";
import { ENV } from "../config/env";
import { upsertUser, migrateAnonymousSession } from "../db/client";
import { logger } from "../utils/logger";

export interface SessionContext {
  sessionId:       string;
  /** The raw cookie-based session UUID (always set, even for Clerk users). */
  cookieSessionId: string | null;
  setCookie:       string | null;
}

// ---------------------------------------------------------------------------
// JWT verification using the standalone verifyToken export from @clerk/backend
// Tries secretKey first (network JWKS lookup), then publishableKey (public JWKS).
// ---------------------------------------------------------------------------
async function verifyClerkToken(token: string): Promise<string | null> {
  if (!ENV.CLERK_SECRET_KEY && !ENV.CLERK_PUBLISHABLE_KEY) {
    logger.warn(
      "[session] CLERK_SECRET_KEY y CLERK_PUBLISHABLE_KEY no están configuradas. " +
      "Añade ambas claves en tu archivo .env (ver .env.example)."
    );
    return null;
  }

  // Primary: secretKey (recommended — uses JWKS endpoint securely)
  if (ENV.CLERK_SECRET_KEY) {
    try {
      const payload = await verifyToken(token, { secretKey: ENV.CLERK_SECRET_KEY });
      return payload.sub;
    } catch (e) {
      logger.warn("[session] verifyToken(secretKey) failed:", (e as Error).message ?? e);
    }
  }

  // Fallback: publishableKey alone (derives JWKS URL from the public key)
  if (ENV.CLERK_PUBLISHABLE_KEY) {
    try {
      const payload = await verifyToken(token, { publishableKey: ENV.CLERK_PUBLISHABLE_KEY });
      return payload.sub;
    } catch (e) {
      logger.warn("[session] verifyToken(publishableKey) failed:", (e as Error).message ?? e);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main resolve function
// ---------------------------------------------------------------------------
export async function resolveSession(req: Request): Promise<SessionContext> {
  // Always extract the cookie session (used as a fallback / dual-lookup)
  const cookie  = req.headers.get("cookie") ?? "";
  const match   = cookie.match(/session_id=([^;]+)/);
  const existed = !!match?.[1];
  const cookieId = existed ? match![1] : null;
  const newCookieId = existed ? null : newSessionId();
  const setCookie = newCookieId
    ? `${SESSION_COOKIE.name}=${newCookieId}; Path=${SESSION_COOKIE.path}; HttpOnly; SameSite=${SESSION_COOKIE.sameSite}; Max-Age=${SESSION_COOKIE.maxAge}`
    : null;

  // 1. Try Clerk JWT from Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const clerkId = await verifyClerkToken(token);
      if (clerkId) {
        // Upsert user in DB so data is always associated to this Clerk ID
        const { mergedCookie } = await upsertUser(clerkId);

        // Migrate anonymous cookie data → Clerk ID (once per device cookie)
        if (cookieId && cookieId !== clerkId && mergedCookie !== cookieId) {
          await migrateAnonymousSession(clerkId, cookieId);
        }

        return {
          sessionId:       clerkId,
          cookieSessionId: cookieId,
          setCookie:       null,
        };
      }
    }
  }

  // 2. Fall back to cookie-based anonymous session
  const sessionId = cookieId ?? newCookieId!;
  return { sessionId, cookieSessionId: null, setCookie };
}

export function applySession(res: Response, setCookie: string | null): Response {
  if (!setCookie) return res;
  const headers = new Headers(res.headers);
  headers.set("Set-Cookie", setCookie);
  return new Response(res.body, { status: res.status, headers });
}

