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
import type { MagazinePaper } from '@/lib/magazinePaper';

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
 *
 * Two layers, one job each. The DOM is the carousel: every card is an element
 * placed, scaled, blurred, faded and dealt here, inside a frame that carries
 * the cursor tilt. What a card *shows* is a sheet of paper drawn by
 * lib/magazinePaper.ts into a canvas inside it — the artwork on a deformable
 * mesh, flexing with the deck's speed and lit by a studio HDRI. Until the
 * paper is up, or where WebGL isn't available, the card shows its DOM face
 * instead: the same artwork, flat.
 */

// Selected card, blown up relative to the deck's base card size.
const CENTER_SCALE = 1.3;

// Slots either side of centre that can be on screen. ±1 is half off screen.
const HALF_WINDOW = 2;
// One extra ring stays mounted so a card leaving is never torn off mid-travel.
const MOUNT_RADIUS = HALF_WINDOW + 1;

// Slot ±1 is parked with its centre on the viewport edge — half the card shows,
// half is cut off. SLOT_NUDGE pushes it further out (negative = more card on
// screen), as a fraction of the card's height so the gap between the centre
// card and its neighbours keeps its proportion on every screen — 60px on the
// 366px desktop card, ~15px on a phone's.
const SLOT_NUDGE = 0.165;
// Distance added per slot beyond the first. Roughly one card height, so slot ±2
// clears the screen edge completely and mount/unmount can never be seen.
const OFFSCREEN_STEP = 280;

// Depth ramps, index = distance from centre in cards. Read continuously, so a
// card halfway between two slots gets values halfway between two entries.
// The neighbours are kept well down from the centre card, so it reads as the
// one in hand and they as the deck behind it.
const SCALE_RAMP = [CENTER_SCALE, 0.72, 0.64, 0.6];
const OPACITY_RAMP = [1, 0.96, 0.9, 0.9];
// Depth of field — only the selected card is in focus.
const BLUR_RAMP = [0, 3, 6, 6];

// Paper flex. While the deck moves, each sheet curls like paper pushed through
// air: the leading edge runs slightly ahead and the trailing edge lags back,
// away from the viewer. Scroll down and the cards travel up, so their bottom
// edges curl; scroll up and the tops do. The shape is the vertex shader's
// (lib/magazinePaperShader.ts); this file decides how much, from the speed.
// Degrees of curl at the trailing edge per card/s of deck speed, and the most
// it will ever curl. A mouse notch peaks around 1.5 cards/s.
const BEND_PER_SPEED = 10;
const BEND_MAX = 30;
// Touch drives the deck harder and closer to the eye, so it bends less.
const BEND_TOUCH_SCALE = 0.55;
// px the leading edge runs ahead of its slot at full curl.
const BEND_LEAD = 6;
// The curl chases the speed through a spring, underdamped on purpose: when the
// deck lands the sheet overshoots flat and flicks back once, like paper does.
const BEND_STIFFNESS = 170;
// ζ ≈ 0.6 — one small flick past flat, never a wobble.
const BEND_DAMPING = 16;
// Time constant of the speed estimate, in seconds — irons out frame jitter.
const BEND_SPEED_SMOOTHING = 0.05;
// Only cards this close to centre flex — the rest are off screen.
const BEND_RADIUS = 1.75;

// Cards drawn as paper: everything that can be on screen. Beyond this a card
// hands its canvas back (and shows nothing, being off screen).
const PAPER_RADIUS = 1.9;
// Away from the centre the cards are blurred anyway; they're drawn at half
// resolution past this.
const PAPER_SHARP_RADIUS = 0.5;
// The centre card's hover zoom — the artwork grows inside the sheet.
const HOVER_ZOOM = 1.1;
// Seconds for the zoom to cover most of the way (the old 700ms ease-out).
const HOVER_ZOOM_TIME = 0.25;

// Interrupting the intro (an early scroll or grab) doesn't cut to the live
// poses — the cards blend from wherever the deal left them, over this long.
const HANDOVER_MS = 320;
// A drag that paused this long before release is dropped, not thrown.
const RELEASE_STALE_MS = 80;

