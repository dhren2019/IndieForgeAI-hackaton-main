import {
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

export async function createSocialPost(input: CreatePostInput): Promise<Post> {
  return createPost(input) as Promise<Post>;
}

export async function getSocialPost(postId: number, sessionId: string): Promise<Post | null> {
  return getPostById(postId, sessionId) as Promise<Post | null>;
}

export async function getSocialFeed(sessionId: string, limit = 20): Promise<Post[]> {
  return getFeed(sessionId, limit) as Promise<Post[]>;
}

export async function exploreSocialPosts(
  sessionId: string,
  tag: string | null,
  sort: string,
  limit: number
): Promise<Post[]> {
  return explorePosts(sessionId, tag, sort, limit) as Promise<Post[]>;
}

export async function getTrending(sessionId: string, limit = 20): Promise<Post[]> {
  return getTrendingPosts(sessionId, limit) as Promise<Post[]>;
}

export async function getOwnPosts(sessionId: string): Promise<Post[]> {
  return getMyPosts(sessionId) as Promise<Post[]>;
}

export async function deleteSocialPost(postId: number, sessionId: string): Promise<boolean> {
  const post = await getPostById(postId, sessionId);
  if (!post || post.session_id !== sessionId) return false;
  return deletePost(postId, sessionId);
}

export async function togglePostLike(postId: number, sessionId: string): Promise<boolean> {
  return toggleLike(sessionId, postId);
}

export async function getPostComments(postId: number): Promise<PostComment[]> {
  return getComments(postId) as Promise<PostComment[]>;
}

export async function addPostComment(
  postId: number,
  sessionId: string,
  content: string
): Promise<PostComment> {
  return addComment(sessionId, postId, content) as Promise<PostComment>;
}

export async function followUserTag(sessionId: string, tag: string): Promise<void> {
  await followTag(sessionId, tag);
}

export async function unfollowUserTag(sessionId: string, tag: string): Promise<void> {
  await unfollowTag(sessionId, tag);
}

export async function getUserFollowedTags(sessionId: string): Promise<string[]> {
  return getFollowedTags(sessionId);
}

export async function getPopularTagsList(): Promise<Array<{ tag: string; count: number }>> {
  return getPopularTags();
}

export async function recordUserInteraction(
  sessionId: string,
  postId: number,
  action: UserInteractionType
): Promise<void> {
  await recordInteraction(sessionId, postId, action);
}
