import React from "react";
import { FeedPost } from "./FeedPost";
import { FeedSkeleton } from "../ui/Skeletons";
import type { Post } from "../../types/social";

interface FeedListProps {
  posts:        Post[];
  loading:      boolean;
  followedTags: Set<string>;
  onTagFilter:  (tag: string) => void;
  onTagToggle:  (tag: string, follow: boolean) => void;
  ownSessionId: string;
  onDelete:     (id: number) => void;
  onToast:      (msg: string, kind?: "ok" | "error") => void;
}

export function FeedList({
  posts, loading, followedTags, onTagFilter, onTagToggle,
  ownSessionId, onDelete, onToast,
}: FeedListProps) {
  if (loading) return <FeedSkeleton />;

  if (posts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📭</div>
        <p className="empty-state__text">No hay publicaciones aquí todavía.</p>
      </div>
    );
  }

  return (
    <div className="feed-list">
      {posts.map((p) => (
        <FeedPost
          key={p.id}
          post={p}
          followedTags={followedTags}
          onTagFilter={onTagFilter}
          onTagToggle={onTagToggle}
          isOwn={p.session_id === ownSessionId}
          onDelete={onDelete}
          onToast={onToast}
        />
      ))}
    </div>
  );
}
