import { createClerkClient } from "@clerk/backend";
import { SESSION_COOKIE } from "../config/constants";
import { newSessionId } from "../utils/ids";
import { ENV } from "../config/env";

export interface SessionContext {
  sessionId: string;
  setCookie: string | null;
}

// Lazily initialised so the server still starts if CLERK_SECRET_KEY is empty
let _clerkClient: ReturnType<typeof createClerkClient> | null = null;
function getClerkClient() {
  if (!_clerkClient && ENV.CLERK_SECRET_KEY) {
    _clerkClient = createClerkClient({ secretKey: ENV.CLERK_SECRET_KEY });
  }
  return _clerkClient;
}

export async function resolveSession(req: Request): Promise<SessionContext> {
  // 1. Try Clerk JWT from Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const clerk = getClerkClient();
    if (clerk && token) {
      try {
        const payload = await clerk.verifyToken(token);
        // payload.sub is the Clerk user ID (e.g. "user_2abc123")
        return { sessionId: payload.sub, setCookie: null };
      } catch {
        // Invalid / expired token — fall through to cookie session
      }
    }
  }

  // 2. Fall back to cookie-based anonymous session
  const cookie = req.headers.get("cookie") ?? "";
  const match   = cookie.match(/session_id=([^;]+)/);
  const existed = !!match?.[1];
  const sessionId = existed ? match![1] : newSessionId();

  const setCookie = existed
    ? null
    : `${SESSION_COOKIE.name}=${sessionId}; Path=${SESSION_COOKIE.path}; HttpOnly; SameSite=${SESSION_COOKIE.sameSite}; Max-Age=${SESSION_COOKIE.maxAge}`;

  return { sessionId, setCookie };
}

export function applySession(res: Response, setCookie: string | null): Response {
  if (!setCookie) return res;
  const headers = new Headers(res.headers);
  headers.set("Set-Cookie", setCookie);
  return new Response(res.body, { status: res.status, headers });
}
