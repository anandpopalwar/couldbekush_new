import "server-only";
import { cache } from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { FOIL_COLOURS } from "@/collections/Magazines";
import type { Magazine, MagazineLayer } from "@/payload-types";
import type { MagazineData, MagazineFace } from "@/types/magazines";

type Layer = string | MagazineLayer | null | undefined;

const url = (layer: Layer) => (layer && typeof layer !== "string" && layer.url) || undefined;

const face = (layers?: { print?: Layer; foil?: Layer; deboss?: Layer } | null): MagazineFace => ({
  print: url(layers?.print),
  foil: url(layers?.foil),
  deboss: url(layers?.deboss),
});

// Only what the viewer shows and the files it loads — nothing of Payload's own.
const toMagazine = (doc: Magazine): MagazineData => ({
  name: doc.name,
  stock: { label: doc.stock.label, short: doc.stock.short, color: doc.stock.color },
  foil: { label: doc.foil.label, color: doc.foil.color || FOIL_COLOURS[doc.foil.label] },
  finish: doc.finish ?? "",
  envelope: doc.envelope ?? "",
  insideMessage: doc.insideMessage ?? "",
  front: { ...face(doc.front), dieCut: url(doc.front.dieCut) },
  insideLeft: face(doc.insideLeft),
  insideRight: face(doc.insideRight),
  back: face(doc.back),
});

/**
 * The About page's magazines: the published ones, by order and then by name.
 *
 * Empty when there are none — and when the CMS can't be reached, which is
 * what a build without DATABASE_URI hits. Either way the page falls back to
 * the five built-in magazines, so it is never blank and never fails to build.
 */
export const getMagazines = cache(async (): Promise<MagazineData[]> => {
  try {
    const payload = await getPayload({ config });
    const { docs } = await payload.find({
      collection: "magazines",
      where: { _status: { equals: "published" } },
      sort: ["order", "name"],
      depth: 1,
      limit: 100,
      overrideAccess: false,
    });
    // A magazine whose cover file has gone missing has nothing to show.
    return docs.map(toMagazine).filter((magazine) => magazine.front.print);
  } catch (error) {
    console.warn(
      "[getMagazines] Payload unavailable — showing the built-in magazines.",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
});
