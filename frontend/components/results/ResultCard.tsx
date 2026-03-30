import React, { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Card }          from "../ui/Card";
import { Badge }         from "../ui/Badge";
import { Modal }         from "../ui/Modal";
import { ResultActions } from "./ResultActions";
import { ResultJson }    from "./ResultJson";
import { ImagePreview }  from "./ImagePreview";
import { AddToProjectPanel } from "../projects/ProjectModal";
import { TYPE_META, FIELD_LABELS } from "../../types/generate";
import { getGenerationTitle, labelFor } from "../../lib/formatters";
import type { Generation } from "../../types/generate";

interface ResultCardProps {
  gen:         Generation;
  isFav:       boolean;
  onFavToggle: (id: number, add: boolean) => void;
  onShare?:    () => void;
  showActions?: boolean;
  onGlbGenerated?:   (url: string) => void;
  onImageGenerated?: (url: string) => void;
}

// Fields that benefit from a full-text expand (long prose fields)
const EXPANDABLE_FIELDS = new Set([
  "appearance", "personality", "backstory", "secret", "motivation",
  "dialogue", "combat_style", "description", "lore", "summary",
  "objective", "twist", "reward", "special_ability", "passive",
  "attack_style", "weakness", "resistance", "drops", "impact",
]);

// Featured fields always get a prominent icon and are always expandable
const FEATURED_FIELD_ICONS: Record<string, string> = {
  appearance: "👁️",
  backstory:  "📖",
  dialogue:   "💬",
};

interface FieldModal { key: string; label: string; value: string }

function FieldsView({
  data,
  onExpand,
}: {
  data: Record<string, unknown>;
  onExpand: (f: FieldModal) => void;
}) {
  return (
    <div className="fields-grid">
      {Object.entries(data).map(([k, v]) => {
        // Join arrays with double-newline so modal can render each item as its own paragraph
        const rawStr    = Array.isArray(v) ? (v as unknown[]).map(String).join("\n\n") : String(v);
        const isLong    = rawStr.length > 100;
        const featured  = k in FEATURED_FIELD_ICONS;
        const expandable = featured || EXPANDABLE_FIELDS.has(k) || isLong;
        const icon       = FEATURED_FIELD_ICONS[k];
        const displayStr = isLong ? rawStr.slice(0, 100) + "…" : rawStr;
        return (
          <div
            className={`field-item${expandable ? " field-item--expandable" : ""}${featured ? " field-item--featured" : ""}`}
            key={k}
            onClick={expandable ? () => onExpand({ key: k, label: labelFor(k), value: rawStr }) : undefined}
            title={expandable ? "Haz clic para ver el texto completo" : undefined}
          >
            <div className="field-item__key">
              {icon && <span className="field-item__type-icon">{icon}</span>}
              {labelFor(k)}
              {expandable && <span className="field-item__expand-icon">⤢</span>}
            </div>
            <div className="field-item__value">
              {!isLong && Array.isArray(v)
                ? (v as unknown[]).map((item, i) => (
                    <span key={i} className="field-item__tag">{String(item)}</span>
                  ))
                : displayStr}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ResultCard({
  gen,
  isFav,
  onFavToggle,
  onShare,
  showActions = true,
  onGlbGenerated,
  onImageGenerated,
}: ResultCardProps) {
  const [view, setView]               = useState<"fields" | "json">("fields");
  const [showIllustrator, setShowIllustrator] = useState(false);
  const [fieldModal, setFieldModal]   = useState<FieldModal | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const { isSignedIn } = useAuth();

  const handleImageReady = (url: string) => {
    onImageGenerated?.(url);
  };

  const meta  = TYPE_META[gen.type];
  const title = getGenerationTitle(gen.result, gen.type, gen.id);

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

  return (
    <Card className="result-card">
      <div className="result-card__header">
        <Badge type={gen.type} icon={meta.icon} label={meta.label} />
        <span className="result-card__title">{title}</span>
        {gen.source === "fallback" && (
          <Badge type="fallback" label="respaldo" small />
        )}

        {showActions && (
          <ResultActions
            isFav={isFav}
            onFavToggle={() => onFavToggle(gen.id, !isFav)}
            onCopy={handleCopy}
            onExport={handleExport}
            onShare={onShare}
            onIllustrate={() => setShowIllustrator((v) => !v)}
            showIllustrator={showIllustrator}
            viewMode={view}
            onToggleView={() => setView((v) => v === "fields" ? "json" : "fields")}
            onAddToProject={isSignedIn ? () => setShowAddProject(true) : undefined}
          />
        )}
      </div>

      {view === "fields"
        ? <FieldsView data={gen.result} onExpand={setFieldModal} />
        : <ResultJson data={gen.result} />
      }

      {showIllustrator && (
        <ImagePreview
          type={gen.type}
          result={gen.result}
          generationId={gen.id}
          initialImageUrl={gen.image_url}
          onImageReady={handleImageReady}
          onGlbReady={onGlbGenerated}
        />
      )}

      {fieldModal && (
        <Modal
          open
          onClose={() => setFieldModal(null)}
          title={fieldModal.label}
          size="md"
        >
          <div className="field-modal__text">
            {fieldModal.value.split("\n\n").map((para, i) => (
              <p key={i} className="field-modal__para">{para}</p>
            ))}
          </div>
        </Modal>
      )}

      {showAddProject && (
        <Modal
          open
          onClose={() => setShowAddProject(false)}
          title="📁 Añadir a proyecto"
          size="sm"
        >
          <AddToProjectPanel
            generationId={gen.id}
            onClose={() => setShowAddProject(false)}
          />
        </Modal>
      )}
    </Card>
  );
}
