'use client';

import {
  MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { Project } from '@/types/portfolio';
import { ChevronDown } from 'lucide-react';

/**
 * CardDeck2 — vertical deck, driven by a continuous position.
 *
 * The deck's state is a single float in `positionRef`: card units, where an
 * integer centres that card and 4.5 sits exactly between two. Input writes to
 * it directly and this component renders whatever it currently says, once per
 * frame. There are no per-card tweens and no stepping — the deck can sit
 * between cards, which is what lets a scroll be followed as it happens and
 * snapped only when it stops.
 *
 * Windowing is still a conveyor: a short ring of slots around the rounded
 * position, each keyed by its virtual index. Keys never repeat, so a card
 * element is never reused for another position and there is no wrap to catch.
 * Cards mount and unmount beyond the screen edge.
 */

// Selected card, blown up relative to the deck's base card size.
const CENTER_SCALE = 1.3;

// Slots either side of centre that can be on screen. ±1 is half off screen.
const HALF_WINDOW = 2;
// One extra ring stays mounted so a card leaving is never torn off mid-travel.
const MOUNT_RADIUS = HALF_WINDOW + 1;

// Slot ±1 is parked with its centre on the viewport edge — half the card shows,
// half is cut off. SLOT_NUDGE shifts that (negative = more card on screen).
const SLOT_NUDGE = 0;
// Distance added per slot beyond the first. Roughly one card height, so slot ±2
// clears the screen edge completely and mount/unmount can never be seen.
const OFFSCREEN_STEP = 280;

// Depth ramps, index = distance from centre in cards. Read continuously, so a
// card halfway between two slots gets values halfway between two entries.
const SCALE_RAMP = [CENTER_SCALE, 0.94, 0.88, 0.84];
const OPACITY_RAMP = [1, 0.96, 0.9, 0.9];
// Depth of field — only the selected card is in focus.
const BLUR_RAMP = [0, 3, 6, 6];

// Pointer drag: how far you pull for one card.
const DRAG_TRAVEL_PER_CARD = 220;

// Intro, once per page load, and the only motion on the page that nobody asked
// for — so it gets one gesture, borrowed from handling an actual deck: the cards
// are set down as a loose pile, squared up, then flicked out one at a time.
const INTRO_DROP = 44;
const INTRO_POP_FROM = 0.9;
const INTRO_SQUARE_DURATION = 0.45;
const INTRO_SQUARE_EASE = 'back.out(1.6)';
const INTRO_DEAL_DURATION = 0.52;
const INTRO_DEAL_EASE = 'back.out(1.1)';
const INTRO_KICK_DEG = 7;
const INTRO_BEATS = [0, 0.09, 0.26, 0.35];
const INTRO_TOTAL_MS =
  (INTRO_SQUARE_DURATION +
    INTRO_BEATS[INTRO_BEATS.length - 1] +
    INTRO_DEAL_DURATION) *
  1000;

/** Deterministic per-card offset, so the pile looks hand-stacked and identical on every load. */
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
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Read a depth ramp at a fractional distance. */
function ramp(values: number[], depth: number) {
  const t = Math.min(Math.max(depth, 0), values.length - 1);
  const i = Math.floor(t);
  const next = Math.min(i + 1, values.length - 1);
  return values[i] + (values[next] - values[i]) * (t - i);
}

interface SlotPose {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
  /** Blur radius in px. Kept numeric so the frame loop can compare it without
      building a string every frame; `poseToTween` wraps it for GSAP. */
  blur: number;
}

/** SlotPose in the shape GSAP wants — only the intro needs this. */
function poseToTween(pose: SlotPose) {
  const { blur, ...rest } = pose;
  return { ...rest, filter: `blur(${blur}px)` };
}

/**
 * Where a card sits for a signed distance from centre, in card units. Accepts
 * fractions: at 0.5 the card is halfway to its neighbour's slot, half-scaled
 * and half-blurred between the two. Rotation and x are always 0 — they exist so
 * a card left crooked by the intro is straightened by the next frame.
 */
function slotPose(offset: number, viewportHeight: number): SlotPose {
  const depth = Math.abs(offset);
  const edge = viewportHeight / 2 + SLOT_NUDGE;
  // Within one card of centre the travel is to the screen edge; beyond that
  // each further card clears by a card height.
  const distance =
    depth <= 1 ? depth * edge : edge + (depth - 1) * OFFSCREEN_STEP;

  return {
    x: 0,
    rotation: 0,
    // Upcoming projects (positive offset) stack above centre and travel down.
    y: -Math.sign(offset) * distance,
    scale: ramp(SCALE_RAMP, depth),
    opacity: ramp(OPACITY_RAMP, depth),
    // Fine-grained so two cards straddling the centre never tie.
    zIndex: Math.round(100 - depth * 10),
    // Rounded to a tenth of a pixel: blur is the most expensive property here,
    // and finer steps than this are invisible but still force a repaint.
    blur: Math.round(ramp(BLUR_RAMP, depth) * 10) / 10,
  };
}

function windowAround(centre: number) {
  const keys: number[] = [];
  for (let offset = -MOUNT_RADIUS; offset <= MOUNT_RADIUS; offset++) {
    keys.push(centre + offset);
  }
  return keys;
}

interface CardDeck2Props {
  projects: Project[];
  /** Live deck position in card units. Input writes here; the deck renders it. */
  positionRef: MutableRefObject<number>;
  /** The centred card changed — wrapped project index, and which way it moved. */
  onCentreChange: (index: number, direction: 'up' | 'down') => void;
  onGoToIndex: (index: number, direction?: 'up' | 'down') => void;
  onSelectProject: (project: Project) => void;
  /** Settle onto the nearest card, e.g. when a drag is released. */
  onSettle: () => void;
  /** Stop any in-flight settle, e.g. when a drag starts. */
  onGrab: () => void;
}

export function CardDeck2({
  projects,
  positionRef,
  onCentreChange,
  onGoToIndex,
  onSelectProject,
  onSettle,
  onGrab,
}: CardDeck2Props) {
  const totalCount = projects.length;

  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const startPosition = useRef(Math.round(positionRef.current));
  const centreRef = useRef(startPosition.current);
  const [centreKey, setCentreKey] = useState(startPosition.current);
  const [slots, setSlots] = useState<number[]>(() =>
    windowAround(startPosition.current),
  );

  // While the intro plays it owns the cards; the frame loop stands off.
  const introPendingRef = useRef(true);
  const introActiveRef = useRef(true);
  const introTweensRef = useRef<gsap.core.Tween[]>([]);

  const [hintVisible, setHintVisible] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartPositionRef = useRef(0);

  // Per-frame bookkeeping. `applied` is the last value written to each card, so
  // an unchanged property is never written twice; `dirty` forces a pass after a
  // mount or resize even though the position hasn't moved.
  const appliedRef = useRef<Map<number, SlotPose & { interactive: boolean }>>(
    new Map(),
  );
  const lastCentreRef = useRef<number | null>(null);
  const dirtyRef = useRef(true);
  // Cached so the loop never reads window.innerHeight, which can force layout.
  const viewportHeightRef = useRef(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );

  const projectFor = useCallback(
    (key: number) => projects[((key % totalCount) + totalCount) % totalCount],
    [projects, totalCount],
  );

  const viewportHeight = () => viewportHeightRef.current;

  // Cards mounting or unmounting change what has to be written next frame.
  useEffect(() => {
    dirtyRef.current = true;
  }, [slots]);

  useEffect(() => {
    const onResize = () => {
      viewportHeightRef.current = window.innerHeight;
      dirtyRef.current = true;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const endIntro = useCallback(() => {
    introTweensRef.current.forEach((tween) => tween.kill());
    introTweensRef.current = [];
    introActiveRef.current = false;
  }, []);

  // The hint waits for the deal rather than talking over it.
  useEffect(() => {
    const start = prefersReducedMotion() ? 0 : INTRO_TOTAL_MS;
    const show = setTimeout(() => setHintVisible(true), start);
    const hide = setTimeout(() => setHintVisible(false), start + 4500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  // Place a card the moment it mounts, before paint, so a card entering the
  // window is never visible for a frame at its untransformed size.
  const placeCard = useCallback(
    (el: HTMLDivElement, key: number) => {
      if (introActiveRef.current) return;
      gsap.set(el, poseToTween(slotPose(key - positionRef.current, viewportHeight())));
    },
    [positionRef],
  );

  // The frame loop: render whatever position currently says. This is the whole
  // motion model — no tweens per card, so the deck can rest between two cards
  // and follow input continuously.
  //
  // Written to do as little as possible per frame: it bails entirely when the
  // position hasn't moved, writes styles directly rather than through gsap.set,
  // and skips any property whose value is unchanged. At rest it costs one
  // float comparison; while scrolling, one transform write per card.
  useEffect(() => {
    const tick = () => {
      const centre = positionRef.current;

      if (introActiveRef.current) {
        // An early scroll cancels the intro and hands the deck over.
        if (centre !== startPosition.current) endIntro();
        else return;
      }

      if (!dirtyRef.current && centre === lastCentreRef.current) return;
      dirtyRef.current = false;
      lastCentreRef.current = centre;

      const vh = viewportHeightRef.current;
      cardsRef.current.forEach((el, key) => {
        const offset = key - centre;
        const pose = slotPose(offset, vh);
        const prev = appliedRef.current.get(key);

        if (!prev || prev.y !== pose.y || prev.scale !== pose.scale) {
          // translate3d keeps the card on its own compositor layer.
          el.style.transform = `translate3d(0px, ${pose.y}px, 0px) scale(${pose.scale})`;
        }
        if (!prev || prev.opacity !== pose.opacity) {
          el.style.opacity = String(pose.opacity);
        }
        if (!prev || prev.zIndex !== pose.zIndex) {
          el.style.zIndex = String(pose.zIndex);
        }
        if (!prev || prev.blur !== pose.blur) {
          el.style.filter = `blur(${pose.blur}px)`;
        }

        const interactive = Math.abs(offset) <= 1;
        if (!prev || prev.interactive !== interactive) {
          el.style.pointerEvents = interactive ? 'auto' : 'none';
        }

        appliedRef.current.set(key, { ...pose, interactive });
      });

      const rounded = Math.round(centre);
      if (rounded !== centreRef.current) {
        const direction = rounded > centreRef.current ? 'down' : 'up';
        centreRef.current = rounded;
        setCentreKey(rounded);
        setSlots(windowAround(rounded));
        onCentreChange(
          ((rounded % totalCount) + totalCount) % totalCount,
          direction,
        );
      }
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [positionRef, onCentreChange, totalCount, endIntro]);

  // Deal-out intro, first layout only.
  useLayoutEffect(() => {
    if (!introPendingRef.current) return;
    introPendingRef.current = false;

    const vh = viewportHeight();
    const centre = startPosition.current;
    const reducedMotion = prefersReducedMotion();
    const pile = slotPose(0, vh);

    if (reducedMotion) {
      introActiveRef.current = false;
      return;
    }

    slots.forEach((key) => {
      const el = cardsRef.current.get(key);
      if (!el) return;

      const offset = key - centre;
      const depth = Math.abs(offset);
      const pose = slotPose(offset, vh);

      // The deck is set down as one loose pile, a little above centre.
      const jitter = pileJitter(key);
      gsap.set(el, {
        x: jitter.x,
        y: pile.y - INTRO_DROP + jitter.y,
        rotation: jitter.rotation,
        scale: pile.scale * INTRO_POP_FROM,
        opacity: 0,
        zIndex: pose.zIndex,
        filter: 'blur(0px)',
      });

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

      if (depth === 0) return;

      const order = (depth - 1) * 2 + (offset > 0 ? 0 : 1);
      const beat = INTRO_BEATS[Math.min(order, INTRO_BEATS.length - 1)];
      introTweensRef.current.push(
        gsap.to(el, {
          ...poseToTween(pose),
          rotation: 0,
          startAt: { rotation: Math.sign(offset) * INTRO_KICK_DEG },
          duration: INTRO_DEAL_DURATION,
          delay: INTRO_SQUARE_DURATION + beat,
          ease: INTRO_DEAL_EASE,
        }),
      );
    });

    // Hand over to the frame loop once the last card has landed.
    const handover = setTimeout(endIntro, INTRO_TOTAL_MS);
    return () => clearTimeout(handover);
  }, [slots, endIntro]);

  // Pointer drag — the deck follows the pointer directly, then settles.
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartPositionRef.current = positionRef.current;
    onGrab();
    endIntro();
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const travelled = e.clientY - dragStartYRef.current;
    positionRef.current =
      dragStartPositionRef.current + travelled / DRAG_TRAVEL_PER_CARD;
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    onSettle();
  };

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="col-span-1 compact:col-start-4 compact:col-span-6 compact:row-start-1 h-full relative perspective-stage flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing overflow-visible touch-none select-none"
    >
      {/* Scaled card dimension stage — h-full + items-center puts the centre card
          on the exact vertical middle of the viewport. */}
      <div className="relative w-[var(--card-width)] aspect-[4/3] flex items-center justify-center">
        <div className="relative w-full h-full">
          {slots.map((key) => {
            const project = projectFor(key);
            if (!project) return null;
            const isCenter = key === centreKey;

            return (
              <div
                key={key}
                ref={(el) => {
                  if (el) {
                    cardsRef.current.set(key, el);
                    placeCard(el, key);
                  } else {
                    cardsRef.current.delete(key);
                  }
                }}
                onClick={() => {
                  if (isDraggingRef.current) return;
                  if (key === Math.round(positionRef.current)) {
                    onSelectProject(project);
                    return;
                  }
                  const index = ((key % totalCount) + totalCount) % totalCount;
                  onGoToIndex(
                    index,
                    key > positionRef.current ? 'down' : 'up',
                  );
                }}
                className="absolute inset-0 w-full h-full rounded-sm overflow-hidden bg-surface will-change-transform select-none cursor-pointer group"
                data-key={key}
              >
                <div className="relative w-full h-full overflow-hidden">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    sizes="(max-width: 768px) 81vw, 416px"
                    priority={key === startPosition.current}
                    loading="eager"
                    className={`object-cover object-center pointer-events-none transition-transform duration-500 ease-out ${
                      isCenter ? 'group-hover:scale-105' : 'scale-100'
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
        className={`absolute bottom-6 flex items-center space-x-2 text-inkMuted text-micro-md font-mono tracking-widest uppercase pointer-events-none transition-opacity duration-700 ${
          hintVisible ? 'opacity-60' : 'opacity-0'
        }`}
      >
        <ChevronDown className="w-3 h-3 animate-bounce" />
        <span>Swipe / Scroll / Click</span>
      </div>
    </div>
  );
}
