import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiHistory } from "../lib/api";
import type { Generation } from "../types/generate";

export function useHistory() {
  const [history, setHistory] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);
  const { userId, isLoaded } = useAuth();

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await apiHistory(30);
    if (data) setHistory(data);
    setLoading(false);
  }, []);

  // Re-fetch whenever auth state settles or the logged-in user changes
  useEffect(() => {
    if (isLoaded) reload();
  }, [reload, isLoaded, userId]);

  const prepend = (gen: Generation) => setHistory((h) => [gen, ...h]);

  return { history, loading, reload, prepend };
}
