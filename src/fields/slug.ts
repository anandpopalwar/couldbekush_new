import type { Field } from "payload";

const toSlug = (val: string): string =>
  val
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * A slug field that auto-generates from `source` (e.g. "title") on save but
 * stays manually editable. Pass `unique` for collections that need it (Posts).
 */
export const slugField = (source = "title", options?: { unique?: boolean }): Field => ({
  name: "slug",
  type: "text",
  index: true,
  unique: options?.unique ?? false,
  admin: {
    position: "sidebar",
    description: "Auto-generated from the title; edit if you need a custom URL.",
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === "string" && value.length > 0) return toSlug(value);
        const src = data?.[source];
        if (typeof src === "string" && src.length > 0) return toSlug(src);
        return value;
      },
    ],
  },
});
