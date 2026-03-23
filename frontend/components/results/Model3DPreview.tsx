import React, { useState } from "react";
import { Button }          from "../ui/Button";
import { Loader }          from "../ui/Loader";
import { apiGenerate3D }   from "../../lib/api";

interface Model3DPreviewProps {
  imageUrl: string;   // the 2-D image we convert to 3-D
}

/**
 * Calls the /api/trellis backend which proxies Microsoft TRELLIS to
 * generate a .glb 3-D model from a 2-D character image.
 * Renders the result with Google's <model-viewer> web component
 * (loaded from CDN in index.html).
 */
export function Model3DPreview({ imageUrl }: Model3DPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [glbUrl,  setGlbUrl]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGlbUrl(null);

    const { data, error: e } = await apiGenerate3D(imageUrl);
    setLoading(false);

    if (data?.glbUrl) {
      setGlbUrl(data.glbUrl);
    } else {
      setError(e ?? "Error al generar el modelo 3D");
    }
  };

  return (
    <div className="model3d-preview">
      <div className="model3d-preview__header">
        <span className="model3d-preview__icon">🧊</span>
        <span>Modelo 3D — TRELLIS</span>
        <span className="model3d-preview__badge">Microsoft</span>
      </div>

      {!glbUrl && (
        <p className="model3d-preview__hint">
          Convierte la hoja de diseño a un asset 3D interactivo usando&nbsp;
          <strong>Microsoft TRELLIS</strong>.
          La generación puede tardar 1-3 minutos.
        </p>
      )}

      <Button
        variant={glbUrl ? "secondary" : "primary"}
        size="sm"
        loading={loading}
        onClick={handleGenerate}
      >
        {loading
          ? "Generando modelo 3D…"
          : glbUrl
            ? "🔄 Regenerar modelo 3D"
            : "🧊 Generar modelo 3D"}
      </Button>

      {error && <p className="model3d-preview__error">{error}</p>}

      {loading && (
        <div className="model3d-preview__loading">
          <Loader size="md" />
          <p>TRELLIS está procesando la imagen. Puede tardar hasta 3 minutos…</p>
        </div>
      )}

      {glbUrl && !loading && (
        <div className="model3d-preview__viewer-wrap">
          {/* model-viewer is a custom element loaded from CDN in index.html */}
          {/* @ts-ignore — custom element not in TS DOM types */}
          <model-viewer
            src={glbUrl}
            alt="Modelo 3D del personaje"
            auto-rotate
            camera-controls
            shadow-intensity="1"
            environment-image="neutral"
            class="model3d-preview__viewer"
          />
          <div className="model3d-preview__controls-hint">
            🖱 Arrasta para rotar · Scroll para zoom
          </div>
          <a
            href={glbUrl}
            download="personaje-3d.glb"
            className="model3d-preview__download"
          >
            ⬇ Descargar .glb
          </a>
        </div>
      )}
    </div>
  );
}
