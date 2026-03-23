/**
 * Thin fetch wrapper with typed responses.
 */
export async function fetcher<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json() as { success: boolean; data?: T; error?: string };
    if (!json.success) return { data: null, error: json.error ?? "Unknown error" };
    return { data: json.data ?? null, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function postJSON<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<{ data: T | null; error: string | null }> {
  return fetcher<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteJSON<T>(url: string, body?: unknown): Promise<{ data: T | null; error: string | null }> {
  return fetcher<T>(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
