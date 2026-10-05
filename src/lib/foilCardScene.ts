import type * as THREE_NS from 'three';
import { CARD_ASPECT, mk, rng } from './foilCards';
import { type FaceLayers, LayerError, type ViewerCard } from './foilLayers';

/**
 * The About page's cards, as objects — all of them on one diagonal track.
 *
 * The track runs from small and far in the lower left to large and near in
 * the upper right, with the front card centre stage. One float, `progress`,
 * in card units, says where it is: an integer puts that card at the front.
 * The wheel and the keys step it one card at a time on a timed move; a drag
 * moves it freely and it settles on the nearest card. Only the front card opens.
 *
 * A card is two thin boards hinged down the left edge. Its cover and the page
 * that carries the greeting are baked from lib/foilCards.ts's masks into two
 * textures each — the colour, and a data map with height (the stamp's
 * relief), roughness and metalness — so foil is a real metal pressed into
 * matte cotton, and the light finds it as the card leans. The other two faces
 * are bare stock: one shared paper map, tinted. The light is a small studio
 * built in code: softboxes for the foil to reflect, a key light, and a glint
 * that follows the mouse over a card. Nothing casts a shadow.
 *
 * The scene owns its canvas (appended to the stage it is given) and its own
 * frame loop, and reports back only what the page needs to label itself.
 * Three.js loads on demand from `create()`, so only this page pays for it.
 */

// The card in world units — 5 × 7 in — and the board's thickness.
const CW = 1;
const CH = CARD_ASPECT;
const CT = 0.009;
// How far the cover swings, and how long it takes.
const OPEN_ANGLE = (160 * Math.PI) / 180;
const OPEN_TIME = 0.9;
// How far back the hinge drops as the card opens, in card widths.
const HINGE_DROP = 0.3;
// Depth of the stamp, in world units. three reads a bump map per screen pixel,
// so this is scaled by each card's size on screen every frame — otherwise the
// relief would deepen as a card got smaller.
const BUMP_DEPTH = 0.0042;
const EXPOSURE = 0.92;
const MAX_PIXEL_RATIO = 2;
const FOV = 28;

// The studio. Colours are linear, as lights are; intensities are physical.
const SKY = 0xffffff;
const FLOOR_BOUNCE = 0xb8b0a2;
const KEY = 0xfff4e6;
const WARM_STRIP = 0xffe6c8;
const TABLE = 0xd9d4ca;
const ROOM = 0x0a0a0b;
const HEMI_INTENSITY = 1.57;
const KEY_INTENSITY = 3.61;
const KEY_POSITION: Vec3 = [-2.4, 4, 4];
// The glint: candela, reach, falloff. It rests at GLINT_REST and follows the
// mouse only while a card is under it, GLINT_LIFT in front of the card.
const GLINT: Vec3 = [6, 8, 2];

// The track. One card's step along it, in world units — x, y and toward the
// viewer — on the wide layout and on the stacked one, where it runs steeper.
const STEP: { wide: Vec3; stacked: Vec3 } = { wide: [1.3, 0.42, 0.95], stacked: [1.02, 0.62, 0.8] };
// An open front card pushes its neighbours this much further away.
const SPREAD_OPEN = 0.85;
// The track goes round: a card that runs off one end comes back on at the
// other. Where it joins is worked out from the screen (see setWindow), so that
// both ends are out of sight. These are how far a leaning card reaches either
// side of its centre, in card widths — what decides it has left the screen —
// and the step the walk out to each edge takes.
const CARD_REACH: [number, number] = [0.56, 0.6];
const WALK = 0.05;
// Closer to the camera than this, a card isn't in front of it any more.
const NEAR_LIMIT = 0.3;
// A card grows in at the far end and out at the near one, by scale. Normally
// that happens off screen and is never seen; these are the stretches it takes
// when the screen shows more of the track than there are cards to fill.
const FADE_IN_SPAN = 0.65;
const FADE_OUT_SPAN = 0.3;
const FADE_MIN = 0.05;
const FADE_HIDE = 0.002;
// Every card leans back about a diagonal axis; the open front card turns to
// face the reader instead.
const LEAN_AXIS = 0.38;
const LEAN = -0.62;
const FACING: [number, number] = [-0.04, -0.1];
// Only the card under the mouse tilts: the side under the cursor dips away,
// by this many radians at the card's edge (about 11°). Nothing else follows
// the cursor. HOVER_RATE is how quickly a card eases in and out, per second.
const HOVER_TILT = 0.2;
const HOVER_RATE = 6;
const GLINT_REST = [0, 0.4, 2.2] as const;
const GLINT_LIFT = 2.2;
// A drag on the front card (mouse, pen or touch) spins it — radians per px — and it
// eases back to rest on release. A drag anywhere else scrolls the track.
const SPIN_RATE = 0.01;
const SPIN_BACK_MS = 700;
const SPIN_BACK_MS_REDUCED = 200;
// How quickly the track catches its target, per second.
const TRACK_RATE = 6.5;
const TRACK_RATE_REDUCED = 18;
// The open card closes once the track is heading this far away.
const CLOSE_BEYOND = 0.3;
// Near enough to a card to call the track at rest.
const SETTLED = 0.08;

