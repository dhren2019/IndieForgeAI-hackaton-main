import React, { useState, useRef } from "react";
import { PageContainer }   from "../components/layout/PageContainer";
import { WorldMapPanel }   from "../components/results/WorldMap3D";
import { Button }          from "../components/ui/Button";
import { Loader }          from "../components/ui/Loader";
import type { WorldMapParams } from "../components/results/WorldMap3D";

interface WorldCreatorPageProps {
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

const EXAMPLES = [
  "Un reino de volcanes activos donde dragones de obsidiana custodian templos subterráneos llenos de lava y ruinas antiguas",
  "Bosques mágicos eternos donde los árboles brillan de noche y los elfos construyeron ciudades en las copas. La niebla cubre el suelo y esconde criaturas ancestrales",
  "Tundra helada con torres de hielo negro que emergen de la nieve. Los muertos caminan bajo las auroras boreales",
  "Pantanos traicioneros de color verde putrefacto, llenos de ruinas hundidas de una civilización ahogada. Cocodrilos gigantes patrullan las aguas oscuras",
  "Desierto de dunas doradas con pirámides enterradas hasta la mitad. Bajo la arena duerme un dios olvidado",
];

export function WorldCreatorPage({ onToast }: WorldCreatorPageProps) {
  const [prompt,      setPrompt]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [params,      setParams]      = useState<WorldMapParams | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCreate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) { onToast("Escribe una descripción del mundo primero", "error"); return; }
    setLoading(true);
    setDescription(null);
    setParams(null);

    try {
      const res = await fetch("/api/worldmap", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: trimmed }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json() as { data: { description: string; params: WorldMapParams } };
      setDescription(json.data.description);
      setParams(json.data.params);
      onToast("¡Mundo generado! 🌍");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Error de red", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (ex: string) => {
    setPrompt(ex);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreate();
  };

  return (
    <div className="page-bg-wrap">
      <div className="social-bg" aria-hidden="true">
        <div className="social-bg__orb social-bg__orb--1" />
        <div className="social-bg__orb social-bg__orb--2" />
        <div className="social-bg__orb social-bg__orb--3" />
        <div className="social-bg__orb social-bg__orb--4" />
        <div className="social-bg__grid" />
      </div>

      <PageContainer>
        <div className="page-hero">
          <h1 className="page-hero__title">🌍 World Creator</h1>
          <p className="page-hero__sub">
            Describe tu mundo en palabras. La IA lo imaginará y construirá un mapa 3D interactivo en tiempo real.
          </p>
        </div>

        {/* Prompt area */}
        <div className="wc-prompt-card">
          <div className="wc-prompt-card__header">
            <span className="wc-prompt-card__icon">✍️</span>
            <span className="wc-prompt-card__title">Describe tu mundo</span>
            <span className="wc-prompt-card__hint">Ctrl + Enter para generar</span>
          </div>

          <textarea
            ref={textareaRef}
            className="wc-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Un vasto reino de montañas nevadas donde antiguos dioses duermen bajo la roca..."
            rows={5}
            maxLength={800}
            disabled={loading}
          />

          <div className="wc-prompt-card__footer">
            <span className="wc-char-count">{prompt.length}/800</span>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              onClick={handleCreate}
              disabled={!prompt.trim() || loading}
              icon="🗺️"
            >
              Crear Mundo
            </Button>
          </div>
        </div>

        {/* Examples */}
        {!params && (
          <div className="wc-examples">
            <span className="wc-examples__label">Inspiración rápida:</span>
            <div className="wc-examples__chips">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  className="wc-example-chip"
                  onClick={() => handleExample(ex)}
                  disabled={loading}
                >
                  {ex.slice(0, 52)}…
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="wc-loading">
            <Loader size="lg" />
            <p className="wc-loading__text">La IA está imaginando tu mundo...</p>
            <p className="wc-loading__sub">Generando lore, extrayendo parámetros de terreno y preparando el mapa 3D</p>
          </div>
        )}

        {/* AI description */}
        {description && !loading && (
          <div className="wc-description">
            <div className="wc-description__header">
              <span className="wc-description__icon">📜</span>
              <span className="wc-description__title">El mundo que la IA imaginó</span>
            </div>
            <p className="wc-description__text">{description}</p>
          </div>
        )}

        {/* 3D Map Panel */}
        {params && !loading && (
          <div className="wc-map-section">
            <WorldMapPanel params={params} />
          </div>
        )}
      </PageContainer>
    </div>
  );
}
