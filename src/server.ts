/**
 * IndieForge AI — Server entry point
 *
 * Responsibilities:
 *  1. Run DB migration
 *  2. Register middlewares (CORS, session, error handler)
 *  3. Register routes
 *  4. Serve compiled frontend
 *  5. Health check
 */

import { ENV }                        from "./config/env";
import { corsPreflightResponse, applyCors } from "./middleware/cors";
import { resolveSession }             from "./middleware/session";
import { handleError }                from "./middleware/error-handler";
import { generateRoute }              from "./routes/generate";
import { imageRoute }                 from "./routes/image";
import { historyRoute }               from "./routes/history";
import { favoritesRoute }             from "./routes/favorites";
import { handleSocial }               from "./routes/social";
import { saveGenerationImageRoute, saveGenerationGlbRoute } from "./routes/generation-image";
import { trellisRoute }               from "./routes/trellis";
import { instantMeshRoute }           from "./routes/instant-mesh";
import { shapERoute }                 from "./routes/shap-e";
import { healthRoute }                from "./routes/health";
import { sql }                          from "bun";
import { logger }                     from "./utils/logger";
import { readFileSync }               from "fs";
import { join }                       from "path";

// ── DB Migration ─────────────────────────────────────────────────────────────
async function runMigration(): Promise<void> {
  const schemaSql = readFileSync(join(import.meta.dir, "db/schema.sql"), "utf-8");

  const statements = schemaSql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }

  logger.info("DB ready");
}

// ── Static file server ────────────────────────────────────────────────────────
async function serveStatic(pathname: string): Promise<Response | null> {
  const frontendBase = join(import.meta.dir, "../frontend");
  const publicBase   = join(import.meta.dir, "../public");

  // Public assets take priority (logos, images, fonts)
  if (pathname !== "/") {
    const pubFile = Bun.file(join(publicBase, pathname));
    if (await pubFile.exists()) return new Response(pubFile);
  }

  // Frontend app files
  const filePath = pathname === "/" ? join(frontendBase, "index.html") : join(frontendBase, pathname);
  const file     = Bun.file(filePath);
  if (await file.exists()) return new Response(file);

  return null;
}

// ── Router ────────────────────────────────────────────────────────────────────
async function router(req: Request, sessionId: string): Promise<Response> {
  const url      = new URL(req.url);
  const pathname = url.pathname;
  const method   = req.method;

  // Health check
  if (pathname === "/api/health")                          return healthRoute();

  // Generate
  if (pathname === "/api/generate" && method === "POST")   return generateRoute(req, sessionId);

  // Image generation
  if (pathname === "/api/imagen" && method === "POST")     return imageRoute(req);

  // Save generation image
  const genImgMatch = pathname.match(/^\/api\/generations\/(\d+)\/image$/);
  if (genImgMatch && method === "PATCH")
    return saveGenerationImageRoute(req, sessionId, Number(genImgMatch[1]));

  // Save generation GLB
  const genGlbMatch = pathname.match(/^\/api\/generations\/(\d+)\/glb$/);
  if (genGlbMatch && method === "PATCH")
    return saveGenerationGlbRoute(req, sessionId, Number(genGlbMatch[1]));

  // 3D generation
  if (pathname === "/api/trellis"       && method === "POST") return trellisRoute(req, sessionId);
  if (pathname === "/api/instant-mesh" && method === "POST") return instantMeshRoute(req, sessionId);
  if (pathname === "/api/shap-e"       && method === "POST") return shapERoute(req, sessionId);

  // History
  if (pathname === "/api/history" && method === "GET")     return historyRoute(req, sessionId);

  // Favorites
  if (pathname.startsWith("/api/favorite"))                return favoritesRoute(req, sessionId);

  // Social
  if (pathname.startsWith("/api/social"))                  return handleSocial(req);

  // Static files (compiled frontend)
  const staticRes = await serveStatic(pathname);
  return staticRes ?? new Response("Not Found", { status: 404 });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
await runMigration();

Bun.serve({
  port: ENV.PORT,
  async fetch(req) {
    if (req.method === "OPTIONS") return corsPreflightResponse();

    const { sessionId, setCookie } = resolveSession(req);

    let res: Response;
    try {
      res = await router(req, sessionId);
    } catch (e) {
      res = handleError(e);
    }

    res = applyCors(res);

    if (setCookie) {
      const headers = new Headers(res.headers);
      headers.set("Set-Cookie", setCookie);
      res = new Response(res.body, { status: res.status, headers });
    }

    return res;
  },
});

logger.info(`Server running on http://localhost:${ENV.PORT}`);
