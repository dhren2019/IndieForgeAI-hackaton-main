import React from "react";
import type { ToastMessage } from "../../types/ui";

export function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span className="toast__icon">
            {t.kind === "ok" ? "✓" : t.kind === "error" ? "✕" : "⚠"}
          </span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
