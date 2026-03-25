import React, { useState } from "react";
import { useUser }     from "@clerk/clerk-react";
import { Modal }        from "../ui/Modal";
import { Button }       from "../ui/Button";
import { Badge }        from "../ui/Badge";
import { ImagePreview } from "../results/ImagePreview";
import { apiCreatePost } from "../../lib/api";
import { sanitizeTag, getGenerationTitle } from "../../lib/formatters";
import { TYPE_META }     from "../../types/generate";
import type { Generation } from "../../types/generate";

interface PublishModalProps {
  gen:             Generation;
  onClose:         () => void;
  onPublished:     () => void;
  onToast:         (msg: string, kind?: "ok" | "error") => void;
  initialGlbUrl?:   string;
  initialImageUrl?: string;
}

const MAX_TAGS = 8;

export function PublishModal({ gen, onClose, onPublished, onToast, initialGlbUrl, initialImageUrl }: PublishModalProps) {
  const { user } = useUser();
  const [title,    setTitle]    = useState(getGenerationTitle(gen.result, gen.type, gen.id));
  const [desc,     setDesc]     = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags,     setTags]     = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialImageUrl ?? gen.image_url ?? undefined);
  const [glbUrl,   setGlbUrl]   = useState<string | undefined>(initialGlbUrl);
  const [loading,  setLoading]  = useState(false);

  // Resolve a display name for this post — use full name or first+last name only.
  // Explicitly avoid user.username which Clerk auto-generates as random words.
  const displayName = user
    ? (
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        ""
      ).trim()
    : "";

  const meta = TYPE_META[gen.type];

  const addTag = (raw: string) => {
    const t = sanitizeTag(raw);
    if (!t || tags.includes(t) || tags.length >= MAX_TAGS) return;
    setTags((prev) => [...prev, t]);
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    } else if (e.key === "Backspace" && tagInput === "") {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) { onToast("El título es obligatorio", "error"); return; }
    setLoading(true);
    const { data, error } = await apiCreatePost({
      title:        title.trim(),
      description:  desc.trim(),
      type:         gen.type,
      result:       gen.result,
      tags,
      image_url:    imageUrl ?? null,
      glb_url:      glbUrl ?? null,
      display_name: displayName,
    });
    setLoading(false);
    if (error) { onToast("Error al publicar: " + error, "error"); return; }
    onToast("¡Publicado en el feed! 🎉");
    onPublished();
    onClose();
  };

  return (
    <Modal open={true} title="Publicar en la comunidad" onClose={onClose} size="md">
      <div className="publish-form">
        <div className="publish-form__badge-row">
          <Badge type={gen.type} icon={meta.icon} label={meta.label} />
          <span className="publish-form__type-hint">{meta.label}</span>
        </div>

        <label className="form-field">
          <span className="form-field__label">Título *</span>
          <input
            className="form-field__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de tu creación..."
            maxLength={100}
          />
        </label>

        <label className="form-field">
          <span className="form-field__label">Descripción (opcional)</span>
          <textarea
            className="form-field__textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Añade contexto o historia..."
            rows={3}
            maxLength={500}
          />
        </label>

        <div className="form-field">
          <span className="form-field__label">
            Etiquetas ({tags.length}/{MAX_TAGS})
          </span>
          <div className="tag-input-wrap">
            {tags.map((t) => (
              <span className="tag-pill tag-pill--removable" key={t}>
                #{t}
                <button className="tag-pill__remove" onClick={() => removeTag(t)}>×</button>
              </span>
            ))}
            {tags.length < MAX_TAGS && (
              <input
                className="tag-input-wrap__input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Añadir etiqueta..."
              />
            )}
          </div>
          <span className="form-field__hint">Pulsa Enter o coma para añadir</span>
        </div>

        <div className="form-field">
          <span className="form-field__label">Hoja de diseño</span>
          {imageUrl && (
            <div className="publish-design-preview">
              <img src={imageUrl} alt="Hoja de diseño" className="publish-design-preview__img" />
              <p className="publish-design-preview__hint">Se publicará esta imagen generada</p>
            </div>
          )}
          <ImagePreview
            type={gen.type}
            result={gen.result}
            initialImageUrl={imageUrl ?? gen.image_url ?? null}
            onImageReady={(url) => setImageUrl(url)}
            onGlbReady={(url) => setGlbUrl(url)}
          />
        </div>

        {glbUrl && (
          <div className="form-field">
            <span className="form-field__label">Modelo 3D — se publicará con tu creación</span>
            <div className="publish-3d-viewer">
              {/* @ts-ignore custom element */}
              <model-viewer
                src={glbUrl}
                alt="Vista previa del modelo 3D"
                auto-rotate
                camera-controls
                shadow-intensity="1"
                environment-image="neutral"
                class="publish-3d-viewer__canvas"
              />
            </div>
            <a href={glbUrl} download="personaje-3d.glb" className="publish-glb-preview__download">
              ⬇ Descargar .glb
            </a>
          </div>
        )}
      </div>

      <div className="modal__footer">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handlePublish} loading={loading}>
          Publicar
        </Button>
      </div>
    </Modal>
  );
}
