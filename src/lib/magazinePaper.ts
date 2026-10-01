import type * as THREE_NS from 'three';
import {
  paperFragmentShader,
  paperVertexShader,
  shadowFragmentShader,
  shadowVertexShader,
} from './magazinePaperShader';

/**
 * The deck's cards as paper — one WebGL renderer for all of them.
 *
 * The carousel stays in the DOM: each card is still an element the deck
 * places, scales, blurs, fades and deals, and the frame still carries the
 * cursor tilt. What changes is what the element shows. It holds a plain 2D
 * canvas, a little larger than the card, and this renderer draws the card's
 * sheet into it: the artwork as a texture on a subdivided plane, deformed in
 * the vertex shader, coated and lit by a studio HDRI in the fragment shader.
 * The canvas inherits every transform the deck gives the card, so it is
 * aligned by construction; nothing here positions anything on screen.
 *
 * A context per card would run into the browser's limit on live contexts, so
 * there is one offscreen renderer, one geometry, two materials (the printed
 * face and the sheet's underside) sharing one set of uniforms, and a texture
 * per project. Drawing a card sets its uniforms, renders, and copies the
 * result into its canvas in the same task.
 *
 * Three.js and the studio maps load on demand from `create()`, client-side
 * only, so neither the server render nor the first paint pays for them.
 */

// The studio, baked from the source HDRI by scripts/bake-studio-env.py.
const ENV_URLS = {
  gloss: '/env/studio-gloss.hdr',
  haze: '/env/studio-haze.hdr',
  irr: '/env/studio-irr.hdr',
};
// Which way the room faces. A card only reflects a narrow cone of the room
// behind the viewer — about ±11° across, ±8° up and down — so these aim one
// light into it: the studio's square LED panel, up and to the left, where
// its corner rests on the top-left of the centred card. The tilt and the
// deck's travel sweep it across the sheet. Yaw in turns, pitch in degrees.
const ENV_YAW = 0.632;
const ENV_PITCH = 13;
// Where that panel is in the baked map (u, v). The shadow is cast from it,
// so the shadow and the reflection always agree about where the light is.
const KEY_LIGHT_UV: [number, number] = [0.675, 0.5];
// Overall brightness of the studio in the coat. The panel is ~25× the room's
// floor and the coat reflects 4% of it head-on — this makes it a bright,
// clean studio highlight rather than a blown-out patch, and leaves the dark
// walls and the floor all but invisible, so the print keeps its contrast.
const EXPOSURE = 0.6;
// clear coat, sheen, grazing lift — the coat's two roughnesses and the room
// it catches at a grazing angle.
const COAT: [number, number, number] = [1, 0.12, 0.3];
const FRESNEL_POWER = 3.5;

// Surface. How far the paper's height field tips the normal, as a slope — a
// fraction of a degree, felt only where a reflection lands.
const MICRO_NORMAL = 0.0025;
const PEEL_NORMAL = 0.16;
// The sheet's corners, px — the card's rounded-sm.
const CORNER_RADIUS = 2;
// Paper thickness, px at full curl. It only exists while the sheet bends:
// flat, the underside would peek past the face as a hairline on the cards
// away from the centre.
const THICKNESS = 1.5;
// The deformation's secondary motions, px per radian of curl.
const CROSS_BOW = 14;
const RIPPLE = 2.2;
// The scrim over the artwork (the old from-black/70 … to-black/20).
const SCRIM: [number, number] = [0.7, 0.2];

// The shadow. The sheet rests this many px above the surface; the curl and
// the tilt bring parts of it nearer (the tilt at this share of its depth).
const SHADOW_LIFT = 10;
const SHADOW_TILT_LIFT = 0.35;
// Contact: alpha, and px of blur per px of height. Ambient: alpha, blur per
// px of height, and the share of it in the long tail.
const SHADOW_CONTACT: [number, number] = [0.18, 0.35];
const SHADOW_AMBIENT: [number, number, number] = [0.11, 1.1, 0.4];

