import React, { useState, useEffect, useCallback } from "react";
import { useAppState } from "../state/app-state";
import { useHistory }  from "../hooks/useHistory";
import { apiForge }    from "../lib/api";
import { ForgeAnimation } from "../components/ui/ForgeAnimation";
import { ResultCard }     from "../components/results/ResultCard";
import { Card }           from "../components/ui/Card";
import { Button }         from "../components/ui/Button";
import { Badge }          from "../components/ui/Badge";
import { ModelSelector }  from "../components/generate/ModelSelector";
import { Modal }          from "../components/ui/Modal";
import { TYPE_META }      from "../types/generate";
import { getGenerationTitle } from "../lib/formatters";
import type { Generation }    from "../types/generate";
import type { AiModelId }     from "../types/generate";
import type { ToastMessage }  from "../types/ui";

interface ForgePageProps {
  onToast: (msg: string, kind?: ToastMessage["kind"]) => void;
}

type Slot = "A" | "B";

function SlotCard({
  slot,
  gen,
  onPick,
  onClear,
}: {
  slot: Slot;
  gen: Generation | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!gen) {
    return (
      <button className="forge-slot forge-slot--empty" onClick={onPick}>
        <span className="forge-slot__icon">{slot === "A" ? "⚡" : "🌀"}</span>
        <span className="forge-slot__label">Seleccionar creación {slot}</span>
        <span className="forge-slot__hint">Toca para elegir del historial</span>
      </button>
    );
  }

  const meta = TYPE_META[gen.type];
  const title = getGenerationTitle(gen.result, gen.type, gen.id);
  return (
    <div className="forge-slot forge-slot--filled">
      <div className="forge-slot__header">
        <Badge type={gen.type} icon={meta.icon} label={meta.label} />
        <button className="forge-slot__clear" onClick={onClear} title="Quitar">✕</button>
      </div>
      <div className="forge-slot__title">{title}</div>
      {gen.image_url && (
        <img src={gen.image_url} alt={title} className="forge-slot__image" />
      )}
      <button className="forge-slot__change" onClick={onPick}>Cambiar</button>
    </div>
  );
}

