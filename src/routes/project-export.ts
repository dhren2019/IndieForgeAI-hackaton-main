/**
 * GET /api/projects/:id/export
 *
 * Generates a ZIP "Export Pack" for the given project containing:
 *   game-bible.json   — structured data for every generation
 *   game-bible.md     — human-readable markdown summary
 *   assets/images/    — all generation images (decoded from data-URIs)
 *   assets/models/    — all .glb 3-D models   (decoded from data-URIs)
 *   unity-data.json   — Unity-friendly flat array of items
 *   godot-data.json   — Godot-friendly flat array of items
 */

import JSZip from "jszip";
import { getProjectItems } from "../db/client";
import { sql }             from "bun";
import { err }             from "../utils/response";
import { logger }          from "../utils/logger";
import type { Generation } from "../db/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode a data-URI string into { buffer, ext } */
function decodeDataUri(uri: string): { buffer: Buffer; ext: string } | null {
  const m = uri.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const ext  = mime.includes("png") ? "png"
             : mime.includes("jpeg") || mime.includes("jpg") ? "jpg"
             : mime.includes("webp") ? "webp"
             : mime.includes("gltf") || mime.includes("glb") ? "glb"
             : mime.includes("octet") ? "glb"
             : mime.split("/")[1] ?? "bin";
  return { buffer: Buffer.from(m[2], "base64"), ext };
}

/** Sanitise a name for use as a filename */
function safeName(raw: string, fallback: string): string {
  const clean = raw
    .replace(/[^a-zA-Z0-9_\-. ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
  return clean || fallback;
}

/** Build a slug from a generation */
function itemSlug(gen: Generation, idx: number): string {
  const name =
    (gen.result as Record<string, unknown>)?.name as string
    ?? (gen.result as Record<string, unknown>)?.title as string
    ?? (gen.prompt_meta as Record<string, unknown>)?.style as string
    ?? gen.type;
  return `${String(idx + 1).padStart(3, "0")}_${safeName(String(name), gen.type)}`;
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdown(projectName: string, items: Generation[]): string {
  const lines: string[] = [
    `# ${projectName} — Game Bible`,
    "",
    `> Exported from IndieForge AI on ${new Date().toISOString().slice(0, 10)}`,
    "",
    `## Summary`,
    "",
    `Total items: **${items.length}**`,
    "",
  ];
  const byType: Record<string, Generation[]> = {};
  for (const g of items) {
    (byType[g.type] ??= []).push(g);
  }
  for (const [type, gens] of Object.entries(byType)) {
    lines.push(`- **${type}**: ${gens.length}`);
  }
  lines.push("", "---", "");

  for (let i = 0; i < items.length; i++) {
    const g   = items[i];
    const res = g.result as Record<string, unknown>;
    lines.push(`## ${i + 1}. [${g.type.toUpperCase()}] ${res.name ?? res.title ?? "Unnamed"}`);
    lines.push("");

    for (const [k, v] of Object.entries(res)) {
      if (k === "name" || k === "title") continue;
      if (typeof v === "string") {
        lines.push(`**${k}:** ${v}`);
      } else if (Array.isArray(v)) {
        lines.push(`**${k}:** ${v.join(", ")}`);
      }
    }
    if (g.image_url) lines.push(`\n![image](assets/images/${itemSlug(g, i)}.png)`);
    if (g.glb_url)   lines.push(`\n3D model: \`assets/models/${itemSlug(g, i)}.glb\``);
    lines.push("", "---", "");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Engine-friendly data builders
// ---------------------------------------------------------------------------

function buildEngineData(items: Generation[]) {
  return items.map((g, i) => {
    const slug = itemSlug(g, i);
    return {
      id:        g.id,
      type:      g.type,
      slug,
      data:      g.result,
      image:     g.image_url ? `assets/images/${slug}.png` : null,
      model:     g.glb_url   ? `assets/models/${slug}.glb` : null,
      created_at: g.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function projectExportRoute(
  _req: Request,
  sessionId: string,
  projectId: number,
): Promise<Response> {
  // Verify ownership & get project name
  const projRows = await sql`
    SELECT name, emoji FROM projects
    WHERE id = ${projectId} AND session_id = ${sessionId}
  `;
  if (projRows.length === 0) return err("Proyecto no encontrado", 404);

  const projectName = String((projRows[0] as Record<string, unknown>).name);
  const items       = await getProjectItems(projectId, sessionId);

  if (items.length === 0) return err("El proyecto está vacío — no hay nada que exportar", 400);

  const zip = new JSZip();

  // ── game-bible.json ─────────────────────────────────────────────────────
  const bible = {
    project:    projectName,
    exported:   new Date().toISOString(),
    item_count: items.length,
    items:      items.map((g) => ({
      id:         g.id,
      type:       g.type,
      prompt_meta: g.prompt_meta,
      result:     g.result,
      image_url:  g.image_url ? `assets/images/${itemSlug(g, items.indexOf(g))}.png`  : null,
      glb_url:    g.glb_url   ? `assets/models/${itemSlug(g, items.indexOf(g))}.glb` : null,
      created_at: g.created_at,
    })),
  };
  zip.file("game-bible.json", JSON.stringify(bible, null, 2));

  // ── game-bible.md ───────────────────────────────────────────────────────
  zip.file("game-bible.md", buildMarkdown(projectName, items));

  // ── unity-data.json / godot-data.json ───────────────────────────────────
  const engineData = buildEngineData(items);
  zip.file("unity-data.json",  JSON.stringify({ items: engineData }, null, 2));
  zip.file("godot-data.json",  JSON.stringify({ items: engineData }, null, 2));

  // ── assets/images & assets/models ───────────────────────────────────────
  for (let i = 0; i < items.length; i++) {
    const g    = items[i];
    const slug = itemSlug(g, i);

    if (g.image_url) {
      const decoded = decodeDataUri(g.image_url);
      if (decoded) {
        zip.file(`assets/images/${slug}.${decoded.ext}`, decoded.buffer);
      }
    }

    if (g.glb_url) {
      const decoded = decodeDataUri(g.glb_url);
      if (decoded) {
        zip.file(`assets/models/${slug}.${decoded.ext}`, decoded.buffer);
      }
    }
  }

  // ── Generate the ZIP ────────────────────────────────────────────────────
  let zipBuffer: ArrayBuffer;
  try {
    zipBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  } catch (e) {
    logger.error("[export] ZIP generation failed:", e);
    return err("Error al generar el ZIP", 500);
  }

  const filename = safeName(projectName, "project") + "_export.zip";
  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
