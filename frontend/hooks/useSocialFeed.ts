import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiFeed, apiTrending, apiExplore, apiMyPosts, apiFollowedTags, apiPopularTags, apiFollowTag, apiUnfollowTag } from "../lib/api";
import type { Post, SocialSubTab, SortMode } from "../types/social";

export function useSocialFeed() {
  const [posts, setPosts]               = useState<Post[]>([]);
  const [loading, setLoading]           = useState(false);
  const [subTab, setSubTab]             = useState<SocialSubTab>("feed");
  const [sortMode, setSortMode]         = useState<SortMode>("reciente");
  const [filterTag, setFilterTag]       = useState<string | null>(null);
  const [followedTags, setFollowedTags] = useState<Set<string>>(new Set());
  const [popularTags, setPopularTags]   = useState<Array<{ tag: string; count: number }>>([]);
  const { userId, isLoaded } = useAuth();

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setPosts([]);  // Clear stale posts immediately when switching tabs
    let data: Post[] | null = null;

    if (subTab === "feed")          ({ data } = await apiFeed());
    else if (subTab === "trending") ({ data } = await apiTrending());
    else if (subTab === "explorar") ({ data } = await apiExplore(filterTag, sortMode));
    else                            ({ data } = await apiMyPosts());

    setPosts(data ?? []);  // Always update, even on error (clears stale state)
    setLoading(false);
  }, [subTab, filterTag, sortMode]);

  const loadMeta = useCallback(async () => {
    const [tags, popular] = await Promise.all([apiFollowedTags(), apiPopularTags()]);
    if (tags.data)    setFollowedTags(new Set(tags.data));
    if (popular.data) setPopularTags(popular.data);
  }, []);

  // Re-fetch when auth changes (sign in / sign out affects "Mis Posts" and tags)
  useEffect(() => { if (isLoaded) loadPosts(); }, [loadPosts, isLoaded, userId]);
  useEffect(() => { if (isLoaded) loadMeta(); },  [loadMeta, isLoaded, userId]);

  const toggleTag = async (tag: string, follow: boolean) => {
    if (follow) {
      await apiFollowTag(tag);
      setFollowedTags((s) => new Set(s).add(tag));
    } else {
      await apiUnfollowTag(tag);
      setFollowedTags((s) => { const n = new Set(s); n.delete(tag); return n; });
    }
  };

  const filterByTag = (tag: string) => {
    setFilterTag(tag);
    setSubTab("explorar");
  };

  const removePost = (id: number) => setPosts((p) => p.filter((x) => x.id !== id));

  return {
    posts, loading, subTab, sortMode, filterTag,
    followedTags, popularTags,
    setSubTab, setSortMode, setFilterTag,
    toggleTag, filterByTag, removePost, loadPosts,
  };
}
