import React from "react";
import { TYPE_META } from "../../types/generate";
import type { GenerationType } from "../../types/generate";

interface TypeSelectorProps {
  selected: GenerationType;
  onSelect: (type: GenerationType) => void;
}

export function TypeSelector({ selected, onSelect }: TypeSelectorProps) {
  return (
    <div className="type-selector">
      {(Object.entries(TYPE_META) as [GenerationType, (typeof TYPE_META)[GenerationType]][]).map(
        ([type, meta]) => (
          <button
            key={type}
            className={`type-card ${selected === type ? "type-card--active" : ""}`}
            onClick={() => onSelect(type)}
            style={{ "--type-color": meta.color } as React.CSSProperties}
          >
            <div className="type-card__icon">{meta.icon}</div>
            <div className="type-card__label">{meta.label}</div>
            <div className="type-card__desc">{meta.desc}</div>
          </button>
        )
      )}
    </div>
  );
}
