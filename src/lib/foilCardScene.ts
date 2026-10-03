import type * as THREE_NS from 'three';
import { CARD_ASPECT, type FoilCard, backText, layer, message, mk, rng } from './foilCards';

/**
 * The About page's cards, as objects — one folded card on a table, lit, that
 * can be turned in the hand and opened.
 *
 * A card is two thin boards hinged down the left edge. Each of its four faces
 * is baked from lib/foilCards.ts's masks into two textures: the colour, and a
 * data map carrying height (the stamp's relief), roughness and metalness — so
 * foil is a real mirror-ish metal pressed into matte cotton, and the light
 * finds it as the card moves. The light is a small studio built in code:
 * softboxes for the foil to reflect, one key light for the shadow, and a glint
 * that follows the pointer.
 *
 * The scene owns its canvas (appended to the stage it is given) and its own
 * frame loop. It reports back only what the page needs to label its buttons.
 * Three.js loads on demand from `create()`, so only this page pays for it.
 */

// The card in world units — 5 × 7 in — and the board's thickness.
const CW = 1;
const CH = CARD_ASPECT;
const CT = 0.009;
// How far the cover swings.
const OPEN_ANGLE = (164 * Math.PI) / 180;
// Depth of the stamp, in world units. three reads a bump map per screen pixel,
// so this is scaled by the card's size on screen every frame — otherwise the
// relief would deepen as the card got smaller.
const BUMP_DEPTH = 0.0042;
const EXPOSURE = 0.98;
const MAX_PIXEL_RATIO = 2;
const FOV = 30;

// The studio. Colours are linear, as lights are.
const SKY = 0xffffff;
const FLOOR_BOUNCE = 0xb8b0a2;
const KEY = 0xfff4e6;
const WARM_STRIP = 0xffe6c8;
const TABLE = 0xd9d4ca;
const ROOM = 0x0a0a0b;
const HEMI_INTENSITY = 1.73;
const KEY_INTENSITY = 3.93;
// The glint that rides the pointer: candela, reach, falloff.
const GLINT: [number, number, number] = [4, 7, 2];
// The cast shadow and the soft contact patch under the card, before
// --card-shadow-strength.
const SHADOW_OPACITY = 0.16;
const CONTACT_OPACITY = 0.5;

// Seconds: the cover's swing, and a card leaving and arriving.
const OPEN_TIME = 0.95;
const SWAP_OUT = 0.32;
const SWAP_IN = 0.55;
// Pointer travel before a press is a turn rather than a tap, and radians of
// turn per px after that.
const TAP_SLOP_PX = 6;
const TURN_PER_PX = 0.009;
// Left alone this long, the card drifts on its own so the foil keeps moving.
const IDLE_MS = 2600;

export interface FoilSceneState {
  index: number;
  open: boolean;
  /** Showing its back. */
  turned: boolean;
}

export interface FoilSceneOptions {
  cards: FoilCard[];
  index: number;
  /** Texture width, px — the height follows from the card. */
  textureWidth: number;
  /** The shadow's colour, `R G B` channels (--color-shadow), and its strength
      (--card-shadow-strength). */
  shadow: string;
  shadowStrength: number;
  onState: (state: FoilSceneState) => void;
  /** The first card is on the table. */
  onReady: () => void;
}

type Three = typeof THREE_NS;

interface Face {
  col: HTMLCanvasElement;
  dat: HTMLCanvasElement;
}

interface FaceSpec {
  stock: string;
  foil?: string;
  ink?: string;
  foilMask?: HTMLCanvasElement;
  inkMask?: HTMLCanvasElement;
  debossMask?: HTMLCanvasElement;
}

interface BuiltCard {
  group: THREE_NS.Group;
  pivot: THREE_NS.Group;
  meshes: THREE_NS.Mesh[];
  /** The four printed faces — the ones with relief. */
  faces: THREE_NS.MeshStandardMaterial[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// One macrotask, so a long bake is broken up and the page can paint between.
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve));