// Mesh resolution — the curl runs along the height, so that's where it's
// needed. Coarse pointers (phones) get a lighter mesh.
const SEGMENTS = { fine: [12, 48], coarse: [8, 28] } as const;
// px of mesh past the sheet's edge, so its outline antialiases inside geometry.
const EDGE_PAD = 2;
// Room around the card in the canvas, px: the leading edge runs ahead, a curl
// can swing the sheet past its rest outline, and the shadow falls below.
const MARGIN_SIDE = 56;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 110;
// Steps of the curl integral when working out the sheet's footprint —
// matches CURL_STEPS in the shader.
const CURL_STEPS = 12;

const MAX_PIXEL_RATIO = 2;
const COARSE_PIXEL_RATIO = 1.5;
const MAX_CANVAS_WIDTH = 2048;
// The artwork's widths, from next/image's default device sizes.
const ARTWORK_WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048];

export interface PaperScene {
  /** Unscaled card size, CSS px. */
  cardWidth: number;
  cardHeight: number;
  /** The largest scale a card is drawn at — sets the canvas resolution. */
  maxScale: number;
  /** The frame's CSS perspective — where the eye is. */
  eyeDistance: number;
  /** The paper's stock colour, `R G B` channels (the --color-stock token). */
  stock: string;
  /** Its shadow's colour (--color-shadow) and strength (--card-shadow-strength). */
  shadow: string;
  shadowStrength: number;
}

export interface PaperPose {
  /** The project's artwork URL. */
  src: string;
  /** The card's own scale and its travel along the deck, px. */
  scale: number;
  offsetY: number;
  /** The frame's tilt, degrees — gsap's rotationX / rotationY. */
  tiltX: number;
  tiltY: number;
  /** The sheet's curl, degrees, signed as the deck's bend spring. */
  bend: number;
  /** The share of the lead (0–1) the leading edge runs ahead. */
  lead: number;
  /** Seconds, for the ripple. */
  time: number;
  /** The artwork's hover zoom, 1 at rest. */
  zoom: number;
  /** Per-card, so neighbouring cards aren't cut from the same patch of paper. */
  seed: number;
  /** Draw at half resolution — for the blurred cards away from the centre. */
  lowRes: boolean;
}

/** How far the canvas reaches past its card, px — set on the canvas's style. */
export interface PaperMargins {
  side: number;
  top: number;
  bottom: number;
}

type Three = typeof THREE_NS;

interface Artwork {
  texture: THREE_NS.Texture | null;
  aspect: number;
  failed: boolean;
}

export class MagazinePaper {
  private readonly three: Three;
  private readonly renderer: THREE_NS.WebGLRenderer;
  private readonly scene: THREE_NS.Scene;
  private readonly camera: THREE_NS.PerspectiveCamera;
  private readonly face: THREE_NS.ShaderMaterial;
  private readonly underside: THREE_NS.ShaderMaterial;
  private readonly faceMesh: THREE_NS.Mesh;
  private readonly undersideMesh: THREE_NS.Mesh;
  private readonly shadow: THREE_NS.ShaderMaterial;
  private readonly shadowMesh: THREE_NS.Mesh;
  private shadowGeometry: THREE_NS.PlaneGeometry | null = null;
  private readonly envMaps: THREE_NS.Texture[];
  private readonly uniforms: Record<string, THREE_NS.IUniform>;
  private readonly artwork = new Map<string, Artwork>();
  private readonly loader: THREE_NS.TextureLoader;
  private readonly contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  private readonly coarse: boolean;
  private readonly onArtwork: () => void;
  private geometry: THREE_NS.PlaneGeometry | null = null;
  private card = { width: 0, height: 0, eye: 0 };
  private width = 0;
  private height = 0;
  private lost = false;
  margins: PaperMargins = { side: MARGIN_SIDE, top: MARGIN_TOP, bottom: MARGIN_BOTTOM };

