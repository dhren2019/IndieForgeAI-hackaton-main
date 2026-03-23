import React from "react";
import { Card }     from "../ui/Card";
import { Badge }    from "../ui/Badge";
import { TYPE_META } from "../../types/generate";
import { getGenerationTitle, getPreviewText, timeAgo } from "../../lib/formatters";
import type { Generation } from "../../types/generate";

interface HistoryItemProps {
  gen:      Generation;
  onClick:  (gen: Generation) => void;
}

export function HistoryItem({ gen, onClick }: HistoryItemProps) {
  const meta    = TYPE_META[gen.type];
  const title   = getGenerationTitle(gen.result, gen.type, gen.id);
  const preview = getPreviewText(gen.result);

  return (
    <Card hoverable className="history-item" onClick={() => onClick(gen)}>
      <div className="history-item__header">
        <Badge type={gen.type} icon={meta.icon} label={meta.label} small />
        <span className="history-item__title">{title}</span>
        <span className="history-item__time">{timeAgo(gen.created_at)}</span>
      </div>
      {preview && <p className="history-item__preview">{preview}</p>}
    </Card>
  );
}