// Framing. The front card is centred in the band between the top UI and the
// notes — this far down it — and fills this share of it, or this share of the
// stage's width if that is smaller.
const BAND_MIN = 150;
const BAND_GAP = 14;
// Dead centre: the far card hangs lower than the front one, and any further
// down its corner lands on the notes.
const BAND_CENTRE = { wide: 0.5, stacked: 0.5 };
const BAND_FILL = 0.74;
const WIDTH_SHARE = { wide: 0.3, stacked: 0.44 };

// A phone has no diagonal track. Its cards are a carousel: the front one
// centred, its neighbours off to either side — lower, smaller, and cut by the
// screen's edges. These are the neighbours' place as shares of the stage's
// width and height, their size against the front card's, and how far along
// the track a card is gone altogether.
const CAROUSEL = { side: 0.46, drop: 0.13, scale: 0.42, gone: 1.6 };
// Its framing: how far down its band the front card sits, the share of the
// band and of the width it may fill, and the gap kept above the UI beneath.
const PHONE_BAND = { centre: 0.4, fill: 0.72, width: 0.5, gap: 10 };
// Just enough depth per step that a card nearer the front draws over the next.
const CAROUSEL_DEPTH = 0.02;

// Input. The wheel and the arrow keys are a stepper: one push or one press is
// one card, on a move of fixed length that starts fast and settles slowly.
// A jump to a named card takes a little longer for each card it crosses.
const STEP_MS = 650;
const JUMP_MS_PER_CARD = 100;
const JUMP_MS_MAX = 1100;
const MOVE_MS_REDUCED = 200;
// The earliest a new push can start the next move, which carries on from
// wherever the track has got to.
const REARM_AFTER_MS = 200;
// A trackpad gesture steps once it has added up to WHEEL_THRESHOLD px, and is
// over after QUIET_MS without an event.
const WHEEL_THRESHOLD = 24;
const QUIET_MS = 180;
// A mouse-wheel notch: a big delta that arrives on its own, or repeats exactly.
const NOTCH_MIN = 50;
const NOTCH_GAP_MS = 60;
// A fresh trackpad push: a delta that rises to REARM_RATIO × the lowest since
// the momentum's peak. Lines and pages are turned into px.
const REARM_RATIO = 2;
const REARM_MIN = 12;
const WHEEL_LINE = 18;
const WHEEL_PAGE = 400;
// A press that travels further than this is a drag. A drag is read along the
// track's own diagonal, and thrown on release.
const TAP_SLOP_PX = 6;
const DRAG_AXIS: [number, number] = [0.82, -0.57];
const DRAG_THROW = 0.16;
const DRAG_THROW_MAX = 1.6;

type Vec3 = [number, number, number];

export interface FoilSceneState {
  index: number;
  open: boolean;
}

/** phone: the carousel. stacked: the steeper track. wide: the long one. */
export type FoilLayout = 'phone' | 'stacked' | 'wide';

/** Where the front card may sit, in px of the stage. The page measures it. */
export interface FoilSceneFrame {
  /** The band the card is centred in: under the top UI, above the notes. */
  top: number;
  bottom: number;
  /** How far an open card may reach either side of the centre. */
  room: number;
  layout: FoilLayout;
}

export interface FoilSceneOptions {
  cards: ViewerCard[];
  index: number;
  /** Texture width, px — the height follows from the card. */
  textureWidth: number;
  frame: () => FoilSceneFrame;
  onState: (state: FoilSceneState) => void;
  /** The front card is on the track. */
  onReady: () => void;
  /** A card's layers would not load. It is left off the track. */
  onSkip: (index: number) => void;
}

type Three = typeof THREE_NS;

interface Face {
  col: HTMLCanvasElement;
  dat: HTMLCanvasElement;
}

interface FaceSpec {
  stock: string;
  /** Full-colour artwork on its paper. Where there is one it replaces the
      stock and the ink. */
  print?: HTMLCanvasElement;
  foil?: string;
  ink?: string;
  foilMask?: HTMLCanvasElement;
  inkMask?: HTMLCanvasElement;
  debossMask?: HTMLCanvasElement;
}

interface TrackCard {
  outer: THREE_NS.Group;
  hinge: THREE_NS.Group;
  pivot: THREE_NS.Group;
  meshes: THREE_NS.Mesh[];
  /** Every face with relief — its bump scale is set per frame. */
  reliefs: THREE_NS.MeshStandardMaterial[];
  edge: THREE_NS.MeshStandardMaterial;
  openP: number;
  /** How far the hover has tipped it, -1 to 1 across and down. */
  hx: number;
  hy: number;
  /** Its spin from being dragged, and the ease back to rest once let go. */
  spin: THREE_NS.Quaternion;
  spinBack: { from: THREE_NS.Quaternion; start: number } | null;
}

type Drag =
  | { mode: 'track'; x: number; y: number; p: number; moved: boolean; v: number; t: number; unit: number }
  | { mode: 'spin'; index: number; x: number; y: number; lx: number; ly: number; moved: boolean };

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const mod = (a: number, n: number) => ((a % n) + n) % n;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// The track's timed moves: a fast start and a long settle.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
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

