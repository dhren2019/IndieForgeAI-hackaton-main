import React from "react";
import { HistoryItem } from "./HistoryItem";
import { Loader }      from "../ui/Loader";
import type { Generation } from "../../types/generate";

interface HistoryListProps {
  items:      Generation[];
  loading:    boolean;
  onSelect:   (gen: Generation) => void;
  emptyMsg:   string;
  selectedId?: number;
}

export function HistoryList({ items, loading, onSelect, emptyMsg }: HistoryListProps) {
  if (loading) return <Loader center label="Cargando historial…" />;

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🗃️</div>
        <p className="empty-state__msg">{emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {items.map((gen) => (
        <HistoryItem key={gen.id} gen={gen} onClick={onSelect} />
      ))}
    </div>
  );
}
