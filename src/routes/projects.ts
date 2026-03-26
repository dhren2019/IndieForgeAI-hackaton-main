/**
 * Routes for /api/projects
 *
 * GET    /api/projects                       — list user projects
 * POST   /api/projects                       — create project  { name, emoji? }
 * DELETE /api/projects/:id                   — delete project
 * GET    /api/projects/:id/items             — list generations in a project
 * POST   /api/projects/:id/items             — add generation  { generation_id }
 * DELETE /api/projects/:id/items/:genId      — remove generation from project
 * GET    /api/projects/generation/:genId     — which projects contain this generation
 */
import {
  createUserProject,
  getUserProjects,
  deleteUserProject,
  updateUserProject,
  addGenerationToProject,
  removeGenerationFromProject,
  listProjectItems,
  getGenerationProjectIds,
} from "../services/project.service";
import { ok, err } from "../utils/response";

export async function projectsRoute(req: Request, sessionId: string, cookieSessionId?: string | null): Promise<Response> {
  const url      = new URL(req.url);
  const pathname = url.pathname;
  const method   = req.method;

  // GET /api/projects
  if (pathname === "/api/projects" && method === "GET") {
    const projects = await getUserProjects(sessionId, cookieSessionId);
    return ok(projects);
  }

  // POST /api/projects
  if (pathname === "/api/projects" && method === "POST") {
    let body: Record<string, unknown>;
    try { body = await req.json() as Record<string, unknown>; }
    catch { return err("JSON inválido"); }
    const name  = String(body.name ?? "").trim();
    const emoji = String(body.emoji ?? "📁").slice(0, 4);
    if (!name) return err("El nombre es obligatorio", 400);
    const project = await createUserProject(sessionId, name, emoji);
    return ok(project, 201);
  }

  // GET /api/projects/generation/:genId
  const genCheck = pathname.match(/^\/api\/projects\/generation\/(\d+)$/);
  if (genCheck && method === "GET") {
    const genId      = Number(genCheck[1]);
    const projectIds = await getGenerationProjectIds(genId, sessionId);
    return ok(projectIds);
  }

  // Routes with project :id
  const idMatch = pathname.match(/^\/api\/projects\/(\d+)(\/.*)?$/);
  if (idMatch) {
    const projectId = Number(idMatch[1]);
    const sub       = idMatch[2] ?? "";

    // DELETE /api/projects/:id
    if (sub === "" && method === "DELETE") {
      const deleted = await deleteUserProject(projectId, sessionId);
      if (!deleted) return err("Proyecto no encontrado", 404);
      return ok({ deleted: true });
    }

    // PATCH /api/projects/:id  { name, emoji }
    if (sub === "" && method === "PATCH") {
      let body: Record<string, unknown>;
      try { body = await req.json() as Record<string, unknown>; }
      catch { return err("JSON inválido"); }
      const name  = String(body.name  ?? "").trim();
      const emoji = String(body.emoji ?? "📁").slice(0, 4);
      if (!name) return err("El nombre es obligatorio", 400);
      const updated = await updateUserProject(projectId, sessionId, name, emoji);
      if (!updated) return err("Proyecto no encontrado", 404);
      return ok(updated);
    }

    // GET /api/projects/:id/items
    if (sub === "/items" && method === "GET") {
      const items = await listProjectItems(projectId, sessionId);
      return ok(items);
    }

    // POST /api/projects/:id/items  { generation_id }
    if (sub === "/items" && method === "POST") {
      let body: Record<string, unknown>;
      try { body = await req.json() as Record<string, unknown>; }
      catch { return err("JSON inválido"); }
      const generationId = Number(body.generation_id);
      if (!generationId) return err("generation_id requerido", 400);
      const added = await addGenerationToProject(projectId, generationId, sessionId);
      if (!added) return err("No se pudo añadir (¿proyecto no encontrado?)", 403);
      return ok({ added: true });
    }

    // DELETE /api/projects/:id/items/:genId
    const itemMatch = sub.match(/^\/items\/(\d+)$/);
    if (itemMatch && method === "DELETE") {
      const generationId = Number(itemMatch[1]);
      await removeGenerationFromProject(projectId, generationId, sessionId);
      return ok({ removed: true });
    }
  }

  return new Response(JSON.stringify({ error: "Ruta no encontrada" }), { status: 404 });
}
