'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { X } from 'lucide-react';

/**
 * Contact: two cards tossed onto the deck — "Come say hi" and the credits
 * (the credits from sm up only).
 * Either can be picked up and dragged anywhere — it stays where it is let go.
 * Close, Escape or a click on the bare page sweeps them off again.
 *
 * Each card is centred on the viewport by CSS and placed by gsap's x / y, so
 * the drag only ever writes x, y and rotation.
 */

type Entry = { label: string; links: { text: string; href?: string }[] };

const SAY_HI: Entry[] = [
  { label: 'Drop me a line', links: [{ text: 'couldbekush@gmail.com', href: 'mailto:couldbekush@gmail.com' }] },
  { label: 'Where I post', links: [{ text: 'LinkedIn', href: 'https://www.linkedin.com/in/couldbekush/' }, { text: 'Twitter', href: 'https://x.com/couldbekush' }] },
  { label: 'Based', links: [{ text: 'Working globally' }] },
];

const CREDITS: Entry[] = [
  { label: 'Design & development', links: [{ text: 'couldbekush' }] },
  { label: 'Type', links: [{ text: 'Google Sans Flex' }, { text: 'Google Sans Code' }] },
  { label: 'Built with', links: [{ text: 'Next.js, Payload' }, { text: 'Three.js, GSAP' }] },
];

// Where each card lands, off the viewport's centre, in px at 1100px wide and
// scaled down below that. `r` is its resting tilt in degrees.
const REST = [
  { x: 70, y: -60, r: -2 },
  { x: -120, y: 150, r: 3 },
];

const DRAG_TILT = 0.02; // degrees of lean per px/s of sideways speed
const DRAG_TILT_MAX = 10;

const CARD =
  'contact-card card-edge absolute left-1/2 top-1/2 touch-none select-none cursor-grab active:cursor-grabbing p-6 md:p-8';

function Field({ entry, tone }: { entry: Entry; tone: 'dark' | 'light' }) {
  return (
    <div>
      <p className={`text-paragraph-xs ${tone === 'dark' ? 'text-invert/50' : 'text-ink/50'}`}>{entry.label}</p>
      {entry.links.map((link) =>
        link.href ? (
          <a
            key={link.text}
            href={link.href}
            target={link.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noreferrer"
            className="block text-label-sm hover:underline"
          >
            {link.text}
          </a>
        ) : (
          <p key={link.text} className="text-label-sm">
            {link.text}
          </p>
        ),
      )}
    </div>
  );
}

export function ContactCards({ onClose }: { onClose: () => void }) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const zRef = useRef(2);
  const leavingRef = useRef(false);

  // Toss in from below the screen, the second a beat behind the first.
  useLayoutEffect(() => {
    const k = Math.min(1, window.innerWidth / 1100);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    cards.forEach((card, i) => {
      const rest = { x: REST[i].x * k, y: REST[i].y * k, rotation: REST[i].r, xPercent: -50, yPercent: -50 };
      if (reduce) return void gsap.set(card, rest);
      gsap.fromTo(
        card,
        { ...rest, x: rest.x + (i ? -80 : 80), y: window.innerHeight, rotation: i ? -18 : 14 },
        { ...rest, duration: 0.9, delay: i * 0.12, ease: 'expo.out' },
      );
    });
    return () => void gsap.killTweensOf(cards);
  }, []);

  const close = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    gsap.killTweensOf(cards);
    gsap.to(cards, {
      y: window.innerHeight,
      rotation: (i) => (i ? -16 : 12),
      duration: 0.5,
      stagger: 0.06,
      ease: 'power3.in',
      onComplete: onClose,
    });
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // ── Drag: one pointer per card, dropped where it is let go ───────────────
  const drag = useRef<{ id: number; dx: number; dy: number; x: number; t: number; vx: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Links and Close keep their clicks: capturing the pointer would hand the
    // click to the card instead.
    if (leavingRef.current || drag.current) return;
    if ((e.target as HTMLElement).closest('a, button')) return;
    const card = e.currentTarget;
    gsap.killTweensOf(card);
    card.style.zIndex = String(++zRef.current);
    const x = Number(gsap.getProperty(card, 'x'));
    const y = Number(gsap.getProperty(card, 'y'));
    drag.current = { id: e.pointerId, dx: e.clientX - x, dy: e.clientY - y, x, t: performance.now(), vx: 0 };
    card.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const x = e.clientX - d.dx;
    const y = e.clientY - d.dy;
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    // Smoothed sideways speed in px/s, for the lean.
    d.vx = d.vx * 0.6 + ((x - d.x) / dt) * 1000 * 0.4;
    d.x = x;
    d.t = now;
    const lean = gsap.utils.clamp(-DRAG_TILT_MAX, DRAG_TILT_MAX, REST[i].r + d.vx * DRAG_TILT);
    gsap.set(e.currentTarget, { x, y });
    gsap.to(e.currentTarget, { rotation: lean, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  };

  const onPointerUp = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    gsap.to(e.currentTarget, { rotation: REST[i].r, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  };

  const cardProps = (i: number) => ({
    ref: (el: HTMLDivElement | null) => {
      cardRefs.current[i] = el;
    },
    onPointerDown,
    onPointerMove: onPointerMove(i),
    onPointerUp: onPointerUp(i),
    onPointerCancel: onPointerUp(i),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  });

  return (
    <div className="contact-cards fixed inset-0 z-50 overflow-hidden" onClick={close}>
      <div
        {...cardProps(0)}
        role="dialog"
        aria-label="Contact"
        style={{ zIndex: 2 }}
        className={`${CARD} bg-surface text-invert w-[min(calc(theme(spacing.96)*1.15),80vw)]`}
      >
        <h2 className="font-display text-title-h4 uppercase mb-6">Come say hi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {SAY_HI.map((entry) => (
            <Field key={entry.label} entry={entry} tone="dark" />
          ))}
        </div>
        <button
          type="button"
          onClick={close}
          className="mt-6 ml-auto flex items-center gap-1.5 text-label-sm hover:underline"
        >
          Close <X className="w-4 h-4" />
        </button>
      </div>

      <div
        {...cardProps(1)}
        aria-label="Credits"
        style={{ zIndex: 1 }}
        // Phones get the one card only.
        className={`${CARD} hidden sm:block bg-canvasDark text-ink w-[min(theme(spacing.96),80vw)]`}
      >
        <h2 className="font-display text-title-h4 uppercase mb-6">Credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {CREDITS.map((entry) => (
            <Field key={entry.label} entry={entry} tone="light" />
          ))}
        </div>
      </div>
    </div>
  );
}
