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

/** Published projects from Payload, oldest first. Falls back to the static list while the CMS is empty. */
export async function getProjects(): Promise<Project[]> {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "projects",
    where: { _status: { equals: "published" } },
    sort: "createdAt",
    depth: 1,
    limit: 100,
    overrideAccess: false,
  });

  const projects = docs
    .map(toPortfolioProject)
    .filter((p) => p.image);

  return projects.length > 0 ? projects : PROJECTS;
}