/** Smooth noise, one byte per texel: paper grain, and the foil's crinkle. */
function noiseField(w: number, h: number, cell: number, seed: number) {
  const small = mk(Math.ceil(w / cell), Math.ceil(h / cell));
  const sx = small.getContext('2d')!;
  const id = sx.createImageData(small.width, small.height);
  const r = rng(seed);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = r() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  sx.putImageData(id, 0, 0);
  const big = mk(w, h);
  const bx = big.getContext('2d', { willReadFrequently: true })!;
  bx.imageSmoothingQuality = 'high';
  bx.drawImage(small, 0, 0, w, h);
  const d = bx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = d[i];
  return out;
}

function alphaOf(mask: HTMLCanvasElement | undefined) {
  if (!mask) return null;
  const d = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height).data;
  const a = new Uint8Array(mask.width * mask.height);
  for (let i = 3, j = 0; j < a.length; i += 4, j++) a[j] = d[i];
  return a;
}

export class FoilCardScene {
  private readonly three: Three;
  private readonly stage: HTMLElement;
  private readonly options: FoilSceneOptions;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE_NS.WebGLRenderer;
  private readonly scene: THREE_NS.Scene;
  private readonly camera: THREE_NS.PerspectiveCamera;
  private readonly root: THREE_NS.Group;
  private readonly holder: THREE_NS.Group;
  private readonly contact: THREE_NS.Mesh;
  private readonly glint: THREE_NS.PointLight;
  private readonly panel: THREE_NS.BoxGeometry;
  private readonly environment: THREE_NS.WebGLRenderTarget;
  private readonly statics: { dispose: () => void }[] = [];
  private readonly observer: ResizeObserver;
  private readonly reduced: boolean;
  private readonly texW: number;
  private readonly texH: number;
  private readonly anisotropy: number;

  private grain: Uint8Array | null = null;
  private crink: Uint8Array | null = null;
  private card: BuiltCard | null = null;
  private cur: number;
  private built = -1;
  private ready = false;
  private disposed = false;

  private openP = 0;
  private openTarget = 0;
  private yaw = 0;
  private yawTarget = 0;
  private camDist = 0;
  private swap: { phase: 'out' | 'in'; t: number; dir: number; next: number } | null = null;
  private pending: { i: number; dir: number } | null = null;

  private readonly pointer = { x: 0, y: 0 };
  private readonly smooth = { x: 0, y: 0 };
  private lastMove = -1e9;
  private drag: { x: number; yaw: number; moved: boolean } | null = null;
  private last = 0;
  private raf = 0;

  /** Null where WebGL (or three) isn't available — the page shows flat cards. */
  static async create(stage: HTMLElement, options: FoilSceneOptions): Promise<FoilCardScene | null> {
    if (typeof window === 'undefined') return null;
    try {
      const three = await import('three');
      return new FoilCardScene(three, stage, options);
    } catch (error) {
      console.warn('[FoilCardScene] WebGL unavailable, showing the flat cards.', error);
      return null;
    }
  }

