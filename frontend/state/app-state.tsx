import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { AppTab, ToastMessage } from "../types/ui";
import type { Generation } from "../types/generate";
import { DEFAULT_MODEL } from "../types/generate";
import type { AiModelId } from "../types/generate";

interface AppState {
  tab:              AppTab;
  latest:           Generation | null;
  selectedModel:    AiModelId;
  showToast:        (msg: string, kind?: ToastMessage["kind"]) => void;
  setTab:           (tab: AppTab) => void;
  setLatest:        (gen: Generation) => void;
  setSelectedModel: (model: AiModelId) => void;
  toasts:           ToastMessage[];
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [tab, setTab]       = useState<AppTab>("generate");
  const [latest, setLatest] = useState<Generation | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedModel, setSelectedModelRaw] = useState<AiModelId>(
    () => (localStorage.getItem("indieforge_model") as AiModelId | null) ?? DEFAULT_MODEL
  );

  const setSelectedModel = useCallback((model: AiModelId) => {
    localStorage.setItem("indieforge_model", model);
    setSelectedModelRaw(model);
  }, []);

  const showToast = useCallback((msg: string, kind: ToastMessage["kind"] = "ok") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <AppContext.Provider value={{ tab, latest, toasts, selectedModel, showToast, setTab, setLatest, setSelectedModel }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
