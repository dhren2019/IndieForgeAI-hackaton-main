import React, { useEffect, useRef, useState } from "react";

/**
 * SummonCircle — Animación "Invocación Épica" estilo RPG.
 *
 * Muestra un círculo arcano con runas girando, partículas de energía y
 * un destello final cuando la generación termina. Pensado para el flujo
 * de generación principal, dando un efecto "gacha summon" a la creación
 * de NPCs, armas, enemigos, etc.
 */

interface SummonCircleProps {
  /** true while the AI is generating */
  active: boolean;
  /** fired once the reveal flash animation ends */
  onRevealDone?: () => void;
  /** generation type — changes the accent colour */
  type?: string;
}

// Runic alphabet for the rotating circle
const RUNES = "ᚠᚢᚦᚨᚱᚲᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᛡᛣᛥᛧᛨ";

const TYPE_COLOURS: Record<string, string> = {
  npc:    "#a855f7",
  quest:  "#3b82f6",
  item:   "#f59e0b",
  lore:   "#10b981",
  weapon: "#ef4444",
  enemy:  "#dc2626",
};

export function SummonCircle({ active, onRevealDone, type = "npc" }: SummonCircleProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "summoning" | "reveal" | "done">("idle");
  const phaseRef   = useRef(phase);
  phaseRef.current = phase;
  const prevActiveRef = useRef(active);

  // Transition: idle → summoning when active becomes true
  // Transition: summoning → reveal when active becomes false
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      setPhase("summoning");
    }
    if (!active && prevActiveRef.current && phaseRef.current === "summoning") {
      setPhase("reveal");
      // After flash, mark done
      const t = setTimeout(() => {
        setPhase("done");
        onRevealDone?.();
        // Reset to idle after done so it can fire again
        setTimeout(() => setPhase("idle"), 600);
      }, 900);
      return () => clearTimeout(t);
    }
    prevActiveRef.current = active;
  }, [active, onRevealDone]);

  // Canvas animation
  useEffect(() => {
    if (phase !== "summoning" && phase !== "reveal") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let frameId  = 0;
    let t        = 0;

    const accent = TYPE_COLOURS[type] ?? "#a855f7";

    // particles
    interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; }
    const particles: Particle[] = [];

    const addParticle = (cx: number, cy: number, radius: number) => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = radius * (0.7 + Math.random() * 0.5);
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -Math.random() * 1.2 - 0.3,
        life: 0,
        maxLife: 40 + Math.random() * 40,
        size: 1.5 + Math.random() * 2.5,
      });
    };

    const DPR = Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * DPR;
      canvas.height = rect.height * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const animate = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(animate);
      t += 0.02;

      const W  = canvas.width  / DPR;
      const H  = canvas.height / DPR;
      const cx = W / 2;
      const cy = H / 2;
      const R  = Math.min(W, H) * 0.36;

      ctx.clearRect(0, 0, W, H);

      const isReveal = phaseRef.current === "reveal";
      const pulse    = isReveal ? 1.0 : 0.5 + Math.sin(t * 2) * 0.25;

      // ── Outer glow ─────────────────────────────────────────────────
      const grd = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
      grd.addColorStop(0, accent + (isReveal ? "55" : "18"));
      grd.addColorStop(0.5, accent + "08");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // ── Concentric circles ─────────────────────────────────────────
      for (let i = 0; i < 3; i++) {
        const r  = R * (0.65 + i * 0.2);
        const lw = i === 1 ? 2 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = accent + (isReveal ? "cc" : Math.round(pulse * 120).toString(16).padStart(2, "0"));
        ctx.lineWidth   = lw;
        ctx.stroke();
      }

      // ── Rotating runes on middle circle ────────────────────────────
      const runeR     = R * 0.85;
      const runeCount = 18;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.3);
      ctx.font      = `${R * 0.14}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < runeCount; i++) {
        const a   = (i / runeCount) * Math.PI * 2;
        const rx  = Math.cos(a) * runeR;
        const ry  = Math.sin(a) * runeR;
        const idx = (i + Math.floor(t * 2)) % RUNES.length;
        ctx.fillStyle = accent + (isReveal ? "ff" : Math.round((0.4 + Math.sin(t * 3 + i) * 0.3) * 255).toString(16).padStart(2, "0"));
        ctx.fillText(RUNES[idx], rx, ry);
      }
      ctx.restore();

      // ── Inner rotating rune ring (counter direction) ───────────────
      const innerR     = R * 0.5;
      const innerCount = 12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.5);
      ctx.font = `${R * 0.10}px serif`;
      for (let i = 0; i < innerCount; i++) {
        const a   = (i / innerCount) * Math.PI * 2;
        const rx  = Math.cos(a) * innerR;
        const ry  = Math.sin(a) * innerR;
        const idx = (i + Math.floor(t * 3) + 7) % RUNES.length;
        ctx.fillStyle = accent + "88";
        ctx.fillText(RUNES[idx], rx, ry);
      }
      ctx.restore();

      // ── Crosshair lines ────────────────────────────────────────────
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.15);
      ctx.strokeStyle = accent + "30";
      ctx.lineWidth   = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
        ctx.lineTo(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05);
        ctx.stroke();
      }
      ctx.restore();

      // ── Center emblem ──────────────────────────────────────────────
      ctx.save();
      ctx.translate(cx, cy);
      const emblemR = R * 0.18;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + t * 0.4;
        const m = i === 0 ? "moveTo" : "lineTo";
        (ctx as any)[m](Math.cos(a) * emblemR, Math.sin(a) * emblemR);
      }
      ctx.closePath();
      ctx.fillStyle   = accent + "30";
      ctx.strokeStyle = accent + (isReveal ? "ff" : "88");
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // ── Particles ──────────────────────────────────────────────────
      if (Math.random() < (isReveal ? 0.95 : 0.35)) {
        addParticle(cx, cy, R);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x    += p.vx;
        p.y    += p.vy;
        p.life += 1;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        const alpha = 1 - p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = accent + Math.round(alpha * 200).toString(16).padStart(2, "0");
        ctx.fill();
      }

      // ── Reveal flash ───────────────────────────────────────────────
      if (isReveal) {
        const flashAlpha = Math.max(0, 1 - (t % 3) * 0.7);
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();
    };
  }, [phase, type]);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div className={`summon-circle ${phase === "reveal" ? "summon-circle--reveal" : ""}`}>
      <canvas ref={canvasRef} className="summon-circle__canvas" />
      {phase === "summoning" && (
        <p className="summon-circle__text">Invocando…</p>
      )}
    </div>
  );
}
