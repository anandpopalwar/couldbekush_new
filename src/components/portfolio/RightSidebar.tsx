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
  const prevIndexRef = useRef(currentIndex);
  const mountedRef = useRef(false);
  const totalCount = projects.length;

  const slotCount = SLOT_RADIUS * 2 + 1;

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
    gsap.to(track, {
      y: base,
      duration: 0.38,
      ease: "power2.out",
      overwrite: true,
    });
  }, [currentIndex, totalCount, restY]);

  // Resize: re-park instantly.
  useEffect(() => {
    const handleResize = () => {
      const track = trackRef.current;
      if (track) gsap.set(track, { y: restY() });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [restY]);

  // Swallow wheel/scroll gestures over the sidebar so scrolling here neither
  // navigates the sidebar nor bubbles up to the global page scroll handler.
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  return (
    <aside className="hidden md:flex md:col-start-10 md:col-span-3 md:row-start-1 h-full flex-col justify-between pointer-events-auto pl-6 pr-20 overflow-hidden relative z-30">
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

            // Fade is fixed per slot (never changes), so relabels/recentering
            // can never cause an opacity flash.
            const fade = isCenter
              ? 1
              : Math.max(0.1, Math.pow(0.52, Math.abs(s)));

            return (
              <div
                key={j}
                onClick={() => {
                  if (isCenter) return;
                  onGoToIndex(pIdx, s < 0 ? "down" : "up");
                }}
                style={{ opacity: fade }}
                className="h-[150px] relative flex flex-col items-center justify-center text-center cursor-pointer select-none px-2"
              >
                <span
                  className={`uppercase mb-1 ${
                    isCenter
                      ? "text-ink font-extrabold text-[10.5px] tracking-widest"
                      : "text-ink font-normal text-[9px] tracking-normal"
                  }`}
                >
                  {project.subtitle}
                </span>

                <h4
                  className={`uppercase ${
                    isCenter
                      ? "text-ink font-black text-[19px] md:text-[21px] tracking-tight"
                      : "text-ink font-medium text-[14px] tracking-normal"
                  }`}
                >
                  {project.title}
                </h4>

                <span
                  className={`${
                    isCenter
                      ? "text-ink font-black text-sm my-1"
                      : "text-ink font-normal text-[10px] my-0.5"
                  }`}
                >
                  —
                </span>

                <p
                  className={`max-w-[280px] line-clamp-3 ${
                    isCenter
                      ? "text-ink font-black text-[12px] leading-snug"
                      : "text-ink font-normal text-[10px]"
                  }`}
                >
                  {project.description}
                </p>

                {isCenter && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden xl:flex space-x-1.5 pointer-events-none">
                    <span className="w-3.5 h-3.5 bg-pink-200 rounded-xs inline-block shadow-xs" />
                    <span className="w-3.5 h-3.5 bg-indigo-200 rounded-xs inline-block shadow-xs" />
                    <span className="w-3.5 h-3.5 bg-amber-100 rounded-xs inline-block shadow-xs" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-30 font-mono text-[10px] font-bold text-ink uppercase tracking-wider flex items-center space-x-1 hover:opacity-75 transition-opacity cursor-pointer">
        <span className="underline font-black">'25 showreel</span>
        <span className="text-[8px]">▶</span>
      </div>
    </aside>
  );
}
