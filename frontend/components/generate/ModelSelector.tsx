import React from "react";
import { AI_MODELS } from "../../types/generate";
import type { AiModelId } from "../../types/generate";

interface ModelSelectorProps {
  value:    AiModelId;
  onChange: (model: AiModelId) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div className="model-selector">
      <label className="form-field__label">
        🤖 Modelo IA
      </label>
      <select
        className="form-field__select model-selector__select"
        value={value}
        onChange={(e) => onChange(e.target.value as AiModelId)}
      >
        {AI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </div>
  );
}
