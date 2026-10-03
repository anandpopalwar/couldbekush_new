import type { MagazineData } from '@/types/magazines';
import { CARD_ASPECT, type FoilCard, layer, message, mk } from './foilCards';

/**
 * A magazine's artwork as layers — the one shape the viewer presses from,
 * wherever the artwork came from.
 *
 * Two sources. The built-in magazines are drawn in code (lib/foilCards.ts)
 * and turn their drawings into layers here. A magazine from the CMS arrives
 * as image files, one per layer, designed in Figma at 1024 × 1434 px; they
 * are loaded and drawn to the size the viewer asks for.
 *
 * A layer is a canvas. `print` is the full-colour artwork on its paper.
 * `foil`, `ink` and `deboss` are masks — white where the thing is, in the
 * alpha channel, which is what the baking reads. `dieCut` is black where the
 * hole is, as seen from the front.
 */

export interface FaceLayers {
  print?: HTMLCanvasElement;
  foil?: HTMLCanvasElement;
  deboss?: HTMLCanvasElement;
  /** Built-in magazines only: a mask printed in `inkColor` over the stock. */
  ink?: HTMLCanvasElement;
  inkColor?: string;
}

export interface CardLayers {
  front: FaceLayers;
  insideLeft: FaceLayers;
  insideRight: FaceLayers;
  back: FaceLayers;
  dieCut?: HTMLCanvasElement;
}

export interface ViewerCard {
  name: string;
  /** Paper: its colour, and its name in two words. */
  stock: string;
  stockShort: string;
  /** Foil: its colour in the light, its name, and the ramp for flat renders. */
  foil: string;
  foilName: string;
  grad: string[];
  finish: string;
  /** The greeting inside, for a screen reader. */
  insideMessage: string;
  /** Every face's layers, `width` px wide. Rejects with a LayerError if a file won't load. */
  layers: (width: number) => Promise<CardLayers>;
}

/** A layer file that would not load — `field` says which, as the CMS names it. */
export class LayerError extends Error {
  constructor(public readonly field: string) {
    super(`The ${field} layer failed to load.`);
  }
}

// How the blind deboss and the die-cut's shade read in a flat render.
const FLAT_DEBOSS = 'rgba(60,40,20,.16)';
const FLAT_WINDOW_SHADE = 'rgba(0,0,0,.22)';

const heightFor = (width: number) => Math.round(width * CARD_ASPECT);

/* ── built-in magazines: from their drawings ───────────────────────────── */

export function drawnCard(card: FoilCard): ViewerCard {
  return {
    name: card.name,
    stock: card.stock,
    stockShort: card.stockShort,
    foil: card.foil,
    foilName: card.foilName,
    grad: card.grad,
    finish: card.finish,
    insideMessage: card.message.join(' '),
    layers: async (width) => {
      const w = width;
      const h = heightFor(width);
      const greeting = (ctx: CanvasRenderingContext2D, W: number, H: number) =>
        message(ctx, W, H, card.message, H * card.msgY);
      let dieCut: HTMLCanvasElement | undefined;
      if (card.dieCut) {
        dieCut = mk(w, h);
        const ctx = dieCut.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(w * card.dieCut.x, h * card.dieCut.y, w * card.dieCut.r, 0, Math.PI * 2);
        ctx.fill();
      }
      return {
        front: {
          foil: layer(card.front, w, h),
          deboss: card.deboss ? layer(card.deboss, w, h) : undefined,
        },
        insideLeft: {},
        // The greeting is stamped in foil on some, printed in ink on the rest.
        insideRight: {
          foil: layer((ctx, W, H) => {
            card.inside?.(ctx, W, H);
            if (card.foilMessage) greeting(ctx, W, H);
          }, w, h),
          ink: card.foilMessage ? undefined : layer(greeting, w, h),
          inkColor: card.ink,
        },
        back: {},
        dieCut,
      };
    },
  };
}

/* ── magazines from the CMS: from their files ──────────────────────────── */

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (from: number[], to: number[], t: number) =>
  `rgb(${from.map((c, i) => Math.round(c + (to[i] - c) * t)).join(' ')})`;

/** A foil has no ramp in the CMS, only a colour: this is the ramp, from that. */
function rampFrom(hex: string) {
  const colour = channels(hex);
  return [mix(colour, WHITE, 0.6), hex, mix(colour, BLACK, 0.45), mix(colour, WHITE, 0.3)];
}

// crossOrigin: the files may be on another origin (Vercel Blob), and a canvas
// that has drawn one without it can't be read back.
async function load(url: string, field: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new LayerError(field);
  }
  return image;
}

/** Stretched to fit — every layer is the card's own shape. */
function drawn(image: HTMLImageElement, w: number, h: number) {
  const canvas = mk(w, h);
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(image, 0, 0, w, h);
  return canvas;
}

