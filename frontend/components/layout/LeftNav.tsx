import React from "react";
import { useAppState } from "../../state/app-state";
import type { AppTab } from "../../types/ui";

const NAV_ITEMS: { id: AppTab; label: string; icon: string }[] = [
  { id: "generate",  label: "Generar",   icon: "✦" },
  { id: "history",   label: "Historial", icon: "📖" },
  { id: "favorites", label: "Favoritos", icon: "★" },
  { id: "social",    label: "Social",    icon: "🌐" },
];

export function LeftNav() {
  const { tab, setTab } = useAppState();
  return (
    <nav className="app-nav">
      <div className="app-nav__section">
        <span className="app-nav__label">Navegación</span>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item${tab === item.id ? " nav-item--active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-item__icon">{item.icon}</span>
            <span className="nav-item__label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="app-nav__footer">
        IndieForge AI v1.0
      </div>
    </nav>
  );
}
