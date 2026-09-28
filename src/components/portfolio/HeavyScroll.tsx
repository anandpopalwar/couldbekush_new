'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * A scroll container with weight, to match the deck.
 *
 * The wheel no longer moves the page directly. It moves a *target*, and the
 * real scroll position is eased toward that every frame — so the page takes a
 * moment to get going and a moment to stop, the way the deck resists being
 * dragged off a card.
 *
 * Anything that isn't the wheel — a touch drag, a keyboard scroll, an anchor
 * jump from the thumbnail rail — is left to the browser and simply resynced, so
 * none of this has to be reimplemented and nothing fights it.
 */

// Scroll travel per unit of wheel. Below 1 is resistance.
const RESISTANCE = 0.55;
// How much of the remaining distance is covered each frame. Lower is heavier.
const EASE = 0.075;
// Close enough to stop the loop rather than chase the last fraction of a pixel.
const SETTLE_PX = 0.4;
// How far you scroll before anything marked `fade-on-scroll` is fully gone.
const FADE_DISTANCE = 160;
// The other end: how much of the last screen has to be showing before anything
// marked `fade-at-end` is fully gone, as a fraction of the viewport. At 0.6 the
// rail and the thumbnails have cleared out by the time the next project's name
// is two-thirds of the way up.
const OUTRO_FRACTION = 0.6;
// Past this the faded elements also leave the pointer path, so an invisible
// rail can't swallow a click meant for the full-screen link underneath.
const OUTRO_INERT_AT = 0.9;

export function HeavyScroll({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // scrollHeight is a layout read, and the ticker below writes scrollTop
    // every frame — reading it in the same frame would force a synchronous
    // layout each time. It only changes when the page is resized or an image
    // settles, so it's cached and refreshed by an observer instead.
    let travel = 0;
    let viewport = 0;
    const measure = () => {
      viewport = el.clientHeight;
      travel = Math.max(0, el.scrollHeight - viewport);
    };
    measure();

    // Publish how far we are from the top as --scroll-fade, which anything
    // inside can pick up with `fade-on-scroll` — no element needs its own
    // listener, and it inherits, so this works at any depth. --outro-fade is
    // the mirror of it at the far end, for `fade-at-end`.
    const updateFade = () => {
      const progress = Math.min(1, Math.max(0, el.scrollTop / FADE_DISTANCE));
      el.style.setProperty('--scroll-fade', progress.toFixed(3));

      const span = Math.max(1, viewport * OUTRO_FRACTION);
      const remaining = travel - el.scrollTop;
      const outro = Math.min(1, Math.max(0, 1 - remaining / span));
      el.style.setProperty('--outro-fade', outro.toFixed(3));
      el.dataset.outro = outro > OUTRO_INERT_AT ? 'on' : 'off';
    };
    updateFade();

    // The scroller's own box only changes on resize; its *content* height is
    // what moves the far end, so every child is watched too.
    const observer = new ResizeObserver(() => {
      measure();
      updateFade();
    });
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);

    // Weighted scrolling is exactly the kind of thing this setting is for — but
    // the fade still has to work, so it is wired up before bailing out.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.addEventListener('scroll', updateFade, { passive: true });
      return () => {
        observer.disconnect();
        el.removeEventListener('scroll', updateFade);
      };
    }

    let target = el.scrollTop;
    let current = target;
    let running = false;

    // The cached measurement, so a wheel event never forces a layout.
    const limit = () => travel;

    const tick = () => {
      current += (target - current) * EASE;

      if (Math.abs(target - current) < SETTLE_PX) {
        current = target;
        stop();
      }

      el.scrollTop = current;
    };

    const start = () => {
      if (running) return;
      running = true;
      gsap.ticker.add(tick);
    };

    function stop() {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
    }

    const onWheel = (e: WheelEvent) => {
      // Horizontal gestures belong to the browser — a two-finger sideways
      // swipe is back/forward navigation, and preventing it here kills it.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      e.preventDefault();
      target = Math.min(limit(), Math.max(0, target + e.deltaY * RESISTANCE));
      start();
    };

    // Someone moved the scroller that isn't us — take their position as the
    // new truth instead of yanking it back.
    const onScroll = () => {
      updateFade();
      if (Math.abs(el.scrollTop - current) <= 2) return;
      stop();
      current = el.scrollTop;
      target = current;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      stop();
      observer.disconnect();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  );
}
