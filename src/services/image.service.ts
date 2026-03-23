/**
 * Image generation service — builds prompt and calls HuggingFace FLUX.1-schnell.
 */
import { callImageModel } from "../lib/huggingface";
import { buildImagePrompt } from "../lib/imageGen";
import type { GenerationType } from "../types/generate";

export interface ImageGenerationResult {
  url: string | null;
  prompt: string;
  error?: string;
}

export async function generateImage(
  type: GenerationType,
  result: Record<string, unknown>
): Promise<ImageGenerationResult> {
  const prompt    = buildImagePrompt(type, result);
  const imgResult = await callImageModel(prompt);

  if (!imgResult.base64) {
    return { url: null, prompt, error: imgResult.error };
  }

  return {
    url:    `data:${imgResult.mimeType};base64,${imgResult.base64}`,
    prompt,
  };
}
