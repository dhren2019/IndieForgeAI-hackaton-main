import { useState, useEffect, useCallback } from "react";
import { apiHistory } from "../lib/api";
import type { Generation } from "../types/generate";

export function useHistory() {
  const [history, setHistory] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await apiHistory(30);
    if (data) setHistory(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const prepend = (gen: Generation) => setHistory((h) => [gen, ...h]);

  return { history, loading, reload, prepend };
}
