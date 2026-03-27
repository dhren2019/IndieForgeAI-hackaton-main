import React, { useEffect, useRef, useState } from "react";
import * as THREE          from "three";
import { OrbitControls }   from "three/examples/jsm/controls/OrbitControls.js";
import { Modal }           from "../ui/Modal";
import { WorldMapPanel }   from "../results/WorldMap3D";
import type { WorldMapParams } from "../results/WorldMap3D";
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

// ── WorldMap biome color preview ──────────────────────────────────────────────

const BIOME_LABELS_CARD: Record<string, string> = {
  forest: "Bosque", desert: "Desierto", tundra: "Tundra", swamp: "Pantano",
  volcanic: "Volcánico", ocean: "Océano", plains: "Llanuras", mountains: "Montañas",
  dungeon: "Mazmorra", mystic: "Místico", jungle: "Jungla", savanna: "Sabana",
  glacier: "Glaciar", canyon: "Cañón", mushroom: "Bosque Hongos", wasteland: "Páramo",
  sky: "Cielos", infernal: "Infierno", city: "Ciudad", town: "Pueblo",
  village_biome: "Aldea", farmland: "Cultivos", coast: "Costa", arctic: "Ártico",
  badlands: "Badlands", rainforest: "Selva Tropical", steppe: "Estepa",
  underground: "Subterráneo",
};

function WorldMapPreview({ result }: { result: Record<string, unknown> }) {
  const c1    = String(result.terrain_color_1 ?? "336633");
  const c2    = String(result.terrain_color_2 ?? "234523");
  const c3    = String(result.terrain_color_3 ?? "557755");
  const sky   = String(result.sky_color       ?? "1a2840");
  const water = String(result.water_color     ?? "153060");
  const biome = String(result.biome           ?? "");
  const label = BIOME_LABELS_CARD[biome] ?? biome;

  const gradient = `linear-gradient(180deg,
    #${sky} 0%,
    #${sky} 25%,
    #${c3} 38%,
    #${c2} 52%,
    #${c1} 65%,
    #${water} 68%,
    #${water} 100%)`;

  return (
    <div className="proj-item-card__world-preview" style={{ background: gradient }}>
      {/* Stylized mountain silhouette */}
      <svg className="proj-item-card__world-mountains" viewBox="0 0 100 40" preserveAspectRatio="none">
        <polygon points="0,40 15,18 28,28 42,10 58,25 72,14 85,22 100,40" fill={`#${c2}`} opacity="0.9" />
        <polygon points="0,40 10,24 22,32 35,16 50,30 64,20 78,27 90,35 100,40" fill={`#${c1}`} opacity="0.8" />
      </svg>
      {label && <span className="proj-item-card__world-biome-tag">{label}</span>}
    </div>
  );
}

// ── Expand detail modal content ───────────────────────────────────────────────

function ExpandModal({ gen, title, onClose }: {
  gen:     Generation;
  title:   string;
  onClose: () => void;
}) {
  const isWorldMap = gen.type === "worldmap";
  const has3D      = !!gen.glb_url;
  const previewText = getPreviewText(gen.result);

  if (isWorldMap) {
    const params = gen.result as unknown as WorldMapParams;
    return (
      <Modal open onClose={onClose} title={`🌍 ${title}`} size="xl">
        <div className="proj-expand__world">
          <WorldMapPanel params={params} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="proj-expand__content">
        {gen.image_url && (
          <img src={gen.image_url} alt={title} className="proj-expand__img" />
        )}
        {has3D && (
          <GlbViewer url={gen.glb_url!} />
        )}
        {previewText && (
          <p className="proj-expand__desc">{previewText}</p>
        )}
        {!gen.image_url && !has3D && !previewText && (
          <pre className="proj-expand__json">
            {JSON.stringify(gen.result, null, 2)}
          </pre>
        )}
      </div>
    </Modal>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

const TYPE_BG: Record<string, string> = {
  npc:      "linear-gradient(145deg,#1a1000,#3d2800)",
  quest:    "linear-gradient(145deg,#001428,#0d3060)",
  item:     "linear-gradient(145deg,#001810,#063820)",
  lore:     "linear-gradient(145deg,#120028,#300062)",
  weapon:   "linear-gradient(145deg,#1a0000,#3a0000)",
  enemy:    "linear-gradient(145deg,#080808,#1c1c1c)",
  worldmap: "linear-gradient(145deg,#001a20,#003040)",
};

interface ProjectItemCardProps {
  gen:         Generation;
  isFav:       boolean;
  onFavToggle: (id: number, add: boolean) => void;
}

export function ProjectItemCard({ gen, isFav, onFavToggle }: ProjectItemCardProps) {
  const [showModel,  setShowModel]  = useState(false);
  const [showExpand, setShowExpand] = useState(false);

  const meta        = TYPE_META[gen.type as keyof typeof TYPE_META] ?? { icon: "🌍", label: gen.type, color: "#22d3ee" };
  const title       = getGenerationTitle(gen.result, gen.type, gen.id);
  const previewText = getPreviewText(gen.result);
  const bg          = TYPE_BG[gen.type] ?? TYPE_BG.enemy;
  const isWorldMap  = gen.type === "worldmap";

  return (
    <article className="proj-item-card">
      {/* Visual area */}
      <div className="proj-item-card__visual" style={{ background: gen.image_url ? undefined : bg }}>
        {gen.image_url && (
          <img src={gen.image_url} alt={title} className="proj-item-card__img" loading="lazy" />
        )}

        {!gen.image_url && isWorldMap && (
          <WorldMapPreview result={gen.result} />
        )}

        {!gen.image_url && !isWorldMap && (
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

        {/* 3D model button (only when no expand would show 3D anyway) */}
        {gen.glb_url && !isWorldMap && (
          <button
            className="proj-item-card__model-btn"
            onClick={() => setShowModel(true)}
            title="Ver modelo 3D"
          >
            🧊 3D
          </button>
        )}

        {/* Expand / open button — top-left */}
        <button
          className="proj-item-card__expand"
          onClick={() => setShowExpand(true)}
          title={isWorldMap ? "Explorar mapa" : "Ampliar"}
          aria-label="Ampliar"
        >
          ⛶
        </button>

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

      {/* 3D model modal (standalone) */}
      {showModel && gen.glb_url && (
        <Modal open onClose={() => setShowModel(false)} title={`🧊 ${title}`} size="lg">
          <GlbViewer url={gen.glb_url} />
        </Modal>
      )}

      {/* Expand modal */}
      {showExpand && (
        <ExpandModal gen={gen} title={title} onClose={() => setShowExpand(false)} />
      )}
    </article>
  );
}
