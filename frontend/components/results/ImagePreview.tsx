import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Loader } from "../ui/Loader";
import { apiGenerateImage, apiSaveGenerationImage } from "../../lib/api";
import type { GenerationType } from "../../types/generate";

interface ImagePreviewProps {
  type:              GenerationType;
  result:            Record<string, unknown>;
  generationId?:     number;
  initialImageUrl?:  string | null;
  onImageReady?:     (url: string) => void;
}

export function ImagePreview({
  type, result, generationId, initialImageUrl, onImageReady,
}: ImagePreviewProps) {
  const [loading, setLoading]   = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [error, setError]       = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await apiGenerateImage(type, result);
    setLoading(false);
    if (data?.url) {
      setImageUrl(data.url);
      onImageReady?.(data.url);
      // Persist to DB if we have a generation id
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
          <a href={imageUrl} download="hoja-de-diseno.png" className="image-preview__download">
            ⬇ Descargar
          </a>
        </div>
      )}
    </div>
  );
}
