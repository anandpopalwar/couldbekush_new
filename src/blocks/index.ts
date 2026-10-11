import type { Block, FieldAccess } from "payload";
import { lexicalEditor } from "@payloadcms/richtext-lexical";

export const RichTextBlock: Block = {
  slug: "richText",
  interfaceName: "RichTextBlock",
  labels: { singular: "Rich Text", plural: "Rich Text" },
  fields: [
    {
      name: "content",
      type: "richText",
      editor: lexicalEditor(),
      required: true,
    },
  ],
};

export const ImageGridBlock: Block = {
  slug: "imageGrid",
  interfaceName: "ImageGridBlock",
  labels: { singular: "Image Grid", plural: "Image Grids" },
  fields: [
    {
      name: "images",
      type: "array",
      minRows: 1,
      required: true,
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true },
      ],
    },
    {
      name: "columns",
      type: "select",
      defaultValue: "3",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
  ],
};

export const QuoteBlock: Block = {
  slug: "quote",
  interfaceName: "QuoteBlock",
  fields: [
    { name: "quote", type: "textarea", required: true },
    { name: "attribution", type: "text" },
  ],
};

export const CodeBlock: Block = {
  slug: "code",
  interfaceName: "CodeBlock",
  fields: [
    {
      name: "language",
      type: "select",
      defaultValue: "ts",
      options: [
        { label: "TypeScript", value: "ts" },
        { label: "TSX", value: "tsx" },
        { label: "JavaScript", value: "js" },
        { label: "JSX", value: "jsx" },
        { label: "Bash", value: "bash" },
        { label: "JSON", value: "json" },
        { label: "CSS", value: "css" },
        { label: "HTML", value: "html" },
        { label: "Python", value: "python" },
      ],
    },
    { name: "code", type: "code", required: true },
  ],
};

export const VideoEmbedBlock: Block = {
  slug: "videoEmbed",
  interfaceName: "VideoEmbedBlock",
  fields: [{ name: "url", type: "text", required: true }],
};

export const CallToActionBlock: Block = {
  slug: "cta",
  interfaceName: "CallToActionBlock",
  labels: { singular: "Call To Action", plural: "Calls To Action" },
  fields: [
    { name: "heading", type: "text" },
    { name: "body", type: "textarea" },
    { name: "buttonLabel", type: "text" },
    { name: "buttonLink", type: "text" },
  ],
};

// Who may write a Code Embed's code. It runs on the published page (inside a
// sandboxed iframe), so this is the one switch for who is trusted with that.
// false: anyone who can log into the admin. true: admins only — an editor
// still sees the block, but any code they enter is dropped on save.
const CODE_EMBED_ADMIN_ONLY = false;

const codeEmbedAccess: FieldAccess = ({ req: { user } }) =>
  CODE_EMBED_ADMIN_ONLY ? user?.role === "admin" : Boolean(user);

const codeEmbedCode = { create: codeEmbedAccess, update: codeEmbedAccess };

export const CodeEmbedBlock: Block = {
  slug: "codeEmbed",
  interfaceName: "CodeEmbedBlock",
  labels: { singular: "Code Embed", plural: "Code Embeds" },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: { description: "Names the widget for screen readers and is shown under it." },
    },
    { name: "html", type: "code", admin: { language: "html" }, access: codeEmbedCode },
    { name: "css", type: "code", admin: { language: "css" }, access: codeEmbedCode },
    { name: "js", type: "code", admin: { language: "javascript" }, access: codeEmbedCode },
    {
      name: "height",
      type: "number",
      defaultValue: 400,
      min: 1,
      admin: { description: "Height of the widget's frame, in pixels." },
    },
    { name: "caption", type: "text" },
  ],
};

export const contentBlocks: Block[] = [
  CodeEmbedBlock,
  RichTextBlock,
  ImageGridBlock,
  QuoteBlock,
  CodeBlock,
  VideoEmbedBlock,
  CallToActionBlock,
];
