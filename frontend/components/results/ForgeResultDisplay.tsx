import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { TYPE_META } from "../../types/generate";
import { getGenerationTitle, labelFor } from "../../lib/formatters";
import { ImagePreview }        from "./ImagePreview";
import { AddToProjectPanel }   from "../projects/ProjectModal";
import { PublishModal }        from "../social/PublishModal";
import { Modal }               from "../ui/Modal";
import { apiAddFavorite, apiRemoveFavorite, apiFavorites } from "../../lib/api";
import type { Generation, GenerationType } from "../../types/generate";

/* ── Field category buckets ─────────────────────────────────── */
const IDENTITY_FIELDS = new Set([
  "role", "race", "age", "class", "alignment", "difficulty", "rarity",
  "element", "style", "range", "damage", "speed", "armor", "hp", "type",
  "value", "era",
]);
const STORY_FIELDS = new Set([
  "backstory", "description", "history", "lore", "summary", "overview",
  "impact", "twist", "objective", "synopsis", "moral_dilemma",
  "failure_consequences", "important_events", "myths_and_prophecies",
  "geography", "magic_or_power",
]);
const ABILITY_FIELDS = new Set([
  "appearance", "personality", "motivation", "combat_style", "special_ability",
  "passive", "abilities", "attack_style", "weakness", "resistance", "drops",
  "secret", "effect", "reward", "crafting_material", "requirements",
  "encounter_tips", "npcs_involved", "relationships", "curse", "steps",
  "enemies", "key_figures", "factions", "factions_desc", "region",
  "location", "region_name",
]);
const DIALOGUE_FIELDS = new Set(["dialogue"]);
const SKIP_FIELDS = new Set(["name", "title", "_fusion", "_source_a", "_source_b"]);

// Array fields that should render as numbered cards instead of flat pills
const LIST_FIELDS = new Set([
  "abilities", "steps", "drops", "enemies", "key_figures",
  "factions", "npcs_involved", "relationships", "requirements",
  "encounter_tips", "important_events", "factions_desc",
]);

const TYPE_COLORS: Record<string, string> = {
  npc: "#f59e0b", quest: "#3b82f6", item: "#10b981",
  lore: "#8b5cf6", weapon: "#ef4444", enemy: "#6b7280",
};

type TabId = "identity" | "story" | "abilities";
const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "identity",  icon: "⚡", label: "Identidad" },
  { id: "story",     icon: "📖", label: "Historia" },
  { id: "abilities", icon: "⚔️", label: "Habilidades" },
];

function getStr(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v ?? "");
}

