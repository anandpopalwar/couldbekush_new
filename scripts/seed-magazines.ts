/**
 * Puts the built-in magazines into the CMS: uploads their layer files from
 * reference/magazine-layers/ (see export-magazine-layers.mjs) and creates and
 * publishes one magazine for each. Safe to re-run — a layer already uploaded
 * is reused, and a magazine that exists is updated rather than duplicated.
 *
 *   npx payload run scripts/seed-magazines.ts
 *
 * It writes to whatever DATABASE_URI and BLOB_READ_WRITE_TOKEN point at.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";
import { FOIL_CARDS } from "../src/lib/foilCards";
import type { Magazine } from "../src/payload-types";

const ROOT = path.resolve(process.cwd(), "reference/magazine-layers");
const folderOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const payload = await getPayload({ config });

/** A layer's id, uploading the file if it isn't in the CMS yet. Undefined if there is no such file. */
async function layer(folder: string, file: string) {
  const filePath = path.join(ROOT, folder, `${file}.png`);
  if (!existsSync(filePath)) return undefined;
  // One name per file across every magazine, so a re-run can find it again.
  const filename = `${folder}-${file}.png`;
  const found = await payload.find({
    collection: "magazineLayers",
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
  });
  if (found.docs[0]) return found.docs[0].id;
  const data = readFileSync(filePath);
  const created = await payload.create({
    collection: "magazineLayers",
    data: {},
    file: { data, mimetype: "image/png", name: filename, size: data.length },
  });
  console.log(`  uploaded ${filename}`);
  return created.id;
}

for (const [i, card] of FOIL_CARDS.entries()) {
  const folder = folderOf(card.name);
  const front = await layer(folder, "front-print");
  if (!front) {
    console.log(`${card.name}: no layers in ${path.join(ROOT, folder)} — run the export first. Skipped.`);
    continue;
  }
  console.log(card.name);
  const data = {
    name: card.name,
    order: i + 1,
    stock: { label: card.stockName, short: card.stockShort, color: card.stock },
    foil: { label: card.foilName as Magazine["foil"]["label"], color: card.foil },
    finish: card.finish,
    envelope: card.envelope,
    insideMessage: card.message.join(" "),
    front: {
      print: front,
      foil: await layer(folder, "front-foil"),
      deboss: await layer(folder, "front-deboss"),
      dieCut: await layer(folder, "front-dieCut"),
    },
    insideRight: {
      print: await layer(folder, "insideRight-print"),
      foil: await layer(folder, "insideRight-foil"),
    },
    _status: "published" as const,
  };

  const existing = await payload.find({
    collection: "magazines",
    where: { name: { equals: card.name } },
    limit: 1,
    depth: 0,
    draft: true,
  });
  if (existing.docs[0]) {
    await payload.update({ collection: "magazines", id: existing.docs[0].id, data });
    console.log("  updated and published");
  } else {
    await payload.create({ collection: "magazines", data });
    console.log("  created and published");
  }
}

process.exit(0);
