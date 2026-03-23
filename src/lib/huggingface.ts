/**
 * Hugging Face Inference API client.
 */
import { ENV } from "../config/env";

export interface HFTextResponse {
  raw: string;
  ok: boolean;
  error?: string;
}

export interface HFImageResponse {
  base64: string | null;
  mimeType: string;
  error?: string;
}

export async function callTextModel(prompt: string, customUrl?: string): Promise<HFTextResponse> {
  const url = customUrl ?? ENV.HF_MODEL_URL;
  if (!ENV.HF_TOKEN || !url) {
    return { raw: "", ok: false, error: "HF_TOKEN or model URL not set" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:       `Bearer ${ENV.HF_TOKEN}`,
        "Content-Type":      "application/json",
        "x-wait-for-model":  "true",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens:  512,
          temperature:     0.85,
          top_p:           0.92,
          do_sample:       true,
          return_full_text: false,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { raw: "", ok: false, error: `HF API ${res.status}: ${body}` };
    }

    const data = await res.json() as Array<{ generated_text: string }>;
    const raw  = Array.isArray(data) ? (data[0]?.generated_text ?? "") : "";
    return { raw, ok: true };
  } catch (e) {
    return { raw: "", ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function callImageModel(prompt: string): Promise<HFImageResponse> {
  if (!ENV.HF_TOKEN) {
    return {
      base64: null,
      mimeType: "image/png",
      error: "HF_TOKEN not configured",
    };
  }

  const url = `https://router.huggingface.co/hf-inference/models/${ENV.HF_IMAGE_MODEL}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:      `Bearer ${ENV.HF_TOKEN}`,
        "Content-Type":     "application/json",
        "x-wait-for-model": "true",
      },
      body: JSON.stringify({
        inputs:     prompt,
        parameters: { num_inference_steps: 4 },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { base64: null, mimeType: "image/png", error: `HF API ${res.status}: ${body.slice(0, 300)}` };
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer      = await res.arrayBuffer();
    const base64      = Buffer.from(buffer).toString("base64");
    return { base64, mimeType: contentType };
  } catch (e) {
    return { base64: null, mimeType: "image/png", error: e instanceof Error ? e.message : String(e) };
  }
}
