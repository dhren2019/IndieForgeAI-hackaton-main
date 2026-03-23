import React, { useState } from "react";
import { HistoryList }   from "../components/history/HistoryList";
import { ResultCard }    from "../components/results/ResultCard";
import { PublishModal }  from "../components/social/PublishModal";
import { PageContainer } from "../components/layout/PageContainer";
import { useHistory }    from "../hooks/useHistory";
import { useFavorites }  from "../hooks/useFavorites";
import type { Generation } from "../types/generate";

interface HistoryPageProps {
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

export function HistoryPage({ onToast }: HistoryPageProps) {
  const { history, loading }           = useHistory();
  const { favIds, toggle: toggleFav }  = useFavorites();
  const [selected, setSelected]        = useState<Generation | null>(null);
  const [publishing, setPublishing]    = useState(false);

  return (
    <PageContainer>
      <div className="split-layout">
        <aside className="split-layout__list">
          <h2 className="section-title">Historial de generaciones</h2>
          <HistoryList
            items={history}
            loading={loading}
            onSelect={(g) => { setSelected(g); setPublishing(false); }}
            selectedId={selected?.id}
            emptyMsg="No hay generaciones en el historial"
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
              <div className="empty-state__icon">📜</div>
              <p className="empty-state__text">Selecciona una entrada del historial</p>
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
