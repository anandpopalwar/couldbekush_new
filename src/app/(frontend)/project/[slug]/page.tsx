import type { Metadata } from 'next';
import Image from 'next/image';
import { SlideLink } from '@/components/transition/SlideLink';
import { notFound } from 'next/navigation';
import { getProject, getProjects } from '@/lib/getProjects';
import { ProjectChrome } from '@/components/portfolio/ProjectChrome';
import { PageEnter } from '@/components/portfolio/PageEnter';
import { HeavyScroll } from '@/components/portfolio/HeavyScroll';

type Params = { params: Promise<{ slug: string }> };

// Without this the route is rendered on demand for every visit — a cold
// function, a fresh database connection and the query, all before the first
// byte. With it each case study is built ahead of time and served as a static
// page, rebuilt only when an editor changes content (see
// src/collections/revalidate.ts). A project published after the build is
// still rendered on its first visit and cached from then on.
export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return { title: 'Project not found — couldbekush' };

  return {
    title: `${project.title} — couldbekush`,
    description: project.description,
  };
}

/**
 * The project's accent, from its own theme colours.
 *
 * Prefers the most saturated colour that is still legible on the canvas, and
 * falls back to the darkest. The name is set at 11.5vw in this colour, so a
 * washed-out pick would be the most visible mistake on the page — and the
 * palettes come from the work, not from this design.
 */
