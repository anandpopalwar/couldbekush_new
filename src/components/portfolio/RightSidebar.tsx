"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import gsap from "gsap";
import { Project } from "@/types/portfolio";

interface RightSidebarProps {
  projects: Project[];
  currentIndex: number;
  onGoToIndex: (
    index: number,
    direction?: "up" | "down",
    stepDelta?: number,
  ) => void;
}

const ITEM_HEIGHT = 150;
// Number of slots rendered above / below the center slot. The track only ever
// holds these (2*R + 1) fixed slots and never scrolls more than one card, so a
// runaway multi-card "sweep" is structurally impossible.
const SLOT_RADIUS = 8;

// A slot's appearance is a function of how far it actually is from the centre of
// the viewport, not of which slot happens to hold the selected project. The
// slots are relabeled the instant the selection changes but the track takes
// 0.38s to glide, so a boolean would make the incoming card fully selected while
// it is still a whole slot away. Both formulas below collapse to exactly the old
// values at rest (distance 0, 1, 2 …) and only differ while the track moves.
const SLOT_FALLOFF = 0.52;
const MIN_FADE = 0.1;
// How late the emphasis arrives. 1 ramps linearly across the slot; higher keeps
// the card plain until it is nearly centred, then commits quickly.
const CENTER_RAMP = 2.2;

const PLAIN_RGB = [156, 163, 175]; // gray-400
const INK_RGB = [17, 17, 17]; // ink

function slotFade(distance: number) {
  return Math.max(MIN_FADE, Math.pow(SLOT_FALLOFF, distance));
}

/** 1 when a slot is dead centre, 0 once it is a full slot away. */
function slotEmphasis(distance: number) {
  return Math.pow(Math.max(0, 1 - distance), CENTER_RAMP);
}

