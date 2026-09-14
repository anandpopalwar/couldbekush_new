import type { CollectionConfig } from "payload";
import { anyone, authenticated } from "../access";

const webp = { format: "webp" as const, options: { quality: 80 } };

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    // Media is referenced by published content, so reads are public.
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      admin: { description: "Required for SEO and accessibility." },
    },
    {
      name: "caption",
      type: "text",
    },
  ],
  upload: {
    // Storage is handled by the R2 (S3) adapter in payload.config.ts when R2 env
    // vars are set; otherwise Payload falls back to local disk for local dev.
    mimeTypes: ["image/*"],
    // Convert the base upload to WebP ~80%.
    formatOptions: webp,
    imageSizes: [
      { name: "thumbnail", width: 400, height: 300, formatOptions: webp },
      { name: "card", width: 768, height: 512, formatOptions: webp },
      // Hero: constrain width only, keep aspect ratio.
      { name: "hero", width: 1920, formatOptions: webp },
      { name: "og", width: 1200, height: 630, formatOptions: webp },
    ],
  },
};
