'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { NavSection } from '@/types/portfolio';

/**
 * Full-screen menu for the stacked layout below 1100px.
 *
 * It arrives blurred and resolves: the panel fades up from blur(14px) to sharp,
 * which is the same visual language as the deck's transition blink. Closing
 * plays it in reverse, so the panel is unmounted only after the outro finishes.
 *
 *   ┌────────────────────┐
 *   │ ✕     couldbekush  │
 *   │                    │
 *   │ Independent designer
 *   │ Working globally   │
 *   │                    │
 *   │ →WORK              │
 *   │ ABOUT              │
 *   │ PLAYGROUND         │
 *   │ CONTACT            │
 *   │                    │
 *   │ For inquiries      │
 *   │ hello@…   '25 ▶    │
 *   └────────────────────┘
 */

const NAV_ITEMS: { id: NavSection; label: string }[] = [
  { id: 'work', label: 'WORK' },
  { id: 'about', label: 'ABOUT' },
  { id: 'playground', label: 'PLAYGROUND' },
  { id: 'contact', label: 'CONTACT' },
];

const BLUR_PX = 14;
const IN_DURATION = 0.55;
const OUT_DURATION = 0.3;

// The tagline and each nav item rise into place as the panel resolves.
// back.out overshoots slightly and settles — the bounce.
const BOUNCE_FROM_Y = 18;
const BOUNCE_DURATION = 0.5;
const BOUNCE_EASE = 'back.out(1.7)';
const BOUNCE_STAGGER = 0.06;
const BOUNCE_DELAY = 0.08;

interface MobileMenuProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  /** Ask to be dismissed — starts the outro. */
  onRequestClose: () => void;
  /** Flipped true by the parent to run the outro (the toggle lives outside). */
  closing: boolean;
  /** The outro has finished; safe to unmount. */
  onClosed: () => void;
}

export function MobileMenu({
  activeSection,
  onSelectSection,
  onRequestClose,
  closing,
  onClosed,
}: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const closingRef = useRef(false);

  // Resolve out of blur on mount, with the tagline and nav items rising in.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const risers = [
      taglineRef.current,
      ...(navRef.current ? Array.from(navRef.current.children) : []),
    ].filter(Boolean) as Element[];

    gsap.fromTo(
      risers,
      { y: BOUNCE_FROM_Y, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: BOUNCE_DURATION,
        ease: BOUNCE_EASE,
        stagger: BOUNCE_STAGGER,
        delay: BOUNCE_DELAY,
      },
    );

    gsap.fromTo(
      el,
      { opacity: 0, filter: `blur(${BLUR_PX}px)` },
      {
        opacity: 1,
        filter: 'blur(0px)',
        duration: IN_DURATION,
        ease: 'power2.out',
        // Drop the filter entirely at rest rather than leaving blur(0px): a
        // filter creates a stacking context and forces its own layer.
        onComplete: () => {
          el.style.filter = '';
        },
      },
    );
  }, []);

  // Blur back out, then tell the parent it is safe to unmount. Driven by the
  // `closing` prop rather than a local handler, because the control that
  // dismisses it — MenuToggle — lives outside this panel.
  useEffect(() => {
    if (!closing) return;

    const el = panelRef.current;
    if (!el || closingRef.current) {
      onClosed();
      return;
    }
    closingRef.current = true;

    gsap.to(el, {
      opacity: 0,
      filter: `blur(${BLUR_PX}px)`,
      duration: OUT_DURATION,
      ease: 'power2.in',
      onComplete: onClosed,
    });
  }, [closing, onClosed]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onRequestClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="compact:hidden page-canvas fixed inset-0 z-50 text-ink pointer-events-auto"
    >
      {/* Blocks are positioned against the viewport rather than stacked in
          flow, so the proportions hold at any phone height: tagline at 30%,
          nav at 57%, footer pinned to the bottom. */}

      {/* The close control is MenuToggle, rendered by MobileChrome above this
          panel — one element that morphs between the two states rather than a
          separate button appearing here. Only the brand belongs to the panel. */}
      <div className="absolute top-5 left-0 right-0 flex justify-center">
        <span className="text-title-h6 tracking-tight leading-none">couldbekush</span>
      </div>

      <p ref={taglineRef} className="absolute left-4 top-[30%] text-label-xs">
        Independent designer
        <br />
        Working globally
      </p>

      {/* `group` + group-hover blurs the whole list while the hovered item
          overrides itself back to sharp — same behaviour as the desktop nav. */}
      <nav
        ref={navRef}
        className="group absolute left-4 top-[57%] flex flex-col items-start uppercase text-title-h3 leading-none"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectSection(item.id);
                onRequestClose();
              }}
              // Only `filter` transitions: the bounce drives transform and
              // opacity from GSAP, and transition-all would fight it.
              className="inline-flex items-center transition-[filter] duration-200 group-hover:blur-[3px] hover:!blur-none"
            >
              {isActive && <span aria-hidden>→</span>}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="absolute left-4 right-6 bottom-5 flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-label-xs text-inkMuted">For inquiries</span>
          <a
            href="mailto:couldbekush@gmail.com"
            className="text-label-xs underline hover:opacity-70 transition-opacity"
          >
            couldbekush@gmail.com
          </a>
        </div>

        {/* <button className="flex items-center gap-x-1.5 hover:opacity-70 transition-opacity">
          <span className="text-label-xs underline">&apos;25 showreel</span>
          <span aria-hidden className="text-micro-xs">
            ▶
          </span>
        </button> */}
      </div>
    </div>
  );
}
