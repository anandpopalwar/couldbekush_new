import type { Access, FieldAccess } from "payload";

/** Any logged-in user. */
export const authenticated: Access = ({ req: { user } }) => Boolean(user);

/** Public. */
export const anyone: Access = () => true;

/**
 * Read access for draft-enabled collections: authenticated users see everything
 * (including drafts); the public sees only published documents.
 */
export const publishedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true;
  return {
    _status: {
      equals: "published",
    },
  };
};

/** Admins only. */
export const isAdmin: Access = ({ req: { user } }) => user?.role === "admin";

/** Admins can act on any user; everyone else only on their own record. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return {
    id: {
      equals: user.id,
    },
  };
};

/** Field-level: only admins may read/write the field (e.g. the role field). */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) =>
  user?.role === "admin";
