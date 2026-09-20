'use client';

import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';

const BLUR_PX = 6;
const IN_DURATION = 0.15;
const OUT_DURATION = 0.45;
// Sharpen only once scrolling has stopped, so a fast run stays blurred
// throughout instead of flickering between every card.
const SETTLE_DELAY_MS = 170;

/**
 * Blurs while the deck moves between projects and sharpens once it settles —
 * the blink that ties the text to the card transition. Shared by the desktop
 * sidebar and the mobile stack so the two behave identically.
 *
 * Attach the returned callback as a `ref` to every element that should blink;
 * it collects them, so any number of elements can share one instance.
 *
 * At rest the filter is REMOVED, not left at `blur(0px)`. A filter creates a
 * stacking context, and the counter's `mix-blend-difference` has to blend
 * against main's background — leaving one behind renders the number solid
 * white. Do not "simplify" the onComplete away.
 */
export function useTransitionBlur(key: string) {
  const targets = useRef<Set<HTMLElement>>(new Set());
  const prevKey = useRef(key);
  const amount = useRef({ v: 0 });
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const register = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    targets.current.add(el);
    return () => {
      targets.current.delete(el);
    };
  }, []);

  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;

    const apply = () => {
      const filter = `blur(${amount.current.v}px)`;
      targets.current.forEach((el) => {
        el.style.filter = filter;
      });
    };

    // Ramp up quickly as the card starts moving.
    gsap.to(amount.current, {
      v: BLUR_PX,
      duration: IN_DURATION,
      ease: 'power1.out',
      overwrite: true,
      onUpdate: apply,
    });

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      gsap.to(amount.current, {
        v: 0,
        duration: OUT_DURATION,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: apply,
        onComplete: () => {
          targets.current.forEach((el) => {
            el.style.filter = '';
          });
        },
      });
    }, SETTLE_DELAY_MS);
  }, [key]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  return register;
}
