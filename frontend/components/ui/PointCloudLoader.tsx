import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

interface PointCloudLoaderProps {
  text?:    string;
  subtext?: string;
}

/**
 * Animated point-cloud terrain rendered with Three.js.
 * Looks like a miniature procedural world map — mountains, valleys, water.
 * Used while the World Creator is loading so users see a living landscape
 * instead of a black screen.
 */
export function PointCloudLoader({
  text    = "La IA está imaginando tu mundo…",
  subtext = "Generando lore, extrayendo parámetros de terreno y preparando el mapa 3D",
}: PointCloudLoaderProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let disposed = false;
    let animFrameId = 0;

    // Defer one rAF so CSS layout has applied → clientWidth/Height are correct
    const initRaf = requestAnimationFrame(() => {
      if (disposed) return;

      const W = el.clientWidth  || 420;
      const H = el.clientHeight || 340;

      // ── Renderer ───────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);
      el.appendChild(renderer.domElement);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
      camera.position.set(0, 6, 10);
      camera.lookAt(0, 0, 0);

      // ── Terrain point cloud (fBm heightmap) ────────────────────────────
      const noise2D    = createNoise2D();
      const GRID       = 120;
      const POINT_COUNT = GRID * GRID;
      const EXTENT     = 8;
      const MAX_H      = 2.8;
      const WATER_LINE = 0.35;

      const positions = new Float32Array(POINT_COUNT * 3);
      const colors    = new Float32Array(POINT_COUNT * 3);

      for (let iz = 0; iz < GRID; iz++) {
        for (let ix = 0; ix < GRID; ix++) {
          const idx = iz * GRID + ix;
          const x   = (ix / (GRID - 1) - 0.5) * EXTENT * 2;
          const z   = (iz / (GRID - 1) - 0.5) * EXTENT * 2;

          // fBm height
          let h = 0, amp = 1, freq = 0.22, maxAmp = 0;
          for (let oct = 0; oct < 6; oct++) {
            h      += amp * noise2D(x * freq, z * freq);
            maxAmp += amp;
            amp    *= 0.48;
            freq   *= 2.1;
          }
          h = ((h / maxAmp) + 1) * 0.5;   // normalise 0..1
          const y = h * MAX_H;

          positions[idx * 3 + 0] = x;
          positions[idx * 3 + 1] = y;
          positions[idx * 3 + 2] = z;

          // Colours mimic the real world-map palette
          let r: number, g: number, b: number;
          if (h < WATER_LINE * 0.6) {
            r = 0.03; g = 0.12; b = 0.35;                         // deep water
          } else if (h < WATER_LINE) {
            r = 0.06; g = 0.25; b = 0.55;                         // shallow water
          } else if (h < WATER_LINE + 0.06) {
            r = 0.72; g = 0.62; b = 0.40;                         // beach / sand
          } else if (h < 0.55) {
            r = 0.14 + Math.random() * 0.08;                      // lowland green
            g = 0.42 + Math.random() * 0.12;
            b = 0.12 + Math.random() * 0.05;
          } else if (h < 0.72) {
            r = 0.28 + Math.random() * 0.08;                      // highland
            g = 0.30 + Math.random() * 0.08;
            b = 0.14;
          } else if (h < 0.88) {
            r = 0.38; g = 0.36; b = 0.32;                         // rock
          } else {
            r = 0.88; g = 0.92; b = 0.98;                         // snow cap
          }
          colors[idx * 3 + 0] = r;
          colors[idx * 3 + 1] = g;
          colors[idx * 3 + 2] = b;
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color",    new THREE.BufferAttribute(colors,    3));

      const material = new THREE.PointsMaterial({
        size: 0.10, vertexColors: true, transparent: true, opacity: 0.92, sizeAttenuation: true,
      });
      const terrain = new THREE.Points(geometry, material);
      scene.add(terrain);

      // ── Water shimmer points ───────────────────────────────────────────
      const WATER_PTS = 3000;
      const wPos = new Float32Array(WATER_PTS * 3);
      const wCol = new Float32Array(WATER_PTS * 3);
      for (let i = 0; i < WATER_PTS; i++) {
        wPos[i * 3 + 0] = (Math.random() - 0.5) * EXTENT * 2;
        wPos[i * 3 + 1] = WATER_LINE * MAX_H + (Math.random() - 0.5) * 0.06;
        wPos[i * 3 + 2] = (Math.random() - 0.5) * EXTENT * 2;
        wCol[i * 3 + 0] = 0.08;
        wCol[i * 3 + 1] = 0.32 + Math.random() * 0.15;
        wCol[i * 3 + 2] = 0.65 + Math.random() * 0.15;
      }
      const waterGeo = new THREE.BufferGeometry();
      waterGeo.setAttribute("position", new THREE.BufferAttribute(wPos, 3));
      waterGeo.setAttribute("color",    new THREE.BufferAttribute(wCol, 3));
      const waterMat = new THREE.PointsMaterial({
        size: 0.12, vertexColors: true, transparent: true, opacity: 0.55, sizeAttenuation: true,
      });
      scene.add(new THREE.Points(waterGeo, waterMat));

      // ── Background stars ───────────────────────────────────────────────
      const STAR_N = 800;
      const sPos = new Float32Array(STAR_N * 3);
      for (let i = 0; i < STAR_N; i++) {
        sPos[i * 3 + 0] = (Math.random() - 0.5) * 60;
        sPos[i * 3 + 1] = 5 + Math.random() * 30;
        sPos[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.06, color: 0x8899cc, transparent: true, opacity: 0.35,
      });
      scene.add(new THREE.Points(starGeo, starMat));

      // ── Animate ────────────────────────────────────────────────────────
      let t = 0;
      const animate = () => {
        if (disposed) return;
        animFrameId = requestAnimationFrame(animate);
        t += 0.006;

        // Orbit camera around the terrain
        camera.position.x = Math.sin(t * 0.4) * 10;
        camera.position.z = Math.cos(t * 0.4) * 10;
        camera.position.y = 5.5 + Math.sin(t * 0.25) * 1.2;
        camera.lookAt(0, 0.8, 0);

        // Shimmer
        waterMat.opacity = 0.45 + Math.sin(t * 2.5) * 0.10;
        material.opacity = 0.82 + Math.sin(t * 1.0) * 0.10;

        renderer.render(scene, camera);
      };
      animate();

      // ── Resize ─────────────────────────────────────────────────────────
      const ro = new ResizeObserver(() => {
        if (disposed) return;
        const w = el.clientWidth  || 420;
        const h = el.clientHeight || 340;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(el);

      // Store teardown so the outer cleanup can call it
      cleanupRef.current = () => {
        disposed = true;
        cancelAnimationFrame(animFrameId);
        ro.disconnect();
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        waterGeo.dispose();
        waterMat.dispose();
        starGeo.dispose();
        starMat.dispose();
        if (renderer.domElement.parentNode === el) {
          el.removeChild(renderer.domElement);
        }
      };
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(initRaf);
      cancelAnimationFrame(animFrameId);
      cleanupRef.current?.();
    };
  }, []);

  return (
    <div className="wc-pointcloud">
      <div ref={mountRef} className="wc-pointcloud__canvas" />
      <div className="wc-pointcloud__text-wrap">
        <p className="wc-loading__text">{text}</p>
        <p className="wc-loading__sub">{subtext}</p>
      </div>
    </div>
  );
}
