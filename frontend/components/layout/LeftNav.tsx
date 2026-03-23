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
  const { tab, setTab, navCollapsed, toggleNav } = useAppState();
  return (
    <nav className="app-nav">
      <div className="app-nav__section">
        {!navCollapsed && <span className="app-nav__label">Navegación</span>}
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item${tab === item.id ? " nav-item--active" : ""}`}
            onClick={() => setTab(item.id)}
            title={navCollapsed ? item.label : undefined}
          >
            <span className="nav-item__icon">{item.icon}</span>
            {!navCollapsed && <span className="nav-item__label">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Toggle at the bottom — icon only */}
      <button
        className="app-nav__toggle"
        onClick={toggleNav}
        title={navCollapsed ? "Expandir menú" : "Colapsar menú"}
        aria-label={navCollapsed ? "Expandir menú" : "Colapsar menú"}
      >
        <span className="app-nav__toggle-icon">{navCollapsed ? "›" : "‹"}</span>
      </button>
    </nav>
  );
}
