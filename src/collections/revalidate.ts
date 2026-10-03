import { revalidatePath } from "next/cache";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

// The frontend is static and has no timer: these hooks are the only thing that
// rebuilds it. Everything is marked stale at once — the deck and every case
// study read the same project list (order, numbering, "next project"), so one
// edit can touch any of them. Nothing is rebuilt here; each page regenerates on
// its next visit.
const revalidateSite = () => {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Outside a Next request (a seed script, the Payload CLI) there is no
    // cache to invalidate, and revalidatePath throws.
  }
};

export const revalidateAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
}) => {
  // Draft autosaves fire every 800ms while an editor types. A draft that was
  // never published isn't on the site, so there is nothing to rebuild.
  // Collections without drafts have no _status and always pass.
  if (doc._status === "draft" && previousDoc?._status !== "published") {
    return doc;
  }
  revalidateSite();
  return doc;
};

export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateSite();
  return doc;
};
