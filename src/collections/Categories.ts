import type { CollectionConfig } from "payload";
import { anyone, authenticated } from "../access";
import { slugField } from "../fields/slug";
import { revalidateAfterChange, revalidateAfterDelete } from "./revalidate";

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    useAsTitle: "name",
  },
  // When populated from a Post/Project, return only these fields (not the whole doc).
  defaultPopulate: {
    name: true,
    slug: true,
  },
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    slugField("name"),
    {
      name: "description",
      type: "textarea",
    },
  ],
};
