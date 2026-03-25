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

export async function apiSaveGenerationGlb(generationId: number, glbUrl: string) {
  return postJSON<{ saved: boolean }>(`/api/generations/${generationId}/glb`, { glb_url: glbUrl }, "PATCH");
}

// ── 3D generation (TRELLIS · InstantMesh · Shap-E) ───────────────
export type ThreeDModelId = "trellis" | "instant-mesh" | "shap-e";

const THREE_D_ENDPOINTS: Record<ThreeDModelId, string> = {
  "trellis":      "/api/trellis",
  "instant-mesh": "/api/instant-mesh",
  "shap-e":       "/api/shap-e",
};

export async function apiGenerate3D(imageUrl: string, model: ThreeDModelId = "trellis") {
  return postJSON<{ glbUrl: string }>(THREE_D_ENDPOINTS[model], { imageUrl });
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
  glb_url?: string | null;
  display_name?: string;
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
// ── Projects ──────────────────────────────────────────────────────────────────
export interface ProjectData {
  id: number;
  name: string;
  emoji: string;
  item_count: number;
  created_at: string;
}

export async function apiGetProjects() {
  return fetcher<ProjectData[]>("/api/projects");
}

export async function apiCreateProject(name: string, emoji = "📁") {
  return postJSON<ProjectData>("/api/projects", { name, emoji });
}

export async function apiUpdateProject(projectId: number, name: string, emoji: string) {
  return postJSON<ProjectData>(`/api/projects/${projectId}`, { name, emoji }, "PATCH");
}

export async function apiDeleteProject(projectId: number) {
  return deleteJSON(`/api/projects/${projectId}`);
}

export async function apiAddToProject(projectId: number, generationId: number) {
  return postJSON("/api/projects/" + projectId + "/items", { generation_id: generationId });
}

export async function apiRemoveFromProject(projectId: number, generationId: number) {
  return deleteJSON(`/api/projects/${projectId}/items/${generationId}`);
}

export async function apiGetProjectItems(projectId: number) {
  return fetcher<import("../types/generate").Generation[]>(`/api/projects/${projectId}/items`);
}

export async function apiGetGenerationProjects(generationId: number) {
  return fetcher<number[]>(`/api/projects/generation/${generationId}`);
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
