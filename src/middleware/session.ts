import { SESSION_COOKIE } from "../config/constants";
import { newSessionId } from "../utils/ids";

export interface SessionContext {
  sessionId: string;
  setCookie: string | null;
}

export function resolveSession(req: Request): SessionContext {
  const cookie = req.headers.get("cookie") ?? "";
  const match  = cookie.match(/session_id=([^;]+)/);
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
