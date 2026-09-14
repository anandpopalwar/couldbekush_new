import type { Block } from "payload";
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

export const contentBlocks: Block[] = [
  RichTextBlock,
  ImageGridBlock,
  QuoteBlock,
  CodeBlock,
  VideoEmbedBlock,
  CallToActionBlock,
];
