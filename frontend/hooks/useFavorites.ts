import { useState, useEffect, useCallback } from "react";
import { apiFavorites, apiAddFavorite, apiRemoveFavorite } from "../lib/api";
import type { Generation } from "../types/generate";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Generation[]>([]);
  const [favIds, setFavIds]       = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await apiFavorites();
    if (data) {
      setFavorites(data);
      setFavIds(new Set(data.map((f) => f.id)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const toggle = useCallback(async (id: number, add: boolean) => {
    if (add) {
      await apiAddFavorite(id);
      setFavIds((s) => new Set(s).add(id));
    } else {
      await apiRemoveFavorite(id);
      setFavIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
    reload();
  }, [reload]);

  return { favorites, favIds, loading, reload, toggle };
}
