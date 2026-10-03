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