function slotColor(emphasis: number) {
  const channel = (i: number) =>
    Math.round(PLAIN_RGB[i] + (INK_RGB[i] - PLAIN_RGB[i]) * emphasis);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

// useLayoutEffect on the client (positions the track before paint so relabels
// are never visible), falling back to useEffect during SSR to avoid warnings.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function RightSidebar({
  projects,
  currentIndex,
  onGoToIndex,
}: RightSidebarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const paintedRef = useRef<number[]>([]);
  const prevIndexRef = useRef(currentIndex);
  const mountedRef = useRef(false);
  const totalCount = projects.length;

  const slotCount = SLOT_RADIUS * 2 + 1;

  // Re-derive every slot's emphasis from where the track actually is. Called on
  // each frame of the glide, so emphasis follows the motion instead of leading
  // it. Slots whose distance hasn't meaningfully changed are left alone.
  const paint = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const vpH =
      viewportRef.current?.clientHeight ||
      (typeof window !== "undefined" ? window.innerHeight : 0);
    const trackY = (gsap.getProperty(track, "y") as number) ?? 0;
    const viewportCenter = vpH / 2;

    slotsRef.current.forEach((el, j) => {
      if (!el) return;
      const slotCenter = trackY + j * ITEM_HEIGHT + ITEM_HEIGHT / 2;
      const distance = Math.abs(slotCenter - viewportCenter) / ITEM_HEIGHT;

      const cacheKey = Math.round(distance * 500);
      if (paintedRef.current[j] === cacheKey) return;
      paintedRef.current[j] = cacheKey;

      const emphasis = slotEmphasis(distance);
      el.style.opacity = slotFade(distance).toFixed(3);
      el.style.color = slotColor(emphasis);
      el.style.setProperty("--u", emphasis.toFixed(3));
    });
  }, []);

  // Track Y that parks the center slot at the vertical center of the viewport.
  const restY = useCallback(() => {
    const vpH =
      viewportRef.current?.clientHeight ||
      (typeof window !== "undefined" ? window.innerHeight : 0);
    return vpH / 2 - (SLOT_RADIUS * ITEM_HEIGHT + ITEM_HEIGHT / 2);
  }, []);

  // On every selection change, glide exactly one card (the minimal step, so the
  // first<->last wrap is a single card too). The slots are relabeled instantly by
  // render; we compensate the relabel with a set() so the glide stays continuous,
  // then always settle back to the same rest position (no drift, no teleport).
  useIsomorphicLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      prevIndexRef.current = currentIndex;
      gsap.set(track, { y: restY() });
      paint();
      return;
    }

    let dir =
      (((currentIndex - prevIndexRef.current) % totalCount) + totalCount) %
      totalCount;
    if (dir > totalCount / 2) dir -= totalCount;
    prevIndexRef.current = currentIndex;
    if (dir === 0) return;

    const base = restY();
    const currentY = (gsap.getProperty(track, "y") as number) ?? base;
    // The relabel shifted every slot's project by `dir`; shift the track by the
    // same amount so the picture is unchanged, then animate back to rest.
    gsap.set(track, { y: currentY - dir * ITEM_HEIGHT });
    // Repaint against the compensated position, so the first frame after a step
    // still emphasises whichever card is genuinely at the centre — the one that
    // is about to leave — rather than the one that hasn't arrived yet.
    paint();
    gsap.to(track, {
      y: base,
      duration: 0.38,
      ease: "power2.out",
      overwrite: true,
      onUpdate: paint,
      onComplete: paint,
    });
  }, [currentIndex, totalCount, restY, paint]);

  // Resize: re-park instantly.
  useEffect(() => {
    const handleResize = () => {
      const track = trackRef.current;
      if (track) gsap.set(track, { y: restY() });
      paint();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [restY, paint]);

  // No local wheel handler: wheel events over the sidebar bubble up to the global
  // page scroll handler, which advances the deck (and the sidebar follows in sync).

  const themeColors = projects[currentIndex]?.themeColors;

  return (
    <aside className="hidden md:flex md:col-start-10 md:col-span-3 md:row-start-1 h-full flex-col justify-between pointer-events-auto pl-0 pr-30 overflow-hidden relative">
      <div
        ref={viewportRef}
        className="w-full h-full relative overflow-hidden touch-none"
      >
        <div ref={trackRef} className="absolute top-0 left-0 w-full will-change-transform">
          {Array.from({ length: slotCount }, (_, j) => {
            // Slot offset from center: negative = above (next projects),
            // positive = below (previous projects) — matching the card deck.
            const s = j - SLOT_RADIUS;
            const pIdx =
              (((currentIndex - s) % totalCount) + totalCount) % totalCount;
            const project = projects[pIdx];
            const isCenter = s === 0;

            // Rest-state appearance, for the first paint and for SSR. paint()
            // takes over as soon as the track moves; the two agree exactly here.
            const distance = Math.abs(s);
            const emphasis = slotEmphasis(distance);

            return (
              <div
                key={j}
                ref={(el) => {
                  slotsRef.current[j] = el;
                }}
                onClick={() => {
                  if (isCenter) return;
                  onGoToIndex(pIdx, s < 0 ? "down" : "up");
                }}
                style={
                  {
                    opacity: slotFade(distance),
                    color: slotColor(emphasis),
                    "--u": emphasis,
                  } as React.CSSProperties
                }
                className="rs-slot h-[150px] relative flex flex-col items-center justify-center text-center cursor-pointer select-none px-0 pr-28 "
              >
                <span className="rs-sub uppercase mb-1">{project.subtitle}</span>

                <h4 className="rs-title uppercase">{project.title}</h4>

                <span className="rs-dash my-1">—</span>

                <p className="rs-desc max-w-[280px] line-clamp-3 leading-snug">
                  {project.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected project's theme swatches — fixed at the right edge, vertically centered
          (represents the theme of the currently selected project). */}
      {themeColors && themeColors.length > 0 && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden xl:flex space-x-1.5 pointer-events-none">
          {themeColors.map((color, i) => (
            <span
              key={i}
              className="w-3.5 h-3.5 rounded-[3px] inline-block shadow-xs"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-6 right-6 z-30 font-mono text-[10px] font-bold text-ink uppercase tracking-wider flex items-center space-x-1 hover:opacity-75 transition-opacity cursor-pointer">
        <span className="underline font-black">'25 showreel</span>
        <span className="text-[8px]">▶</span>
      </div>
    </aside>
  );
}