  /**
   * Null when WebGL or the studio maps are unavailable — the cards then keep
   * their DOM face. `onLost` fires if the context is lost later; `onArtwork`
   * when a project's texture arrives, so the deck can draw it.
   */
  static async create(onLost: () => void, onArtwork: () => void): Promise<MagazinePaper | null> {
    if (typeof window === 'undefined') return null;
    try {
      const [three, { HDRLoader }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/HDRLoader.js'),
      ]);
      const hdr = new HDRLoader();
      const [gloss, haze, irr] = await Promise.all(
        [ENV_URLS.gloss, ENV_URLS.haze, ENV_URLS.irr].map((url) => hdr.loadAsync(url)),
      );
      return new MagazinePaper(three, [gloss, haze, irr], onLost, onArtwork);
    } catch (error) {
      console.warn('[MagazinePaper] WebGL paper unavailable, keeping the DOM cards.', error);
      return null;
    }
  }

  private constructor(
    three: Three,
    envMaps: THREE_NS.Texture[],
    onLost: () => void,
    onArtwork: () => void,
  ) {
    this.three = three;
    this.onArtwork = onArtwork;
    this.coarse = window.matchMedia('(pointer: coarse)').matches;
    const canvas = document.createElement('canvas');
    // Throws without WebGL 2 — create() turns that into the DOM fallback.
    this.renderer = new three.WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      stencil: false,
      powerPreference: 'default',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', () => {
      // dispose() forces a loss of its own; that one isn't news.
      if (this.lost) return;
      this.lost = true;
      onLost();
    });

    // The equirects wrap around; bilinear across the seam needs Repeat. And
    // they're sampled top row first, as baked — HDRLoader flips them by default.
    this.envMaps = envMaps;
    envMaps.forEach((map) => {
      map.flipY = false;
      map.wrapS = three.RepeatWrapping;
      map.wrapT = three.ClampToEdgeWrapping;
      map.needsUpdate = true;
    });

    this.loader = new three.TextureLoader();
    this.scene = new three.Scene();
    this.camera = new three.PerspectiveCamera();

    this.uniforms = {
      uCardSize: { value: new three.Vector2() },
      uBend: { value: 0 },
      uLead: { value: 0 },
      uCrossBow: { value: CROSS_BOW },
      uRipple: { value: RIPPLE },
      uTime: { value: 0 },
      uScale: { value: 1 },
      uOffsetY: { value: 0 },
      uFrame: { value: new three.Matrix3() },
      uThickness: { value: 0 },
      uRadius: { value: CORNER_RADIUS },
      uEye: { value: new three.Vector3() },
      uMap: { value: null },
      uUvRect: { value: new three.Vector4(1, 1, 0, 0) },
      uScrim: { value: new three.Vector2(...SCRIM) },
      uStock: { value: new three.Color(0.88, 0.87, 0.84) },
      uEnvGloss: { value: envMaps[0] },
      uEnvHaze: { value: envMaps[1] },
      uEnvIrr: { value: envMaps[2] },
      uEnvYaw: { value: ENV_YAW },
      uEnvPitch: { value: (ENV_PITCH * Math.PI) / 180 },
      uExposure: { value: EXPOSURE },
      uCoat: { value: new three.Vector3(...COAT) },
      uFresnelPower: { value: FRESNEL_POWER },
      uMicroNormal: { value: this.coarse ? 0 : MICRO_NORMAL },
      uPeelNormal: { value: PEEL_NORMAL },
      uDensity: { value: 1 },
      uSeed: { value: 0 },
    };
    const material = (sheet: number) =>
      new three.ShaderMaterial({
        vertexShader: paperVertexShader,
        fragmentShader: paperFragmentShader,
        // Shared, so both sheets are set in one place per draw; uSheet is the
        // only thing that differs, and it's a per-material override below.
        uniforms: { ...this.uniforms, uSheet: { value: sheet } },
        side: three.DoubleSide,
        transparent: true,
        depthTest: true,
        depthWrite: true,
      });
    this.underside = material(1);
    // And pushed back in depth, so the face always wins where they meet.
    this.underside.polygonOffset = true;
    this.underside.polygonOffsetFactor = 2;
    this.underside.polygonOffsetUnits = 2;
    this.face = material(0);
    this.faceMesh = new three.Mesh(undefined, this.face);
    this.undersideMesh = new three.Mesh(undefined, this.underside);
    this.shadow = new three.ShaderMaterial({
      vertexShader: shadowVertexShader,
      fragmentShader: shadowFragmentShader,
      uniforms: {
        // The sheet's own uniforms, shared, so the shadow reads the same
        // curl, scale and tilt the sheet was drawn with.
        uCardSize: this.uniforms.uCardSize,
        uBend: this.uniforms.uBend,
        uCrossBow: this.uniforms.uCrossBow,
        uScale: this.uniforms.uScale,
        uFrame: this.uniforms.uFrame,
        uFootprint: { value: new three.Vector4() },
        uLightDir: { value: keyLight(three) },
        uShadowColor: { value: new three.Color() },
        uShadowStrength: { value: 1 },
        uMotion: { value: 0 },
        uLift: { value: SHADOW_LIFT },
        uTiltLift: { value: SHADOW_TILT_LIFT },
        uContact: { value: new three.Vector2(...SHADOW_CONTACT) },
        uAmbient: { value: new three.Vector3(...SHADOW_AMBIENT) },
        uBounds: { value: new three.Vector4() },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.shadowMesh = new three.Mesh(undefined, this.shadow);
    // The shadow under everything, whatever its depth — a curl reaches back
    // past the surface it's cast on. Then the underside; the face then wins
    // every tie at equal depth.
    this.shadowMesh.renderOrder = -1;
    this.undersideMesh.renderOrder = 0;
    this.faceMesh.renderOrder = 1;
    this.scene.add(this.shadowMesh, this.undersideMesh, this.faceMesh);
  }

  get usable() {
    return !this.lost;
  }

  /** Card size and the room — on mount, and whenever the card resizes. */
  setScene(scene: PaperScene) {
    const three = this.three;
    const { cardWidth: w, cardHeight: h } = scene;
    this.card = { width: w, height: h, eye: scene.eyeDistance };
    (this.uniforms.uCardSize.value as THREE_NS.Vector2).set(w, h);
    (this.uniforms.uEye.value as THREE_NS.Vector3).set(0, 0, scene.eyeDistance);
    const channels = (value: string) => {
      const rgb = value.trim().split(/\s+/).map((n) => Number(n) / 255);
      return rgb.length === 3 && !rgb.some(Number.isNaN) ? rgb : null;
    };
    const stock = channels(scene.stock);
    // Kept as sRGB values: the shader linearises the stock itself.
    if (stock) (this.uniforms.uStock.value as THREE_NS.Color).setRGB(stock[0], stock[1], stock[2]);
    const shade = channels(scene.shadow);
    if (shade) {
      (this.shadow.uniforms.uShadowColor.value as THREE_NS.Color).setRGB(
        shade[0], shade[1], shade[2], three.SRGBColorSpace,
      );
    }
    this.shadow.uniforms.uShadowStrength.value = scene.shadowStrength;

    const [sx, sy] = this.coarse ? SEGMENTS.coarse : SEGMENTS.fine;
    this.geometry?.dispose();
    this.geometry = new three.PlaneGeometry(w + 2 * EDGE_PAD, h + 2 * EDGE_PAD, sx, sy);
    // UVs to the sheet itself, not the padded mesh — the pad samples the
    // artwork's clamped edge and is faded out by the outline.
    const uv = this.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (uv.getX(i) * (w + 2 * EDGE_PAD) - EDGE_PAD) / w,
        (uv.getY(i) * (h + 2 * EDGE_PAD) - EDGE_PAD) / h,
      );
    }
    this.faceMesh.geometry = this.geometry;
    this.undersideMesh.geometry = this.geometry;

    const { side, top, bottom } = this.margins;
    const fullW = w + 2 * side;
    const fullH = h + top + bottom;
    // The shadow's quad covers the whole canvas.
    this.shadowGeometry?.dispose();
    this.shadowGeometry = new three.PlaneGeometry(fullW, fullH);
    this.shadowGeometry.translate(0, (top - bottom) / 2, 0);
    (this.shadow.uniforms.uBounds.value as THREE_NS.Vector4).set(
      -fullW / 2, -h / 2 - bottom, fullW / 2, h / 2 + top,
    );
    this.shadowMesh.geometry = this.shadowGeometry;

    const cap = this.coarse ? COARSE_PIXEL_RATIO : MAX_PIXEL_RATIO;
    const ratio = Math.min(window.devicePixelRatio || 1, cap) * scene.maxScale;
    const width = Math.min(Math.round(fullW * ratio), MAX_CANVAS_WIDTH);
    const height = Math.round((width * fullH) / fullW);
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.renderer.setSize(width, height, false);
    }
    this.uniforms.uDensity.value = width / fullW;
  }

  /**
   * Whether a project's artwork is ready to draw. The first ask starts the
   * load — through next/image, so it's same-origin (no CORS), sized for the
   * canvas, and already in the browser's cache from the DOM face.
   */
  hasArtwork(src: string) {
    const art = this.artwork.get(src);
    if (art) return !!art.texture;
    const entry: Artwork = { texture: null, aspect: 1, failed: false };
    this.artwork.set(src, entry);
    const need = this.card.width * 1.3 * Math.min(window.devicePixelRatio || 1, 2);
    const width = ARTWORK_WIDTHS.find((w) => w >= need) ?? ARTWORK_WIDTHS[ARTWORK_WIDTHS.length - 1];
    const url = `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
    this.loader.load(
      url,
      (texture) => {
        const three = this.three;
        texture.colorSpace = three.SRGBColorSpace;
        // Clamped, never repeated: the sheet's edge samples the artwork's
        // own edge, not the far side of it.
        texture.wrapS = three.ClampToEdgeWrapping;
        texture.wrapT = three.ClampToEdgeWrapping;
        texture.minFilter = three.LinearMipmapLinearFilter;
        texture.magFilter = three.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        const image = texture.image as { width: number; height: number };
        entry.aspect = image.width / image.height;
        entry.texture = texture;
        if (this.lost) texture.dispose();
        else this.onArtwork();
      },
      undefined,
      () => {
        entry.failed = true;
      },
    );
    return false;
  }

  /** Draw one card's sheet into its canvas. */
  draw(target: HTMLCanvasElement, pose: PaperPose) {
    const art = this.artwork.get(pose.src);
    if (this.lost || !this.geometry || !this.width || !art?.texture) return false;
    const u = this.uniforms;
    const { width: w, height: h, eye } = this.card;

    // object-cover, then the hover zoom about the centre.
    const cardAspect = w / h;
    let sx = 1;
    let sy = 1;
    if (art.aspect > cardAspect) sx = cardAspect / art.aspect;
    else sy = art.aspect / cardAspect;
    sx /= pose.zoom;
    sy /= pose.zoom;
    (u.uUvRect.value as THREE_NS.Vector4).set(sx, sy, (1 - sx) / 2, (1 - sy) / 2);
    u.uMap.value = art.texture;

    const bend = (pose.bend * Math.PI) / 180;
    u.uBend.value = bend;
    u.uLead.value = pose.lead;
    u.uTime.value = pose.time;
    u.uThickness.value = THICKNESS * Math.min(1, Math.abs(pose.bend) / 4);
    // Below half a px there's no edge to see, only a sheet to fight with.
    this.undersideMesh.visible = u.uThickness.value > 0.5;
    u.uScale.value = pose.scale;
    u.uOffsetY.value = pose.offsetY;
    u.uSeed.value = pose.seed;
    this.castShadow(bend, pose.lead);
    (u.uFrame.value as THREE_NS.Matrix3).copy(frameRotation(this.three, pose.tiltX, pose.tiltY));

    // The eye, in this card's own space: the page's eye sits eyeDistance in
    // front of the frame's centre, and this card is offsetY below that centre
    // at `scale`. An off-axis frustum through the canvas's rectangle maps the
    // flat sheet exactly onto the canvas; only relief moves off it.
    const ey = pose.offsetY / pose.scale;
    const ez = eye / pose.scale;
    // The nearest the sheet ever comes is a curl's relief in front of the
    // card, and the farthest its curl behind it, so the depth range hugs the
    // card: a near plane at 1px would leave the underside, a paper's
    // thickness behind the face, fighting it for depth in white shards.
    const near = Math.max(1, ez - 400);
    const { side, top, bottom } = this.margins;
    const mx = w / 2 + side;
    this.camera.position.set(0, ey, ez);
    this.camera.updateMatrixWorld();
    this.camera.projectionMatrix.makePerspective(
      (-mx * near) / ez,
      (mx * near) / ez,
      ((h / 2 + top - ey) * near) / ez,
      ((-h / 2 - bottom - ey) * near) / ez,
      near,
      ez + 400,
    );
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

    const scale = pose.lowRes ? 0.5 : 1;
    const vw = Math.round(this.width * scale);
    const vh = Math.round(this.height * scale);
    this.renderer.setViewport(0, 0, vw, vh);
    this.renderer.render(this.scene, this.camera);

    if (target.width !== vw || target.height !== vh) {
      target.width = vw;
      target.height = vh;
      this.contexts.delete(target);
    }
    let ctx = this.contexts.get(target);
    if (!ctx) {
      ctx = target.getContext('2d') ?? undefined;
      if (!ctx) return false;
      this.contexts.set(target, ctx);
    }
    // Copied in the same task as the render, so the drawing buffer is still
    // intact without preserveDrawingBuffer. The viewport is the bottom-left
    // of the drawing buffer, which is the canvas's bottom rows.
    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(this.renderer.domElement, 0, this.height - vh, vw, vh, 0, 0, vw, vh);
    return true;
  }

  /**
   * Where the flexed sheet lies over the surface — the same curl integral the
   * vertex shader walks, taken to the trailing edge — and how much the deck's
   * movement is spreading its shadow.
   */
  private castShadow(bend: number, lead: number) {
    const { width: w, height: h } = this.card;
    const phi = Math.abs(bend);
    let along = h;
    if (phi > 1e-5) {
      along = 0;
      const step = h / CURL_STEPS;
      for (let i = 0; i < CURL_STEPS; i++) {
        const s = ((i + 0.5) * step) / h;
        along += step * Math.cos(phi * s * s);
      }
    }
    // Card space, y up. Moving down the screen (bend > 0) the bottom leads.
    const [y0, y1] =
      bend > 0 ? [-h / 2 - lead, -h / 2 + along - lead] : [h / 2 - along + lead, h / 2 + lead];
    const u = this.shadow.uniforms;
    (u.uFootprint.value as THREE_NS.Vector4).set(-w / 2, y0, w / 2, y1);
    // The bend is the deck's spring, so the spread eases back with the sheet.
    u.uMotion.value = Math.min(1, phi / ((30 * Math.PI) / 180));
  }

  /** A card that's gone off screen gives its canvas memory back. */
  release(target: HTMLCanvasElement) {
    this.contexts.delete(target);
    target.width = 0;
    target.height = 0;
  }

  dispose() {
    this.lost = true;
    this.artwork.forEach((art) => art.texture?.dispose());
    this.artwork.clear();
    this.envMaps.forEach((map) => map.dispose());
    this.geometry?.dispose();
    this.shadowGeometry?.dispose();
    this.shadow.dispose();
    this.face.dispose();
    this.underside.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/**
 * The key light's direction in frame space (y down, z toward the viewer): the
 * panel's place in the baked map, run back through the room's yaw and pitch —
 * env() in the shader, inverted.
 */
function keyLight(three: Three) {
  const [u, v] = KEY_LIGHT_UV;
  const phi = (u - 0.5 - ENV_YAW) * 2 * Math.PI;
  const elevation = (0.5 - v) * Math.PI;
  const pitch = (ENV_PITCH * Math.PI) / 180;
  const dx = Math.cos(elevation) * Math.sin(phi);
  const dy = Math.sin(elevation);
  const dz = -Math.cos(elevation) * Math.cos(phi);
  const y = dy * Math.cos(pitch) + dz * Math.sin(pitch);
  const z = -dy * Math.sin(pitch) + dz * Math.cos(pitch);
  return new three.Vector3(dx, -y, z).normalize();
}

const DEG = Math.PI / 180;
let rotation: THREE_NS.Matrix3 | null = null;

/**
 * The frame's tilt as CSS applies it: gsap writes rotateY before rotateX, so a
 * point is turned by X first, then Y. CSS space — y down, z toward the viewer.
 */
function frameRotation(three: Three, tiltX: number, tiltY: number) {
  const cx = Math.cos(tiltX * DEG);
  const sx = Math.sin(tiltX * DEG);
  const cy = Math.cos(tiltY * DEG);
  const sy = Math.sin(tiltY * DEG);
  rotation ??= new three.Matrix3();
  // Ry · Rx, with CSS's rotateX [1 0 0; 0 c -s; 0 s c] and
  // rotateY [c 0 s; 0 1 0; -s 0 c].
  return rotation.set(
    cy, sy * sx, sy * cx,
    0, cx, -sx,
    -sy, cy * sx, cy * cx,
  );
}
