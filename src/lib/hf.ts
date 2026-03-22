/**
 * Hugging Face Inference API client.
 * Uses Bun's native fetch — no extra libraries.
 */

const HF_TOKEN     = process.env.HF_TOKEN     ?? "";
const HF_MODEL_URL = process.env.HF_MODEL_URL ?? "";

export interface HFResponse {
  raw: string;
  ok: boolean;
  error?: string;
}

/**
 * Call the fine-tuned model via HF Inference API.
 * Returns the raw text string so the parser can handle it.
 */
export async function callModel(prompt: string): Promise<HFResponse> {
  if (!HF_TOKEN || !HF_MODEL_URL) {
    return { raw: "", ok: false, error: "HF_TOKEN or HF_MODEL_URL not set" };
  }

  try {
    const res = await fetch(HF_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true",  // wait instead of 503 on cold start
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 512,
          temperature: 0.85,
          top_p: 0.92,
          do_sample: true,
          return_full_text: false,  // return only generated part
        },
      }),
      signal: AbortSignal.timeout(45_000),  // 45 s timeout
    });

    if (!res.ok) {
      const body = await res.text();
      return { raw: "", ok: false, error: `HF API ${res.status}: ${body}` };
    }

    const data = await res.json() as Array<{ generated_text: string }>;
    const raw  = Array.isArray(data) ? (data[0]?.generated_text ?? "") : "";

    return { raw, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { raw: "", ok: false, error: msg };
  }
}
