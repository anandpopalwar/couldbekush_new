import type { CollectionConfig } from "payload";
import { isAdmin, isAdminFieldLevel, isAdminOrSelf } from "../access";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: {
    useAsTitle: "name",
  },
  // When a User is populated from a Post (author), return only these fields.
  defaultPopulate: {
    name: true,
  },
  access: {
    // Editors can log into the admin panel to manage content...
    admin: ({ req: { user } }) => Boolean(user),
    // ...but only admins manage users; editors see/edit only their own record.
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
      ],
      // Only admins may set or change a user's role.
      access: {
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        description: "Admins manage users; editors manage content only.",
      },
    },
  ],
};
