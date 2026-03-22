/**
 * Ruta: POST /api/imagen
 * Genera una hoja de diseño del personaje/arma/enemigo usando HuggingFace FLUX.1-schnell.
 * Una sola imagen con vista frontal, trasera y primer plano — como reference sheets profesionales.
 */

import { buildImagePrompt, generateImage, type CharacterType } from "../lib/imageGen";

export async function handleImageGen(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const type   = body.type   as CharacterType | undefined;
  const result = body.result as Record<string, unknown> | undefined;

  if (!type || !["npc", "quest", "item", "lore", "weapon", "enemy"].includes(type))
    return json({ error: "Tipo inválido" }, 400);

  if (!result || typeof result !== "object")
    return json({ error: "Resultado inválido" }, 400);

  const prompt    = buildImagePrompt(type, result);
  const imgResult = await generateImage(prompt);

  if (!imgResult.base64) {
    return json({ success: false, error: imgResult.error ?? "Error de generación" }, 503);
  }

  return json({
    success: true,
    data: {
      url: `data:${imgResult.mimeType};base64,${imgResult.base64}`,
      prompt,
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
