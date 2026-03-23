import React from "react";
import { HistoryItem } from "../history/HistoryItem";
import { Loader }      from "../ui/Loader";
import type { Generation } from "../../types/generate";

interface FavoriteListProps {
  items:       Generation[];
  loading:     boolean;
  onSelect:    (gen: Generation) => void;
  selectedId?: number;
}

export function FavoriteList({ items, loading, onSelect }: FavoriteListProps) {
  if (loading) return <Loader center label="Cargando favoritos…" />;

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">★</div>
        <p className="empty-state__msg">
          Aún no hay favoritos. Guarda una generación haciendo clic en ☆ Guardar.
        </p>
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
