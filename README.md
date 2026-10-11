# couldbekush portfolio

Next.js 16 + Payload 3. `AGENTS.md` describes how the site is built; this file
covers the one thing an editor does by hand: adding a magazine to the About
page.

## Magazines (the About page)

The About page shows the **published** entries of the *Magazines* collection,
by `order` and then by name. With none published it shows five built-in ones,
so the page is never empty.

A magazine is designed in Figma and uploaded as image layers. Every layer is
**1024 × 1434 px** (5 × 7 in); a file of another shape is refused.

| Layer | File | What it is |
|-------|------|------------|
| `print` | WebP, PNG or JPG | Full-colour artwork on the paper colour, without foil |
| `foil` | PNG | White = foil, black = paper. No gradients or effects |
| `deboss` | PNG | White = pressed into the paper without foil |
| `dieCut` | PNG | Black = hole, white = paper. Drawn as seen from the front |

Masks (`foil`, `deboss`, `dieCut`) must be PNG: lossy compression leaves a
halo round them.

### Adding one

1. In the admin, open **About → Magazine layers** and upload the layer files.
2. Open **About → Magazines → Create new**. Fill in the name, order, paper
   (label, two-word name, hex colour), foil and finish.
3. Under **Front**, pick the `print` layer (required) and any `foil`, `deboss`
   or `dieCut`. Do the same for **Inside left**, **Inside right** and **Back**;
   a face left empty is plain paper.
4. **Publish.** The page picks it up on its next visit — no redeploy. A draft
   is never shown.

`reference/magazine-layers/` holds the layers of the five built-in magazines as
examples of each kind of file.

### Scripts

```bash
# Draw the built-in magazines as layer PNGs into reference/magazine-layers/.
# Needs the site running (SITE_URL, default http://localhost:3000) and Chrome
# (CHROME_PATH, if it isn't in the usual place on Windows).
node scripts/export-magazine-layers.mjs

# Upload those layers and create/publish a magazine for each. Safe to re-run.
# Writes to whatever DATABASE_URI and BLOB_READ_WRITE_TOKEN point at.
npx payload run scripts/seed-magazines.ts
```

### Where the files live, and CORS

Layers are stored on Vercel Blob (`magazine-layers/` in the store) exactly as
uploaded, and the browser loads them from the store's public URL. The viewer
draws each layer into a canvas and reads its pixels back, which a browser only
allows if the file's origin answers with `Access-Control-Allow-Origin`. Vercel
Blob's public URLs send `Access-Control-Allow-Origin: *`, so there is nothing
to set.

If the files ever move to another host (S3, a CDN), that host must send
`Access-Control-Allow-Origin: <the site's origin>` (or `*`) for `GET`, or every
magazine will fail to load and the page will fall back to the built-in ones.

## Code Embed (a block for projects and posts)

A Code Embed is a small interactive widget — a counter, a calculator, a
little animation — that you write yourself. You paste its HTML, CSS and
JavaScript into three boxes in the admin, and it runs on the published project
page, after the images, in a frame of its own.

Use it when a picture can't show the thing and it needs to be played with.
For plain text or images, use a normal block.

**What the code can't do.** It runs shut off from the rest of the site:

- It can't fetch anything or call an API. Images and fonts can be loaded from
  `https://` addresses; nothing else can.
- It can't save anything — no `localStorage`, no cookies. A score is gone when
  the page is reloaded.
- It can't read or change the page around it, or send the visitor elsewhere.

**Before you publish**

- A loop that never ends will freeze the visitor's browser tab. Try the
  widget first.
- Search engines don't read what is inside the frame. Anything that should be
  found by search belongs in a normal block.
- It only shows on a project's page. Posts have no page yet.

**Try it.** Add a Code Embed, give it a title, and paste these in:

HTML

```html
<button id="add">Clicked 0 times</button>
```

CSS

```css
button { font: inherit; padding: 12px 20px; cursor: pointer; }
```

JS

```js
let count = 0;
const button = document.getElementById('add');
button.addEventListener('click', () => {
  count += 1;
  button.textContent = `Clicked ${count} times`;
});
```

Publish, open the project, and the button should count your clicks.

Two samples — a light you move over a model, and a grid of dots — can be
added to the temporary WON J. YOU STUDIOS project with
`npx payload run scripts/seed-code-embed.ts`. Safe to re-run; delete the
blocks from the project in the admin to remove them.

Who may write the code is one switch, `CODE_EMBED_ADMIN_ONLY`, at the top of
the block in `src/blocks/index.ts`.
