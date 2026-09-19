"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import gsap from "gsap";
import { Project } from "@/types/portfolio";
import { ChevronDown } from "lucide-react";

/**
 * CardDeck2 — vertical deck, conveyor flow.
 *
 * The deck is a conveyor, not a carousel. Rather than cycling one DOM node per
 * project around a ring — which forces a card to teleport from the top of the
 * stack back to the bottom, the jump you catch when scrolling fast — this
 * renders a short window of slots around the current position, each one keyed by
 * an ever-increasing virtual index.
 *
 * Because the key never repeats, a card element is never reused for a different
 * position: it mounts one slot beyond the deck (off screen), slides inward as
 * the deck advances, and unmounts one slot past the far side, also off screen.
 * The only motion visible on screen is a card travelling straight up or straight
 * down. There is no wrap, no teleport, and nothing to catch.
 *
 * `currentIndex` from the parent is wrapped to 0..n-1, so it can't tell +1 from
 * a wrap of -7. The deck keeps its own unbounded `virtual` counter and advances
 * it by the shortest signed path each time the prop changes.
 */

// Selected card, blown up relative to the deck's base card size.
const CENTER_SCALE = 1.3;

// Slots rendered either side of centre. Slot ±1 is half off screen; slot ±2 is
// fully off screen and is where cards mount and unmount.
const HALF_WINDOW = 2;

// Slot ±1 is parked with its centre on the viewport edge — half the card shows,
// half is cut off. SLOT_NUDGE shifts that (negative = more card on screen).
const SLOT_NUDGE = 0;

// Distance added per slot beyond the first. Roughly one card height, so slot ±2
// clears the screen edge completely and mount/unmount can never be seen.
const OFFSCREEN_STEP = 280;

// Depth cues, index = |offset| - 1. A vertical stack has no diagonal offset to
// read depth from, so scale carries it.
const SLOT_SCALE = [0.94, 0.88, 0.84];
const SLOT_OPACITY = [0.96, 0.9, 0.9];

// Card movement. Short and crisp on purpose — a long duration with a deep
// ease-out tail (the old 0.65s / power3.out) reads as a floaty glide rather than
// a deck of cards being dealt. Swap EASE for "back.out(1.4)" if you want the
// card to slam past its slot and settle, or "none" for a fully mechanical step.
const DURATION = 0.3;
const EASE = "power2.out";

// Intro, once per page load, and the only motion on the page that nobody asked
// for — so it gets one gesture, borrowed from handling an actual deck: the cards
// are set down as a loose pile, squared up, then flicked out one at a time.
const INTRO_DROP = 44; // height the pile is set down from
const INTRO_POP_FROM = 0.9; // pile starts at this fraction of centre scale
const INTRO_SQUARE_DURATION = 0.45;
const INTRO_SQUARE_EASE = "back.out(1.6)";
const INTRO_DEAL_DURATION = 0.52;
// Slight overshoot on landing — a dealt card is flicked, not placed.
const INTRO_DEAL_EASE = "back.out(1.1)";
// Spin a card carries off the pile, unwound by the time it lands.
const INTRO_KICK_DEG = 7;
// Uneven gaps between deals, in order +1, -1, +2, -2. An even stagger is a
// metronome; a hand dealing cards isn't one.
const INTRO_BEATS = [0, 0.09, 0.26, 0.35];
const INTRO_TOTAL_MS =
  (INTRO_SQUARE_DURATION +
    INTRO_BEATS[INTRO_BEATS.length - 1] +
    INTRO_DEAL_DURATION) *
  1000;

/**
 * Deterministic per-card offset for the starting pile, so it looks hand-stacked
 * rather than machine-aligned — and looks identical on every load.
 */