/** The same picture, left to right. */
function mirrored(source: HTMLCanvasElement) {
  const canvas = mk(source.width, source.height);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
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
  private readonly glint: THREE_NS.PointLight;
  private readonly panel: THREE_NS.BoxGeometry;
  private readonly environment: THREE_NS.WebGLRenderTarget;
  private readonly observer: ResizeObserver;
  private readonly reduced: boolean;
  private readonly texW: number;
  private readonly texH: number;
  private readonly anisotropy: number;

  // The track's step, the lean every card has, and the front card's facing.
  private readonly step: THREE_NS.Vector3;
  private readonly lean: THREE_NS.Quaternion;
  private readonly facing: THREE_NS.Quaternion;
  private readonly turn: THREE_NS.Quaternion;
  private readonly tip: THREE_NS.Quaternion;
  private readonly tipAngles: THREE_NS.Euler;

  private grain: Uint8Array | null = null;
  private crink: Uint8Array | null = null;
  private paper: THREE_NS.CanvasTexture | null = null;
  private readonly cards: (TrackCard | null)[];
  private disposed = false;

  // Which arrangement this is, and the stage's size — set by layout().
  private mode: FoilLayout = 'wide';
  private stageWidth = 1;
  private stageHeight = 1;

  // The window a card's place on the track wraps in, and the stretch at each
  // end where it grows in or out. Set by layout().
  private wrapFrom = -2.5;
  private fadeIn: [number, number] = [-2.5, -1.85];
  private fadeOut: [number, number] = [2.2, 2.5];

  private progress: number;
  private target: number;
  private active: number;
  private openTarget = 0;
  private baseDist = 5;
  private openFit = 1;
  private camDist = 0;

  // px inside the canvas; over: directly over it; mouse: a mouse or a pen.
  private readonly pointer = { x: 0, y: 0, over: false, mouse: false };
  private readonly hoverRay: THREE_NS.Raycaster;
  private readonly hoverNdc: THREE_NS.Vector2;
  private readonly glintGoal: THREE_NS.Vector3;
  private readonly proj: THREE_NS.Vector3;
  private readonly projEdge: THREE_NS.Vector3;
  // A timed move — a step or a jump. Without one the track settles on `target`.
  private anim: { from: number; to: number; start: number; dur: number } | null = null;
  private readonly wheel = { last: -1e9, acc: 0, locked: false, prevAbs: 0, peak: 0, min: Infinity };
  private drag: Drag | null = null;
  private readonly rest: THREE_NS.Quaternion;
  private readonly spinAxis: THREE_NS.Vector3;
  private readonly spinStep: THREE_NS.Quaternion;
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
    this.cards = options.cards.map(() => null);
    this.progress = this.target = this.active = options.index;
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
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const linear = (hex: number) => new three.Color().setHex(hex, three.LinearSRGBColorSpace);

    this.scene = new three.Scene();
    this.environment = this.makeEnvironment(linear);
    this.scene.environment = this.environment.texture;
    this.camera = new three.PerspectiveCamera(FOV, 1, 0.05, 60);

    this.scene.add(new three.HemisphereLight(linear(SKY), linear(FLOOR_BOUNCE), HEMI_INTENSITY));
    const key = new three.DirectionalLight(linear(KEY), KEY_INTENSITY);
    key.position.set(...KEY_POSITION);
    this.scene.add(key);
    this.glint = new three.PointLight(linear(SKY), ...GLINT);
    this.glint.position.set(...GLINT_REST);
    this.scene.add(this.glint);
    this.hoverRay = new three.Raycaster();
    this.hoverNdc = new three.Vector2();
    this.glintGoal = new three.Vector3();
    this.proj = new three.Vector3();
    this.projEdge = new three.Vector3();

    // Hinged on its left edge, centred on its height.
    this.panel = new three.BoxGeometry(CW, CH, CT);
    this.panel.translate(CW / 2, 0, 0);

    this.step = new three.Vector3(...STEP.wide);
    this.lean = new three.Quaternion().setFromAxisAngle(
      new three.Vector3(Math.cos(LEAN_AXIS), Math.sin(LEAN_AXIS), 0).normalize(),
      LEAN,
    );
    this.facing = new three.Quaternion().setFromEuler(new three.Euler(FACING[0], FACING[1], 0));
    this.turn = new three.Quaternion();
    this.tip = new three.Quaternion();
    this.rest = new three.Quaternion();
    this.spinAxis = new three.Vector3();
    this.spinStep = new three.Quaternion();
    this.tipAngles = new three.Euler();

    stage.appendChild(this.canvas);
    this.observer = new ResizeObserver(this.layout);
    this.observer.observe(stage);
    this.layout();

    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    stage.addEventListener('pointerdown', this.onPointerDown);
    stage.addEventListener('pointerup', this.onPointerUp);
    stage.addEventListener('pointercancel', this.onPointerCancel);

    void this.boot();
  }

  /* ── what the page can ask for ─────────────────────────────────────── */

  /** Bring a card to the front by the shortest way round the track. */
  goTo(index: number) {
    const count = this.cards.length;
    const base = Math.round(this.target);
    let delta = mod(index - mod(base, count), count);
    if (delta > count / 2) delta -= count;
    if (!delta) return;
    this.close();
    this.moveTo(
      base + delta,
      this.reduced
        ? MOVE_MS_REDUCED
        : Math.min(JUMP_MS_MAX, STEP_MS + JUMP_MS_PER_CARD * (Math.abs(delta) - 1)),
    );
  }

  /** One card along. Ignored while a move has only just begun, or in the hand. */
  stepBy(direction: 1 | -1) {
    if (!this.canStep() || this.drag?.moved) return;
    this.close();
    this.moveTo(Math.round(this.target) + direction, this.reduced ? MOVE_MS_REDUCED : STEP_MS);
  }

  toggleOpen() {
    this.openTarget = this.openTarget ? 0 : 1;
    this.emit();
  }

  close() {
    if (!this.openTarget) return;
    this.openTarget = 0;
    this.emit();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    window.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('wheel', this.onWheel);
    this.stage.removeEventListener('pointerdown', this.onPointerDown);
    this.stage.removeEventListener('pointerup', this.onPointerUp);
    this.stage.removeEventListener('pointercancel', this.onPointerCancel);
    this.cards.forEach((card) => {
      if (!card) return;
      [card.edge, ...card.reliefs].forEach((material) => {
        // roughness, metalness and bump share one data map; the bare faces
        // share the paper, which goes once, below.
        [material.map, material.roughnessMap, material.alphaMap].forEach((map) => {
          if (map && map !== this.paper) map.dispose();
        });
        material.dispose();
      });
    });
    this.paper?.dispose();
    this.panel.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private emit() {
    this.options.onState({ index: this.active, open: this.openTarget === 1 });
  }

  private setActive(index: number) {
    if (index === this.active) return;
    this.active = index;
    this.openTarget = 0;
    this.emit();
  }

  private moveTo(to: number, dur: number) {
    this.anim = { from: this.progress, to, start: performance.now(), dur };
    this.target = to;
  }

  private canStep() {
    return !this.anim || performance.now() - this.anim.start >= REARM_AFTER_MS;
  }

  private settled() {
    return (
      !this.anim &&
      !this.drag?.moved &&
      Math.abs(this.progress - Math.round(this.progress)) < SETTLED &&
      Math.abs(this.target - this.progress) < SETTLED
    );
  }

  /* ── the studio ────────────────────────────────────────────────────── */

  /** What the foil reflects: a dark room with a few bright panels in it. */
  private makeEnvironment(linear: (hex: number) => THREE_NS.Color) {
    const three = this.three;
    const room = new three.Scene();
    room.background = linear(ROOM);
    const panel = (w: number, h: number, at: Vec3, power: number, tint = SKY) => {
      const mesh = new three.Mesh(
        new three.PlaneGeometry(w, h),
        new three.MeshBasicMaterial({ color: linear(tint).multiplyScalar(power), side: three.DoubleSide }),
      );
      mesh.position.set(...at);
      mesh.lookAt(0, 0, 0);
      room.add(mesh);
    };
    panel(5, 2.2, [0, 4.4, 3.5], 3.4); // overhead softbox
    panel(1.1, 6, [-4.2, 0.8, 4.2], 6); // left strip
    panel(1.1, 6, [4.4, 0.4, 3.2], 4.2, WARM_STRIP); // warm right strip
    panel(2.4, 1, [1.4, 0.2, 7], 0.55); // low fill behind the viewer
    panel(10, 10, [0, -3.6, 0], 0.16, TABLE); // tabletop bounce
    panel(4, 6, [-2, 1.4, -6], 0.5); // back wall card

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

  /**
   * Frames the front card in the open band between the top UI and the notes,
   * and sets the track's direction for the screen's shape.
   */
  private layout = () => {
    const { width, height } = this.stage.getBoundingClientRect();
    if (!width || !height) return;
    const { camera } = this;
    this.renderer.setSize(width, height, false);
    camera.aspect = width / height;

    const { top, bottom, room, layout } = this.options.frame();
    const phone = layout === 'phone';
    const stacked = layout !== 'wide';
    this.mode = layout;
    this.stageWidth = width;
    this.stageHeight = height;
    const band = Math.max(BAND_MIN, bottom - top - (phone ? PHONE_BAND.gap : BAND_GAP));
    const centre =
      top + band * (phone ? PHONE_BAND.centre : stacked ? BAND_CENTRE.stacked : BAND_CENTRE.wide);
    const cardHeight = phone
      ? Math.min(band * PHONE_BAND.fill, width * PHONE_BAND.width * CH)
      : Math.min(band * BAND_FILL, width * (stacked ? WIDTH_SHARE.stacked : WIDTH_SHARE.wide) * CH);
    this.baseDist = (CH * height) / (2 * Math.tan((camera.fov * Math.PI) / 360) * cardHeight);
    // An open card is about twice as wide: the camera pulls back until it
    // fits the room the page allows it.
    this.openFit = Math.max(1, ((cardHeight / CH) * 1.04) / room);
    // The track's origin on the band's centre rather than the stage's.
    camera.setViewOffset(width, height, 0, height / 2 - centre, width, height);
    camera.updateProjectionMatrix();
    this.step.set(...(stacked ? STEP.stacked : STEP.wide));
    // The carousel hides a card long before it would wrap, so it wraps
    // evenly; the tracks join wherever the screen can't see.
    if (phone) this.wrapFrom = -this.cards.length / 2;
    else this.setWindow(width, height, centre);
  };

  /**
   * Where the track joins up. This walks out from the front card in both
   * directions until a card would be off the screen, and centres the wrap
   * window on that stretch — so cards leave through the screen's edges and
   * the jump from one end to the other is never seen. If the screen shows
   * more of the track than there are cards to fill (a very wide window), the
   * near end is kept clean and the far end falls short of the edge, the last
   * card shrinking away as it goes.
   */
  private setWindow(width: number, height: number, centre: number) {
    const count = this.cards.length;
    const focal = height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const { x: stepX, y: stepY, z: stepZ } = this.step;
    const seen = (t: number) => {
      const depth = this.baseDist - stepZ * t;
      if (depth <= NEAR_LIMIT) return false;
      const scale = focal / depth;
      const x = width / 2 + stepX * t * scale;
      const y = centre - stepY * t * scale;
      return (
        x + CARD_REACH[0] * scale > 0 &&
        x - CARD_REACH[0] * scale < width &&
        y + CARD_REACH[1] * scale > 0 &&
        y - CARD_REACH[1] * scale < height
      );
    };
    // The first place at each end where a card is out of sight.
    let far = -WALK;
    while (far > -count && seen(far)) far -= WALK;
    let near = WALK;
    while (near < count && seen(near)) near += WALK;

    const fits = near - far <= count;
    const from = fits ? (far + near - count) / 2 : near - count;
    const to = from + count;
    this.wrapFrom = from;
    this.fadeIn = [from, from + (fits ? Math.max(FADE_MIN, far - from) : FADE_IN_SPAN)];
    this.fadeOut = [to - Math.max(FADE_MIN, Math.min(FADE_OUT_SPAN, to - near)), to];
  }

  /* ── pressing a card ───────────────────────────────────────────────── */

  /**
   * One face, baked: a colour texture, and a data texture carrying height in
   * R (the stamp sinks, the deboss sinks further, the paper has grain),
   * roughness in G and metalness in B.
   *
   * The colour starts from the face's print where it has one — full-colour
   * artwork on its paper — and otherwise from the stock with any ink over it.
   * The foil, the deboss and the grain are pressed in the same way either way.
   */
  private bakeFace(spec: FaceSpec): Face {
    const W = this.texW;
    const H = this.texH;
    const N = W * H;
    const grain = this.grain!;
    const crink = this.crink!;
    const P = spec.print
      ? spec.print.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data
      : null;
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
      let r: number;
      let gg: number;
      let b: number;
      if (P) {
        r = P[i] * m;
        gg = P[i + 1] * m;
        b = P[i + 2] * m;
      } else {
        r = S[0] * m;
        gg = S[1] * m;
        b = S[2] * m;
        r += (In[0] - r) * n;
        gg += (In[1] - gg) * n;
        b += (In[2] - b) * n;
      }
      r += (Fo[0] * fm - r) * f;
      gg += (Fo[1] * fm - gg) * f;
      b += (Fo[2] * fm - b) * f;
      C[i] = r;
      C[i + 1] = gg;
      C[i + 2] = b;
      C[i + 3] = 255;
      // A print is paper all over; only the built-in ink is any smoother.
      const rough = P ? 224 : 224 * (1 - n) + 150 * n;
      Q[i] = 172 + (g - 0.5) * 36 - d * 60 - f * 52 + f * (k - 0.5) * 18;
      Q[i + 1] = rough + ((0.2 + k * 0.17) * 255 - rough) * f;
      Q[i + 2] = f * 255;
      Q[i + 3] = 255;
    }
    cc.putImageData(ci, 0, 0);
    dc.putImageData(di, 0, 0);
    return { col, dat };
  }

  private texture(canvas: HTMLCanvasElement, srgb: boolean) {
    const map = new this.three.CanvasTexture(canvas);
    if (srgb) map.colorSpace = this.three.SRGBColorSpace;
    map.anisotropy = this.anisotropy;
    return map;
  }

  /**
   * Press one card from its layers. Null if the scene went away while they
   * loaded; rejects (a LayerError) if one of them wouldn't.
   */
  private async buildCard(index: number): Promise<TrackCard | null> {
    const three = this.three;
    const card = this.options.cards[index];
    const layers = await card.layers(this.texW);
    if (this.disposed) return null;

    const pressed = (face: FaceLayers) => Boolean(face.print || face.foil || face.deboss || face.ink);
    const bake = (face: FaceLayers) =>
      this.bakeFace({
        stock: card.stock,
        foil: card.foil,
        ink: face.inkColor,
        print: face.print,
        foilMask: face.foil,
        inkMask: face.ink,
        debossMask: face.deboss,
      });
    // The cover and the greeting page always; the other two only if something
    // is pressed into them — otherwise they are bare paper.
    const front = bake(layers.front);
    await breathe();
    const inner = bake(layers.insideRight);
    await breathe();
    const left = pressed(layers.insideLeft) ? bake(layers.insideLeft) : null;
    const back = pressed(layers.back) ? bake(layers.back) : null;
    if (left || back) await breathe();
    if (this.disposed) return null;

    // The window: an alpha map on both faces of the cover. It is drawn as
    // seen from the front, and the cover's inside face is looked at from
    // behind, so that face takes its mirror image — or an off-centre hole
    // would sit in two different places.
    let cut: THREE_NS.MeshStandardMaterialParameters | undefined;
    let cutInside: THREE_NS.MeshStandardMaterialParameters | undefined;
    if (layers.dieCut) {
      cut = { alphaMap: this.texture(layers.dieCut, false), alphaTest: 0.5 };
      cutInside = { alphaMap: this.texture(mirrored(layers.dieCut), false), alphaTest: 0.5 };
    }

    const stock = new three.Color(card.stock);
    const reliefs: THREE_NS.MeshStandardMaterial[] = [];
    const relief = (parameters: THREE_NS.MeshStandardMaterialParameters) => {
      const material = new three.MeshStandardMaterial({ roughness: 1, metalness: 1, ...parameters });
      reliefs.push(material);
      return material;
    };
    // A printed face from its two baked maps; a bare one from the shared
    // paper, in this card's stock.
    const face = (baked: Face | null, extra?: THREE_NS.MeshStandardMaterialParameters) => {
      if (!baked) {
        return relief({ color: stock, roughnessMap: this.paper, metalnessMap: this.paper, bumpMap: this.paper, ...extra });
      }
      const data = this.texture(baked.dat, false);
      return relief({ map: this.texture(baked.col, true), roughnessMap: data, metalnessMap: data, bumpMap: data, ...extra });
    };

    const edge = new three.MeshStandardMaterial({ color: stock, roughness: 0.92, metalness: 0 });
    // Box faces: +x, -x, +y, -y (the board's edges), then +z and -z. A
    // texture on -z reads the right way round from behind, so the inside of
    // the cover is designed as it is seen with the card open.
    const backBoard = new three.Mesh(this.panel, [edge, edge, edge, edge, face(inner), face(back)]);
    backBoard.position.z = -CT / 2;
    const cover = new three.Mesh(this.panel, [edge, edge, edge, edge, face(front, cut), face(left, cutInside)]);
    const pivot = new three.Group();
    pivot.position.z = CT / 2 + 0.0004;
    pivot.add(cover);
    const hinge = new three.Group();
    hinge.add(backBoard, pivot);
    const outer = new three.Group();
    outer.add(hinge);
    // So a tap can tell which card it landed on.
    backBoard.userData.index = cover.userData.index = index;
    // Placed by the next frame; until then it would sit on the front card.
    outer.visible = false;
    this.scene.add(outer);
    return { outer, hinge, pivot, meshes: [backBoard, cover], reliefs, edge, openP: 0, hx: 0, hy: 0, spin: new three.Quaternion(), spinBack: null };
  }

  /** Put one card on the track. False if the scene is gone, or if the card
      had to be left off because a layer wouldn't load. */
  private async press(index: number) {
    try {
      const card = await this.buildCard(index);
      if (!card) return false;
      this.cards[index] = card;
      return true;
    } catch (error) {
      if (this.disposed) return false;
      const field = error instanceof LayerError ? error.field : 'a layer';
      console.warn(`[FoilCardScene] Skipping "${this.options.cards[index].name}": ${field} failed to load.`);
      this.options.onSkip(index);
      return false;
    }
  }

  /** The paper and the front card, a step at a time so the page arriving
      stays smooth. The rest of the rack follows, one card after another. */
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
    await breathe();
    if (this.disposed) return;
    this.paper = this.texture(this.bakeFace({ stock: '#ffffff' }).dat, false);
    await breathe();
    if (this.disposed) return;

    const count = this.cards.length;
    const front = mod(Math.round(this.progress), count);
    if (!(await this.press(front))) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.options.onReady();

    // Nearest to the front first, either side.
    for (let away = 1; away <= count / 2; away++) {
      for (const side of [1, -1]) {
        const index = mod(front + side * away, count);
        if (this.cards[index]) continue;
        if (!(await this.press(index))) return;
      }
    }
  }

  /* ── in the hand ───────────────────────────────────────────────────── */

  private onPointerMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - r.left;
    this.pointer.y = e.clientY - r.top;
    this.pointer.over = e.target === this.canvas;
    this.pointer.mouse = e.pointerType === 'mouse' || e.pointerType === 'pen';
    const now = performance.now();
    const drag = this.drag;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= TAP_SLOP_PX) return;
      drag.moved = true;
      if (drag.mode === 'track') {
        // The hand takes the track from where it is now, not from where it
        // was when the press began — a step may have run on in between.
        this.anim = null;
        drag.x = e.clientX;
        drag.y = e.clientY;
        drag.p = this.target = this.progress;
        drag.t = now;
        return;
      }
    }
    if (drag.mode === 'spin') {
      // A trackball: each move turns the card about the axis at right angles
      // to the move, in screen space.
      const mx = e.clientX - drag.lx;
      const my = e.clientY - drag.ly;
      const length = Math.hypot(mx, my);
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      const card = this.cards[drag.index];
      if (!length || !card) return;
      this.spinAxis.set(my / length, mx / length, 0);
      this.spinStep.setFromAxisAngle(this.spinAxis, length * SPIN_RATE);
      card.spinBack = null;
      card.spin.premultiply(this.spinStep);
      return;
    }
    // Along the track: up and to the right brings the next card forward.
    // The carousel runs straight across; the tracks run on their diagonal.
    const along = this.mode === 'phone' ? dx : dx * DRAG_AXIS[0] + dy * DRAG_AXIS[1];
    const position = drag.p - along / drag.unit;
    drag.v = (position - this.progress) / Math.max(0.008, (now - drag.t) / 1000);
    drag.t = now;
    this.progress = this.target = position;
  };

  private onPointerLeave = () => {
    this.pointer.over = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    // On the front card, at rest, a drag — mouse, pen or touch — spins it;
    // anywhere else, a side card or empty space, it scrolls the track.
    const index = this.hit(e);
    this.drag =
      index !== -1 && index === this.active && this.cards[index] && this.settled()
        ? { mode: 'spin', index, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }
        : {
            mode: 'track',
            x: e.clientX,
            y: e.clientY,
            p: this.progress,
            moved: false,
            v: 0,
            t: performance.now(),
            unit: Math.min(window.innerWidth, window.innerHeight) * 0.5,
          };
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
    if (!drag.moved) {
      // A tap: the front card opens or closes, any other comes to the front.
      const index = this.hit(e);
      if (index === this.active && this.settled()) this.toggleOpen();
      else if (index !== -1) this.goTo(index);
      return;
    }
    if (drag.mode === 'spin') {
      this.springBack(drag.index);
      return;
    }
    this.target = Math.round(this.progress + clamp(drag.v * DRAG_THROW, -DRAG_THROW_MAX, DRAG_THROW_MAX));
  };

  private onPointerCancel = () => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    if (drag.mode === 'spin') this.springBack(drag.index);
    else this.target = Math.round(this.progress);
  };

  private springBack(index: number) {
    const card = this.cards[index];
    if (card) card.spinBack = { from: card.spin.clone(), start: performance.now() };
  }

  private lockWheel(size: number) {
    const { wheel } = this;
    wheel.locked = true;
    wheel.acc = 0;
    wheel.peak = size;
    wheel.min = Infinity;
  }

  // Each mouse notch is one push; a trackpad gesture is one push until a
  // fresh push rises out of its momentum.
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { wheel } = this;
    const now = performance.now();
    const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const delta = e.deltaMode === 1 ? raw * WHEEL_LINE : e.deltaMode === 2 ? raw * WHEEL_PAGE : raw;
    const size = Math.abs(delta);
    if (!delta) return;
    const gap = now - wheel.last;
    wheel.last = now;
    const notch =
      e.deltaMode !== 0 || (size >= NOTCH_MIN && (gap > NOTCH_GAP_MS || size === wheel.prevAbs));
    if (notch) {
      wheel.prevAbs = size;
      this.lockWheel(size);
      this.stepBy(delta > 0 ? 1 : -1);
      return;
    }
    if (gap > QUIET_MS) {
      wheel.acc = 0;
      wheel.locked = false;
    } else if (wheel.locked) {
      // The momentum is still rising to its peak, or dying away from it.
      if (wheel.min === Infinity && size >= wheel.prevAbs) wheel.peak = Math.max(wheel.peak, size);
      else wheel.min = Math.min(wheel.min, size);
      if (
        this.canStep() &&
        wheel.min <= wheel.peak * 0.5 &&
        size >= REARM_MIN &&
        size >= wheel.min * REARM_RATIO &&
        size > wheel.prevAbs
      ) {
        wheel.acc = 0;
        wheel.locked = false;
      }
    }
    wheel.prevAbs = size;
    if (wheel.locked) return;
    if (Math.sign(delta) !== Math.sign(wheel.acc)) wheel.acc = 0;
    wheel.acc += delta;
    if (Math.abs(wheel.acc) >= WHEEL_THRESHOLD) {
      const direction = wheel.acc > 0 ? 1 : -1;
      this.lockWheel(size);
      this.stepBy(direction);
    }
  };

  /** Which card is under the pointer, or -1. */
  private hit(e: PointerEvent) {
    const r = this.stage.getBoundingClientRect();
    const first = this.pick(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    return first ? (first.object.userData.index as number) : -1;
  }

  /** What a point of the stage, in px, lands on: the nearest card's board. */
  private pick(x: number, y: number, width: number, height: number) {
    this.hoverNdc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    this.hoverRay.setFromCamera(this.hoverNdc, this.camera);
    const meshes: THREE_NS.Mesh[] = [];
    this.cards.forEach((card) => {
      if (card?.outer.visible) meshes.push(...card.meshes);
    });
    return this.hoverRay.intersectObjects(meshes, false)[0];
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    const { camera, pointer, cards } = this;
    const count = cards.length;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    const anim = this.anim;
    if (anim) {
      // A step or a jump: a fixed time, fast away and slow to settle.
      const k = clamp((now - anim.start) / anim.dur, 0, 1);
      this.progress = k === 1 ? anim.to : anim.from + (anim.to - anim.from) * easeOut(k);
      if (k === 1) this.anim = null;
    } else if (!this.drag) {
      // Let go of: the track settles on the card it was thrown at.
      const rate = this.reduced ? TRACK_RATE_REDUCED : TRACK_RATE;
      this.progress += (this.target - this.progress) * (1 - Math.exp(-dt * rate));
    }
    this.setActive(mod(Math.round(this.progress), count));
    // Heading for another card: the open one closes.
    if (
      this.openTarget &&
      !this.anim &&
      !this.drag &&
      !this.settled() &&
      Math.abs(this.target - this.progress) > CLOSE_BEYOND
    ) {
      this.openTarget = 0;
      this.emit();
    }

    const front = cards[this.active];
    const frontOpen = front ? ease(front.openP) : 0;

    // The camera pulls back as the front card opens.
    const want = this.baseDist * (1 + (this.openFit - 1) * frontOpen);
    if (!this.camDist) this.camDist = want;
    this.camDist += (want - this.camDist) * (1 - Math.exp(-dt * 5));
    camera.position.set(0, 0, this.camDist);
    camera.lookAt(0, 0, 0);

    // Which card is under the mouse. No hover on touch, or while dragging.
    const hoverHit =
      pointer.over && pointer.mouse && !this.drag?.moved
        ? this.pick(pointer.x, pointer.y, this.stageWidth, this.stageHeight)
        : undefined;
    const hovered = hoverHit ? (hoverHit.object.userData.index as number) : -1;
    const hoverK = 1 - Math.exp(-dt * HOVER_RATE);
    // The glint rests in place, and follows the mouse only over a card.
    if (hoverHit) this.glintGoal.copy(hoverHit.point).setZ(hoverHit.point.z + GLINT_LIFT);
    else this.glintGoal.set(...GLINT_REST);
    this.glint.position.lerp(this.glintGoal, hoverK);

    const spread = 1 + SPREAD_OPEN * frontOpen;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    // Drawing-buffer px per world unit, one unit from the camera.
    const density = this.canvas.height / (2 * tan);
    // The carousel is laid out in px of the stage and turned into world units
    // at the cards' own plane, so its sizes hold as the camera pulls back.
    const phone = this.mode === 'phone';
    const worldPerPx = (2 * tan * this.camDist) / this.stageHeight;
    for (let i = 0; i < count; i++) {
      const card = cards[i];
      if (!card) continue;
      // Signed distance from the front, wrapped so the track goes round.
      const t = mod(i - this.progress - this.wrapFrom, count) + this.wrapFrom;

      const opening = i === this.active && this.openTarget ? 1 : -1;
      card.openP = clamp(card.openP + (opening * dt) / (this.reduced ? 0.15 : OPEN_TIME), 0, 1);
      const open = ease(card.openP);
      const theta = open * OPEN_ANGLE;
      card.pivot.rotation.y = -theta;
      // Kept centred as it opens: the cover swings out past the hinge.
      card.hinge.position.x = -(Math.min(0, CW * Math.cos(theta)) + CW) / 2;
      card.hinge.position.z = -Math.sin(theta) * CW * HINGE_DROP;

      if (phone) {
        // Shrinking and dropping towards a neighbour's place; past it, gone.
        const away = Math.abs(t);
        const size =
          away <= 1
            ? 1 - (1 - CAROUSEL.scale) * away
            : CAROUSEL.scale * clamp(1 - (away - 1) / (CAROUSEL.gone - 1), 0, 1);
        card.outer.visible = size > FADE_HIDE;
        if (!card.outer.visible) continue;
        card.outer.scale.setScalar(size);
        card.outer.position.set(
          t * CAROUSEL.side * this.stageWidth * spread * worldPerPx,
          -Math.min(away, 1) * CAROUSEL.drop * this.stageHeight * worldPerPx,
          -away * CAROUSEL_DEPTH,
        );
      } else {
        const fade =
          smoothstep(this.fadeIn[0], this.fadeIn[1], t) *
          (1 - smoothstep(this.fadeOut[0], this.fadeOut[1], t));
        card.outer.visible = fade > FADE_HIDE;
        if (!card.outer.visible) continue;
        card.outer.scale.setScalar(fade);
        card.outer.position.copy(this.step).multiplyScalar(t * spread);
      }

      // Leaning back with the rest; turned to the reader as it opens at the front.
      this.turn.copy(this.lean).slerp(this.facing, Math.max(0, 1 - Math.abs(t) * 2) * open);
      // Hover: the side under the mouse dips away, so the card turns to face
      // the cursor, and eases back when the mouse leaves.
      let gx = 0;
      let gy = 0;
      if (i === hovered && !this.reduced) {
        // The card's centre and half its size on screen, in px of the stage.
        const size = card.outer.scale.x;
        const { proj, projEdge } = this;
        proj.copy(card.outer.position).project(camera);
        projEdge.copy(card.outer.position);
        projEdge.x += (CW / 2) * size;
        projEdge.y += (CH / 2) * size;
        projEdge.project(camera);
        const halfW = ((projEdge.x - proj.x) / 2) * this.stageWidth;
        const halfH = ((projEdge.y - proj.y) / 2) * this.stageHeight;
        gx = clamp((pointer.x - ((proj.x + 1) / 2) * this.stageWidth) / halfW, -1, 1);
        gy = clamp((pointer.y - ((1 - proj.y) / 2) * this.stageHeight) / halfH, -1, 1);
      }
      card.hx += (gx - card.hx) * hoverK;
      card.hy += (gy - card.hy) * hoverK;
      this.tipAngles.set(card.hy * HOVER_TILT, card.hx * HOVER_TILT, 0);
      this.tip.setFromEuler(this.tipAngles);
      // Spun by a drag on the front card; let go, it eases back to rest.
      if (card.spinBack) {
        const k = Math.min(1, (now - card.spinBack.start) / (this.reduced ? SPIN_BACK_MS_REDUCED : SPIN_BACK_MS));
        card.spin.copy(card.spinBack.from).slerp(this.rest, easeOut(k));
        if (k >= 1) {
          card.spin.identity();
          card.spinBack = null;
        }
      }
      card.outer.quaternion.copy(card.spin).multiply(this.tip).multiply(this.turn);

      const bump = (BUMP_DEPTH * density) / Math.max(0.1, this.camDist - card.outer.position.z);
      card.reliefs.forEach((material) => {
        material.bumpScale = bump;
      });
    }

    this.renderer.render(this.scene, camera);
    this.raf = requestAnimationFrame(this.frame);
  };
}
