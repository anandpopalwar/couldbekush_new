import type { CollectionConfig } from "payload";
import { authenticated, publishedOrAuthenticated } from "../access";
import { slugField } from "../fields/slug";
import { contentBlocks } from "../blocks";

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "author", "publishedAt", "_status"],
  },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  versions: {
    maxPerDoc: 25,
    drafts: {
      // See Projects.ts — 800ms is Payload's documented minimum.
      autosave: { interval: 800 },
      schedulePublish: true,
    },
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    slugField("title", { unique: true }),
    {
      name: "excerpt",
      type: "textarea",
      admin: {
        description: "Used on cards and as the meta-description fallback.",
      },
    },
    {
      name: "thumbnail",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: { description: "Card / OG image." },
    },
    {
      name: "gallery",
      type: "array",
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true },
      ],
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "content",
      type: "blocks",
      blocks: contentBlocks,
    },
  ],
};
