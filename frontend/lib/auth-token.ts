/**
 * Module-level bridge between Clerk's React hook (useAuth)
 * and the plain fetcher functions that can't call hooks.
 *
 * ClerkTokenSync in app.tsx calls setTokenGetter() with Clerk's getToken fn.
 * fetcher.ts calls getAuthToken() to attach the Authorization header.
 */

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  _getToken = fn;
}

export async function getAuthToken(): Promise<string | null> {
  if (!_getToken) return null;
  try {
    return await _getToken();
  } catch {
    return null;
  }
}
