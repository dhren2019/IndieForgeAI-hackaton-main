import React, { useState } from "react";
import { Button }           from "../ui/Button";
import { Loader }           from "../ui/Loader";
import { Model3DPreview }   from "./Model3DPreview";
import { apiGenerateImage, apiSaveGenerationImage } from "../../lib/api";
import type { GenerationType } from "../../types/generate";

interface ImagePreviewProps {
  type:              GenerationType;
  result:            Record<string, unknown>;
  generationId?:     number;
  initialImageUrl?:  string | null;
  onImageReady?:     (url: string) => void;
  onGlbReady?:       (url: string) => void;
}

export function ImagePreview({
  type, result, generationId, initialImageUrl, onImageReady, onGlbReady,
}: ImagePreviewProps) {
  const [loading, setLoading]   = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [error, setError]       = useState<string | null>(null);
  const [show3D, setShow3D]     = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await apiGenerateImage(type, result);
    setLoading(false);
    if (data?.url) {
      setImageUrl(data.url);
      setShow3D(false);   // reset 3D panel on new image
      onImageReady?.(data.url);
      if (generationId) {
        apiSaveGenerationImage(generationId, data.url);
      }
    } else {
      setError(err ?? "Error de generación");
    }
  };

  return (
    <div className="image-preview">
      <div className="image-preview__header">🎨 Hoja de diseño</div>

      <Button
        variant={imageUrl ? "secondary" : "primary"}
        size="sm"
        loading={loading}
        onClick={handleGenerate}
      >
        {imageUrl ? "🔄 Regenerar diseño" : "🎨 Generar hoja de diseño"}
      </Button>

      {error && <p className="image-preview__error">{error}</p>}

      {imageUrl && (
        <div className="image-preview__wrap">
          <img src={imageUrl} alt="Hoja de diseño del personaje" className="image-preview__img" />
          <div className="image-preview__actions">
            <a href={imageUrl} download="hoja-de-diseno.png" className="image-preview__download">
              ⬇ Descargar imagen
            </a>
            <button
              className={`image-preview__3d-toggle${show3D ? " image-preview__3d-toggle--active" : ""}`}
              onClick={() => setShow3D((v) => !v)}
              title="Generar modelo 3D con TRELLIS"
            >
              🧊 {show3D ? "Ocultar 3D" : "Ver en 3D"}
            </button>
          </div>
        </div>
      )}

      {imageUrl && show3D && (
        <Model3DPreview imageUrl={imageUrl} generationId={generationId} onGlbReady={onGlbReady} />
      )}
    </div>
  );
}
