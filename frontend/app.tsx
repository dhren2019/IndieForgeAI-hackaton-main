/**
 * IndieForge AI — React Frontend
 * Bundled by Bun: bun build frontend/app.tsx --outfile frontend/app.js
 */
import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type GenerationType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy";

interface Generation {
  id: number;
  type: GenerationType;
  prompt_meta: Record<string, string>;
  result: Record<string, unknown>;
  source: "model" | "fallback";
  created_at: string;
}

interface Post {
  id: number;
  session_id: string;
  generation_id: number | null;
  title: string;
  description: string;
  type: GenerationType;
  result: Record<string, unknown>;
  image_url: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  tags: string[];
  liked_by_me: boolean;
}

interface PostComment {
  id: number;
  post_id: number;
  session_id: string;
  author: string;
  content: string;
  created_at: string;
}

interface Toast { msg: string; kind: "ok" | "error"; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TYPE_META = {
  npc:    { icon: "🧙", label: "NPC",      desc: "Personajes y personalidades", color: "#f59e0b" },
  quest:  { icon: "⚔️", label: "Misión",   desc: "Misiones y objetivos",       color: "#3b82f6" },
  item:   { icon: "💎", label: "Objeto",   desc: "Armaduras, reliquias y objetos", color: "#10b981" },
  lore:   { icon: "📜", label: "Trasfondo", desc: "Historia del mundo y secretos", color: "#a78bfa" },
  weapon: { icon: "🗡️", label: "Arma",    desc: "Espadas, bastones y armas",  color: "#ef4444" },
  enemy:  { icon: "💀", label: "Enemigo",  desc: "Bestias, demonios y jefes",  color: "#6b7280" },
} as const;

const GENEROS         = ["Fantasía", "Ciencia Ficción", "Cyberpunk", "Western", "Terror", "Steampunk", "Post-Apocalíptico"];
const ROLES_NPC       = ["Mercader", "Villano", "Mentor", "Guardia", "Espía", "Sanador", "Asesino", "Errante"];
const RAREZAS         = ["Común", "Infrecuente", "Raro", "Épico", "Legendario"];
const DIFICULTADES    = ["Fácil", "Medio", "Difícil"];
const DIFS_ENEMIGO    = ["Fácil", "Medio", "Difícil", "Jefe"];
const TONOS           = ["Épico", "Oscuro", "Misterioso", "Cómico", "Trágico", "Esperanzador"];
const CLASES_ARMA     = ["Espada", "Hacha", "Arco", "Bastón", "Pistola", "Martillo", "Daga", "Lanza"];
const ELEMENTOS       = ["Ninguno", "Fuego", "Hielo", "Rayo", "Oscuro", "Sagrado", "Veneno", "Viento"];
const ESTILOS_ARMA    = ["Una mano", "Dos manos", "A distancia", "Mágico"];
const TIPOS_ENEMIGO   = ["Bestia", "No-muerto", "Demonio", "Mecánico", "Elemental", "Humanoide", "Dragón"];

// Legacy aliases (still used in GenerateForm)
const GENRES          = GENEROS;
const NPC_ROLES       = ROLES_NPC;
const RARITIES        = RAREZAS;
const DIFFICULTIES    = DIFICULTADES;
const ENEMY_DIFFICULTIES = DIFS_ENEMIGO;
const TONES           = TONOS;
const WEAPON_CLASSES  = CLASES_ARMA;
const ELEMENTS        = ELEMENTOS;
const WEAPON_STYLES   = ESTILOS_ARMA;
const ENEMY_TYPES     = TIPOS_ENEMIGO;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function apiGenerate(type: GenerationType, meta: Record<string, string>) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...meta }),
  });
  return res.json() as Promise<{ success: boolean; data: Generation; error?: string }>;
}

async function apiHistory(): Promise<Generation[]> {
  const res = await fetch("/api/history?limit=30");
  const json = await res.json() as { success: boolean; data: Generation[] };
  return json.data ?? [];
}

async function apiFavorites(): Promise<Generation[]> {
  const res = await fetch("/api/favorites");
  const json = await res.json() as { success: boolean; data: Generation[] };
  return json.data ?? [];
}

async function apiToggleFav(generation_id: number, add: boolean) {
  await fetch("/api/favorite", {
    method: add ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ generation_id }),
  });
}

// Social
async function apiSocialFeed(limit = 20): Promise<Post[]> {
  const res = await fetch(`/api/social/feed?limit=${limit}`);
  const json = await res.json() as { success: boolean; data: Post[] };
  return json.data ?? [];
}

