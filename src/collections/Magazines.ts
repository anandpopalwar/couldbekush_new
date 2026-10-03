import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  Field,
  TextFieldSingleValidation,
  UploadFieldSingleValidation,
} from "payload";
import { authenticated, publishedOrAuthenticated } from "../access";
import { revalidateAfterChange, revalidateAfterDelete } from "./revalidate";

// The About page's magazines. Each is designed in Figma and arrives here as
// image layers (see MagazineLayers); the viewer presses them into a lit 3D
// object. Nothing on this page draws — it only says which layer goes where.

export const FOIL_COLOURS: Record<string, string> = {
  Gold: "#E9C068",
  Silver: "#DCE1E7",
  Copper: "#DB8F5C",
  "Rose gold": "#D9967F",
};

const HEX = /^#[0-9A-F]{6}$/i;
const hex =
  (required: boolean): TextFieldSingleValidation =>
  (value) => {
    if (!value) return required ? "A colour is required, as 6-digit hex — #E9C068." : true;
    return HEX.test(value) || "Use 6-digit hex, like #E9C068.";
  };

// A mask is read pixel by pixel; lossy compression leaves a halo round it.
const pngOnly: UploadFieldSingleValidation = async (value, { req }) => {
  if (!value) return true;
  const id = (typeof value === "object" ? (value as { id: string }).id : value) as string;
  try {
    // Read outside the request's transaction: fields validate side by side,
    // and two reads on one MongoDB transaction at once make it fail.
    const layer = await req.payload.findByID({ collection: "magazineLayers", id, depth: 0 });
    return layer.mimeType === "image/png" || "Masks must be lossless PNG";
  } catch {
    return "Masks must be lossless PNG";
  }
};

const DESCRIPTIONS = {
  print: "Full-colour artwork on the paper colour, without foil. 1024 × 1434 px. WebP, PNG or JPG.",
  foil: "PNG, 1024 × 1434 px. White = foil, black = paper. No gradients or effects.",
  deboss: "PNG, 1024 × 1434 px. White = pressed into the paper without foil.",
  dieCut: "PNG, 1024 × 1434 px. Black = hole, white = paper. Drawn as seen from the front.",
};

const layer = (name: keyof typeof DESCRIPTIONS, required = false): Field => ({
  name,
  type: "upload",
  relationTo: "magazineLayers",
  required,
  admin: { description: DESCRIPTIONS[name] },
  // The print is artwork and may be lossy; everything else is a mask.
  ...(name === "print" ? {} : { validate: pngOnly }),
});

// A foil left without a colour takes its name's.
const fillFoilColour: CollectionBeforeChangeHook = ({ data }) => {
  if (data.foil?.label && !data.foil.color) {
    data.foil.color = FOIL_COLOURS[data.foil.label];
  }
  return data;
};

export const Magazines: CollectionConfig = {
  slug: "magazines",
  labels: { singular: "Magazine", plural: "Magazines" },
  admin: {
    group: "About",
    useAsTitle: "name",
    defaultColumns: ["name", "order", "_status"],
    description:
      "The magazines on the About page. Only published ones are shown; with none published, the five built-in ones appear.",
  },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  versions: { drafts: true },
  hooks: {
    beforeChange: [fillFoilColour],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "order",
      type: "number",
      admin: { description: "Where it sits on the track. Lowest first, then by name." },
    },
    {
      name: "stock",
      type: "group",
      fields: [
        {
          name: "label",
          type: "text",
          required: true,
          admin: { description: 'The paper, in full — "Cream cotton, 350 gsm".' },
        },
        {
          name: "short",
          type: "text",
          required: true,
          admin: { description: 'And in two words — "cream cotton".' },
        },
        {
          name: "color",
          type: "text",
          required: true,
          validate: hex(true),
          admin: { description: "The paper's colour, as 6-digit hex. Bare faces and the edges are this." },
        },
      ],
    },
    {
      name: "foil",
      type: "group",
      fields: [
        {
          name: "label",
          type: "select",
          required: true,
          options: Object.keys(FOIL_COLOURS),
        },
        {
          name: "color",
          type: "text",
          validate: hex(false),
          admin: { description: "6-digit hex. Leave empty to use the foil's own colour." },
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "finish", type: "text" },
        { name: "envelope", type: "text" },
      ],
    },
    {
      name: "insideMessage",
      type: "textarea",
      admin: { description: "The greeting inside. Read out to screen readers; not printed by this field." },
    },
    {
      name: "front",
      type: "group",
      fields: [layer("print", true), layer("foil"), layer("deboss"), layer("dieCut")],
    },
    {
      name: "insideLeft",
      type: "group",
      admin: { description: "The inside of the cover, as you see it with the magazine open. Leave empty for plain paper." },
      fields: [layer("print"), layer("foil"), layer("deboss")],
    },
    {
      name: "insideRight",
      type: "group",
      admin: { description: "The page that carries the greeting. Leave empty for plain paper." },
      fields: [layer("print"), layer("foil"), layer("deboss")],
    },
    {
      name: "back",
      type: "group",
      admin: { description: "Leave empty for plain paper." },
      fields: [layer("print"), layer("foil"), layer("deboss")],
    },
  ],
};
