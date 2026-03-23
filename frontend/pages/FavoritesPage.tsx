import React, { useState } from "react";
import { FavoriteList }  from "../components/favorites/FavoriteList";
import { ResultCard }    from "../components/results/ResultCard";
import { PublishModal }  from "../components/social/PublishModal";
import { PageContainer } from "../components/layout/PageContainer";
import { useFavorites }  from "../hooks/useFavorites";
import type { Generation } from "../types/generate";

interface FavoritesPageProps {
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

export function FavoritesPage({ onToast }: FavoritesPageProps) {
  const { favorites, loading, favIds, toggle: toggleFav } = useFavorites();
  const [selected, setSelected]   = useState<Generation | null>(null);
  const [publishing, setPublishing] = useState(false);

  return (
    <PageContainer>
      <div className="split-layout">
        <aside className="split-layout__list">
          <h2 className="section-title">Favoritos</h2>
          <FavoriteList
            items={favorites}
            loading={loading}
            onSelect={(g) => { setSelected(g); setPublishing(false); }}
            selectedId={selected?.id}
          />
        </aside>

        <main className="split-layout__detail">
          {selected ? (
            <ResultCard
              gen={selected}
              isFav={favIds.has(selected.id)}
              onFavToggle={(id, add) => {
                toggleFav(id, add);
                onToast(add ? "Guardado en favoritos" : "Eliminado de favoritos");
              }}
              onShare={() => setPublishing(true)}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">⭐</div>
              <p className="empty-state__text">Selecciona un favorito para verlo</p>
            </div>
          )}
        </main>
      </div>

      {publishing && selected && (
        <PublishModal
          gen={selected}
          onClose={() => setPublishing(false)}
          onPublished={() => onToast("Publicado ✨")}
          onToast={onToast}
        />
      )}
    </PageContainer>
  );
}
