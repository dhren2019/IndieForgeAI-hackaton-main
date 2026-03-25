import React, { useState, useEffect } from "react";
import { Modal }   from "../ui/Modal";
import { Button }  from "../ui/Button";
import { useProjects } from "../../hooks/useProjects";
import { apiGetProjectItems } from "../../lib/api";
import type { ProjectData } from "../../lib/api";
import type { Generation }  from "../../types/generate";
import { getGenerationTitle } from "../../lib/formatters";

// ── Emoji picker options for new project ──────────────────────────────────────
const EMOJI_OPTIONS = ["📁", "⚔️", "🧙", "🏰", "🗺️", "🐉", "💎", "🌿", "🔥", "⚡", "🌙", "🎭"];

// ── Sub-component: panel to add a generation to a project ─────────────────────
interface AddToProjectPanelProps {
  generationId: number;
  onClose:      () => void;
  onToast?:     (msg: string) => void;
}

export function AddToProjectPanel({ generationId, onClose, onToast }: AddToProjectPanelProps) {
  const { projects, loading, createProject, addToProject, getGenerationProjects } = useProjects();
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy]               = useState<number | null>(null);
  const [creating, setCreating]       = useState(false);
  const [newName, setNewName]         = useState("");
  const [newEmoji, setNewEmoji]       = useState("📁");

  useEffect(() => {
    getGenerationProjects(generationId).then((ids) => setAssignedIds(new Set(ids)));
  }, [generationId]);

  const handleToggle = async (projectId: number) => {
    setBusy(projectId);
    if (assignedIds.has(projectId)) {
      const { error } = await import("../../lib/api").then((m) => m.apiRemoveFromProject(projectId, generationId));
      if (!error) setAssignedIds((s) => { const n = new Set(s); n.delete(projectId); return n; });
    } else {
      const ok = await addToProject(projectId, generationId);
      if (ok) setAssignedIds((s) => new Set(s).add(projectId));
    }
    setBusy(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const proj = await createProject(newName.trim(), newEmoji);
    if (proj) {
      await addToProject(proj.id, generationId);
      setAssignedIds((s) => new Set(s).add(proj.id));
      onToast?.(`Proyecto "${proj.name}" creado y elemento añadido`);
    }
    setNewName("");
    setCreating(false);
  };

  if (loading) return <div className="proj-panel__loading">Cargando proyectos…</div>;

  return (
    <div className="proj-panel">
      <div className="proj-panel__list">
        {projects.length === 0 && !creating && (
          <p className="proj-panel__empty">No tienes proyectos aún. ¡Crea el primero!</p>
        )}
        {projects.map((p) => {
          const assigned = assignedIds.has(p.id);
          return (
            <button
              key={p.id}
              className={`proj-panel__item${assigned ? " proj-panel__item--assigned" : ""}`}
              onClick={() => handleToggle(p.id)}
              disabled={busy === p.id}
            >
              <span className="proj-panel__item-emoji">{p.emoji}</span>
              <span className="proj-panel__item-name">{p.name}</span>
              <span className="proj-panel__item-count">{p.item_count}</span>
              <span className="proj-panel__item-check">{assigned ? "✓" : "+"}</span>
            </button>
          );
        })}
      </div>

      {creating ? (
        <div className="proj-panel__create">
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
            onChange={(ev) => setNewName(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") handleCreate(); if (ev.key === "Escape") setCreating(false); }}
            autoFocus
            maxLength={100}
          />
          <div className="proj-panel__create-actions">
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newName.trim()}>Crear</Button>
            <Button variant="ghost"   size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" fullWidth onClick={() => setCreating(true)} icon="＋">
          Nuevo proyecto
        </Button>
      )}
    </div>
  );
}

// ── Main Projects Manager Modal ───────────────────────────────────────────────
interface ProjectsModalProps {
  open:     boolean;
  onClose:  () => void;
  onToast?: (msg: string) => void;
}

export function ProjectsModal({ open, onClose, onToast }: ProjectsModalProps) {
  const { projects, loading, createProject, deleteProject } = useProjects();
  const [selected, setSelected]   = useState<ProjectData | null>(null);
  const [items, setItems]         = useState<Generation[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState("");
  const [newEmoji, setNewEmoji]   = useState("📁");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const openProject = async (p: ProjectData) => {
    setSelected(p);
    setItemsLoading(true);
    const { data } = await apiGetProjectItems(p.id);
    setItems(data ?? []);
    setItemsLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const proj = await createProject(newName.trim(), newEmoji);
    if (proj) onToast?.(`Proyecto "${proj.name}" creado`);
    setNewName("");
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    await deleteProject(id);
    if (selected?.id === id) setSelected(null);
    setConfirmDelete(null);
    onToast?.("Proyecto eliminado");
  };

  return (
    <Modal open={open} onClose={onClose} title="🗂️ Mis Proyectos" size="lg">
      <div className="projects-modal">
        {/* Left: project list */}
        <div className="projects-modal__sidebar">
          {loading && <p className="projects-modal__loading">Cargando…</p>}
          {!loading && projects.length === 0 && !creating && (
            <p className="projects-modal__empty">Sin proyectos todavía.</p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className={`projects-modal__proj${selected?.id === p.id ? " projects-modal__proj--active" : ""}`}
            >
              <button className="projects-modal__proj-btn" onClick={() => openProject(p)}>
                <span className="projects-modal__proj-emoji">{p.emoji}</span>
                <span className="projects-modal__proj-name">{p.name}</span>
                <span className="projects-modal__proj-count">{p.item_count}</span>
              </button>
              {confirmDelete === p.id ? (
                <span className="projects-modal__confirm-row">
                  <button className="projects-modal__danger-btn" onClick={() => handleDelete(p.id)}>✓</button>
                  <button className="projects-modal__cancel-btn"  onClick={() => setConfirmDelete(null)}>✕</button>
                </span>
              ) : (
                <button className="projects-modal__del-btn" onClick={() => setConfirmDelete(p.id)} title="Eliminar proyecto">🗑</button>
              )}
            </div>
          ))}

          {creating ? (
            <div className="proj-panel__create">
              <div className="proj-panel__emoji-row">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e}
                    className={`proj-panel__emoji-opt${newEmoji === e ? " proj-panel__emoji-opt--active" : ""}`}
                    onClick={() => setNewEmoji(e)}>{e}</button>
                ))}
              </div>
              <input
                className="proj-panel__input"
                placeholder="Nombre del proyecto…"
                value={newName}
                onChange={(ev) => setNewName(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === "Enter") handleCreate(); if (ev.key === "Escape") setCreating(false); }}
                autoFocus
                maxLength={100}
              />
              <div className="proj-panel__create-actions">
                <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newName.trim()}>Crear</Button>
                <Button variant="ghost"   size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" size="sm" fullWidth onClick={() => setCreating(true)} icon="＋">
              Nuevo proyecto
            </Button>
          )}
        </div>

        {/* Right: project contents */}
        <div className="projects-modal__content">
          {!selected && (
            <div className="projects-modal__placeholder">
              <span className="projects-modal__placeholder-icon">📁</span>
              <p>Selecciona un proyecto para ver sus elementos</p>
            </div>
          )}
          {selected && (
            <>
              <h4 className="projects-modal__content-title">{selected.emoji} {selected.name}</h4>
              {itemsLoading && <p className="projects-modal__loading">Cargando…</p>}
              {!itemsLoading && items.length === 0 && (
                <p className="projects-modal__empty">Este proyecto está vacío. Usa el botón <strong>+</strong> en cualquier generación para añadir elementos.</p>
              )}
              <div className="projects-modal__items">
                {items.map((g) => (
                  <div key={g.id} className="projects-modal__item">
                    <span className="projects-modal__item-type">{g.type}</span>
                    <span className="projects-modal__item-name">{getGenerationTitle(g.result, g.type, g.id)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
