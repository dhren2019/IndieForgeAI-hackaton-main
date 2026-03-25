import React from "react";
import { Button } from "../ui/Button";

interface ResultActionsProps {
  isFav:        boolean;
  onFavToggle:  () => void;
  onCopy:       () => void;
  onExport:     () => void;
  onShare?:     () => void;
  onIllustrate: () => void;
  showIllustrator: boolean;
  viewMode:     "fields" | "json";
  onToggleView: () => void;
  /** Called when user clicks "Add to project" — only shown when signed in */
  onAddToProject?: () => void;
}

export function ResultActions({
  isFav, onFavToggle, onCopy, onExport,
  onShare, onIllustrate, showIllustrator,
  viewMode, onToggleView, onAddToProject,
}: ResultActionsProps) {
  return (
    <div className="result-actions">
      <Button
        variant={isFav ? "primary" : "ghost"}
        size="sm"
        icon={isFav ? "★" : "☆"}
        onClick={onFavToggle}
        title={isFav ? "Quitar de favoritos" : "Guardar favorito"}
      >
        {isFav ? "Guardado" : "Guardar"}
      </Button>

      {onAddToProject && (
        <Button
          variant="ghost"
          size="sm"
          icon="＋"
          onClick={onAddToProject}
          title="Añadir a proyecto"
        >
          Proyecto
        </Button>
      )}

      <Button variant="ghost" size="sm" onClick={onToggleView}>
        {viewMode === "fields" ? "</> JSON" : "⊞ Campos"}
      </Button>

      <Button variant="ghost" size="sm" icon="📋" onClick={onCopy} title="Copiar JSON" />
      <Button variant="ghost" size="sm" icon="⬇" onClick={onExport} title="Exportar JSON" />

      {onShare && (
        <Button variant="ghost" size="sm" icon="🌐" onClick={onShare} title="Compartir en la comunidad">
          Compartir
        </Button>
      )}

      <Button
        variant={showIllustrator ? "secondary" : "ghost"}
        size="sm"
        icon="🎨"
        onClick={onIllustrate}
        title="Generar ilustración"
      >
        Ilustrar
      </Button>
    </div>
  );
}
