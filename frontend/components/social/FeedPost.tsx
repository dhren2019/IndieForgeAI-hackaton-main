import React, { useState, useEffect } from "react";
import { Badge }       from "../ui/Badge";
import { CommentList } from "./CommentList";
import { ImagePreview } from "../results/ImagePreview";
import { apiToggleLike, apiDeletePost, apiRecordInteraction } from "../../lib/api";
import { timeAgo, labelFor } from "../../lib/formatters";
import { TYPE_META }   from "../../types/generate";
import type { Post }   from "../../types/social";

interface FeedPostProps {
  post:          Post;
  followedTags:  Set<string>;
  onTagFilter:   (tag: string) => void;
  onTagToggle:   (tag: string, follow: boolean) => void;
  isOwn:         boolean;
  onDelete:      (id: number) => void;
  onToast:       (msg: string, kind?: "ok" | "error") => void;
}

function FieldsView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="fields-grid fields-grid--compact">
      {Object.entries(data).map(([k, v]) => (
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

export function FeedPost({
  post, followedTags, onTagFilter, onTagToggle,
  isOwn, onDelete, onToast,
}: FeedPostProps) {
  const [expanded, setExpanded]   = useState(false);
  const [showCmts, setShowCmts]   = useState(false);
  const [liked, setLiked]         = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [cmtCount, setCmtCount]   = useState(post.comment_count);

  useEffect(() => {
    apiRecordInteraction(post.id, "view");
  }, [post.id]);

  const meta    = TYPE_META[post.type];
  const preview = String(
    post.result.personality ?? post.result.objective ?? post.result.description ??
    post.result.summary ?? post.result.special_ability ?? post.result.attack_style ?? ""
  );

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { data } = await apiToggleLike(post.id);
    if (data) {
      setLiked(data.liked);
      setLikeCount((c) => data.liked ? c + 1 : Math.max(0, c - 1));
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Quitar esta publicación del feed?\nTu contenido seguirá disponible en Historial, Favoritos y Proyectos.")) return;
    const { data } = await apiDeletePost(post.id);
    if (data !== null) { onDelete(post.id); onToast("Publicación quitada del feed"); }
    else onToast("Error al quitar la publicación", "error");
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) apiRecordInteraction(post.id, "expand");
  };

  return (
    <article
      className="post-card"
      style={{ "--type-color": meta.color } as React.CSSProperties}
    >
      {/* Accent top border via CSS var */}
      <div className="post-card__accent" />

      {/* Header row */}
      <header className="post-card__header" onClick={handleExpand}>
        <Badge type={post.type} icon={meta.icon} label={meta.label} small />
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
        <span className="post-card__chevron">{expanded ? "▲" : "▼"}</span>
      </header>

      {/* Image */}
      {post.image_url && (
        <div className="post-image-wrap">
          <img src={post.image_url} alt="Hoja de diseño" className="post-image" />
        </div>
      )}

      {/* 3D model viewer */}
      {post.glb_url && (
        <div className="post-3d-viewer">
          {/* @ts-ignore custom element */}
          <model-viewer
            src={post.glb_url}
            alt="Modelo 3D"
            auto-rotate
            camera-controls
            shadow-intensity="1"
            environment-image="neutral"
            class="post-3d-viewer__canvas"
          />
          <div className="post-3d-viewer__hint">🖱 Arrastra para rotar · Scroll para zoom</div>
          <a href={post.glb_url} download="personaje-3d.glb" className="post-glb-download">
            ⬇ Descargar modelo 3D (.glb)
          </a>
        </div>
      )}

      {/* Preview snippet (collapsed) */}
      {!expanded && preview && (
        <p className="post-card__preview">{preview}</p>
      )}

      {/* Full body (expanded) */}
      {expanded && (
        <div className="post-card__body">
          <FieldsView data={post.result} />
          {post.generation_id && (
            <ImagePreview type={post.type} result={post.result} />
          )}
        </div>
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
          onClick={(e) => { e.stopPropagation(); setShowCmts((v) => !v); setCmtCount(cmtCount); }}
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

        {isOwn && (
          <button className="delete-btn" onClick={handleDelete} title="Quitar del feed (el contenido se conserva)">
            ✖ Dejar de compartir
          </button>
        )}
      </div>

      {showCmts && (
        <CommentList postId={post.id} onToast={onToast} />
      )}
    </article>
  );
}
