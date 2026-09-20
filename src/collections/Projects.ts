import type { CollectionConfig } from "payload";
import { authenticated, publishedOrAuthenticated } from "../access";
import { slugField } from "../fields/slug";
import { contentBlocks } from "../blocks";

// Mirrors the existing src/data/projects.ts shape so the card-deck frontend can
// consume it, plus drafts/versions, SEO (added via the plugin) and access control.
export const Projects: CollectionConfig = {
  slug: "projects",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "subtitle", "launch", "_status"],
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
      // 800ms is Payload's documented minimum and its default. Below that the
      // admin fires a save on roughly every keystroke and the requests overlap,
      // which surfaces as intermittent "problem saving" while typing.
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
      name: "subtitle",
      type: "text",
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Short blurb shown on the card deck / right list." },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: { description: "Primary card image." },
    },
    {
      name: "gallery",
      type: "array",
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true },
      ],
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    {
      type: "row",
      fields: [
        { name: "role", type: "text" },
        { name: "launch", type: "text" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "client", type: "text" },
        { name: "liveUrl", type: "text" },
      ],
    },
    {
      name: "recognition",
      type: "text",
      hasMany: true,
      admin: { description: "Awards / accolades, one per entry." },
    },
    {
      name: "techStack",
      type: "text",
      hasMany: true,
    },
    {
      name: "themeColors",
      type: "text",
      hasMany: true,
      admin: {
        description: "Up to 3 hex colors representing the project's theme (e.g. #1b2a6b).",
      },
    },
    {
      name: "overview",
      type: "textarea",
      admin: { description: "Longer summary for the project detail view." },
    },
    {
      name: "content",
      type: "blocks",
      blocks: contentBlocks,
      admin: { description: "Optional rich case-study body." },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};
