/**
 * Exports the built-in magazines as layer files — the same PNGs a designer
 * would hand over from Figma — into reference/magazine-layers/<name>/.
 *
 *   node scripts/export-magazine-layers.mjs
 *
 * They are drawn by the site's own drawing code (src/lib/foilCards.ts), in a
 * headless Chrome, on the site's own page so the lettering is the site's
 * typeface. So the site has to be running: SITE_URL, default
 * http://localhost:3000. Chrome is looked for in its usual place on Windows;
 * set CHROME_PATH for anywhere else.
 *
 * Every file is 1024 × 1434 px:
 *   <face>-print.png   full-colour artwork on the paper colour, without foil
 *   <face>-foil.png    white = foil, black = paper
 *   front-deboss.png   white = pressed into the paper without foil
 *   front-dieCut.png   black = hole, white = paper, as seen from the front
 *
 * _test/front-dieCut-offcentre.png is a die-cut with its hole 30% from the
 * left, for checking that a hole lands in the same place on both sides of
 * the cover. It belongs to no magazine.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const SITE = process.env.SITE_URL ?? 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = resolve('reference/magazine-layers');
const PORT = 9412;

// The drawing code, bundled so it can be run in the page.
const bundle = await build({
  entryPoints: ['src/lib/foilCards.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'FoilArt',
  write: false,
});
const drawingCode = bundle.outputFiles[0].text;

// Runs in the page. Returns { "<name>": { "<face>-<layer>": dataURL } }.
const exportLayers = async () => {
  const { FOIL_CARDS, cardFontsReady, layer, message, mk } = globalThis.FoilArt;
  await cardFontsReady();
  const W = 1024;
  const H = 1434;
  const solid = (color) => {
    const canvas = mk(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    return canvas;
  };
  // A mask, filled with one colour and laid over a base.
  const over = (base, mask, fill) => {
    const tinted = mk(W, H);
    const tx = tinted.getContext('2d');
    tx.drawImage(mask, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = fill;
    tx.fillRect(0, 0, W, H);
    base.getContext('2d').drawImage(tinted, 0, 0);
    return base;
  };
  const maskFile = (draw) => over(solid('#000'), layer(draw, W, H), '#fff');
  const window = (x, y, r) => {
    const canvas = solid('#fff');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(W * x, H * y, W * r, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  };

  const out = {};
  for (const card of FOIL_CARDS) {
    const greeting = (ctx, w, h) => message(ctx, w, h, card.message, h * card.msgY);
    const files = {
      'front-print': solid(card.stock),
      'front-foil': maskFile(card.front),
      // The greeting is printed in ink on some, and stamped in foil on the rest.
      'insideRight-print': card.foilMessage
        ? solid(card.stock)
        : over(solid(card.stock), layer(greeting, W, H), card.ink),
      'insideRight-foil': maskFile((ctx, w, h) => {
        if (card.inside) card.inside(ctx, w, h);
        if (card.foilMessage) greeting(ctx, w, h);
      }),
    };
    if (card.deboss) files['front-deboss'] = maskFile(card.deboss);
    if (card.dieCut) files['front-dieCut'] = window(card.dieCut.x, card.dieCut.y, card.dieCut.r);
    const name = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    out[name] = Object.fromEntries(
      Object.entries(files).map(([file, canvas]) => [file, canvas.toDataURL('image/png')]),
    );
  }
  out._test = { 'front-dieCut-offcentre': window(0.3, 0.3, 0.2).toDataURL('image/png') };
  return JSON.stringify(out);
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'magazine-layers-'))}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    await sleep(200);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      page = targets.find((target) => target.type === 'page');
    } catch {
      // Chrome isn't listening yet.
    }
  }
  if (!page) throw new Error(`Chrome did not start (${CHROME}). Set CHROME_PATH.`);

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((open) => (socket.onopen = open));
  let id = 0;
  const waiting = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((done) => {
      waiting.set(++id, done);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const run = async (expression) => {
    const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (reply.result?.exceptionDetails) {
      throw new Error(reply.result.exceptionDetails.exception?.description ?? 'The page threw.');
    }
    return reply.result?.result?.value;
  };

  await send('Page.enable');
  await send('Page.navigate', { url: `${SITE}/about` });
  // The page's fonts are what the lettering is drawn in.
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if ((await run(`document.readyState === 'complete' && document.fonts.status === 'loaded'`)) === true) break;
  }
  await run(drawingCode);
  const layers = JSON.parse(await run(`(${exportLayers.toString()})()`));

  let count = 0;
  for (const [name, files] of Object.entries(layers)) {
    mkdirSync(join(OUT, name), { recursive: true });
    for (const [file, dataUrl] of Object.entries(files)) {
      writeFileSync(join(OUT, name, `${file}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
      count++;
    }
  }
  console.log(`${count} layers written to ${OUT}`);
  socket.close();
} finally {
  chrome.kill();
}
