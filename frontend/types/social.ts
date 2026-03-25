import type { GenerationType } from "./generate";

export interface Post {
  id: number;
  session_id: string;
  generation_id: number | null;
  title: string;
  description: string;
  type: GenerationType;
  result: Record<string, unknown>;
  image_url: string | null;
  glb_url: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  tags: string[];
  liked_by_me: boolean;
  author: string;
}

export interface PostComment {
  id: number;
  post_id: number;
  session_id: string;
  author: string;
  content: string;
  created_at: string;
}

export type SocialSubTab = "feed" | "trending" | "explorar" | "misposts";
export type SortMode = "reciente" | "popular";
