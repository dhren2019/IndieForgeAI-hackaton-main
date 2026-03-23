import type { Generation, GenerationType } from "../types/generate";
import type { Post, PostComment }          from "../types/social";
import { fetcher, postJSON, deleteJSON }   from "./fetcher";

// ── Generate ─────────────────────────────────────────────────────────────────
export async function apiGenerate(
  type: GenerationType,
  meta: Record<string, string>,
  model?: string
) {
  return postJSON<Generation>("/api/generate", { type, ...meta, ...(model ? { model } : {}) });
}

// ── History ───────────────────────────────────────────────────────────────────
export async function apiHistory(limit = 30) {
  return fetcher<Generation[]>(`/api/history?limit=${limit}`);
}

// ── Favorites ─────────────────────────────────────────────────────────────────
export async function apiFavorites() {
  return fetcher<Generation[]>("/api/favorites");
}

export async function apiAddFavorite(generationId: number) {
  return postJSON("/api/favorite", { generation_id: generationId });
}

export async function apiRemoveFavorite(generationId: number) {
  return deleteJSON("/api/favorite", { generation_id: generationId });
}

// ── Image ─────────────────────────────────────────────────────────────────────
export async function apiGenerateImage(type: GenerationType, result: Record<string, unknown>) {
  return postJSON<{ url: string; prompt: string }>("/api/imagen", { type, result });
}

export async function apiSaveGenerationImage(generationId: number, imageUrl: string) {
  return postJSON<{ saved: boolean }>(`/api/generations/${generationId}/image`, { image_url: imageUrl }, "PATCH");
}

// ── TRELLIS 3D generation ─────────────────────────────────────────
export async function apiGenerate3D(imageUrl: string) {
  return postJSON<{ glbUrl: string }>("/api/trellis", { imageUrl });
}

// ── Social Feed ───────────────────────────────────────────────────────────────
export async function apiFeed(limit = 20) {
  return fetcher<Post[]>(`/api/social/feed?limit=${limit}`);
}

export async function apiTrending(limit = 20) {
  return fetcher<Post[]>(`/api/social/trending?limit=${limit}`);
}

export async function apiExplore(
  tag: string | null,
  sort = "reciente",
  limit = 20
) {
  const params = new URLSearchParams({ limit: String(limit), sort });
  if (tag) params.set("tag", tag);
  return fetcher<Post[]>(`/api/social/explore?${params}`);
}

export async function apiMyPosts() {
  return fetcher<Post[]>("/api/social/misposts");
}

// ── Social Posts ──────────────────────────────────────────────────────────────
export async function apiCreatePost(data: {
  title: string;
  description: string;
  type: GenerationType;
  result: Record<string, unknown>;
  tags: string[];
  generation_id?: number;
  image_url?: string | null;
}) {
  return postJSON<Post>("/api/social/posts", data);
}

export async function apiToggleLike(postId: number) {
  return postJSON<{ liked: boolean }>(`/api/social/posts/${postId}/like`, {});
}

export async function apiDeletePost(postId: number) {
  return deleteJSON(`/api/social/posts/${postId}`);
}

// ── Comments ──────────────────────────────────────────────────────────────────
export async function apiGetComments(postId: number) {
  return fetcher<PostComment[]>(`/api/social/posts/${postId}/comentarios`);
}

export async function apiAddComment(postId: number, content: string) {
  return postJSON<PostComment>(`/api/social/posts/${postId}/comentarios`, { content });
}

// ── Tags ──────────────────────────────────────────────────────────────────────
export async function apiFollowedTags() {
  return fetcher<string[]>("/api/social/tags/siguiendo");
}

export async function apiPopularTags() {
  return fetcher<Array<{ tag: string; count: number }>>("/api/social/tags/populares");
}

export async function apiFollowTag(tag: string) {
  return postJSON("/api/social/tags/seguir", { tag });
}

export async function apiUnfollowTag(tag: string) {
  return postJSON("/api/social/tags/dejar", { tag });
}

// ── Interactions ──────────────────────────────────────────────────────────────
export async function apiRecordInteraction(
  postId: number,
  action: "view" | "expand" | "like" | "comment"
) {
  return postJSON("/api/social/interactions", { post_id: postId, action });
}
