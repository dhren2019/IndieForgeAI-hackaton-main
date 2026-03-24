import React, { useState } from "react";
import { Card }          from "../ui/Card";
import { Badge }         from "../ui/Badge";
import { Modal }         from "../ui/Modal";
import { ResultActions } from "./ResultActions";
import { ResultJson }    from "./ResultJson";
import { ImagePreview }  from "./ImagePreview";
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
        const strVal    = Array.isArray(v) ? v.join(" · ") : String(v);
        const featured  = k in FEATURED_FIELD_ICONS;
        const expandable = featured || (EXPANDABLE_FIELDS.has(k) && strVal.length > 60);
        const icon       = FEATURED_FIELD_ICONS[k];
        return (
          <div
            className={`field-item${expandable ? " field-item--expandable" : ""}${featured ? " field-item--featured" : ""}`}
            key={k}
            onClick={expandable ? () => onExpand({ key: k, label: labelFor(k), value: strVal }) : undefined}
            title={expandable ? "Haz clic para ver el texto completo" : undefined}
          >
            <div className="field-item__key">
              {icon && <span className="field-item__type-icon">{icon}</span>}
              {labelFor(k)}
              {expandable && <span className="field-item__expand-icon">⤢</span>}
            </div>
            <div className="field-item__value">
              {Array.isArray(v)
                ? v.map((item, i) => (
                    <span key={i} className="field-item__tag">{String(item)}</span>
                  ))
                : String(v)}
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
}: ResultCardProps) {
  const [view, setView]               = useState<"fields" | "json">("fields");
  const [showIllustrator, setShowIllustrator] = useState(false);
  const [fieldModal, setFieldModal]   = useState<FieldModal | null>(null);

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
          <p className="field-modal__text">{fieldModal.value}</p>
        </Modal>
      )}
    </Card>
  );
}
