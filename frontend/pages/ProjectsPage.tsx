import React, { useState, useEffect, useCallback } from "react";
import { useAuth, useClerk }  from "@clerk/clerk-react";
import { PageContainer }      from "../components/layout/PageContainer";
import { Button }             from "../components/ui/Button";
import { ProjectsSkeleton, FeedSkeleton } from "../components/ui/Skeletons";
import { ProjectItemCard }    from "../components/projects/ProjectItemCard";
import { useProjects }        from "../hooks/useProjects";
import { useFavorites }       from "../hooks/useFavorites";
import { apiGetProjectItems } from "../lib/api";
import type { ProjectData }   from "../lib/api";
import type { Generation }    from "../types/generate";

interface ProjectsPageProps {
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

const EMOJI_OPTIONS = ["📁", "⚔️", "🧙", "🏰", "🗺️", "🐉", "💎", "🌿", "🔥", "⚡", "🌙", "🎭"];

export function ProjectsPage({ onToast }: ProjectsPageProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { openSignIn }           = useClerk();
  const {
    projects, loading: projLoading,
    createProject, deleteProject, updateProject,
  } = useProjects();
  const { favIds, toggle: toggleFav } = useFavorites();

  const [selected, setSelected]           = useState<ProjectData | null>(null);
  const [items, setItems]                 = useState<Generation[]>([]);
  const [itemsLoading, setItemsLoading]   = useState(false);
  const [creating, setCreating]           = useState(false);
  const [newName, setNewName]             = useState("");
  const [newEmoji, setNewEmoji]           = useState("📁");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [viewMode, setViewMode]           = useState<"grid" | "list">("grid");
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [editName, setEditName]           = useState("");
  const [editEmoji, setEditEmoji]         = useState("📁");

  // Load items when a project is selected
  const openProject = useCallback(async (p: ProjectData) => {
    setSelected(p);
    setItemsLoading(true);
    const { data, error } = await apiGetProjectItems(p.id);
    if (error) onToast("Error al cargar el proyecto", "error");
    setItems(data ?? []);
    setItemsLoading(false);
  }, [onToast]);

  // Keep selected in sync when the projects list updates (e.g. item count changes)
  useEffect(() => {
    if (selected) {
      const fresh = projects.find((p) => p.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [projects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const proj = await createProject(newName.trim(), newEmoji);
    if (proj) {
      onToast(`Proyecto "${proj.name}" creado`);
      setCreating(false);
      setNewName("");
      setNewEmoji("📁");
    }
  };

  const handleDelete = async (id: number) => {
    await deleteProject(id);
    if (selected?.id === id) { setSelected(null); setItems([]); }
    setConfirmDelete(null);
    onToast("Proyecto eliminado");
  };

  const startEdit = (p: ProjectData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditName(p.name);
    setEditEmoji(p.emoji);
    setConfirmDelete(null);
  };

  const handleUpdate = async () => {
    if (!editName.trim() || editingId === null) return;
    const updated = await updateProject(editingId, editName.trim(), editEmoji);
    if (updated) {
      onToast("Proyecto actualizado");
      if (selected?.id === editingId)
        setSelected((s) => s ? { ...s, name: updated.name, emoji: updated.emoji } : s);
    }
    setEditingId(null);
  };

  // Not signed in — show auth wall
  if (isLoaded && !isSignedIn) {
    return (
      <div className="page-bg-wrap">
        <div className="social-bg" aria-hidden="true">
          <div className="social-bg__orb social-bg__orb--1" />
          <div className="social-bg__orb social-bg__orb--2" />
          <div className="social-bg__grid" />
        </div>
        <PageContainer>
          <div className="projects-page__auth-wall">
            <div className="projects-page__auth-icon">🗂️</div>
            <h2 className="projects-page__auth-title">Necesitas una cuenta</h2>
            <p className="projects-page__auth-sub">
              Inicia sesión para crear carpetas y organizar tus creaciones
            </p>
            <Button variant="primary" onClick={() => openSignIn()}>
              Iniciar sesión
            </Button>
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="page-bg-wrap">
      <div className="social-bg" aria-hidden="true">
        <div className="social-bg__orb social-bg__orb--1" />
        <div className="social-bg__orb social-bg__orb--2" />
        <div className="social-bg__orb social-bg__orb--3" />
        <div className="social-bg__grid" />
      </div>

      <PageContainer wide>
        <div className="page-hero">
          <h1 className="page-hero__title"><span className="plain-emoji">🗂️</span> Proyectos</h1>
          <p className="page-hero__sub">Organiza tus generaciones en carpetas</p>
        </div>

        <div className="split-layout split-layout--projects">

          {/* ══ Sidebar: project list ══ */}
          <aside className="split-layout__list projects-sidebar">

            <div className="projects-sidebar__header">
              <span className="projects-sidebar__count">
                {projLoading ? "…" : `${projects.length} proyecto${projects.length !== 1 ? "s" : ""}`}
              </span>
              <Button variant="primary" size="sm" icon="＋" onClick={() => setCreating(true)}>
                Nuevo
              </Button>
            </div>

            {/* Inline create form */}
            {creating && (
              <div className="projects-sidebar__create">
                <div className="proj-panel__emoji-row">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      className={`proj-panel__emoji-opt${newEmoji === e ? " proj-panel__emoji-opt--active" : ""}`}
                      onClick={() => setNewEmoji(e)}
                    >{e}</button>
                  ))}
                </div>
                <input
                  className="proj-panel__input"
                  placeholder="Nombre del proyecto…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                  autoFocus
                  maxLength={100}
                />
                <div className="proj-panel__create-actions">
                  <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                    Crear
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setNewName(""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {projLoading && <ProjectsSkeleton />}

            {!projLoading && projects.length === 0 && !creating && (
              <div className="projects-sidebar__empty">
                <span className="projects-sidebar__empty-icon">📭</span>
                <p>Aún no tienes proyectos</p>
                <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                  Crear el primero
                </Button>
              </div>
            )}

            <div className="projects-sidebar__list">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`projects-sidebar__item${selected?.id === p.id ? " projects-sidebar__item--active" : ""}`}
                >
                  {editingId === p.id ? (
                    /* ── Inline edit form ── */
                    <div className="projects-sidebar__edit">
                      <div className="proj-panel__emoji-row proj-panel__emoji-row--sm">
                        {EMOJI_OPTIONS.map((e) => (
                          <button
                            key={e}
                            className={`proj-panel__emoji-opt${editEmoji === e ? " proj-panel__emoji-opt--active" : ""}`}
                            onClick={() => setEditEmoji(e)}
                          >{e}</button>
                        ))}
                      </div>
                      <input
                        className="proj-panel__input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        maxLength={100}
                      />
                      <div className="proj-panel__create-actions">
                        <Button variant="primary" size="sm" onClick={handleUpdate} disabled={!editName.trim()}>
                          Guardar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        className="projects-sidebar__item-btn"
                        onClick={() => openProject(p)}
                      >
                        <span className="projects-sidebar__item-emoji">{p.emoji}</span>
                        <span className="projects-sidebar__item-name">{p.name}</span>
                        <span className="projects-sidebar__item-count">{p.item_count}</span>
                      </button>

                      {confirmDelete === p.id ? (
                        <span className="projects-sidebar__confirm">
                          <button
                            className="projects-modal__danger-btn"
                            onClick={() => handleDelete(p.id)}
                            title="Confirmar eliminación"
                          >✓</button>
                          <button
                            className="projects-modal__cancel-btn"
                            onClick={() => setConfirmDelete(null)}
                          >✕</button>
                        </span>
                      ) : (
                        <span className="projects-sidebar__actions">
                          <button
                            className="projects-sidebar__edit-btn"
                            onClick={(e) => startEdit(p, e)}
                            title="Editar nombre/icono"
                          >✏️</button>
                          <button
                            className="projects-sidebar__del"
                            onClick={() => setConfirmDelete(p.id)}
                            title="Eliminar proyecto"
                          >🗑</button>
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

          </aside>

          {/* ══ Main: project contents ══ */}
          <main className="split-layout__detail projects-detail">

            {!selected ? (
              <div className="empty-state">
                <div className="empty-state__icon">🗂️</div>
                <p className="empty-state__text">
                  {projects.length === 0
                    ? "Crea tu primer proyecto y añade generaciones"
                    : "Selecciona un proyecto para ver su contenido"}
                </p>
              </div>
            ) : itemsLoading ? (
              <FeedSkeleton />
            ) : (
              <>
                {/* Detail header: project title + view-mode toggle */}
                <div className="projects-detail__header">
                  <span className="projects-detail__title">
                    <span>{selected.emoji}</span>
                    <span>{selected.name}</span>
                    <span className="projects-sidebar__item-count">{items.length}</span>
                  </span>
                  <span className="projects-detail__view-toggle">
                    <button
                      className={`projects-detail__view-btn${viewMode === "grid" ? " projects-detail__view-btn--active" : ""}`}
                      onClick={() => setViewMode("grid")}
                      title="Vista cuadrícula"
                    >⊞</button>
                    <button
                      className={`projects-detail__view-btn${viewMode === "list" ? " projects-detail__view-btn--active" : ""}`}
                      onClick={() => setViewMode("list")}
                      title="Vista lista"
                    >☰</button>
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">{selected.emoji}</div>
                    <p className="empty-state__text">
                      Este proyecto está vacío. Añade generaciones con el botón&nbsp;
                      <strong>＋ Proyecto</strong> en cualquier tarjeta.
                    </p>
                  </div>
                ) : (
                  <div className={`projects-detail__grid projects-detail__grid--${viewMode}`}>
                    {items.map((gen) => (
                      <ProjectItemCard
                        key={gen.id}
                        gen={gen}
                        isFav={favIds.has(gen.id)}
                        onFavToggle={(id, add) => {
                          toggleFav(id, add);
                          onToast(add ? "Guardado en favoritos" : "Eliminado de favoritos");
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

          </main>

        </div>
      </PageContainer>
    </div>
  );
}
