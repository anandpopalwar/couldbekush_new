/**
 * Seeds TEMPORARY sample projects (with images uploaded to Vercel Blob) so the
 * frontend has CMS data to render. Safe to re-run: existing slugs are skipped.
 *
 *   npx payload run scripts/seed-temp-projects.ts
 *
 * Remove later from /admin, or delete the "temp-" slugs.
 */
import { getPayload } from "payload";
import config from "../src/payload.config";

type SeedProject = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  role: string;
  launch: string;
  client: string;
  liveUrl: string;
  overview: string;
  techStack: string[];
  recognition: string[];
  themeColors: string[];
  images: string[]; // first = card image, all = gallery
};

const SEED: SeedProject[] = [
  {
    slug: "temp-fromanother",
    title: "FROMANOTHER",
    subtitle: "Agency & Studio",
    category: "Agency & Studio",
    description:
      "[Temp] A fresh website for the creative agency fromanother, focusing on a raw editorial aesthetic.",
    role: "Design Direction / Website Design",
    launch: "April 2020",
    client: "FromAnother Creative Studio",
    liveUrl: "https://fromanother.example.com",
    overview:
      "Temporary CMS seed data. High-impact typography, fluid transitions and bespoke interactive layouts.",
    techStack: ["Next.js", "GSAP", "WebGL", "Tailwind CSS"],
    recognition: ["Awwwards Site of the Day", "FWA of the Day"],
    themeColors: ["#1b2a6b", "#f2ede0", "#2f6bff"],
    images: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    slug: "temp-iventions",
    title: "IVENTIONS",
    subtitle: "Promotional",
    category: "Promotional",
    description:
      "[Temp] A new website for Iventions, an elite event agency based in Barcelona.",
    role: "Creative Direction & Web Architecture",
    launch: "October 2020",
    client: "Iventions Barcelona",
    liveUrl: "https://iventions.example.com",
    overview:
      "Temporary CMS seed data. Immersive venue previews with kinetic typography and smooth state transitions.",
    techStack: ["React", "Three.js", "GSAP ScrollTrigger"],
    recognition: ["Awwwards Site of the Day", "CSSDA Website of the Day"],
    themeColors: ["#e63946", "#f1faee", "#457b9d"],
    images: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    slug: "temp-dafi-tropicdane",
    title: "DAFI TROPICDANE",
    subtitle: "Furniture",
    category: "Furniture & Interior",
    description:
      "[Temp] A minimal, Scandinavian-inspired website for DAFI, a Danish stone furniture company.",
    role: "Art Direction & Web Production",
    launch: "May 2019",
    client: "DAFI Furniture A/S",
    liveUrl: "https://dafitropicdane.example.com",
    overview:
      "Temporary CMS seed data. Nordic minimalism, tactile texture previews and architectural spacing.",
    techStack: ["Next.js", "Tailwind CSS", "Framer Motion"],
    recognition: ["Behance UI Gallery Featured", "Awwwards Honorable Mention"],
    themeColors: ["#606c38", "#fefae0", "#dda15e"],
    images: [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    slug: "temp-district2-studio",
    title: "DISTRICT2 STUDIO",
    subtitle: "Agency & Studio Showcase",
    category: "Agency & Studio",
    description:
      "[Temp] The new showcase website for District2, the first studio I ever worked at.",
    role: "Team Lead & Website Design",
    launch: "September 2018",
    client: "District2 Collective",
    liveUrl: "https://district2.example.com",
    overview:
      "Temporary CMS seed data. Bold structural grid shifts, monochromatic photography and experimental layouts.",
    techStack: ["Vue", "GSAP", "Canvas API"],
    recognition: ["Awwwards Site of the Day", "CSSDA Website of the Day", "Behance UI Curated"],
    themeColors: ["#22223b", "#c9ada7", "#f2e9e4"],
    images: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    slug: "temp-est-populo",
    title: "EST POPULO",
    subtitle: "Agency & Studio",
    category: "Brand Experience",
    description:
      "[Temp] A bold digital experience for Est Populo, a Swedish marketing agency.",
    role: "Lead Creative Designer",
    launch: "February 2022",
    client: "Est Populo AB",
    liveUrl: "https://estpopulo.example.com",
    overview:
      "Temporary CMS seed data. Custom cursor dynamics, kinetic typography loops and seamless image scaling.",
    techStack: ["Next.js", "Tailwind CSS", "GSAP Physics"],
    recognition: ["Behance UI Gallery", "Awwwards Mobile Excellence"],
    themeColors: ["#e76f51", "#f4a261", "#e9c46a"],
    images: [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    slug: "temp-bison-studio",
    title: "BISON STUDIO",
    subtitle: "3D & Visualization",
    category: "Architectural Studio",
    description:
      "[Temp] A New York 3D studio translating architectural visions into photorealistic renders.",
    role: "UI/UX & WebGL Direction",
    launch: "January 2023",
    client: "Bison 3D LLC",
    liveUrl: "https://bisonstudio.example.com",
    overview:
      "Temporary CMS seed data. Visitors manipulate light sources on architectural models in the browser.",
    techStack: ["Three.js", "React Three Fiber", "Next.js"],
    recognition: ["FWA of the Month Nominee", "Awwwards Developer Award"],
    themeColors: ["#264653", "#2a9d8f", "#e9c46a"],
    images: [
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    slug: "temp-won-j-you-studios",
    title: "WON J. YOU STUDIOS",
    subtitle: "Personal Brand",
    category: "Design Leadership",
    description:
      "[Temp] A high-impact website for Won J. You, veteran designer and advisor.",
    role: "Principal Visual Designer",
    launch: "November 2021",
    client: "Won J. You",
    liveUrl: "https://wonjyou.example.com",
    overview:
      "Temporary CMS seed data. Stark typographic hierarchies and deliberate spatial rhythms.",
    techStack: ["Next.js", "GSAP", "Tailwind CSS"],
    recognition: ["Awwwards Site of the Day", "Typewolf Site of the Month"],
    themeColors: ["#ef4444", "#f5e9c9", "#f59e0b"],
    images: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    slug: "temp-mux-studio",
    title: "MUX STUDIO",
    subtitle: "Research & UX",
    category: "Digital Agency",
    description:
      "[Temp] A stark, kinetic portfolio for a breakthrough young UX advisory team.",
    role: "Creative Direction / Web 3D",
    launch: "March 2024",
    client: "MUX Advisory Group",
    liveUrl: "https://muxstudio.example.com",
    overview:
      "Temporary CMS seed data. Real-time shader ripples and modular design card mechanics.",
    techStack: ["Next.js 15", "GSAP 3", "GLSL Shaders"],
    recognition: ["Awwwards SOTD Nominee", "CSS Design Awards Best UI"],
    themeColors: ["#6d28d9", "#a78bfa", "#22d3ee"],
    images: [
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1200&auto=format&fit=crop",
    ],
  },
];

const payload = await getPayload({ config });

async function uploadImage(url: string, name: string, alt: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const data = Buffer.from(await res.arrayBuffer());
  const media = await payload.create({
    collection: "media",
    data: { alt },
    file: { data, name, mimetype: res.headers.get("content-type") || "image/jpeg", size: data.length },
  });
  payload.logger.info(`  uploaded media ${media.filename} -> ${media.url}`);
  return media;
}

async function findOrCreateCategory(name: string) {
  const existing = await payload.find({
    collection: "categories",
    where: { name: { equals: name } },
    limit: 1,
  });
  if (existing.docs[0]) return existing.docs[0];
  return payload.create({ collection: "categories", data: { name } });
}

for (const p of SEED) {
  const existing = await payload.find({
    collection: "projects",
    where: { slug: { equals: p.slug } },
    limit: 1,
    draft: true,
  });
  if (existing.docs[0]) {
    payload.logger.info(`Skipping ${p.title} (slug ${p.slug} already exists)`);
    continue;
  }

  payload.logger.info(`Seeding ${p.title}`);
  const media = [];
  for (const [i, url] of p.images.entries()) {
    media.push(await uploadImage(url, `${p.slug}-${i + 1}.jpg`, `${p.title} preview ${i + 1}`));
  }
  const category = await findOrCreateCategory(p.category);

  const project = await payload.create({
    collection: "projects",
    data: {
      title: p.title,
      slug: p.slug,
      subtitle: p.subtitle,
      description: p.description,
      image: media[0].id,
      gallery: media.map((m) => ({ image: m.id })),
      categories: [category.id],
      role: p.role,
      launch: p.launch,
      client: p.client,
      liveUrl: p.liveUrl,
      recognition: p.recognition,
      techStack: p.techStack,
      themeColors: p.themeColors,
      overview: p.overview,
      publishedAt: new Date().toISOString(),
      _status: "published",
    },
  });
  payload.logger.info(`  created project ${project.title} (${project.id})`);
}

payload.logger.info("Seed complete.");
