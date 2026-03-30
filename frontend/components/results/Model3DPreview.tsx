import React, { useState } from "react";
import { Button }          from "../ui/Button";
import { Loader }          from "../ui/Loader";
import { apiGenerate3D, apiSaveGenerationGlb } from "../../lib/api";
import type { ThreeDModelId } from "../../lib/api";

interface Model3DPreviewProps {
  imageUrl:       string;   // the 2-D design sheet (front+back)
  generationId?:  number;
  type?:          string;   // generation type so we can skip crop for weapons/items
  onGlbReady?:    (url: string) => void;
}

/**
 * Crops a data URI image to its left half (front view) before sending
 * to the 3D reconstruction model. The input design sheet has [front | back]
 * so the left half gives a clean single front-view for reconstruction.
 */
async function cropFrontHalf(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w      = Math.floor(img.naturalWidth / 2);
        const h      = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl); // fallback: use original if crop fails
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const THREE_D_MODELS: Array<{
  id:    ThreeDModelId;
  label: string;
  badge: string;
  time:  string;
  pro:   boolean;
  hint:  string;
}> = [
  {
    id:    "trellis",
    label: "🔬 TRELLIS.2 — Microsoft",
    badge: "Microsoft",
    time:  "2-4 min",
    pro:   true,
    hint:  "La mayor calidad. ⚠️ Requiere cuenta Hugging Face PRO — excede la cuota gratuita de GPU (120 s).",
  },
  {
    id:    "instant-mesh",
    label: "⚡ InstantMesh — Rápido",
    badge: "InstantMesh",
    time:  "1-2 min",
    pro:   false,
    hint:  "Genera múltiples vistas y reconstruye el modelo. Buena precisión para personajes, objetos y armas.",
  },
  {
    id:    "shap-e",
    label: "💨 Shap-E — Ligero",
    badge: "OpenAI",
    time:  "30-60 seg",
    pro:   false,
    hint:  "Calidad básica pero muy rápido. Ideal para formas simples y pruebas rápidas.",
  },
];

/**
 * Calls /api/trellis, /api/instant-mesh, or /api/shap-e depending on the
 * selected model and renders the returned .glb with Google's <model-viewer>.
 */
export function Model3DPreview({ imageUrl, generationId, type, onGlbReady }: Model3DPreviewProps) {
  const [model,   setModel]   = useState<ThreeDModelId>("instant-mesh");
  const [loading, setLoading] = useState(false);
  const [glbUrl,  setGlbUrl]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const selected = THREE_D_MODELS.find((m) => m.id === model)!;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGlbUrl(null);

    // Always crop the design sheet to the left half (front view) before sending
    // to the 3D reconstruction model. The design sheet has [front | back] side by
    // side; using the full image confuses multi-view models into trying to reconstruct
    // two separate copies. The front view alone yields clean, consistent geometry for
    // all types — characters, weapons, items and enemies alike.
    const frontView = await cropFrontHalf(imageUrl);

    const { data, error: e } = await apiGenerate3D(frontView, model);
    setLoading(false);

    if (data?.glbUrl) {
      setGlbUrl(data.glbUrl);
      onGlbReady?.(data.glbUrl);
      // Persist the GLB URL to DB so it survives page reload
      if (generationId) {
        apiSaveGenerationGlb(generationId, data.glbUrl);
      }
    } else {
      setError(e ?? "Error al generar el modelo 3D");
    }
  };

  return (
    <div className="model3d-preview">
      <div className="model3d-preview__header">
        <span className="model3d-preview__icon">🧊</span>
        <span>Modelo 3D</span>
        <span className="model3d-preview__badge">{selected.badge}</span>
      </div>

      {/* ── Model selector ── */}
      <div className="model3d-preview__selector">
        <label className="model3d-preview__selector-label">Motor 3D</label>
        <select
          className="form-field__select model3d-preview__select"
          value={model}
          onChange={(e) => { setModel(e.target.value as ThreeDModelId); setGlbUrl(null); setError(null); }}
          disabled={loading}
        >
          {THREE_D_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.time}
            </option>
          ))}
        </select>
        <p className="model3d-preview__hint model3d-preview__hint--selector">
          {selected.hint}
        </p>
        {selected.pro && (
          <p className="model3d-preview__pro-warning">
            ⚠️ <strong>TRELLIS requiere HuggingFace PRO</strong> — la cuenta gratuita agota la cuota de GPU.
            Prueba InstantMesh o Shap-E si no tienes suscripción PRO.
          </p>
        )}
      </div>

      {!glbUrl && !selected.pro && (
        <p className="model3d-preview__hint">
          Convierte la hoja de diseño a un asset 3D interactivo.
          La generación puede tardar {selected.time}.
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
          <p>
            {selected.badge} está procesando la imagen.
            Puede tardar hasta {selected.time}…
          </p>
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
