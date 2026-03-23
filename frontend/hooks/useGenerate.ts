import { useState, useCallback } from "react";
import { apiGenerate } from "../lib/api";
import type { Generation, GenerationType } from "../types/generate";

interface GenerateState {
  loading:    boolean;
  error:      string | null;
  result:     Generation | null;
}

export function useGenerate() {
  const [state, setState] = useState<GenerateState>({
    loading: false,
    error:   null,
    result:  null,
  });

  const generate = useCallback(async (
    type:   GenerationType,
    meta:   Record<string, string>,
    model?: string
  ) => {
    setState({ loading: true, error: null, result: null });

    const { data, error } = await apiGenerate(type, meta, model);

    if (error || !data) {
      setState({ loading: false, error: error ?? "Error desconocido", result: null });
      return null;
    }

    setState({ loading: false, error: null, result: data });
    return data;
  }, []);

  return { ...state, generate };
}
