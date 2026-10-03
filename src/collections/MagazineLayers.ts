import { APIError } from "payload";
import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { anyone, authenticated } from "../access";
import { revalidateAfterChange, revalidateAfterDelete } from "./revalidate";

// A magazine is 5 × 7 in, and every layer of it is drawn at 1024 × 1434 px.
// The viewer stretches a layer to fit, so one of another shape would be
// squashed rather than cropped — it is turned away here instead.
const RATIO = 1 / 1.4;
const TOLERANCE = 0.01;

const checkShape: CollectionBeforeChangeHook = ({ data }) => {
  const { width, height } = data;
  if (width && height && Math.abs(width / height / RATIO - 1) > TOLERANCE) {
    throw new APIError("Magazine layers must be 1024 × 1434 px (5 × 7 in).", 400, undefined, true);
  }
  return data;
};

// The artwork of the About page's magazines, one image per layer: the print,
// and the masks that say where the foil, the deboss and the die-cut go.
// Kept apart from Media on purpose — nothing here is resized, cropped or
// converted, because a mask has to arrive exactly as it was drawn.
export const MagazineLayers: CollectionConfig = {
  slug: "magazineLayers",
  labels: { singular: "Magazine layer", plural: "Magazine layers" },
  admin: {
    group: "About",
    description:
      "Image layers for the About page's magazines. Every layer is 1024 × 1434 px. Files are stored exactly as uploaded.",
  },
  access: {
    // The viewer loads these straight from the browser.
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeChange: [checkShape],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [],
  upload: {
    mimeTypes: ["image/png", "image/webp", "image/jpeg"],
    crop: false,
    focalPoint: false,
  },
};