  private constructor(three: Three, stage: HTMLElement, options: FoilSceneOptions) {
    this.three = three;
    this.stage = stage;
    this.options = options;
    this.cur = options.index;
    this.texW = options.textureWidth;
    this.texH = Math.round(options.textureWidth * CARD_ASPECT);
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // A canvas of its own, per instance: a second scene (React mounts effects
    // twice in development) never inherits a context the first one gave up.
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

    // Throws without WebGL 2 — create() turns that into the flat fallback.
    const renderer = new three.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = three.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = three.VSMShadowMap;
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const linear = (hex: number) => new three.Color().setHex(hex, three.LinearSRGBColorSpace);

    this.scene = new three.Scene();
    this.environment = this.makeEnvironment(linear);
    this.scene.environment = this.environment.texture;
    this.camera = new three.PerspectiveCamera(FOV, 1, 0.05, 50);

    this.scene.add(new three.HemisphereLight(linear(SKY), linear(FLOOR_BOUNCE), HEMI_INTENSITY));
    const key = new three.DirectionalLight(linear(KEY), KEY_INTENSITY);
    key.position.set(-1.6, 6.2, 3.4);
    key.target.position.set(0, 0.6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 14;
    Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 12 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.015;
    this.scene.add(key, key.target);
    this.glint = new three.PointLight(linear(SKY), ...GLINT);
    this.scene.add(this.glint);

    // The table: nothing but the shadow that falls on it.
    const channels = options.shadow.trim().split(/\s+/).map(Number);
    const shade = new three.Color();
    if (channels.length === 3 && !channels.some(Number.isNaN)) {
      shade.setRGB(channels[0] / 255, channels[1] / 255, channels[2] / 255, three.SRGBColorSpace);
    }
    const tableGeometry = new three.PlaneGeometry(14, 14);
    const tableMaterial = new three.ShadowMaterial({
      color: shade,
      opacity: SHADOW_OPACITY * options.shadowStrength,
    });
    const table = new three.Mesh(tableGeometry, tableMaterial);
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    this.scene.add(table);

    this.panel = new three.BoxGeometry(CW, CH, CT);
    // Hinged on its left edge, standing on its foot.
    this.panel.translate(CW / 2, CH / 2, 0);
    this.root = new three.Group();
    this.holder = new three.Group();
    this.root.add(this.holder);
    this.scene.add(this.root);

    const contactMap = new three.CanvasTexture(this.contactPatch(options.shadow));
    contactMap.colorSpace = three.SRGBColorSpace;
    const contactGeometry = new three.PlaneGeometry(1, 1);
    const contactMaterial = new three.MeshBasicMaterial({
      map: contactMap,
      transparent: true,
      depthWrite: false,
      opacity: CONTACT_OPACITY * options.shadowStrength,
    });
    this.contact = new three.Mesh(contactGeometry, contactMaterial);
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.y = 0.001;
    this.root.add(this.contact);

    this.statics.push(
      tableGeometry, tableMaterial, contactGeometry, contactMaterial, contactMap, this.panel, this.environment,
    );

    stage.appendChild(this.canvas);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(stage);
    this.resize();

    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    stage.addEventListener('pointerdown', this.onPointerDown);
    stage.addEventListener('pointerup', this.onPointerUp);
    stage.addEventListener('pointercancel', this.onPointerCancel);

    void this.boot();
  }

  /* ── what the page can ask for ─────────────────────────────────────── */

  /** Bring another card in; `dir` is the way the old one leaves. */
  select(index: number, dir: 1 | -1) {
    const count = this.options.cards.length;
    const i = ((index % count) + count) % count;
    if (i === this.cur && !this.swap) return;
    // Still pressing the first card: just change which one it will be.
    if (!this.ready) {
      this.cur = i;
      this.emit();
      return;
    }
    if (this.reduced) {
      this.cur = i;
      this.swapTo(i);
      this.emit();
      return;
    }
    if (this.swap) {
      // Mid-change: retarget the one on its way out, or queue behind the one
      // on its way in.
      if (this.swap.phase === 'out') this.swap.next = i;
      else this.pending = { i, dir };
      this.cur = i;
      this.emit();
      return;
    }
    this.swap = { phase: 'out', t: 0, dir, next: i };
    this.cur = i;
    this.openTarget = 0;
    this.emit();
  }

  toggleOpen() {
    this.openTarget = this.openTarget ? 0 : 1;
    // A card showing its back turns to face you before it opens.
    if (this.openTarget && Math.cos(this.yawTarget) < 0) {
      this.yawTarget = Math.round(this.yawTarget / (2 * Math.PI)) * 2 * Math.PI;
    }
    this.emit();
  }

  turnOver() {
    this.yawTarget = (Math.round(this.yawTarget / Math.PI) + 1) * Math.PI;
    if (Math.cos(this.yawTarget) < 0) this.openTarget = 0;
    this.emit();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    window.removeEventListener('pointermove', this.onPointerMove);
    this.stage.removeEventListener('pointerdown', this.onPointerDown);
    this.stage.removeEventListener('pointerup', this.onPointerUp);
    this.stage.removeEventListener('pointercancel', this.onPointerCancel);
    this.disposeCard();
    this.statics.forEach((item) => item.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private emit() {
    this.options.onState({
      index: this.cur,
      open: this.openTarget === 1,
      turned: Math.cos(this.yawTarget) < 0,
    });
  }

  /* ── the studio ────────────────────────────────────────────────────── */

  /** What the foil reflects: a dark room with a few bright panels in it. */
  private makeEnvironment(linear: (hex: number) => THREE_NS.Color) {
    const three = this.three;
    const room = new three.Scene();
    room.background = linear(ROOM);
    const panel = (w: number, h: number, at: [number, number, number], power: number, tint = SKY) => {
      const mesh = new three.Mesh(
        new three.PlaneGeometry(w, h),
        new three.MeshBasicMaterial({ color: linear(tint).multiplyScalar(power), side: three.DoubleSide }),
      );
      mesh.position.set(...at);
      mesh.lookAt(0, 0.7, 0);
      room.add(mesh);
    };
    panel(5, 2.2, [0, 5, 3.5], 3.4); // overhead softbox
    panel(1.1, 6, [-4.2, 1.6, 4.2], 6); // left strip
    panel(1.1, 6, [4.4, 1.2, 3.2], 4.2, WARM_STRIP); // warm right strip
    panel(2.4, 1, [1.4, 0.9, 7], 0.55); // low fill behind the viewer
    panel(10, 10, [0, -3, 0], 0.16, TABLE); // tabletop bounce
    panel(4, 6, [-2, 2, -6], 0.5); // back wall card

    const pmrem = new three.PMREMGenerator(this.renderer);
    const target = pmrem.fromScene(room, 0.04);
    pmrem.dispose();
    room.traverse((object) => {
      const mesh = object as THREE_NS.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (mesh.material as THREE_NS.Material).dispose();
    });
    return target;
  }

  /** The soft dark patch where the card meets the table. */
  private contactPatch(channels: string) {
    const canvas = mk(256, 256);
    const ctx = canvas.getContext('2d')!;
    const tone = (alpha: number) => `rgb(${channels.trim() || '0 0 0'} / ${alpha})`;
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, tone(0.55));
    gradient.addColorStop(0.45, tone(0.22));
    gradient.addColorStop(1, tone(0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    return canvas;
  }

  private resize = () => {
    const { width, height } = this.stage.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  /* ── pressing a card ───────────────────────────────────────────────── */

  /**
   * One face, baked: a colour texture, and a data texture carrying height in
   * R (the stamp sinks, the deboss sinks further, the paper has grain),
   * roughness in G and metalness in B.
   */
  private bakeFace(spec: FaceSpec): Face {
    const W = this.texW;
    const H = this.texH;
    const N = W * H;
    const grain = this.grain!;
    const crink = this.crink!;
    const F = alphaOf(spec.foilMask);
    const I = alphaOf(spec.inkMask);
    const D = alphaOf(spec.debossMask);
    const S = hexToRgb(spec.stock);
    const Fo = spec.foil ? hexToRgb(spec.foil) : S;
    const In = spec.ink ? hexToRgb(spec.ink) : S;

    const col = mk(W, H);
    const dat = mk(W, H);
    const cc = col.getContext('2d')!;
    const dc = dat.getContext('2d')!;
    const ci = cc.createImageData(W, H);
    const di = dc.createImageData(W, H);
    const C = ci.data;
    const Q = di.data;
    for (let j = 0, i = 0; j < N; j++, i += 4) {
      const g = grain[j] / 255;
      const k = crink[j] / 255;
      const f = F ? F[j] / 255 : 0;
      const n = I ? I[j] / 255 : 0;
      const d = D ? D[j] / 255 : 0;
      const m = (0.965 + g * 0.07) * (1 - d * 0.06);
      const fm = 0.88 + k * 0.2;
      let r = S[0] * m;
      let gg = S[1] * m;
      let b = S[2] * m;
      r += (In[0] - r) * n;
      gg += (In[1] - gg) * n;
      b += (In[2] - b) * n;
      r += (Fo[0] * fm - r) * f;
      gg += (Fo[1] * fm - gg) * f;
      b += (Fo[2] * fm - b) * f;
      C[i] = r;
      C[i + 1] = gg;
      C[i + 2] = b;
      C[i + 3] = 255;
      const rough = 224 * (1 - n) + 150 * n;
      Q[i] = 172 + (g - 0.5) * 36 - d * 60 - f * 52 + f * (k - 0.5) * 18;
      Q[i + 1] = rough + ((0.2 + k * 0.17) * 255 - rough) * f;
      Q[i + 2] = f * 255;
      Q[i + 3] = 255;
    }
    cc.putImageData(ci, 0, 0);
    dc.putImageData(di, 0, 0);
    return { col, dat };
  }

  /** The four faces, in the order assemble() takes them — each a job of its
      own, so the first card can be baked a face at a time. */
  private faceJobs(card: FoilCard): (() => Face)[] {
    const W = this.texW;
    const H = this.texH;
    const greeting = (ctx: CanvasRenderingContext2D, w: number, h: number) =>
      message(ctx, w, h, card.message, h * card.msgY);
    return [
      // the cover
      () => this.bakeFace({
        stock: card.stock,
        foil: card.foil,
        foilMask: layer(card.front, W, H),
        debossMask: card.deboss ? layer(card.deboss, W, H) : undefined,
      }),
      // inside, right: the greeting
      () => this.bakeFace({
        stock: card.stock,
        foil: card.foil,
        ink: card.ink,
        foilMask: layer((ctx, w, h) => {
          card.inside?.(ctx, w, h);
          if (card.foilMessage) greeting(ctx, w, h);
        }, W, H),
        inkMask: card.foilMessage ? undefined : layer(greeting, W, H),
      }),
      // inside, left: bare stock
      () => this.bakeFace({ stock: card.stock }),
      // the back: the imprint
      () => this.bakeFace({ stock: card.stock, ink: card.backInk, inkMask: layer(backText(card), W, H) }),
    ];
  }

  private assemble(card: FoilCard, [front, inner, left, back]: Face[]): BuiltCard {
    const three = this.three;
    const texture = (canvas: HTMLCanvasElement, srgb: boolean) => {
      const map = new three.CanvasTexture(canvas);
      if (srgb) map.colorSpace = three.SRGBColorSpace;
      map.anisotropy = this.anisotropy;
      return map;
    };
    const faces: THREE_NS.MeshStandardMaterial[] = [];
    const faceMaterial = (face: Face, extra?: THREE_NS.MeshStandardMaterialParameters) => {
      const data = texture(face.dat, false);
      const material = new three.MeshStandardMaterial({
        map: texture(face.col, true),
        roughnessMap: data,
        metalnessMap: data,
        bumpMap: data,
        roughness: 1,
        metalness: 1,
        ...extra,
      });
      faces.push(material);
      return material;
    };

    // The window: an alpha map on both faces of the cover. The shadow pass
    // honours it too, so the moon's light falls through.
    let cut: THREE_NS.MeshStandardMaterialParameters | undefined;
    if (card.dieCut) {
      const w = 512;
      const h = Math.round(w * CARD_ASPECT);
      const mask = mk(w, h);
      const ctx = mask.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(w * card.dieCut.x, h * card.dieCut.y, w * card.dieCut.r, 0, Math.PI * 2);
      ctx.fill();
      cut = { alphaMap: texture(mask, false), alphaTest: 0.5 };
    }

    const edge = new three.MeshStandardMaterial({
      color: new three.Color(card.stock),
      roughness: 0.92,
      metalness: 0,
    });
    // Box faces: +x, -x, +y, -y (the board's edges), then +z and -z.
    const backBoard = new three.Mesh(this.panel, [
      edge, edge, edge, edge, faceMaterial(inner), faceMaterial(back),
    ]);
    backBoard.position.z = -CT / 2;
    const cover = new three.Mesh(this.panel, [
      edge, edge, edge, edge, faceMaterial(front, cut), faceMaterial(left, cut),
    ]);
    const pivot = new three.Group();
    pivot.position.z = CT / 2 + 0.0004;
    pivot.add(cover);
    const group = new three.Group();
    group.add(backBoard, pivot);
    [backBoard, cover].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return { group, pivot, meshes: [backBoard, cover], faces };
  }

  private disposeCard() {
    const card = this.card;
    if (!card) return;
    this.card = null;
    this.holder.remove(card.group);
    const seen = new Set<{ dispose: () => void }>();
    card.meshes.forEach((mesh) => {
      (mesh.material as THREE_NS.MeshStandardMaterial[]).forEach((material) => {
        if (seen.has(material)) return;
        seen.add(material);
        // roughness, metalness and bump share one data map.
        [material.map, material.roughnessMap, material.alphaMap].forEach((map) => {
          if (!map || seen.has(map)) return;
          seen.add(map);
          map.dispose();
        });
        material.dispose();
      });
    });
  }

  private mount(card: BuiltCard, index: number) {
    this.disposeCard();
    this.card = card;
    this.built = index;
    this.holder.add(card.group);
    this.openP = 0;
    this.openTarget = 0;
    // Facing front, by the shortest way round.
    this.yawTarget = Math.round(this.yawTarget / (2 * Math.PI)) * 2 * Math.PI;
    this.yaw = this.yawTarget;
    this.emit();
  }

  /** Bake and mount in one go — used mid-change, while nothing is on screen. */
  private swapTo(index: number) {
    const card = this.options.cards[index];
    this.mount(this.assemble(card, this.faceJobs(card).map((job) => job())), index);
  }

  /** The first card, baked a step at a time so the page arriving stays smooth. */
  private async boot() {
    const W = this.texW;
    const H = this.texH;
    await breathe();
    if (this.disposed) return;
    const fine = noiseField(W, H, 2, 21);
    await breathe();
    const coarse = noiseField(W, H, 11, 22);
    for (let i = 0; i < fine.length; i++) fine[i] = fine[i] * 0.6 + coarse[i] * 0.4;
    this.grain = fine;
    await breathe();
    this.crink = noiseField(W, H, 5, 23);

    for (;;) {
      const target = this.cur;
      const card = this.options.cards[target];
      const faces: Face[] = [];
      for (const job of this.faceJobs(card)) {
        await breathe();
        if (this.disposed) return;
        faces.push(job());
      }
      // Another card was picked while this one was pressing — press that.
      if (target !== this.cur) continue;
      this.mount(this.assemble(card, faces), target);
      break;
    }

    this.ready = true;
    // The first card arrives the way every later one does.
    if (!this.reduced) this.swap = { phase: 'in', t: 0, dir: 1, next: this.cur };
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.options.onReady();
  }

  /* ── in the hand ───────────────────────────────────────────────────── */

  private setPointer(e: PointerEvent) {
    const r = this.stage.getBoundingClientRect();
    this.pointer.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.2, 1.2);
    this.pointer.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.2, 1.2);
    this.lastMove = performance.now();
  }

  private onPointerMove = (e: PointerEvent) => {
    // A finger only steers the light while it's turning the card.
    if (e.pointerType === 'mouse' || this.drag) this.setPointer(e);
    const drag = this.drag;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > TAP_SLOP_PX) drag.moved = true;
    if (drag.moved) this.yawTarget = drag.yaw + dx * TURN_PER_PX;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.setPointer(e);
    this.drag = { x: e.clientX, yaw: this.yawTarget, moved: false };
    try {
      this.stage.setPointerCapture(e.pointerId);
    } catch {
      // Not capturable (a synthetic event) — the drag still tracks on window.
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    if (!drag.moved && this.hitCard(e)) this.toggleOpen();
    else this.emit();
  };

  private onPointerCancel = () => {
    this.drag = null;
  };

  private hitCard(e: PointerEvent) {
    if (!this.card) return false;
    const r = this.stage.getBoundingClientRect();
    const point = new this.three.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    const ray = new this.three.Raycaster();
    ray.setFromCamera(point, this.camera);
    return ray.intersectObjects(this.card.meshes, false).length > 0;
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    const { camera, root, smooth, pointer, card } = this;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    // Where the light and the lean are heading: the pointer, or a slow drift
    // of its own once the pointer has been still a while.
    let tx = pointer.x;
    let ty = pointer.y;
    if (!this.drag && now - this.lastMove > IDLE_MS) {
      const t = now / 1000;
      if (this.reduced) {
        tx = 0.25;
        ty = -0.1;
      } else {
        tx = Math.sin(t * 0.42) * 0.6;
        ty = Math.sin(t * 0.29 + 1) * 0.35;
      }
    }
    const k = 1 - Math.exp(-dt * 3.5);
    smooth.x += (tx - smooth.x) * k;
    smooth.y += (ty - smooth.y) * k;
    this.yaw += (this.yawTarget - this.yaw) * (1 - Math.exp(-dt * (this.drag ? 14 : 5)));

    const dir = this.openTarget > this.openP ? 1 : -1;
    this.openP = clamp(this.openP + (dir * dt) / (this.reduced ? 0.15 : OPEN_TIME), 0, 1);
    const e = ease(this.openP);
    const theta = e * OPEN_ANGLE;

    if (card) {
      card.pivot.rotation.y = -theta;
      // Kept centred as it opens: the cover swings out past the hinge.
      const minX = Math.min(0, CW * Math.cos(theta));
      card.group.position.x = -(minX + CW) / 2;
      card.group.position.z = -Math.sin(theta) * CW * 0.25;
    }
    root.rotation.y = this.yaw + smooth.x * 0.42;
    this.contact.scale.set(CW * (1.3 + 0.95 * e), 0.32 + 0.25 * Math.sin(theta), 1);

    // Frame the card — closed or open — in whatever shape the stage is.
    const vt = Math.tan((camera.fov * Math.PI) / 360);
    const needW = CW * (1.45 + 1.3 * e);
    const needH = CH * (1.36 + 0.14 * e);
    const want = Math.max(needH / 2 / vt, needW / 2 / (vt * camera.aspect));
    if (!this.camDist) this.camDist = want;
    this.camDist += (want - this.camDist) * (1 - Math.exp(-dt * 4));
    const dist = this.camDist;
    const el = 0.13 + smooth.y * -0.11;
    const az = smooth.x * -0.06;
    const y0 = CH * 0.5;
    camera.position.set(
      Math.sin(az) * Math.cos(el) * dist,
      y0 + Math.sin(el) * dist,
      Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(0, y0, 0);
    this.glint.position.set(smooth.x * 1.8, y0 - smooth.y * 1.3 + 0.3, 1.8);

    if (card) {
      // Drawing-buffer px per world unit at the card.
      const bump = (BUMP_DEPTH * this.canvas.height) / (2 * vt * dist);
      card.faces.forEach((material) => {
        material.bumpScale = bump;
      });
    }

    // A card change: slide out, press the next, slide in.
    const swap = this.swap;
    if (swap) {
      const slide = dist * vt * camera.aspect + CW * 1.2;
      if (swap.phase === 'out') {
        swap.t = Math.min(1, swap.t + dt / SWAP_OUT);
        root.position.x = -swap.dir * slide * Math.pow(swap.t, 2.2);
        if (swap.t >= 1) {
          this.swapTo(swap.next);
          swap.phase = 'in';
          swap.t = 0;
          root.position.x = swap.dir * slide;
        }
      } else {
        swap.t = Math.min(1, swap.t + dt / SWAP_IN);
        root.position.x = swap.dir * slide * Math.pow(1 - swap.t, 3);
        if (swap.t >= 1) {
          root.position.x = 0;
          this.swap = null;
          const pending = this.pending;
          this.pending = null;
          if (pending && pending.i !== this.built) {
            this.swap = { phase: 'out', t: 0, dir: pending.dir, next: pending.i };
            this.openTarget = 0;
          }
        }
      }
    }

    this.renderer.render(this.scene, camera);
    this.raf = requestAnimationFrame(this.frame);
  };
}
