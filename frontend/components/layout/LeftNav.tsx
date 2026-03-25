import React, { useState } from "react";
import { useAppState } from "../../state/app-state";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { ProjectsModal } from "../projects/ProjectModal";
import type { AppTab } from "../../types/ui";

const NAV_ITEMS: { id: AppTab; label: string; icon: string }[] = [
  { id: "generate",  label: "Generar",   icon: "✦" },
  { id: "history",   label: "Historial", icon: "📖" },
  { id: "favorites", label: "Favoritos", icon: "★" },
  { id: "social",    label: "Social",    icon: "🌐" },
  { id: "projects",  label: "Proyectos", icon: "🗂️" },
];

export function LeftNav() {
  const { tab, setTab, navCollapsed, toggleNav } = useAppState();
  const { isSignedIn } = useAuth();
  const { openSignIn }  = useClerk();
  const [showProjects, setShowProjects] = useState(false);

  const handleNewProject = () => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setShowProjects(true);
  };

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav__section">
          {!navCollapsed && <span className="app-nav__label">Navegación</span>}
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item nav-item--${item.id}${tab === item.id ? " nav-item--active" : ""}`}
              onClick={() => setTab(item.id)}
              title={navCollapsed ? item.label : undefined}
            >
              <span className="nav-item__icon">{item.icon}</span>
              {!navCollapsed && <span className="nav-item__label">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* New Project button — above the divider and collapse toggle */}
        <div className="app-nav__projects-area">
          <button
            className="app-nav__new-project"
            onClick={handleNewProject}
            title={navCollapsed ? "Nuevo proyecto" : undefined}
          >
            <span className="app-nav__new-project-icon">＋</span>
            {!navCollapsed && <span className="app-nav__new-project-label">Nuevo proyecto</span>}
          </button>
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

      <ProjectsModal
        open={showProjects}
        onClose={() => setShowProjects(false)}
      />
    </>
  );
}
