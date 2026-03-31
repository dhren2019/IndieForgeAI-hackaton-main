import React, { useState, useEffect } from "react";
import { Badge }       from "../ui/Badge";
import { CommentList } from "./CommentList";
import { ImagePreview } from "../results/ImagePreview";
import { apiToggleLike, apiDeletePost, apiRecordInteraction } from "../../lib/api";
import { timeAgo, labelFor } from "../../lib/formatters";
import { TYPE_META }   from "../../types/generate";
import type { Post }   from "../../types/social";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface FeedPostProps {
  post:          Post;
  followedTags:  Set<string>;
  onTagFilter:   (tag: string) => void;
  onTagToggle:   (tag: string, follow: boolean) => void;
  isOwn:         boolean;
  onDelete:      (id: number) => void;
  onToast:       (msg: string, kind?: "ok" | "error") => void;
}

// Renders all non-internal fields, skipping _-prefixed metadata
function FieldsView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => !k.startsWith("_"));
  return (
    <div className="fields-grid fields-grid--compact">
      {entries.map(([k, v]) => (
        <div className="field-item" key={k}>
          <div className="field-item__key">{labelFor(k)}</div>
          <div className="field-item__value">
            {Array.isArray(v)
              ? v.map((item, i) => <span key={i} className="field-item__tag">{String(item)}</span>)
              : String(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Fusion metadata row shown inside the detail modal
function FusionInfo({ result }: { result: Record<string, unknown> }) {
  if (result._fusion !== true) return null;
  const srcA = result._source_a as { name?: string; type?: string } | undefined;
  const srcB = result._source_b as { name?: string; type?: string } | undefined;
  const nameA = srcA?.name ?? "?";
  const nameB = srcB?.name ?? "?";
  const iconA = srcA?.type ? (TYPE_META[srcA.type as keyof typeof TYPE_META]?.icon ?? "✦") : "✦";
  const iconB = srcB?.type ? (TYPE_META[srcB.type as keyof typeof TYPE_META]?.icon ?? "✦") : "✦";
  return (
    <div className="fusion-info">
      <div className="fusion-info__row">
        <span className="fusion-info__label">Fusión</span>
        <span className="fusion-info__value fusion-badge">✔ Sí</span>
      </div>
      <div className="fusion-info__row">
        <span className="fusion-info__label">Fuente A</span>
        <span className="fusion-info__value">{iconA} {nameA}</span>
      </div>
      <div className="fusion-info__row">
        <span className="fusion-info__label">Fuente B</span>
        <span className="fusion-info__value">{iconB} {nameB}</span>
      </div>
    </div>
  );
}

// Full-detail modal for a post
function PostDetailModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const meta = TYPE_META[post.type];
  const sourceA = post.result._source_a as { name: string; type: string } | undefined;
  const sourceB = post.result._source_b as { name: string; type: string } | undefined;

  return (
    <Modal open onClose={onClose} title={post.title} size="lg">
      <div className="post-detail">
        {/* Badge row */}
        <div className="post-detail__badges">
          <Badge type={post.type} icon={meta.icon} label={meta.label} />
          {post.result._fusion === true && (
            <span className="fusion-badge">✔ Fusión</span>
          )}
        </div>

        {/* Fusion lineage */}
        {sourceA && sourceB && (
          <div className="post-detail__lineage">
            <span className="post-detail__lineage-src">
              {(TYPE_META[sourceA.type as keyof typeof TYPE_META] ?? { icon: "✦" }).icon}&nbsp;{sourceA.name}
            </span>
            <span className="post-detail__lineage-sep">⚗️</span>
            <span className="post-detail__lineage-src">
              {(TYPE_META[sourceB.type as keyof typeof TYPE_META] ?? { icon: "✦" }).icon}&nbsp;{sourceB.name}
            </span>
          </div>
        )}

        {/* Image */}
        {post.image_url && (
          <div className="post-detail__image-wrap">
            <img src={post.image_url} alt={post.title} className="post-detail__image" />
          </div>
        )}

        {/* 3D model */}
        {post.glb_url && (
          <div className="post-3d-viewer post-3d-viewer--modal">
            {/* @ts-ignore */}
            <model-viewer
              src={post.glb_url}
              alt="Modelo 3D"
              auto-rotate
              camera-controls
              shadow-intensity="1"
              environment-image="neutral"
              class="post-3d-viewer__canvas"
            />
          </div>
        )}

        {/* Description */}
        {post.description && (
          <p className="post-detail__desc">{post.description}</p>
        )}

        {/* Fusion metadata (formatted) */}
        <FusionInfo result={post.result} />

        {/* All fields (internal keys filtered) */}
        <FieldsView data={post.result} />

        {/* Meta */}
        <div className="post-detail__meta">
          <span>✍️ {post.author}</span>
          <span>🕒 {timeAgo(post.created_at)}</span>
        </div>
      </div>
    </Modal>
  );
}

export function FeedPost({
  post, followedTags, onTagFilter, onTagToggle,
  isOwn, onDelete, onToast,
}: FeedPostProps) {
  const [showDetail, setShowDetail]         = useState(false);
  const [showCmts, setShowCmts]             = useState(false);
  const [liked, setLiked]                   = useState(post.liked_by_me);
  const [likeCount, setLikeCount]           = useState(post.like_count);
  const [cmtCount, setCmtCount]             = useState(post.comment_count);
  const [showUnshareModal, setShowUnshareModal] = useState(false);

  useEffect(() => {
    apiRecordInteraction(post.id, "view");
  }, [post.id]);

  const meta = TYPE_META[post.type];

  // 100-char preview from the most descriptive field
  const rawPreview = String(
    post.result.personality ?? post.result.objective ?? post.result.description ??
    post.result.summary ?? post.result.special_ability ?? post.result.attack_style ?? ""
  );
  const preview = rawPreview.length > 100 ? rawPreview.slice(0, 100) + "…" : rawPreview;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { data } = await apiToggleLike(post.id);
    if (data) {
      setLiked(data.liked);
      setLikeCount((c) => data.liked ? c + 1 : Math.max(0, c - 1));
    }
  };

  const openUnshare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUnshareModal(true);
  };

  const performUnshare = async () => {
    const { data } = await apiDeletePost(post.id);
    if (data !== null) {
      setShowUnshareModal(false);
      onDelete(post.id);
      onToast("Publicación quitada del feed");
    } else {
      onToast("Error al quitar la publicación", "error");
    }
  };

  const handleOpenDetail = () => {
    setShowDetail(true);
    apiRecordInteraction(post.id, "expand");
  };

  return (
    <article
      className="post-card"
      style={{ "--type-color": meta.color } as React.CSSProperties}
    >
      {/* Accent top border */}
      <div className="post-card__accent" />

      {/* Unshare button — own posts only */}
      {isOwn && (
        <button
          className="post-card__unshare"
          onClick={openUnshare}
          title="Dejar de compartir"
          aria-label="Dejar de compartir"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            <line x1="3" y1="3" x2="21" y2="21" />
          </svg>
          <span className="post-card__unshare-label">Dejar de compartir</span>
        </button>
      )}

      {/* Header row — click arrow to open detail modal */}
      <header className="post-card__header">
        <Badge type={post.type} icon={meta.icon} label={meta.label} small />
        {post.result._fusion === true && (
          <span className="fusion-badge">✔ Fusión</span>
        )}
        <div className="post-card__title-area">
          <h3 className="post-card__title">{post.title}</h3>
          {post.description && (
            <p className="post-card__desc">{post.description}</p>
          )}
        </div>
        <div className="post-card__meta">
          <span className="post-card__author">{post.author}</span>
          <span className="post-card__time">{timeAgo(post.created_at)}</span>
        </div>
        <button
          className="post-card__expand-btn"
          onClick={handleOpenDetail}
          title="Ver detalles completos"
          aria-label="Expandir"
        >
          ▼
        </button>
      </header>

      {/* Image thumbnail */}
      {post.image_url && (
        <div className="post-image-wrap">
          <img src={post.image_url} alt="Hoja de diseño" className="post-image" />
        </div>
      )}

      {/* 100-char preview */}
      {preview && (
        <p className="post-card__preview">{preview}</p>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="post-card__tags">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className={`tag-pill${followedTags.has(tag) ? " tag-pill--followed" : ""}`}
              onClick={(e) => { e.stopPropagation(); onTagToggle(tag, !followedTags.has(tag)); }}
              title={followedTags.has(tag) ? "Dejar de seguir" : "Seguir etiqueta"}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="post-card__footer">
        <button
          className={`like-btn${liked ? " like-btn--active" : ""}`}
          onClick={handleLike}
        >
          {liked ? "❤️" : "🤍"} <span>{likeCount}</span>
        </button>

        <button
          className="comment-btn"
          onClick={(e) => { e.stopPropagation(); setShowCmts((v) => !v); }}
        >
          💬 <span>{cmtCount}</span>
        </button>

        {post.tags.length > 0 && (
          <button
            className="tag-filter-btn"
            onClick={(e) => { e.stopPropagation(); onTagFilter(post.tags[0]!); }}
          >
            # {post.tags[0]}
          </button>
        )}

        <button className="post-card__detail-btn" onClick={handleOpenDetail}>
          Ver más ▼
        </button>
      </div>

      {showCmts && (
        <CommentList postId={post.id} onToast={onToast} />
      )}

      {/* Full detail modal */}
      {showDetail && (
        <PostDetailModal post={post} onClose={() => setShowDetail(false)} />
      )}

      {/* Unshare confirmation modal */}
      <Modal
        open={showUnshareModal}
        onClose={() => setShowUnshareModal(false)}
        title="Dejar de compartir"
        footer={(
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowUnshareModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={performUnshare}>Dejar de compartir</Button>
          </div>
        )}
      >
        <p>¿Quieres dejar de compartir esta publicación en la comunidad? No se eliminará de tu Historial, Favoritos ni Proyectos.</p>
      </Modal>
    </article>
  );
}