function pileJitter(key: number) {
  const hash = (seed: number) => {
    const value = Math.sin(key * seed) * 43758.5453;
    return value - Math.floor(value) - 0.5;
  };
  return {
    x: hash(12.9898) * 11,
    y: hash(78.233) * 7,
    rotation: hash(39.425) * 7,
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface SlotPose {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/**
 * Where a card sits for a given signed distance from centre. A resting pose is
 * always square — x and rotation are named explicitly so that a card caught
 * mid-intro, tilted and offset on the pile, is straightened by the next layout
 * rather than left crooked.
 */
function slotPose(offset: number, viewportHeight: number): SlotPose {
  const depth = Math.abs(offset);
  if (depth === 0) {
    return { x: 0, y: 0, rotation: 0, scale: CENTER_SCALE, opacity: 1, zIndex: 40 };
  }
  const step = Math.min(depth, SLOT_SCALE.length) - 1;
  return {
    x: 0,
    rotation: 0,
    // Upcoming projects (positive offset) stack above centre and travel down.
    y: -Math.sign(offset) * (viewportHeight / 2 + SLOT_NUDGE + step * OFFSCREEN_STEP),
    scale: SLOT_SCALE[step],
    opacity: SLOT_OPACITY[step],
    zIndex: 40 - depth,
  };
}

function poseSignature(pose: SlotPose) {
  return `${pose.y}|${pose.scale}|${pose.opacity}|${pose.zIndex}`;
}

/** Shortest signed step from one wrapped index to another. */
function shortestDelta(from: number, to: number, count: number) {
  let delta = to - from;
  while (delta > count / 2) delta -= count;
  while (delta < -count / 2) delta += count;
  return delta;
}

function windowAround(centre: number) {
  const keys: number[] = [];
  for (let offset = -HALF_WINDOW; offset <= HALF_WINDOW; offset++) {
    keys.push(centre + offset);
  }
  return keys;
}

interface CardDeck2Props {
  projects: Project[];
  currentIndex: number;
  onGoToIndex: (
    index: number,
    direction?: "up" | "down",
    stepDelta?: number,
  ) => void;
  onSelectProject: (project: Project) => void;
}

export function CardDeck2({
  projects,
  currentIndex,
  onGoToIndex,
  onSelectProject,
}: CardDeck2Props) {
  const totalCount = projects.length;

  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  // Keys already positioned at least once — anything else is entering.
  const placedRef = useRef<Set<number>>(new Set());
  // Last target applied per key, so a re-render (a card unmounting, say) doesn't
  // restart every in-flight tween against the pose it is already heading for.
  const poseRef = useRef<Map<number, string>>(new Map());
  // Unbounded position counter; `currentIndex` is its wrapped shadow.
  const virtualRef = useRef(currentIndex);
  // Direction of the last move, so a card entering at centre (a multi-step jump)
  // still knows which side to come in from.
  const travelRef = useRef(1);
  const initialKeyRef = useRef(currentIndex);
  // The deal-out intro, and its queued tweens so an early scroll can cancel them.
  const introPendingRef = useRef(true);
  const introTweensRef = useRef<gsap.core.Tween[]>([]);

  const [virtual, setVirtual] = useState(currentIndex);
  // Mounted keys: the live window plus any card still animating off the deck.
  const [slots, setSlots] = useState<number[]>(() => windowAround(currentIndex));

  const [hintVisible, setHintVisible] = useState(false);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const dragDeltaRef = useRef(0);

  const projectFor = useCallback(
    (key: number) => projects[((key % totalCount) + totalCount) % totalCount],
    [projects, totalCount],
  );

  // The hint waits for the deal to finish rather than talking over it, then
  // shows for 4.5s.
  useEffect(() => {
    const start = prefersReducedMotion() ? 0 : INTRO_TOTAL_MS;
    const show = setTimeout(() => setHintVisible(true), start);
    const hide = setTimeout(() => setHintVisible(false), start + 4500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  // Follow the parent's wrapped index with an unbounded counter. Both state
  // updates batch, so the render that moves the deck already carries the
  // departing cards — they animate off instead of vanishing.
  useEffect(() => {
    const wrapped =
      ((virtualRef.current % totalCount) + totalCount) % totalCount;
    const delta = shortestDelta(wrapped, currentIndex, totalCount);
    if (delta === 0) return;

    const next = virtualRef.current + delta;
    virtualRef.current = next;
    travelRef.current = Math.sign(delta);
    setVirtual(next);
    setSlots((prev) =>
      Array.from(new Set([...prev, ...windowAround(next)])).sort((a, b) => a - b),
    );
  }, [currentIndex, totalCount]);

  const layoutDeck = useCallback(
    // `force` re-settles a card whose target hasn't changed but whose transform
    // was moved out from under the deck — a released drag.
    (immediate = false, force = false) => {
      const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 900;
      const centre = virtualRef.current;

      // Kill any queued intro tween before a normal layout runs. A tween still
      // waiting on its delay isn't "active", so GSAP's overwrite:"auto" won't
      // catch it — it would fire later and yank the card back to its intro slot.
      if (introTweensRef.current.length) {
        introTweensRef.current.forEach((tween) => tween.kill());
        introTweensRef.current = [];
        // Those cards were recorded as already at their final pose; clear that so
        // the layout below always re-applies rather than skipping as unchanged.
        slots.forEach((key) => poseRef.current.delete(key));
      }

      // Deal-out intro, first layout only.
      if (introPendingRef.current && !immediate) {
        introPendingRef.current = false;
        const reducedMotion = prefersReducedMotion();
        const pile = slotPose(0, viewportHeight);

        slots.forEach((key) => {
          const el = cardsRef.current.get(key);
          if (!el) return;

          const offset = key - centre;
          const depth = Math.abs(offset);
          const pose = slotPose(offset, viewportHeight);

          placedRef.current.add(key);
          poseRef.current.set(key, poseSignature(pose));
          el.style.pointerEvents = depth <= 1 ? "auto" : "none";

          // Unasked-for motion is the first thing to drop for anyone who has
          // asked not to see it. The deck is simply already dealt.
          if (reducedMotion) {
            gsap.set(el, pose);
            return;
          }

          // The deck is set down as one loose pile, a little above centre and a
          // little undersized. zIndex is already final, so the selected card is
          // the one on top.
          const jitter = pileJitter(key);
          gsap.set(el, {
            x: jitter.x,
            y: pile.y - INTRO_DROP + jitter.y,
            rotation: jitter.rotation,
            scale: pile.scale * INTRO_POP_FROM,
            opacity: 0,
            zIndex: pose.zIndex,
          });

          // It lands and squares up — the tap that straightens a deck.
          introTweensRef.current.push(
            gsap.to(el, {
              x: 0,
              y: pile.y,
              rotation: 0,
              scale: pile.scale,
              opacity: 1,
              duration: INTRO_SQUARE_DURATION,
              ease: INTRO_SQUARE_EASE,
            }),
          );

          // The selected card is already home — it lands and stays.
          if (depth === 0) return;

          // Then cards are flicked off the pile, nearest pair first, up before
          // down. Each leaves with a kick of spin that unwinds as it lands.
          const order = (depth - 1) * 2 + (offset > 0 ? 0 : 1);
          const beat = INTRO_BEATS[Math.min(order, INTRO_BEATS.length - 1)];
          introTweensRef.current.push(
            gsap.to(el, {
              ...pose,
              rotation: 0,
              startAt: { rotation: Math.sign(offset) * INTRO_KICK_DEG },
              duration: INTRO_DEAL_DURATION,
              delay: INTRO_SQUARE_DURATION + beat,
              ease: INTRO_DEAL_EASE,
            }),
          );
        });
        return;
      }

      slots.forEach((key) => {
        const el = cardsRef.current.get(key);
        if (!el) return;

        const offset = key - centre;
        const depth = Math.abs(offset);
        const leaving = depth > HALF_WINDOW;
        // A leaving card keeps going one slot past the deck, then unmounts.
        const pose = slotPose(
          leaving ? Math.sign(offset) * (HALF_WINDOW + 1) : offset,
          viewportHeight,
        );

        // Cards can only be clicked where they're actually visible.
        el.style.pointerEvents = depth <= 1 ? "auto" : "none";

        if (!placedRef.current.has(key)) {
          // First placement: start one slot beyond the deck, on the side this
          // card is arriving from. Always off screen, so it can only slide in.
          placedRef.current.add(key);
          const entrySide = Math.sign(offset) || travelRef.current;
          gsap.set(el, slotPose(entrySide * (HALF_WINDOW + 1), viewportHeight));
        }

        const signature = poseSignature(pose);
        const unchanged = poseRef.current.get(key) === signature;
        poseRef.current.set(key, signature);

        if (immediate) {
          gsap.set(el, pose);
          return;
        }

        if (unchanged && !force) return;

        gsap.to(el, {
          ...pose,
          duration: DURATION,
          ease: EASE,
          overwrite: "auto",
          onComplete: leaving
            ? () => {
                // It may have been scrolled back into the window mid-flight.
                if (Math.abs(key - virtualRef.current) <= HALF_WINDOW) return;
                placedRef.current.delete(key);
                poseRef.current.delete(key);
                cardsRef.current.delete(key);
                setSlots((prev) => prev.filter((k) => k !== key));
              }
            : undefined,
        });
      });
    },
    [slots],
  );

  useLayoutEffect(() => {
    layoutDeck();
  }, [layoutDeck, virtual]);

  // Window resize — the slot distances are viewport-relative, so recompute.
  useEffect(() => {
    const handleResize = () => layoutDeck(true);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [layoutDeck]);

  // Pointer drag gestures
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    dragDeltaRef.current = 0;
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    dragDeltaRef.current = e.clientY - startYRef.current;

    const activeCard = cardsRef.current.get(virtualRef.current);
    if (!activeCard) return;

    // Drag feedback follows the deck's axis — straight up and down, no drift.
    // The squeeze is proportional to CENTER_SCALE so the card shrinks away from
    // its blown-up size instead of snapping down to the deck's base size.
    gsap.set(activeCard, {
      y: dragDeltaRef.current * 0.6,
      scale:
        CENTER_SCALE * (1 - Math.min(Math.abs(dragDeltaRef.current) * 0.0004, 0.08)),
    });
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const delta = dragDeltaRef.current;
    dragDeltaRef.current = 0;

    if (delta < -45) {
      onGoToIndex(currentIndex - 1, "up");
    } else if (delta > 45) {
      onGoToIndex(currentIndex + 1, "down");
    } else {
      // Under the threshold — settle the card back into centre from wherever the
      // drag left it. Its target never changed, so this has to be forced.
      layoutDeck(false, true);
    }
  };

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="col-span-1 md:col-start-4 md:col-span-6 md:row-start-1 h-full relative perspective-stage flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing overflow-visible touch-none select-none"
    >
      {/* Scaled card dimension stage — h-full + items-center puts the centre card
          on the exact vertical middle of the viewport. */}
      <div className="relative w-[75vw] sm:w-[315px] md:w-[335px] lg:w-[370px] aspect-[4/3] flex items-center justify-center">
        {/* Conveyor window */}
        <div className="relative w-full h-full">
          {slots.map((key) => {
            const project = projectFor(key);
            if (!project) return null;
            const isCenter = key === virtual;

            return (
              <div
                key={key}
                ref={(el) => {
                  if (el) cardsRef.current.set(key, el);
                  else cardsRef.current.delete(key);
                }}
                onClick={() => {
                  const offset = key - virtualRef.current;
                  if (offset === 0) {
                    onSelectProject(project);
                    return;
                  }
                  const index =
                    ((key % totalCount) + totalCount) % totalCount;
                  onGoToIndex(index, offset > 0 ? "down" : "up", offset);
                }}
                className="absolute inset-0 w-full h-full rounded-sm overflow-hidden bg-[#151515] will-change-transform select-none cursor-pointer group"
                data-key={key}
              >
                <div className="relative w-full h-full overflow-hidden">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    // Sized for the centre card's blown-up footprint (base width
                    // × CENTER_SCALE), otherwise the focal card upscales a 370px
                    // source and looks soft.
                    sizes="(max-width: 768px) 98vw, 481px"
                    // Cards mount off screen, so lazy loading would let one slide
                    // in empty. Eager everywhere; priority only for the first card
                    // painted, which is the LCP candidate.
                    priority={key === initialKeyRef.current}
                    loading="eager"
                    className={`object-cover object-center pointer-events-none transition-transform duration-500 ease-out ${
                      isCenter ? "group-hover:scale-105" : "scale-100"
                    }`}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating drag hint overlay */}
      <div
        className={`absolute bottom-6 flex items-center space-x-2 text-inkMuted text-[10px] font-mono tracking-widest uppercase pointer-events-none transition-opacity duration-700 ${
          hintVisible ? "opacity-60" : "opacity-0"
        }`}
      >
        <ChevronDown className="w-3 h-3 animate-bounce" />
        <span>Swipe / Scroll / Click</span>
      </div>
    </div>
  );
}
