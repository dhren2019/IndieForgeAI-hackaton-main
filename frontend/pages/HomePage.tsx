import React, { useState } from "react";
import { GenerateForm }  from "../components/generate/GenerateForm";
import { ResultCard }    from "../components/results/ResultCard";
import { PublishModal }  from "../components/social/PublishModal";
import { PageContainer } from "../components/layout/PageContainer";
import { useAppState }   from "../state/app-state";
import { useGenerate }   from "../hooks/useGenerate";
import { useFavorites }  from "../hooks/useFavorites";
import type { GenerationType } from "../types/generate";

interface HomePageProps {
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

export function HomePage({ onToast }: HomePageProps) {
  const { latest, setLatest, setTab, selectedModel, setSelectedModel } = useAppState();
  const { generate, loading, error }    = useGenerate();
  const { favIds, toggle: toggleFav }   = useFavorites();
  const [publishing, setPublishing]     = useState(false);

  const handleGenerate = async (type: GenerationType, meta: Record<string, string>, model: string) => {
    const result = await generate(type, meta, model);
    if (result) { setLatest(result); onToast("\u00a1Generado exitosamente! \u2728"); }
    else         onToast(error ?? "Error al generar", "error");
  };

  return (
    <PageContainer>
      <div className="home-layout">
        <section className="home-layout__form">
          <GenerateForm
            onGenerate={handleGenerate}
            loading={loading}
            model={selectedModel}
            onModelChange={setSelectedModel}
          />
        </section>

        {latest && (
          <section className="home-layout__result">
            <ResultCard
              gen={latest}
              isFav={favIds.has(latest.id)}
              onFavToggle={(id, add) => {
                toggleFav(id, add);
                onToast(add ? "Guardado en favoritos" : "Eliminado de favoritos");
              }}
              onShare={() => setPublishing(true)}
            />
          </section>
        )}
      </div>

      {publishing && latest && (
        <PublishModal
          gen={latest}
          onClose={() => setPublishing(false)}
          onPublished={() => setTab("social")}
          onToast={onToast}
        />
      )}
    </PageContainer>
  );
}
