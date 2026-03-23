import React, { useState } from "react";
import { TypeSelector } from "./TypeSelector";
import { PromptField }  from "./PromptInput";
import { Button }       from "../ui/Button";
import { ModelSelector } from "./ModelSelector";
import {
  GENEROS, ROLES_NPC, RAREZAS, DIFICULTADES, DIFS_ENEMIGO,
  TONOS, CLASES_ARMA, ELEMENTOS, ESTILOS_ARMA, TIPOS_ENEMIGO,
  TYPE_META,
} from "../../types/generate";
import type { GenerationType, AiModelId } from "../../types/generate";

interface GenerateFormProps {
  onGenerate:    (type: GenerationType, meta: Record<string, string>, model: string) => Promise<void>;
  loading:       boolean;
  model:         AiModelId;
  onModelChange: (model: AiModelId) => void;
}

export function GenerateForm({ onGenerate, loading, model, onModelChange }: GenerateFormProps) {
  const [type, setType]     = useState<GenerationType>("npc");
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const val = (k: string) => fields[k] ?? "";

  const handleTypeChange = (t: GenerationType) => { setType(t); setFields({}); };

  const handleSubmit = async () => {
    await onGenerate(type, fields, model);
  };

  return (
    <div className="generate-form">
      <TypeSelector selected={type} onSelect={handleTypeChange} />

      <div className="card card--pad-md generate-form__fields">
        <div className="form-grid">
          <PromptField label="Género" name="genre" type="select" options={GENEROS}
            value={val("genre")} onChange={(v) => set("genre", v)} />

          {type === "npc" && <>
            <PromptField label="Nombre (opcional)" name="name" type="text"
              placeholder="ej. Aldric" value={val("name")} onChange={(v) => set("name", v)} />
            <PromptField label="Rol" name="role" type="select" options={ROLES_NPC}
              value={val("role")} onChange={(v) => set("role", v)} />
          </>}

          {type === "quest" && <>
            <PromptField label="Título (opcional)" name="title" type="text"
              placeholder='ej. "La Reliquia Robada"' value={val("title")} onChange={(v) => set("title", v)} />
            <PromptField label="Dificultad" name="difficulty" type="select" options={DIFICULTADES}
              value={val("difficulty")} onChange={(v) => set("difficulty", v)} />
          </>}

          {type === "item" && <>
            <PromptField label="Nombre (opcional)" name="name" type="text"
              placeholder='ej. "Espada Rompe-Velos"' value={val("name")} onChange={(v) => set("name", v)} />
            <PromptField label="Rareza" name="rarity" type="select" options={RAREZAS}
              value={val("rarity")} onChange={(v) => set("rarity", v)} />
          </>}

          {type === "lore" && <>
            <PromptField label="Tema" name="topic" type="text"
              placeholder='ej. "La Gran Fractura"' value={val("topic")} onChange={(v) => set("topic", v)} />
            <PromptField label="Tono" name="tone" type="select" options={TONOS}
              value={val("tone")} onChange={(v) => set("tone", v)} />
          </>}

          {type === "weapon" && <>
            <PromptField label="Nombre (opcional)" name="name" type="text"
              placeholder='ej. "Hoja Ahumada"' value={val("name")} onChange={(v) => set("name", v)} />
            <PromptField label="Tipo de arma" name="weaponClass" type="select" options={CLASES_ARMA}
              value={val("weaponClass")} onChange={(v) => set("weaponClass", v)} />
            <PromptField label="Elemento" name="element" type="select" options={ELEMENTOS}
              value={val("element")} onChange={(v) => set("element", v)} />
            <PromptField label="Estilo de combate" name="style" type="select" options={ESTILOS_ARMA}
              value={val("style")} onChange={(v) => set("style", v)} />
          </>}

          {type === "enemy" && <>
            <PromptField label="Nombre (opcional)" name="name" type="text"
              placeholder='ej. "Señor Brasa Moloch"' value={val("name")} onChange={(v) => set("name", v)} />
            <PromptField label="Tipo de enemigo" name="enemyType" type="select" options={TIPOS_ENEMIGO}
              value={val("enemyType")} onChange={(v) => set("enemyType", v)} />
            <PromptField label="Dificultad" name="difficulty" type="select" options={DIFS_ENEMIGO}
              value={val("difficulty")} onChange={(v) => set("difficulty", v)} />
          </>}
        </div>

        <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handleSubmit}>
          ✦ Generar {TYPE_META[type].label}
        </Button>
      </div>

      <ModelSelector value={model} onChange={onModelChange} />
    </div>
  );
}
