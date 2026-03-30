import React, { useRef, useEffect, useState } from "react";

interface ForgeAnimationProps {
  active: boolean;
  typeA?: string;
  typeB?: string;
  onComplete?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  npc:    "#f59e0b",
  quest:  "#3b82f6",
  item:   "#10b981",
  lore:   "#8b5cf6",
  weapon: "#ef4444",
  enemy:  "#6b7280",
};

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  type: "spark" | "ember" | "rune";
  char?: string;
}

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛇᛉᛊᛏᛒᛖᛗᛚᛝᛟᛞ";

export function ForgeAnimation({ active, typeA = "npc", typeB = "weapon", onComplete }: ForgeAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [phase, setPhase] = useState<"idle" | "converge" | "clash" | "forge" | "reveal">("idle");

  useEffect(() => {
    if (active) {
      setPhase("converge");
    } else {
      setPhase("idle");
    }
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const colorA = TYPE_COLORS[typeA] || "#f59e0b";
    const colorB = TYPE_COLORS[typeB] || "#ef4444";

    const particles: Particle[] = [];
    let t = 0;
    let phaseStart = 0;
    let currentPhase = phase;

    // Orb positions
    let orbAx = 0, orbAy = 0;
    let orbBx = 0, orbBy = 0;
    const cx = () => W / 2;
    const cy = () => H / 2;

    function spawnSpark(x: number, y: number, color: string) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        maxLife: 30 + Math.random() * 40,
        size: 1 + Math.random() * 3,
        color,
        type: "spark",
      });
    }

    function spawnEmber(x: number, y: number, color: string) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 2,
        life: 1,
        maxLife: 60 + Math.random() * 60,
        size: 2 + Math.random() * 4,
        color,
        type: "ember",
      });
    }

    function spawnRune(x: number, y: number, color: string) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x, y,
        vx: Math.cos(angle) * 0.5,
        vy: Math.sin(angle) * 0.5,
        life: 1,
        maxLife: 80 + Math.random() * 40,
        size: 12 + Math.random() * 8,
        color,
        type: "rune",
        char: RUNES[Math.floor(Math.random() * RUNES.length)],
      });
    }

    function drawOrb(x: number, y: number, radius: number, color: string, pulse: number) {
      const r = radius + Math.sin(t * 0.05) * 3 * pulse;
      // Outer glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
      grad.addColorStop(0, color + "60");
      grad.addColorStop(0.4, color + "20");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.3, color + "ee");
      coreGrad.addColorStop(1, color + "44");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawForgeRing(progress: number) {
      const centerX = cx();
      const centerY = cy();
      const maxR = Math.min(W, H) * 0.3;

      // Rotating hexagonal forge ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(t * 0.02);

      const sides = 6;
      for (let ring = 0; ring < 3; ring++) {
        const r = maxR * (0.4 + ring * 0.2) * progress;
        const alpha = (0.6 - ring * 0.15) * progress;
        ctx.strokeStyle = `rgba(255, 140, 40, ${alpha})`;
        ctx.lineWidth = 2 - ring * 0.5;
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
          const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();

      // Inner fusion glow
      const fuseGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxR * 0.6 * progress);
      fuseGrad.addColorStop(0, `rgba(255, 200, 60, ${0.3 * progress})`);
      fuseGrad.addColorStop(0.5, `rgba(255, 100, 20, ${0.15 * progress})`);
      fuseGrad.addColorStop(1, "transparent");
      ctx.fillStyle = fuseGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxR * 0.6 * progress, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawAnvil() {
      const centerX = cx();
      const centerY = cy() + 30;
      ctx.fillStyle = "#2a2a3a";
      // Anvil body
      ctx.beginPath();
      ctx.moveTo(centerX - 40, centerY);
      ctx.lineTo(centerX - 50, centerY + 15);
      ctx.lineTo(centerX + 50, centerY + 15);
      ctx.lineTo(centerX + 40, centerY);
      ctx.closePath();
      ctx.fill();
      // Anvil top
      ctx.fillStyle = "#3a3a4e";
      ctx.beginPath();
      ctx.moveTo(centerX - 35, centerY);
      ctx.lineTo(centerX - 45, centerY - 8);
      ctx.lineTo(centerX + 55, centerY - 8);
      ctx.lineTo(centerX + 35, centerY);
      ctx.closePath();
      ctx.fill();
      // Highlight edge
      ctx.strokeStyle = "rgba(255,180,60,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 45, centerY - 8);
      ctx.lineTo(centerX + 55, centerY - 8);
      ctx.stroke();
    }

    function drawHammerStrike(progress: number) {
      const centerX = cx();
      const centerY = cy();
      // Radial shockwave
      const maxR = Math.min(W, H) * 0.4;
      const r = maxR * progress;
      const alpha = 1 - progress;
      ctx.strokeStyle = `rgba(255, 220, 100, ${alpha})`;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();

      // Flash
      if (progress < 0.3) {
        const flashAlpha = (1 - progress / 0.3) * 0.6;
        ctx.fillStyle = `rgba(255, 255, 240, ${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    function tick() {
      t++;
      ctx.clearRect(0, 0, W, H);

      // Background heat shimmer
      if (currentPhase !== "idle") {
        const heatAlpha = currentPhase === "reveal" ? 0.04 : 0.02;
        ctx.fillStyle = `rgba(255, 100, 20, ${heatAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      const phaseDuration = t - phaseStart;

      if (currentPhase === "converge") {
        // Two orbs approach center
        const progress = Math.min(phaseDuration / 120, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const startAx = W * 0.15;
        const startBx = W * 0.85;
        orbAx = startAx + (cx() - startAx - 25) * ease;
        orbAy = cy() + Math.sin(t * 0.04) * 8;
        orbBx = startBx + (cx() - startBx + 25) * ease;
        orbBy = cy() + Math.cos(t * 0.04) * 8;

        drawOrb(orbAx, orbAy, 22, colorA, 1);
        drawOrb(orbBx, orbBy, 22, colorB, 1);

        // Trail sparks
        if (t % 3 === 0) {
          spawnSpark(orbAx, orbAy, colorA);
          spawnSpark(orbBx, orbBy, colorB);
        }

        // Connecting energy arc
        if (progress > 0.3) {
          const arcAlpha = (progress - 0.3) / 0.7;
          ctx.strokeStyle = `rgba(255, 200, 100, ${arcAlpha * 0.3})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(orbAx, orbAy);
          ctx.quadraticCurveTo(cx(), cy() - 30 + Math.sin(t * 0.1) * 10, orbBx, orbBy);
          ctx.stroke();
        }

        if (progress >= 1) {
          currentPhase = "clash";
          phaseStart = t;
        }
      } else if (currentPhase === "clash") {
        // Impact flash and explosion
        const progress = Math.min(phaseDuration / 60, 1);
        drawHammerStrike(progress);
        drawAnvil();

        // Explosion sparks
        if (phaseDuration < 15 && t % 2 === 0) {
          for (let i = 0; i < 8; i++) {
            spawnSpark(cx(), cy(), i % 2 === 0 ? colorA : colorB);
            spawnEmber(cx(), cy(), i % 2 === 0 ? "#ff8c28" : "#ffcc44");
          }
          for (let i = 0; i < 3; i++) {
            spawnRune(cx(), cy(), i % 2 === 0 ? colorA : colorB);
          }
        }

        if (progress >= 1) {
          currentPhase = "forge";
          phaseStart = t;
        }
      } else if (currentPhase === "forge") {
        // Sustained forge with rotating rings, embers, anvil
        const progress = Math.min(phaseDuration / 200, 1);
        drawAnvil();
        drawForgeRing(Math.min(progress * 2, 1));

        // Continuous embers rising
        if (t % 4 === 0) {
          spawnEmber(cx() + (Math.random() - 0.5) * 60, cy(), Math.random() > 0.5 ? colorA : colorB);
          spawnSpark(cx() + (Math.random() - 0.5) * 40, cy() - 10, "#ffcc44");
        }

        // Rune pulses
        if (t % 30 === 0) {
          spawnRune(cx() + (Math.random() - 0.5) * 80, cy() + (Math.random() - 0.5) * 60, "#ff8c28");
        }

        // Central fusion orb growing
        const fuseR = 10 + progress * 25;
        const mixColor = `rgba(255, ${160 + progress * 60}, ${40 + progress * 80}, ${0.5 + progress * 0.3})`;
        drawOrb(cx(), cy() - 15, fuseR, mixColor, 2);

        if (progress >= 1) {
          currentPhase = "reveal";
          phaseStart = t;
        }
      } else if (currentPhase === "reveal") {
        const progress = Math.min(phaseDuration / 80, 1);

        // Big white flash
        if (progress < 0.2) {
          const flashAlpha = (1 - progress / 0.2) * 0.8;
          ctx.fillStyle = `rgba(255, 255, 250, ${flashAlpha})`;
          ctx.fillRect(0, 0, W, H);
        }

        // Expanding golden ring
        const ringR = Math.min(W, H) * 0.4 * progress;
        const ringAlpha = 1 - progress;
        ctx.strokeStyle = `rgba(255, 200, 80, ${ringAlpha})`;
        ctx.lineWidth = 4 * (1 - progress);
        ctx.beginPath();
        ctx.arc(cx(), cy(), ringR, 0, Math.PI * 2);
        ctx.stroke();

        // Shower of golden sparks upward
        if (phaseDuration < 30 && t % 2 === 0) {
          for (let i = 0; i < 6; i++) {
            spawnSpark(cx() + (Math.random() - 0.5) * 100, cy() + (Math.random() - 0.5) * 60, "#ffdd66");
            spawnEmber(cx() + (Math.random() - 0.5) * 120, cy(), "#ff9933");
          }
        }

        // Final result orb
        const finalR = 30 * progress;
        const grad = ctx.createRadialGradient(cx(), cy(), 0, cx(), cy(), finalR);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.4, "#ffdd88");
        grad.addColorStop(1, "#ff880033");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx(), cy(), finalR, 0, Math.PI * 2);
        ctx.fill();

        if (progress >= 1) {
          onComplete?.();
          currentPhase = "idle";
        }
      }

      // Update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // gravity
        p.life -= 1 / p.maxLife;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = p.life;

        if (p.type === "spark") {
          ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "ember") {
          ctx.fillStyle = p.color + Math.round(alpha * 180).toString(16).padStart(2, "0");
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
          ctx.fill();
          // Glow
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (p.type === "rune" && p.char) {
          ctx.font = `${p.size}px serif`;
          ctx.fillStyle = p.color + Math.round(alpha * 200).toString(16).padStart(2, "0");
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.char, p.x, p.y);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    if (phase !== "idle") {
      phaseStart = 0;
      currentPhase = phase;
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [phase, typeA, typeB, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="forge-animation__canvas"
      style={{ display: active ? "block" : "none" }}
    />
  );
}
