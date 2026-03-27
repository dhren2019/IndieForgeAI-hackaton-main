/**
 * Thin fetch wrapper with typed responses.
 * Auth is handled via Clerk's browser cookies (__session) which are sent
 * automatically. We no longer attach an Authorization header because the
 * duplicate JWT pushed Cookie + Authorization over Bun's 16 KB header limit
 * causing HTTP 431 errors.
 */

export async function fetcher<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const mergedOptions: RequestInit = {
      ...options,
      credentials: "include",
      headers: {
        ...(options?.headers as Record<string, string> ?? {}),
      },
    };

    const res = await fetch(url, mergedOptions);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, error: `HTTP ${res.status}: ${text}` };
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