/* Renders a single field — handles arrays as numbered cards or tag pills */
function ExpandableField({
  fieldKey,
  label,
  value,
  index,
  typeColor,
}: {
  fieldKey: string;
  label: string;
  value: unknown;
  index: number;
  typeColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isArr = Array.isArray(value);
  const isList = isArr && LIST_FIELDS.has(fieldKey);

  // For plain text determine width + truncation
  const str = isArr ? "" : String(value ?? "");
  const isLong = str.length > 220;
  const isWide = isArr || str.length > 120;
  const display = !isLong || expanded ? str : str.slice(0, 220) + "…";

  return (
    <div
      className={`fr-field${isWide ? " fr-field--wide" : ""}`}
      style={{ animationDelay: `${index * 55}ms`, "--fr-color": typeColor } as React.CSSProperties}
    >
      <div className="fr-field__label">{label}</div>

      {isList ? (
        /* Numbered cards — one per list item */
        <div className="fr-field__list">
          {(value as unknown[]).map((item, i) => (
            <div key={i} className="fr-field__list-item">
              <span className="fr-field__list-num">{i + 1}</span>
              <span className="fr-field__list-text">{String(item)}</span>
            </div>
          ))}
        </div>
      ) : isArr ? (
        /* Short tag pills for other arrays */
        <div className="fr-field__tags">
          {(value as unknown[]).map((item, i) => (
            <span key={i} className="fr-field__tag">{String(item)}</span>
          ))}
        </div>
      ) : (
        /* Plain text, possibly truncated */
        <>
          <div className="fr-field__value">{display}</div>
          {isLong && (
            <button
              className="fr-field__expand"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "▲ Menos" : "▼ Leer más"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface ForgeResultDisplayProps {
  gen: Generation;
  onReset: () => void;
  onToast?: (msg: string, kind?: "ok" | "error" | "info") => void;
}

export function ForgeResultDisplay({ gen, onReset, onToast }: ForgeResultDisplayProps) {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState<TabId>("identity");
  const [visible, setVisible] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [showIllustrator, setShowIllustrator] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(gen.image_url ?? null);

  useEffect(() => {
    setVisible(false);
    setTab("identity");
    setShowIllustrator(false);
    setLocalImageUrl(gen.image_url ?? null);
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, [gen.id]);

  // Check if already favourited on mount
  useEffect(() => {
    apiFavorites().then(({ data }) => {
      if (data) setIsFav(data.some((f) => f.id === gen.id));
    });
  }, [gen.id]);

  const typeColor = TYPE_COLORS[gen.type] ?? "#ff8c28";
  const meta = TYPE_META[gen.type as GenerationType] ?? TYPE_META.npc;
  const title = getGenerationTitle(gen.result, gen.type as GenerationType, gen.id);

  const sourceA = gen.result._source_a as { id: number; type: string; name: string } | undefined;
  const sourceB = gen.result._source_b as { id: number; type: string; name: string } | undefined;

  // Categorise fields
  const allFields = Object.entries(gen.result).filter(([k]) => !SKIP_FIELDS.has(k));
  const byTab: Record<TabId, [string, unknown][]> = {
    identity:  allFields.filter(([k]) => IDENTITY_FIELDS.has(k)),
    story:     allFields.filter(([k]) => STORY_FIELDS.has(k)),
    abilities: allFields.filter(([k]) => ABILITY_FIELDS.has(k) || DIALOGUE_FIELDS.has(k)),
  };
  // Uncategorised fields go into abilities tab
  const categorised = new Set([...IDENTITY_FIELDS, ...STORY_FIELDS, ...ABILITY_FIELDS, ...DIALOGUE_FIELDS]);
  const uncategorised = allFields.filter(([k]) => !categorised.has(k));
  byTab.abilities = [...byTab.abilities, ...uncategorised];

  const activeTabs = TABS.filter((t) => byTab[t.id].length > 0);

  // Quick stats: short identity values only
  const quickStats = byTab.identity
    .filter(([, v]) => !Array.isArray(v) && String(v ?? "").length <= 40)
    .slice(0, 8);

  const handleCopy = () =>
    navigator.clipboard.writeText(JSON.stringify(gen.result, null, 2));

  const handleFavToggle = async () => {
    if (isFav) {
      await apiRemoveFavorite(gen.id);
      setIsFav(false);
      onToast?.("Eliminado de favoritos", "info");
    } else {
      await apiAddFavorite(gen.id);
      setIsFav(true);
      onToast?.("¡Añadido a favoritos! ★", "ok");
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(gen.result, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${gen.type}-fusion-${gen.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`fr-reveal${visible ? " fr-reveal--in" : ""}`}
      style={{ "--fr-color": typeColor } as React.CSSProperties}
    >
      {/* Spinning border glow */}
      <div className="fr-reveal__border-glow" />

      {/* ── Origin lineage ── */}
      {sourceA && sourceB && (
        <div className="fr-origin">
          <div className="fr-origin__src">
            <span className="fr-origin__src-icon">
              {(TYPE_META[sourceA.type as GenerationType] ?? { icon: "✦" }).icon}
            </span>
            <span className="fr-origin__src-name">{sourceA.name}</span>
            <span className="fr-origin__src-type">{sourceA.type.toUpperCase()}</span>
          </div>
          <span className="fr-origin__alchemy">⚗️</span>
          <div className="fr-origin__src">
            <span className="fr-origin__src-icon">
              {(TYPE_META[sourceB.type as GenerationType] ?? { icon: "✦" }).icon}
            </span>
            <span className="fr-origin__src-name">{sourceB.name}</span>
            <span className="fr-origin__src-type">{sourceB.type.toUpperCase()}</span>
          </div>
          <span className="fr-origin__arrow">→</span>
          <span className="fr-origin__result-badge">✨ FUSIÓN LEGENDARIA</span>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="fr-hero">
        <div className="fr-hero__aura" />
        <div className="fr-hero__icon">{meta.icon}</div>
        <div
          className="fr-hero__type-badge"
          style={{ background: `${typeColor}22`, borderColor: `${typeColor}55`, color: typeColor }}
        >
          {meta.label}
        </div>
        <h2 className="fr-hero__name">{title}</h2>

        {localImageUrl && (
          <div className="fr-hero__image-wrap">
            <div
              className="fr-hero__image-glow"
              style={{ background: `radial-gradient(ellipse at center, ${typeColor}55 0%, transparent 70%)` }}
            />
            <img src={localImageUrl} alt={title} className="fr-hero__image" />
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="fr-toolbar">
        <button
          className={`fr-tool-btn${isFav ? " fr-tool-btn--active-fav" : ""}`}
          onClick={handleFavToggle}
          title={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}
        >
          {isFav ? "★" : "☆"} {isFav ? "Guardado" : "Favorito"}
        </button>

        {isSignedIn && (
          <button
            className="fr-tool-btn"
            onClick={() => setShowAddProject(true)}
            title="Añadir a proyecto"
          >
            ＋ Proyecto
          </button>
        )}

        <button
          className={`fr-tool-btn${showIllustrator ? " fr-tool-btn--active-art" : ""}`}
          onClick={() => setShowIllustrator((v) => !v)}
          title="Generar ilustración y modelo 3D"
        >
          🎨 Ilustrar
        </button>

        <button
          className="fr-tool-btn fr-tool-btn--share"
          onClick={() => setShowPublish(true)}
          title="Compartir esta fusión en la comunidad"
        >
          🌍 Compartir Fusión
        </button>

        <button className="fr-tool-btn fr-tool-btn--copy" onClick={handleCopy} title="Copiar JSON">
          📋 Copiar
        </button>

        <button className="fr-tool-btn fr-tool-btn--export" onClick={handleExport} title="Exportar JSON">
          ⬇ Exportar
        </button>
      </div>

      {/* ── Illustrator / 3D panel ── */}
      {showIllustrator && (
        <div className="fr-illustrator-wrap">
          <ImagePreview
            type={gen.type as GenerationType}
            result={gen.result}
            generationId={gen.id}
            initialImageUrl={localImageUrl}
            onImageReady={(url) => setLocalImageUrl(url)}
          />
        </div>
      )}

      {/* ── Quick stats strip ── */}
      {quickStats.length > 0 && (
        <div className="fr-stats">
          {quickStats.map(([k, v], i) => (
            <div key={k} className="fr-stat" style={{ animationDelay: `${180 + i * 70}ms` }}>
              <span className="fr-stat__key">{labelFor(k)}</span>
              <span className="fr-stat__val">{getStr(v)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ornamental divider ── */}
      <div className="fr-divider">
        <span className="fr-divider__line" />
        <span className="fr-divider__gem">◆</span>
        <span className="fr-divider__line" />
      </div>

      {/* ── Tabs (with inline action shortcuts on the right) ── */}
      {activeTabs.length > 1 && (
        <div className="fr-tabs-row">
          <div className="fr-tabs">
            {activeTabs.map((t) => (
              <button
                key={t.id}
                className={`fr-tab${tab === t.id ? " fr-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                <span className="fr-tab__count">{byTab[t.id].length}</span>
              </button>
            ))}
          </div>

          {/* Action shortcuts — shown next to ⚔️ Habilidades */}
          {tab === "abilities" && (
            <div className="fr-tab-actions">
              <button
                className={`fr-tab-action-btn${isFav ? " fr-tab-action-btn--fav" : ""}`}
                onClick={handleFavToggle}
                title={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}
              >
                {isFav ? "★" : "☆"} {isFav ? "Guardado" : "Favorito"}
              </button>
              {isSignedIn && (
                <button
                  className="fr-tab-action-btn"
                  onClick={() => setShowAddProject(true)}
                  title="Añadir a proyecto"
                >
                  ＋ Proyecto
                </button>
              )}
              <button
                className={`fr-tab-action-btn${showIllustrator ? " fr-tab-action-btn--art" : ""}`}
                onClick={() => setShowIllustrator((v) => !v)}
                title="Ilustrar"
              >
                🎨 Ilustrar
              </button>
              <button
                className="fr-tab-action-btn fr-tab-action-btn--share"
                onClick={() => setShowPublish(true)}
                title="Compartir en social"
              >
                🌍 Compartir
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Fields grid ── */}
      <div className="fr-fields" key={tab}>
        {byTab[tab].map(([k, v], i) => (
          <ExpandableField
            key={k}
            fieldKey={k}
            label={labelFor(k)}
            value={v}
            index={i}
            typeColor={typeColor}
          />
        ))}
        {byTab[tab].length === 0 && (
          <p className="fr-fields__empty">Sin datos para esta sección.</p>
        )}
      </div>

      {/* ── Bottom actions ── */}
      <div className="fr-actions">
        <button className="fr-action-btn fr-action-btn--reset" onClick={onReset}>
          🔄 Nueva fusión
        </button>
      </div>

      {/* ── Add to project modal ── */}
      {showAddProject && (
        <Modal open onClose={() => setShowAddProject(false)} title="➕ Añadir a proyecto" size="sm">
          <AddToProjectPanel
            generationId={gen.id}
            onClose={() => setShowAddProject(false)}
            onToast={(msg) => onToast?.(msg, "ok")}
          />
        </Modal>
      )}

      {/* ── Publish / share modal ── */}
      {showPublish && (
        <PublishModal
          gen={gen}
          initialImageUrl={localImageUrl ?? undefined}
          onClose={() => setShowPublish(false)}
          onPublished={() => onToast?.("¡Fusión compartida en la comunidad! 🌍", "ok")}
          onToast={(msg, kind) => onToast?.(msg, kind)}
        />
      )}
    </div>
  );
}
