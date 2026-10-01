'use client';

import { RefObject, useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import Lenis from 'lenis';

/**
 * useDeckScroll — Lenis drives the deck; a spring lands it.
 *
 * Lenis smooths the wheel and gives touch real inertia, but it scrolls an
 * element, and the deck isn't one. So the hook owns a hidden scroller: a fixed,
 * invisible box holding one very tall spacer, parked at SCROLL_ORIGIN. Lenis
 * scrolls that, and every frame the scroll offset is turned into card units
 * and written to `positionRef`, which CardDeck2 renders. Nothing on screen
 * ever actually scrolls.
 *
 * Landing on a card is a spring, not a tween. A tween starts from rest on its
 * own curve, so the deck slowed under Lenis, paused, then was pulled in again
 * — two motions where there should be one. The spring starts at whatever speed
 * the deck is already moving and bleeds it off into the card, so following
 * the wheel and settling onto a card read as one gesture. Everything that ends
 * on a card — a settle, a drag release, a key, a sidebar click — goes through
 * it, and a new target mid-flight just retargets it with its speed intact.
 *
 * While the spring (or a mouse drag) is moving the deck, the hook writes
 * `positionRef` itself and ignores Lenis; when it's done, Lenis is re-synced to
 * where the deck ended up. Lenis's own offset is rounded to device pixels by
 * the DOM, and at 260px a card that's a visible stutter on a slow landing.
 *
 * Why not Lenis's `infinite` mode: its `reset()` (run at the end of every
 * animation) re-reads the wrapped scrollTop, so the unwrapped value jumps by
 * a whole loop — the conveyor would see every card change key at once. A
 * finite range that's thousands of cards long never wraps, and is re-based on
 * ORIGIN whenever it drifts far and the deck is at rest.
 *
 * Why not `lenis/snap`: it snaps to a finite list of points. The deck has
 * none — any integer is a card.
 */

// Scroll px for one card, after wheelMultiplier. A mouse notch (~100 × 0.72)
// is well past the commit threshold, so a notch reads as exactly one card.
const WHEEL_TRAVEL_PER_CARD = 260;
// One event can't throw the deck further than this, so a violent flick stays
// legible instead of teleporting.
const WHEEL_MAX_EVENT_DELTA = 200;
// Finger / pointer px for one card. Touch deltas are scaled to wheel units by
// Lenis's touchMultiplier so both land on the same scale.
export const DRAG_TRAVEL_PER_CARD = 300;

// Lenis feel. lerp is the smoothing — lower is floatier; don't go under 0.06
// or it reads as lag rather than weight. wheelMultiplier is distance per notch.
const WHEEL_LERP = 0.085;
const WHEEL_MULTIPLIER = 0.72;
// How far a touch flick glides. Lenis raises the release velocity to this
// power. (syncTouch has to stay on: the scroller is click-through, so there is
// no native touch scroll for Lenis to fall back to.)
const TOUCH_INERTIA_EXPONENT = 1.7;
const TOUCH_INERTIA_LERP = 0.075;

// A mouse drag released while moving is aimed this far ahead, in ms of travel.
const DRAG_THROW_MS = 180;
// A single gesture never carries more than this many cards.
const MAX_THROW_CARDS = 3;

// Quiet for this long means the gesture is over — settle. A trackpad's
// momentum keeps sending events, so the deck follows it all the way out.
const SETTLE_MS = 55;
// Past this fraction of a card, a gesture commits to the next one rather than
// springing back.
const COMMIT_THRESHOLD = 0.12;
// A trackpad's momentum dribbles out in tiny wheel events long after the hand
// has left. Once the spring is landing, events under this (scroll px) heading
// the same way are that tail, not a new push — they're swallowed rather than
// handing the deck back to Lenis, which would stall it just short of the card.
const MOMENTUM_TAIL_DELTA = 12;

// The landing spring. Stiffness is its natural frequency (rad/s): ~6.6/ω is
// how long it takes to settle, so 11 lands in about 0.6s whatever the distance.
// Damping 1 is critical — the fastest landing with no overshoot; under 1 adds
// a bounce, over 1 makes it creep in.
const SPRING_STIFFNESS = 11;
const SPRING_DAMPING = 1;
// Close enough to call it landed, in cards and cards/s.
const SPRING_REST_DISTANCE = 0.0005;
const SPRING_REST_SPEED = 0.01;
// Integration step. A dropped frame is split up rather than taken in one leap.
const SPRING_STEP = 1 / 120;
const MAX_FRAME_DT = 1 / 20;
// Smoothing on the measured deck speed the spring inherits (0 = raw).
const VELOCITY_SMOOTHING = 0.4;

// The hidden scroller's range. ~3800 cards either way at 260px.
const SCROLL_ORIGIN = 1_000_000;
const SCROLL_SPAN = SCROLL_ORIGIN * 2;
// Re-base on ORIGIN at rest once the scroll has drifted this far.
const REBASE_DISTANCE = SCROLL_ORIGIN / 2;
// A settled deck within this of a card is on it — scrollTop rounds to device
// pixels, and a card 0.004 off centre is a visible 2px shift.
const REST_EPSILON = 0.02;

// position = base + (ORIGIN - scroll) / TRAVEL. Scrolling down (scroll
// increasing) walks back through the deck, so the cards travel up with it.
const cardToScroll = (card: number, base: number) =>
  SCROLL_ORIGIN - (card - base) * WHEEL_TRAVEL_PER_CARD;
const scrollToCard = (scroll: number, base: number) =>
  base + (SCROLL_ORIGIN - scroll) / WHEEL_TRAVEL_PER_CARD;

interface UseDeckScrollOptions {
  /** The deck's position in card units. Written every frame the deck moves. */
  positionRef: RefObject<number>;
  /** False while a modal or menu owns the page — input passes through. */
  enabled: boolean;
}

export function useDeckScroll({ positionRef, enabled }: UseDeckScrollOptions) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // The card that sits at SCROLL_ORIGIN. Moves only when the range re-bases.
  const baseRef = useRef(positionRef.current);
  const enabledRef = useRef(enabled);
  // Direction of the most recent input, in card units (+1 / -1).
  const lastDirectionRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // True while the spring or a mouse drag owns positionRef; Lenis is ignored.
  const manualRef = useRef(false);
  const springRef = useRef({ active: false, target: 0, velocity: 0 });
  // Measured deck speed in cards/s, whoever is moving it — what the spring
  // inherits when it takes over.
  const velocityRef = useRef(0);
  const dragOriginRef = useRef(0);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }, []);

  /** Take positionRef off Lenis: stop its glide and stop listening to it. */
  const takeOver = useCallback(() => {
    const lenis = lenisRef.current;
    manualRef.current = true;
    // A scrollTo to the current value is a no-op in Lenis, so it can't stop a
    // glide; stop() can, and start() re-arms input. Their emits are ignored.
    lenis?.stop();
    lenis?.start();
  }, []);

  /** Give positionRef back to Lenis, synced to wherever the deck now is. */
  const handBack = useCallback(() => {
    const lenis = lenisRef.current;
    springRef.current.active = false;
    if (lenis) {
      const position = positionRef.current;
      // Far from home: move the origin under the deck. Nothing on screen moves.
      if (
        Math.abs(cardToScroll(position, baseRef.current) - SCROLL_ORIGIN) >
        REBASE_DISTANCE
      ) {
        baseRef.current = Math.round(position);
      }
      // Still manual, so this emit (rounded to device pixels) is ignored.
      lenis.scrollTo(cardToScroll(position, baseRef.current), {
        immediate: true,
        force: true,
      });
    }
    manualRef.current = false;
  }, [positionRef]);

  /**
   * Land on an exact card. Picks up the deck's current speed, or keeps the
   * spring's own if it's already flying — so a retarget never lurches.
   */
  const goTo = useCallback(
    (card: number, velocity?: number) => {
      clearSettle();
      const spring = springRef.current;
      if (!spring.active) {
        takeOver();
        spring.active = true;
        spring.velocity = velocity ?? velocityRef.current;
      } else if (velocity !== undefined) {
        spring.velocity = velocity;
      }
      spring.target = card;
    },
    [clearSettle, takeOver],
  );

  /** Commit to a card in the direction of travel, from where the deck is heading. */
  const settleFrom = useCallback(
    (heading: number, direction: number, velocity?: number) => {
      let card: number;
      if (direction > 0) card = Math.floor(heading - COMMIT_THRESHOLD) + 1;
      else if (direction < 0) card = Math.ceil(heading + COMMIT_THRESHOLD) - 1;
      else card = Math.round(heading);

      const origin = Math.round(positionRef.current);
      card = Math.max(
        origin - MAX_THROW_CARDS,
        Math.min(origin + MAX_THROW_CARDS, card),
      );
      goTo(card, velocity);
    },
    [goTo, positionRef],
  );

  // Where Lenis was heading is the natural rest point: it already includes the
  // wheel still to be eased out and a touch flick's inertia.
  const settle = useCallback(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    settleFrom(
      scrollToCard(lenis.targetScroll, baseRef.current),
      lastDirectionRef.current,
    );
  }, [settleFrom]);

  useEffect(() => {
    const wrapper = scrollerRef.current;
    const spacer = spacerRef.current;
    if (!wrapper || !spacer) return;

    spacer.style.height = `${SCROLL_SPAN}px`;
    wrapper.scrollTop = SCROLL_ORIGIN;

    const lenis = new Lenis({
      wrapper,
      content: spacer,
      // The scroller is invisible and click-through; input is read off the
      // whole window, as the old wheel handler did.
      eventsTarget: window,
      smoothWheel: true,
      syncTouch: true,
      syncTouchLerp: TOUCH_INERTIA_LERP,
      touchInertiaExponent: TOUCH_INERTIA_EXPONENT,
      touchMultiplier: WHEEL_TRAVEL_PER_CARD / DRAG_TRAVEL_PER_CARD,
      wheelMultiplier: WHEEL_MULTIPLIER,
      lerp: WHEEL_LERP,
      overscroll: false,
      virtualScroll: (data) => {
        if (!enabledRef.current) return false;
        // Leave horizontal gestures to the browser: a two-finger sideways
        // swipe is back/forward, and preventing it silently kills it.
        if (Math.abs(data.deltaX) > Math.abs(data.deltaY)) return false;
        // Lenis reads the deltas after this returns, so clamping here sticks.
        data.deltaY = Math.max(
          -WHEEL_MAX_EVENT_DELTA,
          Math.min(WHEEL_MAX_EVENT_DELTA, data.deltaY),
        );
        return true;
      },
    });
    lenisRef.current = lenis;

    lenis.on('scroll', (instance: Lenis) => {
      if (manualRef.current) return;
      let position = scrollToCard(instance.animatedScroll, baseRef.current);
      if (!instance.isScrolling) {
        const nearest = Math.round(position);
        if (Math.abs(position - nearest) < REST_EPSILON) position = nearest;
      }
      positionRef.current = position;
    });

    // Fires before Lenis applies the delta, so handing back here means the
    // new input carries on from exactly where the spring had got to.
    lenis.on('virtual-scroll', ({ deltaY, event }) => {
      const touchDown = event.type === 'touchstart';
      if (deltaY === 0 && !touchDown) return;
      const spring = springRef.current;
      if (spring.active && event.type === 'wheel') {
        const landing = Math.sign(spring.target - positionRef.current);
        if (
          Math.abs(deltaY) < MOMENTUM_TAIL_DELTA &&
          -Math.sign(deltaY) === (landing || lastDirectionRef.current)
        ) {
          return;
        }
      }
      // Fresh input catches the deck — a finger on the glass included.
      if (manualRef.current) handBack();
      if (deltaY !== 0) lastDirectionRef.current = -Math.sign(deltaY);
      clearSettle();
      // A finger still on the glass isn't finished; touchend settles.
      if (touchDown || event.type === 'touchmove') return;
      settleTimerRef.current = setTimeout(settle, SETTLE_MS);
    });

    let lastPosition = positionRef.current;
    const tick = (time: number, deltaMs: number) => {
      // Lenis steps first, on gsap's clock and ahead of the deck's own tick,
      // so the position the deck draws is never a frame old.
      lenis.raf(time * 1000);

      const dt = Math.min(deltaMs / 1000, MAX_FRAME_DT);
      const spring = springRef.current;
      if (spring.active && dt > 0) {
        const omega = SPRING_STIFFNESS;
        const steps = Math.ceil(dt / SPRING_STEP);
        const h = dt / steps;
        let x = positionRef.current;
        let v = spring.velocity;
        for (let i = 0; i < steps; i++) {
          const accel =
            -omega * omega * (x - spring.target) -
            2 * SPRING_DAMPING * omega * v;
          v += accel * h;
          x += v * h;
        }
        spring.velocity = v;
        if (
          Math.abs(x - spring.target) < SPRING_REST_DISTANCE &&
          Math.abs(v) < SPRING_REST_SPEED
        ) {
          positionRef.current = spring.target;
          spring.velocity = 0;
          handBack();
        } else {
          positionRef.current = x;
        }
      }

      if (dt > 0) {
        const instant = (positionRef.current - lastPosition) / dt;
        velocityRef.current =
          velocityRef.current * VELOCITY_SMOOTHING +
          instant * (1 - VELOCITY_SMOOTHING);
      }
      lastPosition = positionRef.current;
    };
    gsap.ticker.add(tick, false, true);

    return () => {
      clearSettle();
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [positionRef, settle, clearSettle, handBack]);

  // -- pointer drag (mouse and pen; touch goes through Lenis) ---------------
  // Written straight to positionRef, not through Lenis: a drag is direct
  // manipulation and shouldn't be smoothed or rounded to scroll pixels.

  const dragStart = useCallback(() => {
    clearSettle();
    springRef.current.active = false;
    takeOver();
    dragOriginRef.current = positionRef.current;
  }, [clearSettle, takeOver, positionRef]);

  /** `travelled` is pointer px since dragStart; down pulls the deck down. */
  const drag = useCallback(
    (travelled: number) => {
      positionRef.current =
        dragOriginRef.current + travelled / DRAG_TRAVEL_PER_CARD;
    },
    [positionRef],
  );

  /** `velocity` is pointer px per ms at release. */
  const dragEnd = useCallback(
    (velocity: number) => {
      const cardsPerSecond = (velocity * 1000) / DRAG_TRAVEL_PER_CARD;
      settleFrom(
        positionRef.current + (cardsPerSecond * DRAG_THROW_MS) / 1000,
        Math.sign(cardsPerSecond),
        cardsPerSecond,
      );
    },
    [settleFrom, positionRef],
  );

  /** Step from wherever the deck is going, not wherever it is. */
  const step = useCallback(
    (by: number) => {
      const spring = springRef.current;
      const from = spring.active
        ? spring.target
        : Math.round(positionRef.current);
      goTo(from + by);
    },
    [goTo, positionRef],
  );

  return { scrollerRef, spacerRef, goTo, step, dragStart, drag, dragEnd };
}
