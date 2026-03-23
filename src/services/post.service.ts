import {
  getDB,
  createPost,
  getPostById,
  getFeed,
  explorePosts,
  getTrendingPosts,
  getMyPosts,
  deletePost,
  toggleLike,
  addComment,
  getComments,
  followTag,
  unfollowTag,
  getFollowedTags,
  getPopularTags,
  recordInteraction,
} from "../db/client";
import type { Post, PostComment, CreatePostInput, UserInteractionType } from "../types/social";

export function createSocialPost(input: CreatePostInput): Post {
  return createPost(getDB(), input) as Post;
}

export function getSocialPost(postId: number, sessionId: string): Post | null {
  return getPostById(getDB(), postId, sessionId) as Post | null;
}

export function getSocialFeed(sessionId: string, limit = 20): Post[] {
  return getFeed(getDB(), sessionId, limit) as Post[];
}

export function exploreSocialPosts(
  sessionId: string,
  tag: string | null,
  sort: string,
  limit: number
): Post[] {
  return explorePosts(getDB(), sessionId, tag, sort, limit) as Post[];
}

export function getTrending(sessionId: string, limit = 20): Post[] {
  return getTrendingPosts(getDB(), sessionId, limit) as Post[];
}

export function getOwnPosts(sessionId: string): Post[] {
  return getMyPosts(getDB(), sessionId) as Post[];
}

export function deleteSocialPost(postId: number, sessionId: string): boolean {
  const post = getPostById(getDB(), postId, sessionId);
  if (!post || post.session_id !== sessionId) return false;
  deletePost(getDB(), postId, sessionId);
  return true;
}

export function togglePostLike(postId: number, sessionId: string): boolean {
  return toggleLike(getDB(), sessionId, postId) as boolean;
}

export function getPostComments(postId: number): PostComment[] {
  return getComments(getDB(), postId) as PostComment[];
}

export function addPostComment(
  postId: number,
  sessionId: string,
  content: string
): PostComment {
  return addComment(getDB(), sessionId, postId, content) as PostComment;
}

export function followUserTag(sessionId: string, tag: string): void {
  followTag(getDB(), sessionId, tag);
}

export function unfollowUserTag(sessionId: string, tag: string): void {
  unfollowTag(getDB(), sessionId, tag);
}

export function getUserFollowedTags(sessionId: string): string[] {
  return getFollowedTags(getDB(), sessionId) as string[];
}

export function getPopularTagsList(): Array<{ tag: string; count: number }> {
  return getPopularTags(getDB()) as Array<{ tag: string; count: number }>;
}

export function recordUserInteraction(
  sessionId: string,
  postId: number,
  action: UserInteractionType
): void {
  recordInteraction(getDB(), sessionId, postId, action);
}