// Cursor tilt. The whole stack leans toward the pointer anywhere over the
// deck's section, not only over the centre card — degrees at the section's
// edge. Kept small: a magazine turned in the hand, not a trading card. It
// sets the viewing angle the coat's reflections answer, never the light.
const TILT_MAX_Y = 4;
const TILT_MAX_X = 3.5;
// The frame's own perspective, closer than the stage's 2500px. At 2500px a
// turn reads as a slight squash; this is what makes the tilt read as depth.
// Lower is more dramatic. It's also where the paper's eye is.
const TILT_PERSPECTIVE = 1100;
// How the tilt catches up with the pointer, and how it settles back flat when
// the pointer leaves.
const TILT_DURATION = 0.9;
const TILT_EASE = 'power3.out';

// Movement under this counts as a tap rather than a drag.
const TAP_SLOP_PX = 6;

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
function slotPose(offset: number, viewportHeight: number, nudge: number): SlotPose {
  const depth = Math.abs(offset);
  const edge = viewportHeight / 2 + nudge;
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

/** The parts of a card's pose the intro animates and the handover blends. */
interface LoosePose {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  blur: number;
}

/** Read a card's pose back out of gsap, mid-tween or not. */
function readPose(el: HTMLElement): LoosePose {
  const get = (property: string) => Number(gsap.getProperty(el, property)) || 0;
  const blur = /blur\(([\d.]+)px\)/.exec(el.style.filter);
  return {
    x: get('x'),
    y: get('y'),
    rotation: get('rotation'),
    scale: Number(gsap.getProperty(el, 'scale')) || 1,
    opacity: Number(gsap.getProperty(el, 'opacity')),
    blur: blur ? Number(blur[1]) : 0,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

interface CardDeck2Props {
  projects: Project[];
  /** Live deck position in card units. Input writes here; the deck renders it. */
  positionRef: MutableRefObject<number>;
  /** The centred card changed — wrapped project index, and which way it moved. */
  onCentreChange: (index: number, direction: 'up' | 'down') => void;
  onGoToIndex: (index: number, direction?: 'up' | 'down') => void;
  onSelectProject: (project: Project) => void;
  /** A mouse or pen drag began — catch the deck where it is. */
  onDragStart: () => void;
  /** Pointer px travelled since the drag began; down pulls the deck down. */
  onDrag: (travelled: number) => void;
  /** Released, moving at `velocity` px per ms. */
  onDragEnd: (velocity: number) => void;
}

export function CardDeck2({
  projects,
  positionRef,
  onCentreChange,
  onGoToIndex,
  onSelectProject,
  onDragStart,
  onDrag,
  onDragEnd,
}: CardDeck2Props) {
  const totalCount = projects.length;

  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
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
  // Set when the intro is cut short: where each card was, and when.
  const handoverRef = useRef<{
    start: number;
    from: Map<number, LoosePose>;
  } | null>(null);

  const [hintVisible, setHintVisible] = useState(false);
  const isDraggingRef = useRef(false);
  // Mouse and pen drive the deck from here; touch is Lenis's (see useDeckScroll)
  // and only a tap is resolved here.
  const dragDrivesRef = useRef(false);
  const dragStartYRef = useRef(0);
  const lastMoveRef = useRef({ y: 0, time: 0 });
  const velocityRef = useRef(0);
  // The card the pointer went down on, and whether it travelled since.
  const tapKeyRef = useRef<number | null>(null);
  const tapMovedRef = useRef(false);

  // Per-frame bookkeeping. `applied` is the last value written to each card, so
  // an unchanged property is never written twice; `dirty` forces a pass after a
  // mount or resize even though the position hasn't moved.
  const appliedRef = useRef<Map<number, SlotPose & { interactive: boolean }>>(
    new Map(),
  );
  const lastCentreRef = useRef<number | null>(null);
  const placedRef = useRef(new WeakSet<HTMLDivElement>());
  const dirtyRef = useRef(true);
  // Cached so the loop never reads window.innerHeight, which can force layout.
  const viewportHeightRef = useRef(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );

  // The paper flex, shared by every card: the curl in degrees, its rate, and
  // the speed estimate it chases. The frame loop steps it; the paper loop
  // draws it.
  const bendRef = useRef({
    value: 0,
    rate: 0,
    speed: 0,
    lastPosition: startPosition.current,
    lastTime: 0,
  });
  // Unscaled card size in px — the paper is modelled at it.
  const cardHeightRef = useRef(0);
  const cardWidthRef = useRef(0);
  // Whether the deck was last driven by a finger, which bends it more gently.
  const touchInputRef = useRef(false);

  // The shared paper renderer, once it has loaded; null means the DOM faces.
  const paperRef = useRef<MagazinePaper | null>(null);
  const [paperReady, setPaperReady] = useState(false);
  // Set when a card has to be redrawn though nothing moved — artwork arriving.
  const paperDirtyRef = useRef(true);

  const projectFor = useCallback(
    (key: number) => projects[((key % totalCount) + totalCount) % totalCount],
    [projects, totalCount],
  );

  const viewportHeight = () => viewportHeightRef.current;
  // SLOT_NUDGE in px, for the card's current height (set by measure()).
  const nudgeRef = useRef(0);

  // Cards mounting or unmounting change what has to be written next frame.
  useEffect(() => {
    dirtyRef.current = true;
    paperDirtyRef.current = true;
    appliedRef.current.forEach((_, key) => {
      if (!slots.includes(key)) appliedRef.current.delete(key);
    });
  }, [slots]);

  useEffect(() => {
    const measure = () => {
      viewportHeightRef.current = window.innerHeight;
      // offsetHeight ignores the frame's tilt transform — it's the layout size.
      cardHeightRef.current = frameRef.current?.offsetHeight ?? 0;
      cardWidthRef.current = frameRef.current?.offsetWidth ?? 0;
      nudgeRef.current = SLOT_NUDGE * cardHeightRef.current;
      dirtyRef.current = true;
      paperDirtyRef.current = true;
    };
    measure();
    window.addEventListener('resize', measure);
    // The card is sized in vw and by breakpoint, but a layout change that
    // isn't a window resize can move it too — the paper has to follow.
    const observer = new ResizeObserver(measure);
    if (frameRef.current) observer.observe(frameRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  const endIntro = useCallback(() => {
    if (!introActiveRef.current) return;
    // Cut short mid-deal: note where every card is so the frame loop can blend
    // out from there instead of snapping to the live poses.
    if (introTweensRef.current.some((tween) => tween.isActive() || tween.progress() < 1)) {
      const from = new Map<number, LoosePose>();
      cardsRef.current.forEach((el, key) => from.set(key, readPose(el)));
      handoverRef.current = { start: performance.now(), from };
    }
    introTweensRef.current.forEach((tween) => tween.kill());
    introTweensRef.current = [];
    introActiveRef.current = false;
    dirtyRef.current = true;
  }, []);

  // Cursor-driven tilt of the whole stack. Rotates deck-frame, never the cards:
  // the frame loop owns every card's transform and would overwrite it. The
  // cards all sit in the frame's plane, so leaning the frame leans them
  // together, in the stage's perspective. Mouse and pen only — a finger has no
  // hover, and a tilt that jumps on touchdown just reads as a glitch.
  useEffect(() => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!stage || !frame || prefersReducedMotion()) return;

    gsap.set(frame, { transformPerspective: TILT_PERSPECTIVE });
    const toY = gsap.quickTo(frame, 'rotationY', {
      duration: TILT_DURATION,
      ease: TILT_EASE,
    });
    const toX = gsap.quickTo(frame, 'rotationX', {
      duration: TILT_DURATION,
      ease: TILT_EASE,
    });
    // Measured on entry rather than every move — reading layout per event is
    // what makes pointer effects stutter.
    let rect = stage.getBoundingClientRect();

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      rect = stage.getBoundingClientRect();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      // -1 … 1 across the section, 0 at its centre.
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      toY(clamp(nx) * TILT_MAX_Y);
      // Pointer above centre tips the top edge away, like pressing on it.
      toX(-clamp(ny) * TILT_MAX_X);
    };
    // Back to flat through the same quickTo tweens — overwriting them with a
    // separate tween would leave quickTo driving a dead tween on re-entry.
    const onLeave = () => {
      toY(0);
      toX(0);
    };

    stage.addEventListener('pointerenter', onEnter);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      stage.removeEventListener('pointerenter', onEnter);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      gsap.killTweensOf(frame);
    };
  }, []);

  // Which kind of input is driving the deck, for the bend's strength. Passive
  // listeners on window: they only observe, never touch the gesture.
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      touchInputRef.current = e.pointerType === 'touch';
    };
    const onWheel = () => {
      touchInputRef.current = false;
    };
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('wheel', onWheel);
    };
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
      gsap.set(
        el,
        poseToTween(slotPose(key - positionRef.current, viewportHeight(), nudgeRef.current)),
      );
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
    const reducedMotion = prefersReducedMotion();
    const tick = () => {
      const centre = positionRef.current;

      if (introActiveRef.current) {
        // An early scroll cancels the intro and hands the deck over.
        if (centre !== startPosition.current) endIntro();
        else return;
      }

      // Paper flex: measure how fast the deck is moving and let the curl
      // chase it through a spring. Runs every frame, so the curl can settle —
      // and flick past flat — after the position has stopped.
      const bend = bendRef.current;
      const now = performance.now();
      const elapsed = bend.lastTime ? (now - bend.lastTime) / 1000 : 0;
      bend.lastTime = now;
      if (elapsed > 0 && !reducedMotion) {
        const instant = (centre - bend.lastPosition) / elapsed;
        bend.speed += (instant - bend.speed) * (1 - Math.exp(-elapsed / BEND_SPEED_SMOOTHING));
        const limit = touchInputRef.current ? BEND_MAX * BEND_TOUCH_SCALE : BEND_MAX;
        const gain = touchInputRef.current
          ? BEND_PER_SPEED * BEND_TOUCH_SCALE
          : BEND_PER_SPEED;
        const target = Math.max(-limit, Math.min(limit, bend.speed * gain));
        // Capped step: after a stalled frame the spring would otherwise explode.
        const dt = Math.min(elapsed, 1 / 30);
        bend.rate += (BEND_STIFFNESS * (target - bend.value) - BEND_DAMPING * bend.rate) * dt;
        bend.value += bend.rate * dt;
        if (
          Math.abs(target) < 0.05 &&
          Math.abs(bend.value) < 0.05 &&
          Math.abs(bend.rate) < 0.5
        ) {
          bend.value = 0;
          bend.rate = 0;
          bend.speed = 0;
        }
      }
      bend.lastPosition = centre;

      // While blending out of an interrupted intro, every frame is a write.
      const handover = handoverRef.current;
      let blend = 1;
      if (handover) {
        const t = (performance.now() - handover.start) / HANDOVER_MS;
        if (t >= 1) {
          handoverRef.current = null;
          dirtyRef.current = true;
        } else {
          blend = easeOutCubic(t);
        }
      }
      const blending = blend < 1;

      if (!blending && !dirtyRef.current && centre === lastCentreRef.current) {
        return;
      }
      dirtyRef.current = false;
      lastCentreRef.current = centre;

      const vh = viewportHeightRef.current;
      cardsRef.current.forEach((el, key) => {
        const offset = key - centre;
        const pose = slotPose(offset, vh, nudgeRef.current);
        const prev = appliedRef.current.get(key);
        const from = blending ? handover?.from.get(key) : undefined;

        if (from) {
          // Blend from where the deal left this card. Written unconditionally
          // and marked stale, so the first frame after the blend rewrites it.
          const blur = mix(from.blur, pose.blur, blend);
          el.style.transform = `translate3d(${mix(from.x, 0, blend)}px, ${mix(from.y, pose.y, blend)}px, 0px) rotate(${mix(from.rotation, 0, blend)}deg) scale(${mix(from.scale, pose.scale, blend)})`;
          el.style.opacity = String(mix(from.opacity, pose.opacity, blend));
          el.style.filter = `blur(${Math.round(blur * 10) / 10}px)`;
          el.style.zIndex = String(pose.zIndex);
          appliedRef.current.delete(key);
          return;
        }

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
          // `none`, not blur(0px): any filter at all flattens the card into
          // an offscreen pass, which the focused card doesn't need.
          el.style.filter = pose.blur ? `blur(${pose.blur}px)` : 'none';
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

  // Bring the paper up, client-side. If it can't start — no WebGL 2, three or
  // the studio maps failed to load — nothing changes: the cards keep their DOM
  // faces. A lost context drops back to them the same way.
  useEffect(() => {
    let cancelled = false;
    let paper: MagazinePaper | null = null;
    import('@/lib/magazinePaper')
      .then(({ MagazinePaper }) =>
        MagazinePaper.create(
          () => {
            paperRef.current = null;
            setPaperReady(false);
          },
          () => {
            paperDirtyRef.current = true;
          },
        ),
      )
      .then((created) => {
        paper = created;
        if (cancelled) {
          created?.dispose();
          return;
        }
        if (!created) return;
        paperRef.current = created;
        setPaperReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      paperRef.current = null;
      paper?.dispose();
    };
  }, []);

  // The paper loop: draw every card that can be on screen as a sheet. Runs
  // after the frame loop on the ticker, so it draws this frame's positions and
  // this frame's curl.
  //
  // Draws only when something the sheet depends on changed — its place in the
  // deck, the tilt, the curl, the hover zoom — so a resting deck costs one
  // comparison per card. A card's DOM face is hidden (data-paper) only once
  // its sheet has actually been drawn, so there's never a blank frame.
  useEffect(() => {
    const frame = frameRef.current;
    if (!paperReady || !frame) return;

    const drawn = new Map<number, string>();
    const zooms = new Map<number, number>();
    const canvases = new WeakMap<HTMLDivElement, HTMLCanvasElement | null>();
    let sceneKey = '';
    let lastTime = performance.now();
    const dealtAt = performance.now() + INTRO_TOTAL_MS;
    const tokens = getComputedStyle(document.documentElement);
    const token = (name: string) => tokens.getPropertyValue(name);

    const canvasFor = (el: HTMLDivElement) => {
      if (!canvases.has(el)) canvases.set(el, el.querySelector<HTMLCanvasElement>('[data-paper-canvas]'));
      return canvases.get(el) ?? null;
    };

    // The canvas reaches past the card by the renderer's margins on every side.
    const fit = (canvas: HTMLCanvasElement, paper: MagazinePaper) => {
      const { side, top, bottom } = paper.margins;
      canvas.style.left = `${-side}px`;
      canvas.style.top = `${-top}px`;
      canvas.style.width = `calc(100% + ${2 * side}px)`;
      canvas.style.height = `calc(100% + ${top + bottom}px)`;
      canvas.dataset.fit = '';
    };

    const drop = (el: HTMLDivElement, canvas: HTMLCanvasElement, paper: MagazinePaper) => {
      paper.release(canvas);
      delete el.dataset.paper;
    };

    const tick = () => {
      const paper = paperRef.current;
      if (!paper?.usable) return;
      const width = cardWidthRef.current;
      const height = cardHeightRef.current;
      if (!width || !height) return;

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const nextScene = `${width}|${height}|${window.devicePixelRatio}`;
      if (nextScene !== sceneKey) {
        sceneKey = nextScene;
        paper.setScene({
          cardWidth: width,
          cardHeight: height,
          maxScale: CENTER_SCALE,
          eyeDistance: TILT_PERSPECTIVE,
          stock: token('--color-stock'),
          shadow: token('--color-shadow'),
          shadowStrength: Number(token('--card-shadow-strength')) || 1,
        });
        drawn.clear();
      }

      const centre = positionRef.current;
      const tiltX = round2(Number(gsap.getProperty(frame, 'rotationX')) || 0);
      const tiltY = round2(Number(gsap.getProperty(frame, 'rotationY')) || 0);
      const curl = round2(bendRef.current.value);
      const dirty = paperDirtyRef.current;
      paperDirtyRef.current = false;
      // During the deal and its handover the DOM poses aren't slot poses —
      // the sheets are drawn flat, square to the eye, and re-drawn after.
      const settling =
        (introActiveRef.current && now < dealtAt) || handoverRef.current !== null;

      cardsRef.current.forEach((el, key) => {
        const canvas = canvasFor(el);
        if (!canvas) return;
        const offset = key - centre;
        if (Math.abs(offset) > PAPER_RADIUS) {
          if (drawn.get(key) !== 'off') {
            drawn.set(key, 'off');
            drop(el, canvas, paper);
          }
          return;
        }
        const project = projectFor(key);
        if (!project || !paper.hasArtwork(project.image)) return;
        if (!('fit' in canvas.dataset)) fit(canvas, paper);

        // The centre card's artwork zooms while it's hovered.
        const hovered = key === centreRef.current && el.matches(':hover');
        const zoomFrom = zooms.get(key) ?? 1;
        const zoomTo = hovered ? HOVER_ZOOM : 1;
        let zoom = zoomFrom + (zoomTo - zoomFrom) * (1 - Math.exp(-dt / (HOVER_ZOOM_TIME / 3)));
        if (Math.abs(zoom - zoomTo) < 0.0005) zoom = zoomTo;
        zooms.set(key, zoom);

        const pose = slotPose(settling ? 0 : offset, viewportHeightRef.current, nudgeRef.current);
        const cardCurl = Math.abs(offset) < BEND_RADIUS && !settling ? curl : 0;
        const state = settling
          ? 'settling'
          : `${round2(offset * 100)}|${tiltX}|${tiltY}|${cardCurl}|${round2(zoom * 1000)}`;
        // A curled sheet ripples, so it's redrawn every frame it's curled.
        if (!dirty && cardCurl === 0 && drawn.get(key) === state) return;
        drawn.set(key, state);

        const ok = paper.draw(canvas, {
          src: project.image,
          scale: pose.scale,
          offsetY: pose.y,
          tiltX: settling ? 0 : tiltX,
          tiltY: settling ? 0 : tiltY,
          bend: cardCurl,
          lead: BEND_LEAD * Math.min(Math.abs(cardCurl) / BEND_MAX, 1),
          time: now / 1000,
          zoom,
          seed: ((key % 97) + 97) % 97,
          lowRes: !settling && Math.abs(offset) > PAPER_SHARP_RADIUS,
        });
        if (ok && !('paper' in el.dataset)) el.dataset.paper = '';
      });

      drawn.forEach((_, key) => {
        if (!cardsRef.current.has(key)) {
          drawn.delete(key);
          zooms.delete(key);
        }
      });
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      // Back to the DOM faces — the renderer these canvases came from is gone.
      cardsRef.current.forEach((el) => delete el.dataset.paper);
    };
  }, [paperReady, positionRef, projectFor]);

  // Deal-out intro, first layout only.
  useLayoutEffect(() => {
    if (!introPendingRef.current) return;
    introPendingRef.current = false;

    const vh = viewportHeight();
    // Runs before the measuring effect, so it reads the card's height itself.
    nudgeRef.current = SLOT_NUDGE * (frameRef.current?.offsetHeight ?? 0);
    const centre = startPosition.current;
    const reducedMotion = prefersReducedMotion();
    const pile = slotPose(0, vh, nudgeRef.current);

    if (reducedMotion) {
      introActiveRef.current = false;
      return;
    }

    slots.forEach((key) => {
      const el = cardsRef.current.get(key);
      if (!el) return;

      const offset = key - centre;
      const depth = Math.abs(offset);
      const pose = slotPose(offset, vh, nudgeRef.current);

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
    const handover = setTimeout(() => {
      endIntro();
      paperDirtyRef.current = true;
    }, INTRO_TOTAL_MS);
    return () => clearTimeout(handover);
  }, [slots, endIntro]);

  // Pointer drag — the deck follows the pointer directly, then settles.
  //
  // A tap is resolved here rather than with onClick on the card. The stage
  // captures the pointer so a drag keeps tracking outside the card, and pointer
  // capture retargets the resulting click to the stage — so a card's onClick
  // never fires. Instead the card under the pointer is noted on the way down
  // and acted on when the pointer comes up without having travelled.
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragDrivesRef.current = e.pointerType !== 'touch';
    dragStartYRef.current = e.clientY;
    lastMoveRef.current = { y: e.clientY, time: e.timeStamp };
    velocityRef.current = 0;

    const card = (e.target as HTMLElement).closest('[data-key]');
    const key = card?.getAttribute('data-key');
    tapKeyRef.current = key === null || key === undefined ? null : Number(key);
    tapMovedRef.current = false;

    endIntro();
    if (dragDrivesRef.current) onDragStart();
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const travelled = e.clientY - dragStartYRef.current;
    if (Math.abs(travelled) > TAP_SLOP_PX) tapMovedRef.current = true;
    if (!dragDrivesRef.current) return;

    // Release velocity, lightly smoothed so one jittery sample can't fling it.
    const last = lastMoveRef.current;
    const dt = e.timeStamp - last.time;
    if (dt > 0) {
      const instant = (e.clientY - last.y) / dt;
      velocityRef.current = velocityRef.current * 0.2 + instant * 0.8;
      lastMoveRef.current = { y: e.clientY, time: e.timeStamp };
    }
    onDrag(travelled);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const tappedKey = tapKeyRef.current;
    tapKeyRef.current = null;

    // A tap on the centre card opens it; a tap on a neighbour brings it in.
    if (!tapMovedRef.current && tappedKey !== null) {
      if (tappedKey === Math.round(positionRef.current)) {
        const project = projectFor(tappedKey);
        if (project) {
          onSelectProject(project);
          return;
        }
      } else {
        const index = ((tappedKey % totalCount) + totalCount) % totalCount;
        onGoToIndex(index, tappedKey > positionRef.current ? 'down' : 'up');
        return;
      }
    }

    if (!dragDrivesRef.current) return;
    const stale = e.timeStamp - lastMoveRef.current.time > RELEASE_STALE_MS;
    onDragEnd(stale ? 0 : velocityRef.current);
  };

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="deck-stage col-span-1 compact:col-start-4 compact:col-span-6 compact:row-start-1 h-full relative perspective-stage flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing overflow-visible touch-none select-none"
    >
      {/* Scaled card dimension stage — h-full + items-center puts the centre card
          on the exact vertical middle of the viewport. */}
      <div
        ref={frameRef}
        className="deck-frame relative left-[var(--card-shift)] w-[var(--card-width)] h-[var(--card-height)] flex items-center justify-center will-change-transform"
      >
        <div className="relative w-full h-full">
          {slots.map((key) => {
            const project = projectFor(key);
            if (!project) return null;
            const isCenter = key === centreKey;

            return (
              <div
                key={key}
                ref={(el) => {
                  // An inline ref is detached and re-attached on every render,
                  // so only a card seen for the first time is placed — placing
                  // again would stamp the live pose over a handover blend.
                  if (el) {
                    cardsRef.current.set(key, el);
                    if (!placedRef.current.has(el)) {
                      placedRef.current.add(el);
                      placeCard(el, key);
                    }
                  } else {
                    cardsRef.current.delete(key);
                  }
                }}
                className="deck-card card-edge absolute inset-0 w-full h-full will-change-transform select-none cursor-pointer group"
                data-key={key}
              >
                {/* The DOM face: the card until its sheet has been drawn, and
                    for good where WebGL isn't available. */}
                <div
                  data-face
                  className="absolute inset-0 rounded-sm overflow-hidden bg-surface"
                >
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    sizes="(max-width: 768px) 81vw, 640px"
                    priority={key === startPosition.current}
                    loading="eager"
                    // Hover zoom on the centre card's image. The card clips
                    // it, so it zooms inside the frame rather than growing it.
                    className={`object-cover object-center pointer-events-none transition-transform duration-700 ease-out ${
                      isCenter ? 'group-hover:scale-110' : 'scale-100'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
                  <div className="card-paper" />
                </div>

                {/* The sheet and its shadow, drawn by the paper loop. It
                    reaches past the card by the renderer's margins (set
                    inline), so a curl and the shadow have room; everything
                    else in it is transparent. */}
                <canvas
                  data-paper-canvas
                  aria-hidden
                  // No backing store until it's drawn — the default is 300×150.
                  width={0}
                  height={0}
                  className="absolute pointer-events-none"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating drag hint overlay */}
      <div
        className={`deck-hint absolute bottom-6 translate-x-[var(--card-shift)] flex items-center space-x-2 text-inkMuted text-micro-md font-mono tracking-widest uppercase pointer-events-none transition-opacity duration-700 ${
          hintVisible ? 'opacity-60' : 'opacity-0'
        }`}
      >
        <ChevronDown className="w-3 h-3 animate-bounce" />
        <span>Swipe / Scroll / Click</span>
      </div>
    </div>
  );
}
