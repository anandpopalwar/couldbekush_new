/**
 * The Gildfold collection — five hot-foil greeting cards, drawn in code.
 *
 * Nothing here is an image. Each design is a set of white masks painted on a
 * 2D canvas — one for the foil, one for the ink, one for the blind deboss —
 * in units of `u`, 1% of the card's width, so the same drawing serves a 92px
 * thumbnail and a 1024px texture. What fills a mask is decided by whoever
 * asked for it: lib/foilCardScene.ts turns them into the colour, height,
 * roughness and metalness of a lit 3D card; `flat()` below tints them for the
 * rack's thumbnails and for the fallback where WebGL isn't available.
 *
 * The stock, foil and ink colours are the cards' own materials — content, like
 * a project's theme colours — so they live here as data. The lettering is the
 * site's typeface, read from the font tokens rather than named.
 */

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export interface FoilCard {
  name: string;
  /** Paper: its colour, its full name, and the short one for the back. */
  stock: string;
  stockName: string;
  stockShort: string;
  /** Foil: its colour in the light, its name, and the ramp for flat renders. */
  foil: string;
  foilName: string;
  grad: string[];
  finish: string;
  envelope: string;
  /** Ink inside the card, and the quieter one for the imprint on the back. */
  ink: string;
  backInk: string;
  desc: string;
  /** The greeting inside, where it sits (share of the height), and whether
      it's stamped in foil rather than printed. */
  message: string[];
  msgY: number;
  foilMessage: boolean;
  /** A round window cut through the cover — centre and radius, in card widths. */
  dieCut?: { x: number; y: number; r: number };
  front: Draw;
  inside?: Draw;
  deboss?: Draw;
}

/** A card is 5 × 7 in. */
export const CARD_ASPECT = 1.4;

// The designs were drawn around a narrower face; the site's runs wider, so
// every size is set down by this much to keep each line the length it was.
const TYPE_SCALE = 0.84;
// How the blind deboss and the die-cut's shade read in a flat render.
const FLAT_DEBOSS = 'rgba(60,40,20,.16)';
const FLAT_WINDOW_SHADE = 'rgba(0,0,0,.22)';

let faces: { sans: string; code: string } | null = null;

/** The site's faces, straight from the font tokens. */
function fonts() {
  if (!faces) {
    const style = getComputedStyle(document.documentElement);
    faces = {
      sans: style.getPropertyValue('--font-google-sans').trim() || 'sans-serif',
      code: style.getPropertyValue('--font-google-sans-code').trim() || 'monospace',
    };
  }
  return faces;
}

/** Resolves once the lettering's faces are loaded — a canvas won't wait for them. */
export async function cardFontsReady() {
  const { sans, code } = fonts();
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`500 64px ${sans}`, 'Hooray'),
        document.fonts.load(`600 64px ${sans}`, 'GILDFOLD'),
        document.fonts.load(`500 20px ${code}`, 'HOT'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]);
  } catch {
    // Drawn in the fallback face instead.
  }
}

/* ── drawing helpers ───────────────────────────────────────────────────── */

/** Seeded, so the stars and the confetti land in the same places every time. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mk(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** One mask: whatever `draw` paints, in white on nothing. */
export function layer(draw: Draw, w: number, h: number) {
  const canvas = mk(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  draw(ctx, w, h);
  return canvas;
}

function lettering(ctx: CanvasRenderingContext2D, px: number, weight = 500) {
  ctx.font = `${weight} ${px * TYPE_SCALE}px ${fonts().sans}`;
}

/** Centred text with tracking — canvas has no letter-spacing everywhere yet. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, track: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  let cx = x - (widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1)) / 2;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + track;
  });
  ctx.textAlign = 'center';
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(r, 0.1), 0, Math.PI * 2);
  ctx.stroke();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

/** The greeting inside a card. */
export function message(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[], y0: number) {
  const u = w / 100;
  lettering(ctx, 6.2 * u);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, y0 + i * 8.6 * u));
}