function accentFrom(colors?: string[]) {
  const parse = (hex: string) => {
    const raw = hex.replace('#', '');
    const full =
      raw.length === 3
        ? raw
            .split('')
            .map((c) => c + c)
            .join('')
        : raw;
    if (full.length !== 6) return null;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };

  const scored = (colors ?? [])
    .map((hex) => {
      const rgb = parse(hex);
      if (!rgb) return null;
      const [r, g, b] = rgb;
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      return { hex, luminance, saturation };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (!scored.length) return undefined;

  const legible = scored.filter((c) => c.luminance <= 0.72);
  const pool = legible.length ? legible : scored;
  return [...pool].sort(
    (a, b) => b.saturation - a.saturation || a.luminance - b.luminance,
  )[0].hex;
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const projects = await getProjects();
  const index = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(index + 1) % projects.length];
  const accent = accentFrom(project.themeColors);

  const images = [project.image, ...(project.gallery ?? [])].filter(Boolean);

  return (
    // body is overflow:hidden for the deck, so this page carries its own
    // scroller rather than fighting the global rule.
    // Keyed on the slug so one case study genuinely replaces another. The
    // template above keys on `/project`, so it does not remount when only the
    // slug changes — without this key React reconciles the two pages in place:
    // PageEnter's mount effect never re-runs (no landing animation on the
    // second project) and the scroller keeps the position it was left at, so
    // the new page opens already scrolled to its foot.
    //
    // flex below 1100 purely so the title can be ordered to the top of the
    // page there while staying last in the DOM, where it belongs: it is the
    // page's h1 but on desktop it is furniture along the foot. Back to `block`
    // at compact+, where that furniture is `sticky bottom-0`.
    <HeavyScroll
      key={project.slug}
      className="case-study page-canvas fixed inset-0 overflow-y-auto overscroll-y-contain [touch-action:auto] text-ink flex flex-col compact:block"
    >
      {/* The site's furniture stays put — menu, header, scroll hint — so this
          reads as part of the site rather than a document it links out to. */}
      <ProjectChrome />

      <div className="case-study-body grid gap-y-12 px-6 pt-10 pb-24 compact:grid-cols-[var(--shot-lead)_var(--shot-width)_1fr] compact:gap-x-12 compact:px-12 compact:pt-[var(--shot-top)] compact:pb-28">
        {/* Everything factual, in one quiet column. Sticky so it stays with you
            while the work scrolls past it. */}
        {/* Pinned to the middle of the viewport rather than scrolling with the
            work. It leaves the grid flow to do that, which is safe here: the
            leading track is declared in grid-cols, not sized by this item, so the
            column stays reserved and the shots don't shift left. left-12 and
            w-80 mirror the container's px-12. */}
        {/* Set exactly like rail-left-meta on the deck: one grid with an `auto`
            label track so every value lines up, gap-x-3 / gap-y-8, and
            text-label-xs throughout — muted labels, ink values, no bold. The
            label track is shared rather than per-row, which is what keeps the
            values aligned; min-w-0 stops a long word overflowing its track. */}
        <aside className="case-study-rail fade-at-end grid grid-cols-[auto_1fr] gap-x-3 gap-y-8 items-start content-start min-w-0 compact:fixed compact:left-12 compact:top-1/2 compact:-translate-y-1/2 compact:w-80 compact:z-10">
          <span className="text-label-xs text-inkMuted">About</span>
          <p className="text-label-xs text-ink min-w-0">
            {project.overview || project.description}
          </p>

          {project.client && (
            <>
              <span className="text-label-xs text-inkMuted">Team</span>
              <p className="text-label-xs text-ink min-w-0">{project.client}</p>
            </>
          )}

          {project.role && (
            <>
              <span className="text-label-xs text-inkMuted">Role</span>
              <p className="text-label-xs text-ink min-w-0">{project.role}</p>
            </>
          )}

          {project.launch && (
            <>
              <span className="text-label-xs text-inkMuted">Launch</span>
              <p className="text-label-xs text-ink min-w-0">{project.launch}</p>
            </>
          )}

          {project.recognition.length > 0 && (
            <>
              <span className="text-label-xs text-inkMuted">Recognition</span>
              <ul className="text-label-xs text-ink min-w-0">
                {project.recognition.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {project.liveUrl && (
            <>
              <span aria-hidden />
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="text-label-xs w-fit border-b pb-1 hover:opacity-60 transition-opacity"
                style={
                  accent ? { color: accent, borderColor: accent } : undefined
                }
              >
                Visit site →
              </a>
            </>
          )}
        </aside>

        {/* The work. No radius, no shadow — these read as work, not interface. */}
        {/* Bounces up as the slide leaves over it. The wrapper is this column
            rather than the page, because everything else here is fixed. */}
        <PageEnter className="case-study-shots flex flex-col items-center gap-y-6 compact:gap-y-10 min-w-0 compact:col-start-2">
          {images.map((src, i) => (
            <figure
              key={src}
              id={`shot-${i}`}
              className="case-study-shot relative aspect-[16/10] w-full overflow-hidden bg-surface scroll-mt-28"
            >
              <Image
                src={src}
                alt={`${project.title} — ${i + 1} of ${images.length}`}
                fill
                sizes="(max-width: 1100px) 100vw, 41vw"
                priority={i === 0}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="object-cover object-center"
              />
            </figure>
          ))}
        </PageEnter>

        {/* A rail of every shot, doubling as the page's progress. Pinned to the
            middle of the viewport like case-study-rail, rather than sticking
            below the header. It leaves the grid flow to do that — the trailing
            1fr track must stay declared in grid-cols even so, because that empty
            track is what balances --shot-lead and keeps the work centred. */}
        {images.length > 1 && (
          <nav
            aria-label="Images in this project"
            className="case-study-minimap fade-at-end hidden compact:flex compact:fixed compact:right-12 compact:top-1/2 compact:-translate-y-1/2 compact:w-12 compact:z-10 flex-col gap-y-2"
          >
            {images.map((src, i) => (
              <a
                key={src}
                href={`#shot-${i}`}
                aria-label={`Image ${i + 1}`}
                className="relative block h-8 w-full overflow-hidden bg-surface opacity-50 hover:opacity-100 transition-opacity"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="48px"
                  loading="lazy"
                  className="object-cover object-center"
                />
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* Two lives, one element. At compact+ it is the name across the foot of
          the page — the counterpart to the deck's oversized counter, sitting
          above the work, scrolling nothing, fading out as you go. Below that
          it is simply the page's heading: ordered to the top, centred, in the
          flow above the details, and it scrolls away with everything else
          (`fade-on-scroll` is scoped to compact+ in globals.css for exactly
          that reason, or it would dissolve the moment you moved).
          Flat ink rather than the counter's inverted blend: this one passes
          over the work as you scroll, and a difference blend turned it into
          whatever the image underneath happened to be. */}
      <div className="case-study-title fade-on-scroll order-first compact:order-none static compact:sticky bottom-0 z-20 pointer-events-none px-6 pt-56 pb-0 text-center compact:px-12 compact:pt-0 compact:pb-2 compact:text-right">
        <h1 className="title-wide text-[length:var(--project-title-size)] leading-[0.78] uppercase tracking-tight text-ink">
          {project.title}
        </h1>
      </div>

      {/* A screen of its own, not a footer: the next project gets the whole
          viewport, its name centred and set exactly as the one along the foot
          of the page — white, inverted against the canvas.
          dvh rather than vh so a phone's collapsing toolbar doesn't leave the
          name sitting below the fold. */}
      {next && next.slug !== project.slug && (
        <SlideLink
          href={`/project/${next.slug}`}
          label={next.title}
          className="case-study-next flex h-[100dvh] shrink-0 flex-col items-center justify-center gap-y-3 px-6 compact:px-12"
        >
          <span className="text-label-xs text-ink">Next project</span>
          {/* nowrap keeps it on one line as in the reference; the size is a
              token so it can be tuned against the longest title in the deck.
              Solid ink like the name along the foot of the page. The fade is
              its own hover, not the link's: the anchor covers the whole screen,
              so a group-hover would have fired from anywhere on it. */}
          <span className="title-wide text-[length:var(--next-title-size)] leading-[0.95] whitespace-nowrap uppercase tracking-tight text-ink transition-opacity duration-300 hover:opacity-40">
            {next.title}
          </span>
        </SlideLink>
      )}
    </HeavyScroll>
  );
}