function PickerModal({
  open,
  history,
  loading,
  exclude,
  onPick,
  onClose,
}: {
  open: boolean;
  history: Generation[];
  loading: boolean;
  exclude: number | null;
  onPick: (gen: Generation) => void;
  onClose: () => void;
}) {
  const items = history.filter((g) => g.id !== exclude && g.type !== ("worldmap" as string));

  return (
    <Modal open={open} onClose={onClose} title="🔥 Seleccionar creación" size="lg">
      {loading && <div className="forge-picker__loading">Cargando historial…</div>}
      {!loading && items.length === 0 && (
        <div className="forge-picker__empty">
          No hay creaciones disponibles. Genera algo primero en la página de Generar.
        </div>
      )}
      <div className="forge-picker__grid">
        {items.map((gen) => {
          const meta = TYPE_META[gen.type];
          const title = getGenerationTitle(gen.result, gen.type, gen.id);
          return (
            <button
              key={gen.id}
              className="forge-picker__item"
              onClick={() => onPick(gen)}
            >
              {gen.image_url && (
                <img src={gen.image_url} alt={title} className="forge-picker__thumb" />
              )}
              <div className="forge-picker__info">
                <Badge type={gen.type} icon={meta.icon} label={meta.label} small />
                <span className="forge-picker__name">{title}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function ForgePage({ onToast }: ForgePageProps) {
  const { selectedModel, setSelectedModel } = useAppState();
  const { history, loading: histLoading, reload } = useHistory();

  const [slotA, setSlotA] = useState<Generation | null>(null);
  const [slotB, setSlotB] = useState<Generation | null>(null);
  const [picking, setPicking] = useState<Slot | null>(null);
  const [forging, setForging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);

  useEffect(() => { reload(); }, [reload]);

  const handlePick = useCallback((gen: Generation) => {
    if (picking === "A") setSlotA(gen);
    else setSlotB(gen);
    setPicking(null);
  }, [picking]);

  const canForge = slotA && slotB && !forging;

  const handleForge = async () => {
    if (!slotA || !slotB) return;
    setForging(true);
    setAnimating(true);
    setResult(null);

    const { data, error } = await apiForge(slotA.id, slotB.id, selectedModel);

    // Let animation finish before showing result
    if (data) {
      setResult(data);
    } else {
      onToast(error || "Error al fusionar", "error");
      setAnimating(false);
      setForging(false);
    }
  };

  const handleAnimComplete = () => {
    setAnimating(false);
    setForging(false);
    if (result) {
      onToast("¡Fusión legendaria completada! 🔥", "ok");
    }
  };

  const handleReset = () => {
    setSlotA(null);
    setSlotB(null);
    setResult(null);
  };

  return (
    <div className="forge-page">
      {/* Header */}
      <div className="forge-page__header">
        <h1 className="forge-page__title">
          <span className="forge-page__title-icon">🔥</span>
          Fusion Forge
        </h1>
        <p className="forge-page__subtitle">
          Selecciona dos creaciones y fusiónalas en un híbrido legendario con IA
        </p>
      </div>

      {/* Forge Area */}
      <div className="forge-area">
        {/* Slot A */}
        <div className="forge-area__slot">
          <SlotCard
            slot="A"
            gen={slotA}
            onPick={() => setPicking("A")}
            onClear={() => setSlotA(null)}
          />
        </div>

        {/* Center: Forge Button + Animation */}
        <div className="forge-area__center">
          {animating ? (
            <div className="forge-area__animation-wrap">
              <ForgeAnimation
                active={animating}
                typeA={slotA?.type}
                typeB={slotB?.type}
                onComplete={handleAnimComplete}
              />
            </div>
          ) : (
            <>
              <div className="forge-area__versus">
                <span className="forge-area__cross">✦</span>
              </div>
              <Button
                variant="primary"
                size="lg"
                disabled={!canForge}
                loading={forging && !animating}
                onClick={handleForge}
                className="forge-area__btn"
              >
                🔥 FORJAR FUSIÓN
              </Button>
              <div className="forge-area__model-row">
                <ModelSelector value={selectedModel} onChange={setSelectedModel} />
              </div>
            </>
          )}
        </div>

        {/* Slot B */}
        <div className="forge-area__slot">
          <SlotCard
            slot="B"
            gen={slotB}
            onPick={() => setPicking("B")}
            onClear={() => setSlotB(null)}
          />
        </div>
      </div>

      {/* Fusion result */}
      {result && !animating && (
        <div className="forge-result">
          <div className="forge-result__badge">⚗️ RESULTADO DE FUSIÓN</div>
          <ResultCard
            gen={result}
            isFav={false}
            onFavToggle={() => {}}
            showActions={false}
          />
          <Button variant="secondary" onClick={handleReset} className="forge-result__reset">
            🔄 Nueva fusión
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!slotA && !slotB && !result && (
        <Card className="forge-page__intro">
          <h3>⚔️ ¿Cómo funciona?</h3>
          <ol className="forge-page__steps">
            <li><strong>Selecciona</strong> dos creaciones de tu historial (NPCs, armas, objetos, enemigos…)</li>
            <li><strong>Pulsa FORJAR</strong> y la IA fusionará ambas en un híbrido épico nunca visto</li>
            <li><strong>Descubre</strong> la nueva creación con rasgos, habilidades y lore fusionados</li>
          </ol>
          <div className="forge-page__combos">
            <span className="forge-page__combo">🧙 + 🗡️ = Guerrero legendario</span>
            <span className="forge-page__combo">💎 + 💀 = Reliquia maldita</span>
            <span className="forge-page__combo">⚔️ + 📜 = Misión épica con lore</span>
          </div>
        </Card>
      )}

      {/* Picker modal */}
      <PickerModal
        open={picking !== null}
        history={history}
        loading={histLoading}
        exclude={picking === "A" ? slotB?.id ?? null : slotA?.id ?? null}
        onPick={handlePick}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}
