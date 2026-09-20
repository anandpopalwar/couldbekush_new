import "server-only";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Media, Project as PayloadProject } from "@/payload-types";
import type { Project } from "@/types/portfolio";
import { PROJECTS } from "@/data/projects";

const mediaUrl = (m: string | Media | null | undefined, size?: keyof NonNullable<Media["sizes"]>) => {
  if (!m || typeof m === "string") return "";
  return (size && m.sizes?.[size]?.url) || m.url || "";
};

// Maps a Payload project onto the shape the card-deck components already consume.
// `id` is the display index ("01", "02"…) the counter renders, not the Mongo id.
const toPortfolioProject = (p: PayloadProject, index: number): Project => {
  const firstCategory = p.categories?.find((c) => typeof c !== "string");
  return {
    id: String(index + 1).padStart(2, "0"),
    title: p.title,
    subtitle: p.subtitle ?? "",
    category: firstCategory && typeof firstCategory !== "string" ? firstCategory.name : p.subtitle ?? "",
    description: p.description ?? "",
    role: p.role ?? "",
    launch: p.launch ?? "",
    recognition: p.recognition ?? [],
    image: mediaUrl(p.image, "hero"),
    client: p.client ?? undefined,
    techStack: p.techStack ?? undefined,
    liveUrl: p.liveUrl ?? undefined,
    overview: p.overview ?? undefined,
    gallery: p.gallery?.map((g) => mediaUrl(g.image, "hero")).filter(Boolean),
    themeColors: p.themeColors ?? undefined,
  };
};

/**
 * Published projects from Payload, oldest first.
 *
 * Falls back to the static list twice over: when the CMS has nothing published,
 * and when the CMS cannot be reached at all. The second case is what a build
 * hits with no PAYLOAD_SECRET or DATABASE_URI — getPayload throws, and because
 * this page is prerendered that used to take the whole build down. A portfolio
 * whose content is missing should still render; it should not fail to deploy.
 *
 * The warning matters: a production deploy that logs it is serving placeholder
 * projects, which looks like a working site rather than a broken one.
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const payload = await getPayload({ config });
    const { docs } = await payload.find({
      collection: "projects",
      where: { _status: { equals: "published" } },
      sort: "createdAt",
      depth: 1,
      limit: 100,
      overrideAccess: false,
    });

    const projects = docs.map(toPortfolioProject).filter((p) => p.image);

    return projects.length > 0 ? projects : PROJECTS;
  } catch (error) {
    console.warn(
      "[getProjects] Payload unavailable — serving the static project list. " +
        "Check DATABASE_URI and PAYLOAD_SECRET are set in this environment.",
      error instanceof Error ? error.message : error,
    );
    return PROJECTS;
  }
}
