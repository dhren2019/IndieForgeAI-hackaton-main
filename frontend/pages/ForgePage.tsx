import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAppState } from "../state/app-state";
import { useHistory }  from "../hooks/useHistory";
import { apiForge }    from "../lib/api";
import { ForgeAnimation }        from "../components/ui/ForgeAnimation";
import { ForgeResultDisplay }    from "../components/results/ForgeResultDisplay";
import { Card }                  from "../components/ui/Card";
import { Button }                from "../components/ui/Button";
import { SummonCircle }          from "../components/ui/SummonCircle";
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
  const [resultReady, setResultReady] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether SummonCircle was ever active in the current forge session.
  // If the API responds before the ForgeAnimation ends, SummonCircle is never
  // activated so we skip the reveal gate and show the card immediately.
  const summonActivatedRef = useRef(false);

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
    setResultReady(false);
    summonActivatedRef.current = false;

    // Safety: if animation never fires onComplete, stop after 12 s
    animTimeoutRef.current = setTimeout(() => {
      setAnimating(false);
      setForging(false);
    }, 12_000);

    const { data, error } = await apiForge(slotA.id, slotB.id, selectedModel);

    // Let animation finish before showing result
    if (data) {
      setResult(data);
      setForging(false);
    } else {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      onToast(error || "Error al fusionar", "error");
      setAnimating(false);
      setForging(false);
    }
  };

  // Stable callback — only stop the animation; forging stays true until API responds
  const handleAnimComplete = useCallback(() => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    setAnimating(false);
    // forging stays true until handleForge resolves or safety timeout fires
  }, []);

  // Show toast and scroll once reveal animation is done AND result has arrived
  useEffect(() => {
    if (!animating && result && resultReady) {
      onToast("¡Fusión legendaria completada! 🔥", "ok");
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating, result, resultReady]);

  // Track whether SummonCircle actually became active this session.
  useEffect(() => {
    if (forging && !animating && !result) {
      summonActivatedRef.current = true;
    }
  }, [forging, animating, result]);

  // Fallback: if the API responded while ForgeAnimation was still playing,
  // SummonCircle was never activated and onRevealDone won’t fire — show result directly.
  useEffect(() => {
    if (result && !animating && !resultReady && !summonActivatedRef.current) {
      setResultReady(true);
    }
  }, [result, animating, resultReady]);

  const handleReset = () => {
    setSlotA(null);
    setSlotB(null);
    setResult(null);
    setResultReady(false);
    summonActivatedRef.current = false;
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

      {/* SummonCircle: arcane invocation animation while API is pending.
          When active goes false (result arrives), SummonCircle runs its
          reveal flash, then calls onRevealDone to unlock the result card. */}
      <SummonCircle
        active={forging && !animating && !result}
        type={slotA?.type ?? slotB?.type ?? "npc"}
        onRevealDone={() => setResultReady(true)}
      />

      {/* Fusion result — shown only after the SummonCircle reveal flash completes */}
      {result && !animating && resultReady && (
        <div ref={resultRef}>
          <ForgeResultDisplay gen={result} onReset={handleReset} onToast={onToast} />
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
