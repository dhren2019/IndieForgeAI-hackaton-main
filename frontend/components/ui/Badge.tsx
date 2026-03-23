import React from "react";
import type { GenerationType } from "../../types/generate";

interface BadgeProps {
  type: GenerationType | "fallback" | "source";
  icon?: string;
  label: string;
  small?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  npc:      "badge--npc",
  quest:    "badge--quest",
  item:     "badge--item",
  lore:     "badge--lore",
  weapon:   "badge--weapon",
  enemy:    "badge--enemy",
  fallback: "badge--fallback",
};

export function Badge({ type, icon, label, small = false }: BadgeProps) {
  return (
    <span className={`badge ${TYPE_COLORS[type] ?? "badge--default"} ${small ? "badge--sm" : ""}`}>
      {icon && <span className="badge__icon">{icon}</span>}
      {label}
    </span>
  );
}
