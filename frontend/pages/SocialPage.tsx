import React from "react";
import { FeedList }      from "../components/social/FeedList";
import { PageContainer } from "../components/layout/PageContainer";
import { Sidebar, SidebarSection } from "../components/layout/Sidebar";
import { Tabs }          from "../components/ui/Tabs";
import { Loader }        from "../components/ui/Loader";
import { useSocialFeed } from "../hooks/useSocialFeed";
import type { SocialSubTab, SortMode } from "../types/social";

interface SocialPageProps {
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

const SUB_TABS: { id: SocialSubTab; label: string; icon: string }[] = [
  { id: "feed",      label: "Feed",          icon: "🏠" },
  { id: "trending",  label: "Tendencias",    icon: "🔥" },
  { id: "explorar",  label: "Explorar",      icon: "🔍" },
  { id: "misposts",  label: "Mis posts",     icon: "👤" },
];

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "reciente", label: "Recientes"   },
  { id: "popular",  label: "Populares"   },
];

export function SocialPage({ onToast }: SocialPageProps) {
  const {
    posts, loading, subTab, sortMode, filterTag,
    followedTags, popularTags,
    setSubTab, setSortMode, setFilterTag,
    toggleTag, removePost,
  } = useSocialFeed();

  // Derive own session id from cookie if present
  const mySessionId = document.cookie
    .split("; ")
    .find((r) => r.startsWith("session_id="))
    ?.split("=")[1] ?? "";

  return (
    <PageContainer wide={true}>
      <div className="social-layout">
        {/* Main area */}
        <div className="social-layout__main">
          <Tabs
            tabs={SUB_TABS}
            active={subTab}
            onChange={(id) => setSubTab(id as SocialSubTab)}
            variant="sub"
          />

          {filterTag && (
            <div className="tag-filter-bar">
              <span>Filtrando por <strong>#{filterTag}</strong></span>
              <button className="tag-filter-bar__clear" onClick={() => setFilterTag(null)}>
                ✕ Quitar filtro
              </button>
            </div>
          )}

          {subTab !== "misposts" && (
            <div className="sort-bar">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className={`sort-btn ${sortMode === o.id ? "sort-btn--active" : ""}`}
                  onClick={() => setSortMode(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <FeedList
            posts={posts}
            loading={loading}
            followedTags={followedTags}
            onTagFilter={(tag) => { setFilterTag(tag); setSubTab("explorar"); }}
            onTagToggle={toggleTag}
            ownSessionId={mySessionId}
            onDelete={(id) => { removePost(id); onToast("Publicación eliminada"); }}
            onToast={onToast}
          />
        </div>

        {/* Sidebar */}
        <Sidebar>
          {followedTags.size > 0 && (
            <SidebarSection title="Mis etiquetas">
              <div className="sidebar-tags">
                {[...followedTags].map((t) => (
                  <button
                    key={t}
                    className="tag-pill tag-pill--followed"
                    onClick={() => { setFilterTag(t); setSubTab("explorar"); }}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </SidebarSection>
          )}

          {popularTags.length > 0 && (
            <SidebarSection title="Tendencias">
              <div className="sidebar-tags">
                {popularTags.slice(0, 10).map((t) => (
                  <button
                    key={t.tag}
                    className={`tag-pill ${followedTags.has(t.tag) ? "tag-pill--followed" : ""}`}
                    onClick={() => { setFilterTag(t.tag); setSubTab("explorar"); }}
                    title={`${t.count} posts`}
                  >
                    #{t.tag}
                    <span className="tag-pill__count">{t.count}</span>
                  </button>
                ))}
              </div>
            </SidebarSection>
          )}
        </Sidebar>
      </div>
    </PageContainer>
  );
}