/** The imprint on the back: the maker, the card, how it was made. */
export function backText(card: FoilCard): Draw {
  return (ctx, w, h) => {
    const u = w / 100;
    lettering(ctx, 2.6 * u, 600);
    spaced(ctx, 'GILDFOLD', w / 2, h * 0.872, 1.3 * u);
    lettering(ctx, 2.2 * u, 400);
    ctx.textAlign = 'center';
    ctx.fillText(`${card.name}. ${card.foilName} foil on ${card.stockShort}.`, w / 2, h * 0.9);
    ctx.font = `500 ${1.55 * u}px ${fonts().code}`;
    ctx.fillText('HOT-FOIL STAMPED BY HAND · 5 × 7 IN', w / 2, h * 0.925);
  };
}

/** One fern leaflet: a tapered blade with small lobes along both edges. */
function pinna(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, L: number, u: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const W = L * 0.2;
  const lobes = Math.max(3, Math.round(L / (1.6 * u)));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= lobes; i++) {
    const t = i / lobes;
    const w = W * (1 - t * 0.85);
    ctx.quadraticCurveTo(L * (t - 0.5 / lobes), -w * 1.35, L * t, -w * 0.55);
  }
  for (let i = lobes; i >= 1; i--) {
    const t = i / lobes;
    const w = W * (1 - t * 0.85);
    ctx.lineTo(L * t, w * 0.55);
    ctx.quadraticCurveTo(L * (t - 0.5 / lobes), w * 1.35, L * (t - 1 / lobes), w * 0.5);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function frond(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, ang: number, len: number, curl: number, maxLeaf: number, u: number,
) {
  const n = 30;
  const step = len / n;
  const P: [number, number, number][] = [];
  let px = x;
  let py = y;
  let a = ang;
  for (let i = 0; i <= n; i++) {
    P.push([px, py, a]);
    px += Math.cos(a) * step;
    py += Math.sin(a) * step;
    a += (curl / n) * (0.6 + i / n);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    ctx.lineWidth = (0.75 * (1 - i / n) + 0.18) * u;
    ctx.beginPath();
    ctx.moveTo(P[i][0], P[i][1]);
    ctx.lineTo(P[i + 1][0], P[i + 1][1]);
    ctx.stroke();
  }
  for (let i = 2; i < n; i++) {
    const t = i / n;
    const L = maxLeaf * Math.pow(1 - t, 0.9) * Math.min(1, 0.55 + t * 2.2);
    if (L < 0.5 * u) continue;
    for (const s of [-1, 1]) pinna(ctx, P[i][0], P[i][1], P[i][2] + s * (1.25 - t * 0.55), L, u);
  }
}

function confetti(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, r: () => number, n: number,
  avoid: [number, number, number, number] | null, u: number,
  region: [number, number, number, number] = [6 * u, 6 * u, w - 6 * u, h - 6 * u],
) {
  for (let i = 0; i < n; i++) {
    const x = region[0] + r() * (region[2] - region[0]);
    const y = region[1] + r() * (region[3] - region[1]);
    const k = r();
    const rot = r() * Math.PI;
    const s = r();
    if (avoid && x > avoid[0] && x < avoid[2] && y > avoid[1] && y < avoid[3]) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (k < 0.34) dot(ctx, 0, 0, (0.6 + s * 0.9) * u);
    else if (k < 0.6) ctx.fillRect(-0.55 * u, -1.5 * u, 1.1 * u, 3 * u);
    else if (k < 0.8) {
      ctx.lineWidth = 0.5 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let j = 0; j <= 18; j++) {
        const t = j / 18;
        const px = (t - 0.5) * 7 * u;
        const py = Math.sin(t * Math.PI * 3) * u;
        if (j) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    } else if (k < 0.9) {
      ctx.lineWidth = 0.42 * u;
      ring(ctx, 0, 0, (0.9 + s * 0.6) * u);
    } else {
      const q = 1.6 * u;
      ctx.beginPath();
      ctx.moveTo(0, -q);
      ctx.lineTo(q * 0.87, q * 0.5);
      ctx.lineTo(-q * 0.87, q * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/** One wave scale: concentric arcs, cut clear of the scale beneath it. */
function scale(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, u: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  dot(ctx, x, y, R);
  ctx.restore();
  ctx.lineWidth = 0.42 * u;
  for (let k = 0; k < 4; k++) ring(ctx, x, y, R * (1 - k * 0.22) - 0.35 * u);
  dot(ctx, x, y, R * 0.1);
}

function seigaiha(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, R: number, u: number) {
  for (let row = 0; ; row++) {
    const y = y0 + row * R * 0.5;
    if (y > y1) break;
    const off = row % 2 ? R : 0;
    for (let x = x0 - 2 * R + off; x < x1 + 2 * R; x += 2 * R) scale(ctx, x, y, R, u);
  }
}

/* ── the collection ────────────────────────────────────────────────────── */

export const FOIL_CARDS: FoilCard[] = [
  {
    name: 'Bright Days',
    stock: '#F1E8D6', stockName: 'Cream cotton, 350 gsm', stockShort: 'cream cotton',
    foil: '#E9C068', foilName: 'Gold', grad: ['#FFF2C4', '#DDAF52', '#8E651F', '#F3D58A'],
    finish: 'Blind-debossed double border', envelope: 'Kraft A7, 5¼ × 7¼ in',
    ink: '#3A3026', backInk: '#6B5F50',
    desc: 'A low sun throws forty gold rays across cream cotton. The double border is pressed without foil, so it only shows when light rakes across it.',
    message: ["Here's to the", 'bright days ahead.'], msgY: 0.52, foilMessage: false,
    front(ctx, w, h) {
      const u = w / 100;
      const hx = w / 2;
      const hy = h * 0.7;
      ctx.save();
      ctx.beginPath();
      ctx.rect(10 * u, 10 * u, w - 20 * u, hy - 11.6 * u);
      ctx.clip();
      const N = 40;
      for (let i = 0; i < N; i++) {
        const a = Math.PI + ((i + 0.5) / N) * Math.PI;
        const long = i % 2 === 0;
        const r0 = 20 * u;
        const r1 = long ? 150 * u : 46 * u;
        const da = long ? 0.017 : 0.012;
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(a - da * 0.35) * r0, hy + Math.sin(a - da * 0.35) * r0);
        ctx.lineTo(hx + Math.cos(a - da) * r1, hy + Math.sin(a - da) * r1);
        ctx.lineTo(hx + Math.cos(a + da) * r1, hy + Math.sin(a + da) * r1);
        ctx.lineTo(hx + Math.cos(a + da * 0.35) * r0, hy + Math.sin(a + da * 0.35) * r0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(hx, hy - 0.8 * u, 13.5 * u, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 0.5 * u;
      ctx.beginPath();
      ctx.arc(hx, hy - 0.8 * u, 16.6 * u, Math.PI, 0);
      ctx.stroke();
      ctx.fillRect(10 * u, hy - 0.25 * u, w - 20 * u, 0.5 * u);
      [[44, 0.34, 3.2], [30, 0.3, 5.4], [17, 0.26, 7.6], [7, 0.22, 9.8]].forEach(([l, t, d]) =>
        ctx.fillRect(hx - (l / 2) * u, hy + d * u, l * u, t * u),
      );
      lettering(ctx, 10.5 * u);
      ctx.textAlign = 'center';
      ctx.fillText('Bright Days', hx, h * 0.875);
    },
    deboss(ctx, w, h) {
      const u = w / 100;
      ctx.lineWidth = 0.6 * u;
      ctx.strokeRect(5.5 * u, 5.5 * u, w - 11 * u, h - 11 * u);
      ctx.lineWidth = 0.28 * u;
      ctx.strokeRect(7.3 * u, 7.3 * u, w - 14.6 * u, h - 14.6 * u);
    },
    inside(ctx, w, h) {
      const u = w / 100;
      const x = w / 2;
      const y = h * 0.38;
      ctx.beginPath();
      ctx.arc(x, y, 5 * u, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 0.45 * u;
      ctx.lineCap = 'round';
      for (let i = 0; i < 11; i++) {
        const a = Math.PI + ((i + 0.5) / 11) * Math.PI;
        const r1 = (i % 2 ? 9.5 : 11.5) * u;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 7 * u, y + Math.sin(a) * 7 * u);
        ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.fillRect(x - 14 * u, y + 1.4 * u, 28 * u, 0.35 * u);
    },
  },
  {
    name: 'Moonrise',
    stock: '#141B33', stockName: 'Midnight cotton, 350 gsm', stockShort: 'midnight cotton',
    foil: '#DCE1E7', foilName: 'Silver', grad: ['#FFFFFF', '#C2C9D1', '#6C7480', '#EEF1F4'],
    finish: 'Die-cut 2 in moon window', envelope: 'Navy A7, 5¼ × 7¼ in',
    ink: '#DCE1E7', backInk: '#9AA3B8',
    desc: 'A round window is cut through the cover. Close the card and the silver moon pressed on the inside sits exactly in it.',
    message: ['Thinking of you,', 'near and far.'], msgY: 0.6, foilMessage: true,
    dieCut: { x: 0.5, y: 0.3, r: 0.2 },
    front(ctx, w, h) {
      const u = w / 100;
      const cx = w / 2;
      const cy = h * 0.3;
      const R = w * 0.2;
      ctx.lineWidth = 0.55 * u;
      ring(ctx, cx, cy, R + 1.8 * u);
      ctx.lineWidth = 0.22 * u;
      ring(ctx, cx, cy, R + 3.4 * u);
      const r = rng(7);
      for (let i = 0; i < 130; i++) {
        const x = 8 * u + r() * (w - 16 * u);
        const y = 8 * u + r() * (h * 0.74 - 8 * u);
        const s = r();
        if (Math.hypot(x - cx, y - cy) < R + 6 * u) continue;
        if (s > 0.93) sparkle(ctx, x, y, (1.4 + r() * 1.8) * u);
        else dot(ctx, x, y, (0.16 + s * 0.42) * u);
      }
      const P = [[15, 84], [24, 79], [31, 88], [42, 83], [51, 92], [61, 86], [71, 94], [83, 88]].map(
        ([a, b]) => [a * u, b * u],
      );
      ctx.lineWidth = 0.2 * u;
      ctx.beginPath();
      P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      P.forEach(([x, y], i) => (i % 3 === 1 ? sparkle(ctx, x, y, 1.7 * u) : dot(ctx, x, y, 0.75 * u)));
      lettering(ctx, 10.5 * u);
      ctx.textAlign = 'center';
      ctx.fillText('Moonrise', cx, h * 0.865);
      lettering(ctx, 2.4 * u);
      spaced(ctx, 'NEAR & FAR', cx, h * 0.905, 0.9 * u);
    },
    inside(ctx, w, h) {
      const u = w / 100;
      const cx = w / 2;
      const cy = h * 0.3;
      const R = w * 0.2 * 0.9;
      dot(ctx, cx, cy, R);
      const r = rng(3);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * R * 0.8;
        const cr = (1 + r() * 3.2) * u;
        ctx.globalAlpha = 0.2 + r() * 0.3;
        dot(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr);
      }
      ctx.restore();
    },
  },
  {
    name: 'Fern Study',
    stock: '#8F9E87', stockName: 'Sage cotton, 350 gsm', stockShort: 'sage cotton',
    foil: '#DB8F5C', foilName: 'Copper', grad: ['#FFD8BA', '#D2865A', '#7A3F20', '#F2B68C'],
    finish: 'Single-pass copper stamp', envelope: 'Ivory A7, 5¼ × 7¼ in',
    ink: '#26301F', backInk: '#46523F',
    desc: 'Three copper fronds unfurl from the bottom edge of a sage cover. Every leaflet is stamped in one pass of the die.',
    message: ['Welcome home.', 'May it grow with you.'], msgY: 0.52, foilMessage: false,
    front(ctx, w, h) {
      const u = w / 100;
      frond(ctx, w * 0.5, h * 0.965, -Math.PI / 2 - 0.18, h * 0.7, 0.5, 16 * u, u);
      frond(ctx, w * 0.48, h * 0.965, -Math.PI / 2 - 0.74, h * 0.4, -0.5, 10.5 * u, u);
      frond(ctx, w * 0.52, h * 0.965, -Math.PI / 2 + 0.66, h * 0.42, 0.55, 10.5 * u, u);
      lettering(ctx, 3.4 * u, 600);
      spaced(ctx, 'FERN STUDY', w / 2, 12 * u, 1.3 * u);
    },
    inside(ctx, w, h) {
      const u = w / 100;
      frond(ctx, w * 0.5 - 19 * u, h * 0.37, -0.08, 38 * u, 0.25, 7.5 * u, u);
    },
  },
  {
    name: 'Hooray',
    stock: '#EECDC3', stockName: 'Blush cotton, 350 gsm', stockShort: 'blush cotton',
    foil: '#D9967F', foilName: 'Rose gold', grad: ['#FFE4D9', '#DD9C86', '#93513F', '#F5C4B2'],
    finish: 'Confetti on cover and inside', envelope: 'Blush A7, 5¼ × 7¼ in',
    ink: '#4A2C27', backInk: '#8A6058',
    desc: 'Rose-gold confetti scattered around one big word. Made for birthdays and anything else worth cheering.',
    message: ['Happy birthday!', 'Another lap around', 'the sun, well run.'], msgY: 0.53, foilMessage: false,
    front(ctx, w, h) {
      const u = w / 100;
      const cx = w / 2;
      const ty = h * 0.56;
      lettering(ctx, 20 * u);
      ctx.textAlign = 'center';
      const tw = ctx.measureText('Hooray!').width;
      ctx.fillText('Hooray!', cx, ty);
      confetti(ctx, w, h, rng(11), 130, [cx - tw / 2 - 3 * u, ty - 17 * u, cx + tw / 2 + 3 * u, ty + 6 * u], u);
    },
    inside(ctx, w, h) {
      const u = w / 100;
      confetti(ctx, w, h, rng(5), 34, null, u, [16 * u, 16 * u, w - 16 * u, h * 0.4]);
    },
  },
  {
    name: 'Tide Lines',
    stock: '#202327', stockName: 'Charcoal cotton, 350 gsm', stockShort: 'charcoal cotton',
    foil: '#E3BB66', foilName: 'Gold', grad: ['#FFF0C0', '#D9AC52', '#86601E', '#F0D284'],
    finish: 'Full-bleed wave pattern', envelope: 'Black A7, 5¼ × 7¼ in',
    ink: '#E3BB66', backInk: '#8E9399',
    desc: 'Rows of overlapping wave scales run off the bottom edge in gold. A quiet card for saying thank you.',
    message: ['Thank you', 'for everything.'], msgY: 0.53, foilMessage: true,
    front(ctx, w, h) {
      const u = w / 100;
      lettering(ctx, 12 * u);
      ctx.textAlign = 'center';
      ctx.fillText('Thank you', w / 2, h * 0.27);
      ctx.fillRect(w / 2 - 7 * u, h * 0.27 + 5 * u, 14 * u, 0.35 * u);
      seigaiha(ctx, 0, h * 0.5, w, h + 10 * u, 8 * u, u);
    },
    inside(ctx, w, h) {
      const u = w / 100;
      const R = 4.4 * u;
      const y = h * 0.36;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, y + R * 0.5);
      ctx.clip();
      [[w / 2 - R, y], [w / 2 + R, y], [w / 2, y + R * 0.5]].forEach(([x, yy]) => scale(ctx, x, yy, R, u));
      ctx.restore();
    },
  },
];

/* ── flat renders ──────────────────────────────────────────────────────── */

/**
 * A card drawn flat, `w` px wide: the rack's thumbnails, and the whole viewer
 * where WebGL isn't available. The foil is its colour ramp rather than a
 * reflection, and the deboss a faint tint.
 */
export function flat(card: FoilCard, w: number, side: 'front' | 'inside') {
  const h = Math.round(w * CARD_ASPECT);
  const canvas = mk(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = card.stock;
  ctx.fillRect(0, 0, w, h);

  const foil = () => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    card.grad.forEach((stop, i) => gradient.addColorStop(i / (card.grad.length - 1), stop));
    return gradient;
  };
  const tint = (mask: HTMLCanvasElement, fill: string | CanvasGradient) => {
    const tinted = mk(w, h);
    const tx = tinted.getContext('2d')!;
    tx.drawImage(mask, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = fill;
    tx.fillRect(0, 0, w, h);
    ctx.drawImage(tinted, 0, 0);
  };

  if (side === 'inside') {
    if (card.inside) tint(layer(card.inside, w, h), foil());
    tint(
      layer((c, W, H) => message(c, W, H, card.message, H * card.msgY), w, h),
      card.foilMessage ? foil() : card.ink,
    );
    return canvas;
  }

  if (card.deboss) tint(layer(card.deboss, w, h), FLAT_DEBOSS);
  if (card.dieCut && card.inside) {
    const { x, y, r } = card.dieCut;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w * x, h * y, w * r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = FLAT_WINDOW_SHADE;
    ctx.fillRect(0, 0, w, h);
    tint(layer(card.inside, w, h), foil());
    ctx.restore();
  }
  tint(layer(card.front, w, h), foil());
  return canvas;
}
