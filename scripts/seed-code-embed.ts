/**
 * Adds sample Code Embeds — a light you move over a small model, and a grid
 * of dots that answers the pointer — to one TEMPORARY project, so there is
 * something to look at on its case study.
 * Safe to re-run: an embed whose title the project already has is skipped.
 *
 *   npx payload run scripts/seed-code-embed.ts
 *
 * Remove later from /admin: open the project and delete the block.
 */
import { getPayload } from "payload";
import config from "../src/payload.config";

const SLUG = "temp-won-j-you-studios";

const html = `<canvas id="model"></canvas>
<p>Move over the model to move the light.</p>`;

const css = `body { padding: 0; background: #14161a; overflow: hidden; }
canvas { display: block; width: 100%; height: 100vh; touch-action: none; }
p { position: absolute; left: 16px; bottom: 12px; margin: 0; color: #e9e6df; font-size: 12px; opacity: 0.6; }`;

const js = `const canvas = document.getElementById('model');
const ctx = canvas.getContext('2d');
// The model: blocks, as fractions of the canvas.
const blocks = [
  [0.12, 0.30, 0.14, 0.34], [0.32, 0.18, 0.10, 0.22], [0.48, 0.42, 0.20, 0.16],
  [0.50, 0.14, 0.12, 0.14], [0.74, 0.26, 0.12, 0.40], [0.30, 0.62, 0.12, 0.18],
];
let light = [0.4, 0.4];

function draw() {
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  const lx = light[0] * w;
  const ly = light[1] * h;
  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * 0.6);
  glow.addColorStop(0, 'rgba(255, 236, 200, 0.85)');
  glow.addColorStop(1, 'rgba(255, 236, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  // Each shadow falls away from the light, longer the further off it is.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  for (const [x, y, bw, bh] of blocks) {
    const dx = (x + bw / 2 - light[0]) * w * 0.3;
    const dy = (y + bh / 2 - light[1]) * h * 0.3;
    ctx.fillRect(x * w + dx, y * h + dy, bw * w, bh * h);
  }
  ctx.fillStyle = '#e9e6df';
  for (const [x, y, bw, bh] of blocks) ctx.fillRect(x * w, y * h, bw * w, bh * h);
}

canvas.addEventListener('pointermove', (e) => {
  light = [e.offsetX / canvas.clientWidth, e.offsetY / canvas.clientHeight];
  draw();
});
window.addEventListener('resize', draw);
draw();`;

const dotsHtml = `<canvas id="dots"></canvas>
<p>Move to push the dots. Click to send a ripple.</p>`;

const dotsCss = `body { padding: 0; background: #e9e6df; overflow: hidden; }
canvas { display: block; width: 100%; height: 100vh; touch-action: none; cursor: crosshair; }
p { position: absolute; left: 16px; bottom: 12px; margin: 0; color: #14161a; font-size: 12px; opacity: 0.6; }`;

const dotsJs = `const canvas = document.getElementById('dots');
const ctx = canvas.getContext('2d');
const GAP = 28;
let pointer = [-999, -999];
let ripples = [];

function frame(now) {
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  ripples = ripples.filter((r) => now - r.start < 1600);
  ctx.fillStyle = '#14161a';
  for (let y = GAP / 2; y < h; y += GAP) {
    for (let x = GAP / 2; x < w; x += GAP) {
      // Bigger near the pointer, and as each ripple's ring passes over.
      let size = 2 + 7 * Math.max(0, 1 - Math.hypot(x - pointer[0], y - pointer[1]) / 140);
      for (const r of ripples) {
        const age = (now - r.start) / 1600;
        const ring = Math.abs(Math.hypot(x - r.x, y - r.y) - age * Math.max(w, h));
        size += 8 * (1 - age) * Math.max(0, 1 - ring / 50);
      }
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointermove', (e) => { pointer = [e.offsetX, e.offsetY]; });
canvas.addEventListener('pointerleave', () => { pointer = [-999, -999]; });
canvas.addEventListener('pointerdown', (e) => {
  ripples.push({ x: e.offsetX, y: e.offsetY, start: performance.now() });
});
requestAnimationFrame(frame);`;

const EMBEDS = [
  {
    blockType: "codeEmbed" as const,
    title: "Light study",
    html,
    css,
    js,
    height: 420,
    caption: "A sample Code Embed, written in plain JavaScript.",
  },
  {
    blockType: "codeEmbed" as const,
    title: "Dot field",
    html: dotsHtml,
    css: dotsCss,
    js: dotsJs,
    height: 420,
    caption: "A second sample: a grid that answers the pointer.",
  },
];

const payload = await getPayload({ config });
const { docs } = await payload.find({
  collection: "projects",
  where: { slug: { equals: SLUG } },
  depth: 0,
  limit: 1,
});
const project = docs[0];
const have = new Set(
  project?.content?.flatMap((block) => (block.blockType === "codeEmbed" ? [block.title] : [])),
);
const missing = EMBEDS.filter((embed) => !have.has(embed.title));

if (!project) {
  console.log(`No project with the slug "${SLUG}" — nothing changed.`);
} else if (!missing.length) {
  console.log(`"${project.title}" already has these Code Embeds — nothing changed.`);
} else {
  await payload.update({
    collection: "projects",
    id: project.id,
    data: { content: [...(project.content ?? []), ...missing], _status: "published" },
  });
  console.log(`Added to "${project.title}": ${missing.map((embed) => embed.title).join(", ")}.`);
}
process.exit(0);