async function apiExplore(tag: string | null = null, sort = "reciente", limit = 20): Promise<Post[]> {
  const params = new URLSearchParams({ limit: String(limit), sort });
  if (tag) params.set("tag", tag);
  const res = await fetch(`/api/social/explore?${params}`);
  const json = await res.json() as { success: boolean; data: Post[] };
  return json.data ?? [];
}

async function apiTrending(limit = 20): Promise<Post[]> {
  const res = await fetch(`/api/social/trending?limit=${limit}`);
  const json = await res.json() as { success: boolean; data: Post[] };
  return json.data ?? [];
}

async function apiMyPosts(): Promise<Post[]> {
  const res = await fetch("/api/social/misposts");
  const json = await res.json() as { success: boolean; data: Post[] };
  return json.data ?? [];
}

async function apiCreatePost(data: {
  title: string;
  description: string;
  type: GenerationType;
  result: Record<string, unknown>;
  tags: string[];
  generation_id?: number;
  image_url?: string | null;
}): Promise<{ success: boolean; data?: Post; error?: string }> {
  const res = await fetch("/api/social/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function apiToggleLike(postId: number): Promise<boolean> {
  const res = await fetch(`/api/social/posts/${postId}/like`, { method: "POST" });
  const json = await res.json() as { success: boolean; data?: { liked: boolean } };
  return json.data?.liked ?? false;
}

async function apiGetComments(postId: number): Promise<PostComment[]> {
  const res = await fetch(`/api/social/posts/${postId}/comentarios`);
  const json = await res.json() as { success: boolean; data: PostComment[] };
  return json.data ?? [];
}

async function apiAddComment(postId: number, content: string): Promise<PostComment | null> {
  const res = await fetch(`/api/social/posts/${postId}/comentarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const json = await res.json() as { success: boolean; data?: PostComment };
  return json.data ?? null;
}

async function apiFollowTag(tag: string): Promise<void> {
  await fetch("/api/social/tags/seguir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
}

async function apiUnfollowTag(tag: string): Promise<void> {
  await fetch("/api/social/tags/dejar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
}

async function apiFollowedTags(): Promise<string[]> {
  const res = await fetch("/api/social/tags/siguiendo");
  const json = await res.json() as { success: boolean; data: string[] };
  return json.data ?? [];
}

async function apiPopularTags(): Promise<Array<{ tag: string; count: number }>> {
  const res = await fetch("/api/social/tags/populares");
  const json = await res.json() as { success: boolean; data: Array<{ tag: string; count: number }> };
  return json.data ?? [];
}

async function apiDeletePost(postId: number): Promise<boolean> {
  const res = await fetch(`/api/social/posts/${postId}`, { method: "DELETE" });
  const json = await res.json() as { success: boolean };
  return json.success;
}

async function apiRecordInteraction(postId: number, action: "view" | "expand" | "like" | "comment"): Promise<void> {
  await fetch("/api/social/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postId, action }),
  });
}

async function apiGenerateImage(
  type: GenerationType,
  result: Record<string, unknown>
): Promise<{ url: string | null; error?: string }> {
  const res = await fetch("/api/imagen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, result }),
  });
  const json = await res.json() as { success: boolean; data?: { url: string }; error?: string };
  if (json.success && json.data) return { url: json.data.url };
  return { url: null, error: json.error ?? "Error de generación" };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function getTitle(gen: Generation): string {
  const r = gen.result;
  return (r.name ?? r.title ?? `${gen.type} #${gen.id}`) as string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "ahora mismo";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function authorName(session_id: string): string {
  const raw = session_id.replace(/^(anon-|sess-)/, "");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) & 0x7fff;
  return `Aventurero #${hash % 9000 + 1000}`;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre", role: "Rol", race: "Raza", personality: "Personalidad",
  secret: "Secreto", dialogue: "Diálogo", title: "Título", type: "Tipo",
  objective: "Objetivo", reward: "Recompensa", location: "Ubicación", twist: "Giro",
  rarity: "Rareza", description: "Descripción", effect: "Efecto", value: "Valor",
  era: "Era", summary: "Resumen", factions: "Facciones", element: "Elemento",
  style: "Estilo", damage: "Daño", special_ability: "Habilidad especial", lore: "Trasfondo",
  difficulty: "Dificultad", hp: "HP", attack_style: "Estilo de ataque",
  weakness: "Debilidad", drops: "Botín", class: "Clase",
};

// ---------------------------------------------------------------------------
// JSON pretty-printer
// ---------------------------------------------------------------------------
function JsonDisplay({ data }: { data: Record<string, unknown> }) {
  function highlight(str: string) {
    return str.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
          return `<span class="json-string">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
        if (/null/.test(match))       return `<span class="json-null">${match}</span>`;
        return `<span class="json-number">${match}</span>`;
      }
    );
  }

  const pretty = JSON.stringify(data, null, 2);
  return (
    <div
      className="json-display"
      dangerouslySetInnerHTML={{ __html: highlight(pretty) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Fields viewer (human-friendly)
// ---------------------------------------------------------------------------
function FieldsView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="fields-grid">
      {Object.entries(data).map(([k, v]) => (
        <div className="field-item" key={k}>
          <div className="field-key">{FIELD_LABELS[k] ?? k.replace(/_/g, " ")}</div>
          <div className="field-value">
            {Array.isArray(v)
              ? v.map((item, i) => <span key={i} className="array-item">{String(item)}</span>)
              : String(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IllustratorPanel — HuggingFace image generation (single multi-view design sheet)
// ---------------------------------------------------------------------------
function IllustratorPanel({
  type,
  result,
  onImageReady,
}: {
  type: GenerationType;
  result: Record<string, unknown>;
  onImageReady?: (url: string) => void;
}) {
  const [loading, setLoading]   = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const res = await apiGenerateImage(type, result);
    setLoading(false);
    if (res.url) {
      setImageUrl(res.url);
      onImageReady?.(res.url);
    } else {
      setError(res.error ?? "Error desconocido");
    }
  };

  return (
    <div className="illustrator-panel">
      <div className="illustrator-header">🎨 Hoja de diseño del personaje</div>
      <button
        className="btn-illustrate"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading
          ? <><span className="spinner" /> Generando diseño…</>
          : imageUrl ? "🔄 Regenerar diseño" : "🎨 Generar hoja de diseño"}
      </button>
      {error && <div className="illustrator-error">{error}</div>}
      {imageUrl && (
        <div className="illustrator-image-wrap">
          <img src={imageUrl} alt="Hoja de diseño del personaje" className="illustrator-image" />
          <a
            href={imageUrl}
            download="hoja-de-diseno.png"
            className="illustrator-download"
          >⬇ Descargar</a>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result Card
// ---------------------------------------------------------------------------
function ResultCard({
  gen,
  isFav,
  onFavToggle,
  onShare,
  showActions = true,
}: {
  gen: Generation;
  isFav: boolean;
  onFavToggle: (id: number, add: boolean) => void;
  onShare?: () => void;
  showActions?: boolean;
}) {
  const [view, setView] = useState<"fields" | "json">("fields");
  const [showIllustrator, setShowIllustrator] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(gen.result, null, 2));
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(gen.result, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${gen.type}-${gen.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta = TYPE_META[gen.type];

  return (
    <div className="result-card">
      <div className="result-header">
        <span className={`result-badge badge-${gen.type}`}>{meta.icon} {meta.label}</span>
        <span className="result-title">{getTitle(gen)}</span>
        {gen.source === "fallback" && (
          <span className="result-badge badge-fallback">respaldo</span>
        )}
        {showActions && (
          <div className="result-actions">
            <button
              className={`icon-btn ${isFav ? "fav" : ""}`}
              onClick={() => onFavToggle(gen.id, !isFav)}
              title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
            >
              {isFav ? "★ Guardado" : "☆ Guardar"}
            </button>
            <button className="icon-btn" onClick={() => setView(view === "fields" ? "json" : "fields")}>
              {view === "fields" ? "</> JSON" : "⊞ Campos"}
            </button>
            <button className="icon-btn" onClick={handleCopy} title="Copiar JSON">📋</button>
            <button className="icon-btn" onClick={handleExport} title="Exportar JSON">⬇</button>
            {onShare && (
              <button className="icon-btn share-icon-btn" onClick={onShare} title="Compartir en la comunidad">🌐 Compartir</button>
            )}
            <button
              className={`icon-btn ${showIllustrator ? "active" : ""}`}
              onClick={() => setShowIllustrator((v) => !v)}
              title="Generar ilustración con IA"
            >🎨 Ilustrar</button>
          </div>
        )}
      </div>

      {view === "fields"
        ? <FieldsView data={gen.result} />
        : <JsonDisplay data={gen.result} />}

      {showIllustrator && (
        <IllustratorPanel type={gen.type} result={gen.result} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generate Form
// ---------------------------------------------------------------------------
function GenerateForm({
  onResult,
}: {
  onResult: (gen: Generation) => void;
}) {
  const [type, setType]       = useState<GenerationType>("npc");
  const [loading, setLoading] = useState(false);
  const [fields, setFields]   = useState<Record<string, string>>({});

  const setField = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await apiGenerate(type, fields);
      if (res.success) onResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Type selector */}
      <div className="type-grid">
        {(Object.keys(TYPE_META) as GenerationType[]).map((t) => (
          <div
            key={t}
            className={`type-card ${type === t ? "active" : ""}`}
            onClick={() => { setType(t); setFields({}); }}
          >
            <div className="type-icon">{TYPE_META[t].icon}</div>
            <div className="type-label">{TYPE_META[t].label}</div>
            <div className="type-desc">{TYPE_META[t].desc}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="form-section">
        <div className="form-grid">
          {/* Common: genre */}
          <div className="form-field">
            <label>Género</label>
            <select value={fields.genre ?? ""} onChange={(e) => setField("genre", e.target.value)}>
              <option value="">— elige un género —</option>
              {GENRES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>

          {/* NPC */}
          {type === "npc" && <>
            <div className="form-field">
              <label>Nombre (opcional)</label>
              <input placeholder="ej. Aldric" value={fields.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Rol</label>
              <select value={fields.role ?? ""} onChange={(e) => setField("role", e.target.value)}>
                <option value="">— elige un rol —</option>
                {NPC_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </>}

          {/* Quest */}
          {type === "quest" && <>
            <div className="form-field">
              <label>Título (opcional)</label>
              <input placeholder='ej. "La Reliquia Robada"' value={fields.title ?? ""} onChange={(e) => setField("title", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Dificultad</label>
              <select value={fields.difficulty ?? ""} onChange={(e) => setField("difficulty", e.target.value)}>
                <option value="">— elige dificultad —</option>
                {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </>}

          {/* Item */}
          {type === "item" && <>
            <div className="form-field">
              <label>Nombre (opcional)</label>
              <input placeholder='ej. "Espada Rompe-Velos"' value={fields.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Rareza</label>
              <select value={fields.rarity ?? ""} onChange={(e) => setField("rarity", e.target.value)}>
                <option value="">— elige rareza —</option>
                {RARITIES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </>}

          {/* Lore */}
          {type === "lore" && <>
            <div className="form-field">
              <label>Tema</label>
              <input placeholder='ej. "La Gran Fractura"' value={fields.topic ?? ""} onChange={(e) => setField("topic", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Tono</label>
              <select value={fields.tone ?? ""} onChange={(e) => setField("tone", e.target.value)}>
                <option value="">— elige un tono —</option>
                {TONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </>}

          {/* Weapon */}
          {type === "weapon" && <>
            <div className="form-field">
              <label>Nombre (opcional)</label>
              <input placeholder='ej. "Hoja Ahumada"' value={fields.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Tipo de arma</label>
              <select value={fields.weaponClass ?? ""} onChange={(e) => setField("weaponClass", e.target.value)}>
                <option value="">— elige un tipo —</option>
                {WEAPON_CLASSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Elemento</label>
              <select value={fields.element ?? ""} onChange={(e) => setField("element", e.target.value)}>
                <option value="">— elige un elemento —</option>
                {ELEMENTS.map((el) => <option key={el}>{el}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Estilo de combate</label>
              <select value={fields.style ?? ""} onChange={(e) => setField("style", e.target.value)}>
                <option value="">— elige un estilo —</option>
                {WEAPON_STYLES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </>}

          {/* Enemy */}
          {type === "enemy" && <>
            <div className="form-field">
              <label>Nombre (opcional)</label>
              <input placeholder='ej. "Señor Brasa Moloch"' value={fields.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Tipo de enemigo</label>
              <select value={fields.enemyType ?? ""} onChange={(e) => setField("enemyType", e.target.value)}>
                <option value="">— elige un tipo —</option>
                {ENEMY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Dificultad</label>
              <select value={fields.difficulty ?? ""} onChange={(e) => setField("difficulty", e.target.value)}>
                <option value="">— elige dificultad —</option>
                {ENEMY_DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </>}
        </div>

        <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
          {loading ? <><span className="spinner" /> Generando…</> : `✦ Generar ${TYPE_META[type].label}`}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// History / Favorites Panel
// ---------------------------------------------------------------------------
function GalleryPanel({
  items,
  favIds,
  onFavToggle,
  onSelect,
  emptyMsg,
}: {
  items: Generation[];
  favIds: Set<number>;
  onFavToggle: (id: number, add: boolean) => void;
  onSelect: (gen: Generation) => void;
  emptyMsg: string;
}) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">🗃️</div>
        <p>{emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className="history-grid">
      {items.map((gen) => {
        const meta = TYPE_META[gen.type];
        return (
          <div className="history-card" key={gen.id} onClick={() => onSelect(gen)}>
            <div className="history-card-header">
              <span className={`result-badge badge-${gen.type}`}>{meta.icon} {meta.label}</span>
              <span className="history-card-title">{getTitle(gen)}</span>
              <span className="history-card-time">{timeAgo(gen.created_at)}</span>
            </div>
            <div className="history-card-preview">
              {(gen.result.personality ?? gen.result.objective ?? gen.result.description ?? gen.result.summary ?? gen.result.special_ability ?? gen.result.attack_style ?? "") as string}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentsPanel
// ---------------------------------------------------------------------------
function CommentsPanel({
  postId,
  showToast,
}: {
  postId: number;
  showToast: (msg: string, kind?: "ok" | "error") => void;
}) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    apiGetComments(postId).then((c) => { setComments(c); setLoading(false); });
  }, [postId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const comment = await apiAddComment(postId, trimmed);
    if (comment) {
      setComments((c) => [...c, comment]);
      setText("");
      showToast("Comentario publicado");
    } else {
      showToast("Error al publicar el comentario", "error");
    }
    setSending(false);
  };

  return (
    <div className="comments-section">
      {loading ? (
        <div className="comments-loading">Cargando comentarios…</div>
      ) : (
        <>
          {comments.length === 0 && (
            <div className="comments-empty">Sin comentarios. ¡Sé el primero!</div>
          )}
          {comments.map((c) => (
            <div className="comment-item" key={c.id}>
              <div className="comment-meta">
                <span className="comment-author">{c.author}</span>
                <span className="comment-time">{timeAgo(c.created_at)}</span>
              </div>
              <div className="comment-content">{c.content}</div>
            </div>
          ))}
        </>
      )}
      <div className="comment-input-row">
        <input
          className="comment-input"
          placeholder="Escribe un comentario… (Enter para enviar)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          maxLength={300}
        />
        <button
          className="comment-send-btn"
          onClick={handleSend}
          disabled={sending || !text.trim()}
        >
          {sending ? "…" : "↵"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------
function PostCard({
  post,
  followedTags,
  onTagFilter,
  onTagToggle,
  isOwn,
  onDelete,
  showToast,
}: {
  post: Post;
  followedTags: Set<string>;
  onTagFilter: (tag: string) => void;
  onTagToggle: (tag: string, follow: boolean) => void;
  isOwn: boolean;
  onDelete: (id: number) => void;
  showToast: (msg: string, kind?: "ok" | "error") => void;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showIllustrator, setShowIllustrator] = useState(false);
  const [liked, setLiked]             = useState(post.liked_by_me);
  const [likeCount, setLikeCount]     = useState(post.like_count);
  const [cmtCount, setCmtCount]       = useState(post.comment_count);

  // Registrar vista al montar (señal débil para el algoritmo ML)
  useEffect(() => {
    apiRecordInteraction(post.id, "view");
  }, [post.id]);

  const meta    = TYPE_META[post.type];
  const preview = (
    post.result.personality ??
    post.result.objective   ??
    post.result.description ??
    post.result.summary     ??
    post.result.special_ability ??
    post.result.attack_style    ??
    ""
  ) as string;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = await apiToggleLike(post.id);
    setLiked(newLiked);
    setLikeCount((c) => newLiked ? c + 1 : Math.max(0, c - 1));
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta publicación?")) return;
    const ok = await apiDeletePost(post.id);
    if (ok) { onDelete(post.id); showToast("Publicación eliminada"); }
    else showToast("Error al eliminar", "error");
  };

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments((v) => !v);
    if (!showComments) setCmtCount((c) => c); // keep accurate after open
  };

  return (
    <div className="post-card">
      <div className="post-header" onClick={() => {
        const next = !expanded;
        setExpanded(next);
        // Registrar 'expand' como señal fuerte de interés (primera vez)
        if (next) apiRecordInteraction(post.id, "expand");
      }}>
        <span className={`result-badge badge-${post.type}`}>{meta.icon} {meta.label}</span>
        <span className="post-title">{post.title}</span>
        <span className="post-author">{authorName(post.session_id)}</span>
        <span className="post-time">{timeAgo(post.created_at)}</span>
        <span className="post-expand">{expanded ? "▲" : "▼"}</span>
      </div>

      {post.description && (
        <div className="post-description">{post.description}</div>
      )}

      {post.image_url && (
        <div className="post-image-wrap">
          <img src={post.image_url} alt="Hoja de diseño" className="post-image" />
        </div>
      )}

      {!expanded && preview && (
        <div className="post-preview">{preview}</div>
      )}

      {expanded && (
        <div className="post-body">
          <FieldsView data={post.result} />
          <IllustratorPanel type={post.type} result={post.result} />
        </div>
      )}

      {post.tags.length > 0 && (
        <div className="post-tags">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className={`tag-pill ${followedTags.has(tag) ? "followed" : ""}`}
              onClick={(e) => { e.stopPropagation(); onTagToggle(tag, !followedTags.has(tag)); }}
              title={followedTags.has(tag) ? "Dejar de seguir" : "Seguir etiqueta"}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="post-footer">
        <button
          className={`like-btn ${liked ? "liked" : ""}`}
          onClick={handleLike}
          title={liked ? "Quitar me gusta" : "Me gusta"}
        >
          {liked ? "❤️" : "🤍"} {likeCount}
        </button>
        <button className="comment-toggle-btn" onClick={toggleComments}>
          💬 {cmtCount}
        </button>
        {post.tags.length > 0 && (
          <button
            className="explore-tag-btn"
            onClick={(e) => { e.stopPropagation(); onTagFilter(post.tags[0]!); }}
            title="Explorar por primera etiqueta"
          >
            🔍 #{post.tags[0]}
          </button>
        )}
        {isOwn && (
          <button className="delete-btn" onClick={handleDelete} title="Eliminar publicación">
            🗑
          </button>
        )}
      </div>

      {showComments && (
        <CommentsPanel postId={post.id} showToast={showToast} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PublicarModal
// ---------------------------------------------------------------------------
function PublicarModal({
  gen,
  onClose,
  onPublished,
  showToast,
}: {
  gen: Generation;
  onClose: () => void;
  onPublished: () => void;
  showToast: (msg: string, kind?: "ok" | "error") => void;
}) {
  const [title, setTitle]       = useState(getTitle(gen));
  const [desc, setDesc]         = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]         = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
    if (t && tags.length < 8 && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) setTags((prev) => prev.slice(0, -1));
  };

  const handlePublish = async () => {
    if (!title.trim()) { showToast("El título es obligatorio", "error"); return; }
    setLoading(true);
    const res = await apiCreatePost({
      title: title.trim(),
      description: desc.trim(),
      type: gen.type,
      result: gen.result,
      tags,
      generation_id: gen.id,
      image_url: imageUrl,
    });
    setLoading(false);
    if (res.success) {
      showToast("🌐 ¡Publicado en la comunidad!");
      onPublished();
      onClose();
    } else {
      showToast(res.error ?? "Error al publicar", "error");
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>🌐 Publicar en la comunidad</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label>Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          </div>
          <div className="form-field">
            <label>Descripción (opcional)</label>
            <textarea
              rows={2}
              placeholder="Cuéntale algo a la comunidad sobre esta creación…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="form-field">
            <label>Etiquetas — máx. 8 (pulsa Enter o coma para añadir)</label>
            <div className="tag-input-row">
              {tags.map((t) => (
                <span key={t} className="tag-pill" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>
                  #{t} <span className="tag-remove">✕</span>
                </span>
              ))}
              {tags.length < 8 && (
                <input
                  className="tag-inline-input"
                  placeholder="etiqueta…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                />
              )}
            </div>
          </div>
          <div className="publi-preview">
            <span className={`result-badge badge-${gen.type}`}>{TYPE_META[gen.type].icon} {TYPE_META[gen.type].label}</span>
            <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: "0.85em" }}>
              Se publicará el contenido generado
            </span>
          </div>
          <div className="form-field">
            <label>Ilustración (opcional — se compartirá con la publicación)</label>
            <IllustratorPanel
              type={gen.type}
              result={gen.result}
              onImageReady={(url) => { setImageUrl(url); showToast("🎨 Ilustración lista para compartir"); }}
            />
            {imageUrl && (
              <div className="modal-image-attached">
                <span className="image-attached-badge">✅ Ilustración adjunta</span>
                <button className="icon-btn" onClick={() => setImageUrl(null)} style={{ marginLeft: 8 }}>Quitar</button>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
          <button className="btn-generate" onClick={handlePublish} disabled={loading}>
            {loading ? <><span className="spinner" /> Publicando…</> : "🌐 Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SocialPanel
// ---------------------------------------------------------------------------
type SocialSubTab = "feed" | "trending" | "explorar" | "misposts";

function SocialPanel({
  latest,
  showToast,
}: {
  latest: Generation | null;
  showToast: (msg: string, kind?: "ok" | "error") => void;
}) {
  const [subTab, setSubTab]           = useState<SocialSubTab>("feed");
  const [posts, setPosts]             = useState<Post[]>([]);
  const [loading, setLoading]         = useState(false);
  const [followedTags, setFollowedTags] = useState<Set<string>>(new Set());
  const [popularTags, setPopularTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [filterTag, setFilterTag]     = useState<string | null>(null);
  const [sortMode, setSortMode]       = useState<"reciente" | "popular">("reciente");
  const [shareTarget, setShareTarget] = useState<Generation | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      if (subTab === "feed")         setPosts(await apiSocialFeed());
      else if (subTab === "trending") setPosts(await apiTrending());
      else if (subTab === "explorar") setPosts(await apiExplore(filterTag, sortMode));
      else                            setPosts(await apiMyPosts());
    } finally {
      setLoading(false);
    }
  }, [subTab, filterTag, sortMode]);

  const loadMeta = useCallback(async () => {
    const [followed, popular] = await Promise.all([apiFollowedTags(), apiPopularTags()]);
    setFollowedTags(new Set(followed));
    setPopularTags(popular);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadMeta(); }, []);

  const handleTagToggle = async (tag: string, follow: boolean) => {
    if (follow) {
      await apiFollowTag(tag);
      setFollowedTags((s) => new Set(s).add(tag));
      showToast(`Siguiendo #${tag}`);
    } else {
      await apiUnfollowTag(tag);
      setFollowedTags((s) => { const n = new Set(s); n.delete(tag); return n; });
      showToast(`Dejaste de seguir #${tag}`);
    }
  };

  const handleTagFilter = (tag: string) => {
    setFilterTag(tag);
    setSubTab("explorar");
  };

  const handleDeletePost = (id: number) => setPosts((prev) => prev.filter((p) => p.id !== id));

  return (
    <div className="social-layout">
      {/* Main column */}
      <div className="social-main">
        <div className="social-subtabs">
          <button className={`subtab-btn ${subTab === "feed" ? "active" : ""}`}
            onClick={() => { setSubTab("feed"); setFilterTag(null); }}>
            ✦ Para ti
          </button>
          <button className={`subtab-btn ${subTab === "trending" ? "active" : ""}`}
            onClick={() => { setSubTab("trending"); setFilterTag(null); }}>
            🔥 Trending
          </button>
          <button className={`subtab-btn ${subTab === "explorar" ? "active" : ""}`}
            onClick={() => setSubTab("explorar")}>
            🔍 Explorar
          </button>
          <button className={`subtab-btn ${subTab === "misposts" ? "active" : ""}`}
            onClick={() => setSubTab("misposts")}>
            📌 Mis publicaciones
          </button>
          {latest && (
            <button className="subtab-btn share-btn" onClick={() => setShareTarget(latest)}
              title="Compartir tu última generación">
              🌐 Compartir
            </button>
          )}
        </div>

        {subTab === "explorar" && (
          <div className="explore-controls">
            {filterTag && (
              <div className="filter-banner">
                Filtrando por: <strong>#{filterTag}</strong>
                <button className="clear-filter-btn" onClick={() => setFilterTag(null)}>✕ Quitar</button>
              </div>
            )}
            <div className="sort-controls">
              <span className="sort-label">Ordenar:</span>
              <button
                className={`sort-btn ${sortMode === "reciente" ? "active" : ""}`}
                onClick={() => setSortMode("reciente")}
              >🕐 Más recientes</button>
              <button
                className={`sort-btn ${sortMode === "popular" ? "active" : ""}`}
                onClick={() => setSortMode("popular")}
              >⭐ Más populares</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="social-loading"><span className="spinner" /> Cargando publicaciones…</div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🌐</div>
            <p>
              {subTab === "feed"
                ? "Tu feed está vacío. ¡Sigue etiquetas y publica creaciones!"
                : subTab === "trending"
                  ? "No hay tendencias todavía. ¡Publica y consigue likes!"
                  : subTab === "explorar"
                  ? filterTag
                    ? `Sin publicaciones con #${filterTag}.`
                    : "Sin publicaciones todavía. ¡Sé el primero!"
                  : "Aún no has publicado nada. Usa el botón 🌐 Compartir."}
            </p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                followedTags={followedTags}
                onTagFilter={handleTagFilter}
                onTagToggle={handleTagToggle}
                isOwn={subTab === "misposts"}
                onDelete={handleDeletePost}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="social-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-title">🔖 Etiquetas que sigues</div>
          {followedTags.size === 0 ? (
            <div className="sidebar-empty">
              Haz clic en un #tag de cualquier publicación para seguirlo.
            </div>
          ) : (
            <div className="sidebar-tags">
              {[...followedTags].map((tag) => (
                <span
                  key={tag}
                  className="tag-pill followed"
                  onClick={() => handleTagFilter(tag)}
                  title="Explorar esta etiqueta"
                >
                  #{tag}
                  <button
                    className="tag-unfollow"
                    onClick={(e) => { e.stopPropagation(); handleTagToggle(tag, false); }}
                    title="Dejar de seguir"
                  >✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">🔥 Etiquetas populares</div>
          {popularTags.length === 0 ? (
            <div className="sidebar-empty">Sin etiquetas populares aún.</div>
          ) : (
            <div className="sidebar-tags">
              {popularTags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className={`tag-pill ${followedTags.has(tag) ? "followed" : ""}`}
                  onClick={() => handleTagFilter(tag)}
                  title={`${count} publicación${count !== 1 ? "es" : ""} con #${tag}`}
                >
                  #{tag} <span className="tag-count">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </aside>

      {shareTarget && (
        <PublicarModal
          gen={shareTarget}
          onClose={() => setShareTarget(null)}
          onPublished={() => { if (subTab === "misposts") loadPosts(); setShareTarget(null); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App() {
  const [tab, setTab]           = useState<"generate" | "history" | "favorites" | "social">("generate");  const [shareTarget, setShareTarget] = useState<Generation | null>(null);
  const [latest, setLatest]     = useState<Generation | null>(null);
  const [history, setHistory]   = useState<Generation[]>([]);
  const [favorites, setFavorites] = useState<Generation[]>([]);
  const [favIds, setFavIds]     = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Generation | null>(null);
  const [toast, setToast]       = useState<Toast | null>(null);

  const showToast = (msg: string, kind: "ok" | "error" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2500);
  };

  const loadHistory  = useCallback(async () => { setHistory(await apiHistory()); }, []);
  const loadFavorites = useCallback(async () => {
    const favs = await apiFavorites();
    setFavorites(favs);
    setFavIds(new Set(favs.map((f) => f.id)));
  }, []);

  useEffect(() => { loadHistory(); loadFavorites(); }, []);

  const handleResult = (gen: Generation) => {
    setLatest(gen);
    setHistory((h) => [gen, ...h]);
    showToast(`¡${TYPE_META[gen.type].label} generado! ${gen.source === "fallback" ? "(usando respaldo)" : ""}`);
  };

  const handleFavToggle = async (id: number, add: boolean) => {
    await apiToggleFav(id, add);
    if (add) {
      setFavIds((s) => new Set(s).add(id));
      showToast("¡Añadido a favoritos ★");
    } else {
      setFavIds((s) => { const n = new Set(s); n.delete(id); return n; });
      showToast("Eliminado de favoritos");
    }
    loadFavorites();
  };

  return (
    <div className="app">
      <header>
        <div>
          <div className="logo">⚔ IndieForge AI</div>
          <div className="logo-sub">Generador de Contenido para Videojuegos</div>
        </div>
        <nav>
          <button className={`tab-btn ${tab === "generate"  ? "active" : ""}`} onClick={() => { setTab("generate");  setSelected(null); }}>✦ Generar</button>
          <button className={`tab-btn ${tab === "history"   ? "active" : ""}`} onClick={() => { setTab("history");   setSelected(null); loadHistory(); }}>📖 Historial</button>
          <button className={`tab-btn ${tab === "favorites" ? "active" : ""}`} onClick={() => { setTab("favorites"); setSelected(null); loadFavorites(); }}>★ Favoritos</button>
          <button className={`tab-btn ${tab === "social"    ? "active" : ""}`} onClick={() => { setTab("social");    setSelected(null); }}>🌐 Social</button>
        </nav>
      </header>

      <main>
        {/* Detail view when card is clicked */}
        {selected && (
          <>
            <button className="icon-btn" style={{ marginBottom: 16 }} onClick={() => setSelected(null)}>← Volver</button>
            <ResultCard gen={selected} isFav={favIds.has(selected.id)} onFavToggle={handleFavToggle} />
          </>
        )}

        {/* Generate tab */}
        {!selected && tab === "generate" && (
          <>
            <GenerateForm onResult={handleResult} />
            {latest && (
              <ResultCard gen={latest} isFav={favIds.has(latest.id)} onFavToggle={handleFavToggle} onShare={() => setShareTarget(latest)} />
            )}
          </>
        )}

        {/* History tab */}
        {!selected && tab === "history" && (
          <GalleryPanel
            items={history}
            favIds={favIds}
            onFavToggle={handleFavToggle}
            onSelect={setSelected}
            emptyMsg="Aún no hay generaciones. Crea un NPC, Misión, Objeto, Trasfondo, Arma o Enemigo."
          />
        )}

        {/* Favorites tab */}
        {!selected && tab === "favorites" && (
          <GalleryPanel
            items={favorites}
            favIds={favIds}
            onFavToggle={handleFavToggle}
            onSelect={setSelected}
            emptyMsg="Aún no hay favoritos. Guarda una generación haciendo clic en ☆ Guardar."
          />
        )}

        {/* Social tab */}
        {!selected && tab === "social" && (
          <SocialPanel latest={latest} showToast={showToast} />
        )}
      </main>

      {/* Share modal (triggered from generate tab's ResultCard) */}
      {shareTarget && (
        <PublicarModal
          gen={shareTarget}
          onClose={() => setShareTarget(null)}
          onPublished={() => { showToast("🌐 ¡Publicado!"); setShareTarget(null); }}
          showToast={showToast}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind === "error" ? "error" : ""}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
