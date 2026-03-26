import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "../lib/auth-token";
import { apiHistory } from "../lib/api";
import type { Generation } from "../types/generate";

export function useHistory() {
  const [history, setHistory] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);
  const { userId, isLoaded, getToken, isSignedIn } = useAuth();

  const reload = useCallback(async () => {
    // Sync auth token before any API call (guards against the React effect
    // bottom-up firing order where this hook runs before ClerkTokenSync)
    setTokenGetter(isSignedIn ? getToken : null);
    setLoading(true);
    const { data } = await apiHistory(10);
    if (data) setHistory(data);
    setLoading(false);
  }, [getToken, isSignedIn]);

  // Re-fetch whenever auth state settles or the logged-in user changes
  useEffect(() => {
    if (isLoaded) reload();
  }, [reload, isLoaded, userId]);

  const prepend = (gen: Generation) => setHistory((h) => [gen, ...h]);

  return { history, loading, reload, prepend };
}
