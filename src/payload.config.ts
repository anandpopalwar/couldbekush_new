import path from "path";
import { buildConfig } from "payload";
import type { Plugin } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { seoPlugin } from "@payloadcms/plugin-seo";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Categories } from "./collections/Categories";
import { Projects } from "./collections/Projects";
import { Posts } from "./collections/Posts";

// On Windows, sharp's cache keeps the source image file open, so Payload's
// write-back of the WebP-converted upload to the same temp path fails with
// "UNKNOWN: unknown error, open ... payload-client-upload-*" (errno -4094).
// Linux (Vercel) doesn't lock open files, so keep the cache there.
if (process.platform === "win32") {
  sharp.cache(false);
}

const plugins: Plugin[] = [];

// Vercel Blob — the adapter disables itself when BLOB_READ_WRITE_TOKEN is unset,
// so Media uploads fall back to local disk in dev until the token exists.
plugins.push(
  vercelBlobStorage({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    // Browser uploads straight to Blob, bypassing Vercel's 4.5 MB request body limit.
    clientUploads: true,
    collections: {
      media: {
        prefix: "media",
        // Serve files from the public Blob URL instead of proxying every image
        // through Payload's /api/media/file route.
        disablePayloadAccessControl: true,
      },
    },
  }),
);

plugins.push(
  seoPlugin({
    collections: ["posts", "projects"],
    uploadsCollection: "media",
    tabbedUI: true,
    generateTitle: ({ doc }) => {
      const d = doc as { title?: string };
      return d?.title ?? "";
    },
    generateDescription: ({ doc }) => {
      const d = doc as { excerpt?: string; description?: string };
      return d?.excerpt ?? d?.description ?? "";
    },
  }),
);

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [Users, Media, Categories, Projects, Posts],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(process.cwd(), "src/payload-types.ts"),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || "",
  }),
  plugins,
  sharp,
});