/**
 * A mask file, turned into what the baking reads: white, with the mask in the
 * alpha channel. That is the file's brightness times its own alpha, so white
 * on black and white on transparent both work.
 */
function mask(image: HTMLImageElement, w: number, h: number) {
  const canvas = drawn(image, w, h);
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.getImageData(0, 0, w, h);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const luminance = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = (luminance * d[i + 3]) / 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/** Over white, so the transparent parts of a die-cut file count as paper. */
function window(image: HTMLImageElement, w: number, h: number) {
  const canvas = mk(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas;
}

export function uploadedCard(data: MagazineData): ViewerCard {
  return {
    name: data.name,
    stock: data.stock.color,
    stockShort: data.stock.short,
    foil: data.foil.color,
    foilName: data.foil.label,
    grad: rampFrom(data.foil.color),
    finish: data.finish,
    insideMessage: data.insideMessage,
    layers: async (width) => {
      const w = width;
      const h = heightFor(width);
      const print = async (url: string | undefined, field: string) =>
        url ? drawn(await load(url, field), w, h) : undefined;
      const masked = async (url: string | undefined, field: string) =>
        url ? mask(await load(url, field), w, h) : undefined;
      const face = async (name: 'front' | 'insideLeft' | 'insideRight' | 'back') => {
        const files = data[name];
        const [p, f, d] = await Promise.all([
          print(files.print, `${name}.print`),
          masked(files.foil, `${name}.foil`),
          masked(files.deboss, `${name}.deboss`),
        ]);
        return { print: p, foil: f, deboss: d };
      };
      const [front, insideLeft, insideRight, back, dieCut] = await Promise.all([
        face('front'),
        face('insideLeft'),
        face('insideRight'),
        face('back'),
        data.front.dieCut
          ? load(data.front.dieCut, 'front.dieCut').then((image) => window(image, w, h))
          : undefined,
      ]);
      return { front, insideLeft, insideRight, back, dieCut };
    },
  };
}

/* ── flat renders ──────────────────────────────────────────────────────── */

/**
 * A magazine drawn flat, `width` px wide — what the page shows where WebGL
 * isn't available. The foil is its colour ramp rather than a reflection, the
 * deboss a faint tint, and a die-cut shows the page behind it.
 */
export async function flat(card: ViewerCard, width: number, side: 'front' | 'inside') {
  const w = width;
  const h = heightFor(width);
  const layers = await card.layers(w);

  // One face on a canvas of its own: its print, or bare stock, and then
  // whatever is pressed into it.
  const paint = (face: FaceLayers) => {
    const canvas = mk(w, h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    if (face.print) ctx.drawImage(face.print, 0, 0, w, h);
    else {
      ctx.fillStyle = card.stock;
      ctx.fillRect(0, 0, w, h);
    }
    const ramp = ctx.createLinearGradient(0, 0, w, h);
    card.grad.forEach((stop, i) => ramp.addColorStop(i / (card.grad.length - 1), stop));
    const press = (mask: HTMLCanvasElement | undefined, fill: string | CanvasGradient) => {
      if (!mask) return;
      const tinted = mk(w, h);
      const tx = tinted.getContext('2d')!;
      tx.drawImage(mask, 0, 0, w, h);
      tx.globalCompositeOperation = 'source-in';
      tx.fillStyle = fill;
      tx.fillRect(0, 0, w, h);
      ctx.drawImage(tinted, 0, 0);
    };
    press(face.deboss, FLAT_DEBOSS);
    press(face.ink, face.inkColor ?? card.stock);
    press(face.foil, ramp);
    return { canvas, ctx };
  };

  if (side === 'inside') return paint(layers.insideRight).canvas;
  const cover = paint(layers.front);
  if (!layers.dieCut) return cover.canvas;

  // Knock the hole out of the cover — the die-cut is black where it is — and
  // lay it over the page behind, which sits in the cover's shade.
  const cut = mk(w, h);
  const cutCtx = cut.getContext('2d', { willReadFrequently: true })!;
  cutCtx.drawImage(layers.dieCut, 0, 0, w, h);
  const hole = cutCtx.getImageData(0, 0, w, h).data;
  const paper = cover.ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < hole.length; i += 4) {
    if (hole[i] <= 127) paper.data[i + 3] = 0;
  }
  cover.ctx.putImageData(paper, 0, 0);

  const behind = paint(layers.insideRight);
  behind.ctx.fillStyle = FLAT_WINDOW_SHADE;
  behind.ctx.fillRect(0, 0, w, h);
  behind.ctx.drawImage(cover.canvas, 0, 0);
  return behind.canvas;
}
