'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * The case study arriving, as the slide leaves over it.
 *
 * This wraps the work column rather than the page, on purpose: the case study's
 * scroller, its rail and the chrome are all `position: fixed`, and a transform
 * on an ancestor makes fixed children resolve against *that element* instead of
 * the viewport — they would jump the moment the animation started. This element
 * has no fixed descendants, so it is safe to move.
 *
 * `clearProps` at the end removes the transform entirely rather than leaving it
 * at zero, so nothing inside inherits a containing block it didn't ask for.
 */

const RISE = 28;
const DURATION = 0.6;
// Overshoots and settles — the bounce, rather than a glide.
const EASE = 'back.out(1.5)';
// Begins while the slide is still on its way down, so the page is arriving
// rather than waiting to be revealed.
const DELAY = 0.15;

export function PageEnter({
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

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tween = gsap.fromTo(
      el,
      { y: RISE, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: DURATION,
        ease: EASE,
        delay: DELAY,
        clearProps: 'transform,opacity',
      },
    );

    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
