import React, { useState } from "react";
import { Card }          from "../ui/Card";
import { Badge }         from "../ui/Badge";
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
}

function FieldsView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="fields-grid">
      {Object.entries(data).map(([k, v]) => (
        <div className="field-item" key={k}>
          <div className="field-item__key">{labelFor(k)}</div>
          <div className="field-item__value">
            {Array.isArray(v)
              ? v.map((item, i) => (
                  <span key={i} className="field-item__tag">{String(item)}</span>
                ))
              : String(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultCard({
  gen,
  isFav,
  onFavToggle,
  onShare,
  showActions = true,
}: ResultCardProps) {
  const [view, setView]               = useState<"fields" | "json">("fields");
  const [showIllustrator, setShowIllustrator] = useState(false);

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
        ? <FieldsView data={gen.result} />
        : <ResultJson data={gen.result} />
      }

      {showIllustrator && (
        <ImagePreview
          type={gen.type}
          result={gen.result}
          generationId={gen.id}
          initialImageUrl={gen.image_url}
        />
      )}
    </Card>
  );
}
