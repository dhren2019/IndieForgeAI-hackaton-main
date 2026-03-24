/**
 * Thin fetch wrapper with typed responses.
 * Automatically attaches Authorization: Bearer <token> when the user is
 * signed in with Clerk (token getter set by ClerkTokenSync in app.tsx).
 */
import { getAuthToken } from "./auth-token";

export async function fetcher<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const token = await getAuthToken();
    const authHeader: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...authHeader,
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
