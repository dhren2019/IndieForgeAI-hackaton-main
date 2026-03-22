/**
 * IndieForge AI — Main server entry point
 * Runs with: bun run src/server.ts
 * Hot reload: bun run --hot src/server.ts
 */

import { handleGenerate }       from "./routes/generate";
import { handleHistory }        from "./routes/history";
import { handleFavoriteToggle } from "./routes/favorites";
import { handleSocial }         from "./routes/social";
import { getDB }                from "./db/client";
import { readFileSync }         from "fs";
import { join }                 from "path";

const PORT = Number(process.env.PORT ?? 3000);

// ---------------------------------------------------------------------------
// Run DB migration on startup (idempotent — uses CREATE TABLE IF NOT EXISTS)
// ---------------------------------------------------------------------------
function runMigration() {
  const db  = getDB();
  const sql = readFileSync(join(import.meta.dir, "db/schema.sql"), "utf-8");
  const statements = sql
    .replace(/--[^\n]*/g, "")   // strip line comments first
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  db.transaction(() => {
    for (const stmt of statements) {
      db.run(stmt);
    }
  })();
  console.log("✅ DB ready");
}

runMigration();

// ---------------------------------------------------------------------------
// Static file helper — serves frontend/
// ---------------------------------------------------------------------------
async function serveStatic(pathname: string): Promise<Response | null> {
  const base     = join(import.meta.dir, "../frontend");
  const filePath = pathname === "/" ? join(base, "index.html") : join(base, pathname);

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  return new Response(file);
}

// ---------------------------------------------------------------------------
// Session cookie middleware
// ---------------------------------------------------------------------------
function ensureSession(req: Request): { sessionId: string; setCookie: string | null } {
  const cookie  = req.headers.get("cookie") ?? "";
  const match   = cookie.match(/session_id=([^;]+)/);
  const existed = !!match?.[1];
  const sessionId = existed ? match![1] : `sess-${crypto.randomUUID()}`;
  const setCookie = existed
    ? null
    : `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  return { sessionId, setCookie };
}

function addSessionCookie(res: Response, setCookie: string | null): Response {
  if (!setCookie) return res;
  const headers = new Headers(res.headers);
  headers.set("Set-Cookie", setCookie);
  return new Response(res.body, { status: res.status, headers });
}

// ---------------------------------------------------------------------------
// CORS headers for dev
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url      = new URL(req.url);
    const pathname = url.pathname;

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const { sessionId, setCookie } = ensureSession(req);

    let res: Response;

    // API routes
    if (pathname === "/api/generate" && req.method === "POST") {
      res = await handleGenerate(req);
    } else if (pathname === "/api/history" && req.method === "GET") {
      res = handleHistory(req);
    } else if (pathname.startsWith("/api/favorite")) {
      res = await handleFavoriteToggle(req);
    } else if (pathname.startsWith("/api/favorites") && req.method === "GET") {
      res = await handleFavoriteToggle(req);
    } else if (pathname.startsWith("/api/social")) {
      res = await handleSocial(req);
    } else {
      // Static files
      const staticRes = await serveStatic(pathname);
      res = staticRes ?? new Response("Not Found", { status: 404 });
    }

    // Apply CORS + session cookie
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    if (setCookie) headers.set("Set-Cookie", setCookie);

    return new Response(res.body, { status: res.status, headers });
  },
});

console.log(`🚀 IndieForge AI running on http://localhost:${PORT}`);
