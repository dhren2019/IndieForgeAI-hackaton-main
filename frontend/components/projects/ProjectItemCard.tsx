import React, { useEffect, useRef, useState } from "react";
import * as THREE          from "three";
import { OrbitControls }   from "three/examples/jsm/controls/OrbitControls.js";
import { Modal }           from "../ui/Modal";
import { TYPE_META }       from "../../types/generate";
import { getGenerationTitle, getPreviewText, timeAgo } from "../../lib/formatters";
import type { Generation } from "../../types/generate";

// ── Inline GLB viewer ─────────────────────────────────────────────────────────

function GlbViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled   = true;
    container.appendChild(renderer.domElement);

    const scene    = new THREE.Scene();
    scene.background = new THREE.Color(0x10101e);
    const camera   = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 500);
    camera.position.set(0, 1.5, 3.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.autoRotate     = true;
    controls.autoRotateSpeed = 1.8;
    controls.minDistance    = 0.3;
    controls.maxDistance    = 50;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(4, 8, 4);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8080ff, 0.3);
    fill.position.set(-4, 2, -4);
    scene.add(fill);

    // Grid helper
    const grid = new THREE.GridHelper(6, 12, 0x333355, 0x222244);
    scene.add(grid);

    let rafId    = 0;
    let disposed = false;

    const animate = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
      if (disposed) return;
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        if (disposed) return;
        const box    = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3()).length();
        gltf.scene.position.sub(center);
        gltf.scene.position.y += size * 0.01;
        camera.position.set(0, size * 0.35, size * 1.5);
        controls.target.set(0, -size * 0.05, 0);
        controls.update();
        scene.add(gltf.scene);
      });
    });

    const onResize = () => {
      if (!container || disposed) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [url]);

  return <div ref={ref} className="glb-viewer" />;
}

// ── Card component ────────────────────────────────────────────────────────────

const TYPE_BG: Record<string, string> = {
  npc:    "linear-gradient(145deg,#1a1000,#3d2800)",
  quest:  "linear-gradient(145deg,#001428,#0d3060)",
  item:   "linear-gradient(145deg,#001810,#063820)",
  lore:   "linear-gradient(145deg,#120028,#300062)",
  weapon: "linear-gradient(145deg,#1a0000,#3a0000)",
  enemy:  "linear-gradient(145deg,#080808,#1c1c1c)",
};

interface ProjectItemCardProps {
  gen:         Generation;
  isFav:       boolean;
  onFavToggle: (id: number, add: boolean) => void;
}

export function ProjectItemCard({ gen, isFav, onFavToggle }: ProjectItemCardProps) {
  const [showModel, setShowModel] = useState(false);

  const meta        = TYPE_META[gen.type];
  const title       = getGenerationTitle(gen.result, gen.type, gen.id);
  const previewText = getPreviewText(gen.result);
  const bg          = TYPE_BG[gen.type] ?? TYPE_BG.enemy;

  return (
    <article className="proj-item-card">
      {/* Visual area */}
      <div className="proj-item-card__visual" style={{ background: gen.image_url ? undefined : bg }}>
        {gen.image_url && (
          <img src={gen.image_url} alt={title} className="proj-item-card__img" loading="lazy" />
        )}

        {!gen.image_url && (
          <div className="proj-item-card__placeholder" style={{ background: bg }}>
            <span className="proj-item-card__ph-icon" style={{ color: meta.color }}>{meta.icon}</span>
          </div>
        )}

        {/* Gradient overlay for text legibility */}
        <div className="proj-item-card__overlay" />

        {/* Type badge */}
        <span
          className="proj-item-card__type-badge"
          style={{ "--badge-color": meta.color } as React.CSSProperties}
        >
          {meta.icon} {meta.label}
        </span>

        {/* 3D model button */}
        {gen.glb_url && (
          <button
            className="proj-item-card__model-btn"
            onClick={() => setShowModel(true)}
            title="Ver modelo 3D"
          >
            🧊 3D
          </button>
        )}

        {/* Fav toggle */}
        <button
          className={`proj-item-card__fav${isFav ? " proj-item-card__fav--on" : ""}`}
          onClick={() => onFavToggle(gen.id, !isFav)}
          title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          {isFav ? "★" : "☆"}
        </button>
      </div>

      {/* Info strip */}
      <div className="proj-item-card__info">
        <p className="proj-item-card__title" title={title}>{title}</p>
        {previewText && (
          <p className="proj-item-card__preview">
            {previewText.length > 72 ? previewText.slice(0, 72) + "…" : previewText}
          </p>
        )}
        <span className="proj-item-card__date">{timeAgo(gen.created_at)}</span>
      </div>

      {/* 3D model modal */}
      {showModel && gen.glb_url && (
        <Modal open onClose={() => setShowModel(false)} title={`🧊 ${title}`} size="lg">
          <GlbViewer url={gen.glb_url} />
        </Modal>
      )}
    </article>
  );
}
