'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getPendingLabel, setPendingTransition } from '@/lib/routeTransition';

/**
 * The whole route transition, both halves, in one place.
 *
 * A template re-mounts on every navigation, which makes it the natural owner:
 * the outgoing half runs on the page you are leaving, the instance for the new
 * route is created already covering, and the incoming half finishes there. One
 * panel, one set of timings, whichever direction you are going.
 *
 *   1. the slide rises over the page you are leaving
 *   2. the destination's name fades in on it, then the route changes
 *   3. the new instance picks the slide up and carries it down
 *   4. the arriving page bounces in underneath — see PageEnter
 *
 * Both slides are CSS transitions on a class rather than gsap tweens: gsap
 * animates `yPercent` through its own transform cache while Tailwind's
 * `translate-y-full` writes `--tw-translate-y`, and the two disagree about
 * where the element starts, which makes the slide snap instead of travel.
 */

const RISE_MS = 900;
const NAME_IN_MS = 350;
const NAME_HOLD_MS = 500;
const HOLD_MS = 200;
const LEAVE_MS = 700;
// transitionend never arrives if the tab is backgrounded mid-slide, and losing
// the navigation would strand you on a covered screen.
const FALLBACK_MS = RISE_MS + NAME_IN_MS + NAME_HOLD_MS + 400;

type Phase =
  | 'idle'
  | 'rising' // covering the page being left
  | 'named' // name up, about to navigate
  | 'holding' // arrived, still covered
  | 'leaving'; // carrying the slide back down

// A template also mounts on first load, where there is no outgoing slide to
// continue and the deck has its own intro to play. Only navigations animate.
let hasMountedOnce = false;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface RouteSlideValue {
  /** Cover the screen, name the destination, then go there. */
  slideTo: (href: string, label: string) => void;
}

const RouteSlideContext = createContext<RouteSlideValue>({
  slideTo: () => {},
});

export const useRouteSlide = () => useContext(RouteSlideContext);

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pendingHrefRef = useRef<string | null>(null);

  // Decided during render, not in an effect. An effect runs after the first
  // paint, so an arriving route would flash uncovered — one frame of the page's
  // own pale background between the slide arriving and the slide leaving.
  //
  // Safe for SSR: `window` is undefined on the server and `hasMountedOnce` is
  // false on a first load, so both render 'idle' and hydration agrees.
  const [label, setLabel] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getPendingLabel(pathname),
  );
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === 'undefined') return 'idle';
    if (!hasMountedOnce || prefersReducedMotion()) return 'idle';
    // No label means nothing announced this arrival, so there is no slide in
    // flight to continue and covering now would be a flash from nowhere.
    // `null` is that case — an empty string is an announced arrival that simply
    // has no name to paint, like the trip back to the deck, so this tests for
    // null rather than truthiness.
    return getPendingLabel(pathname) !== null ? 'holding' : 'idle';
  });

  // A template's key is its own segment level, so this one is keyed on
  // `/project` for every case study: going from one to the next changes a
  // *deeper* segment and does not remount it. The lazy initialiser above never
  // runs again, so the arriving half of the transition has to be picked up here
  // instead — otherwise the slide rises, the route changes underneath it, and
  // the panel stays over the new page forever.
  const seenPathRef = useRef(pathname);
  useEffect(() => {
    if (seenPathRef.current === pathname) return;
    seenPathRef.current = pathname;
    // Only continue a slide that is already up. An arrival nobody announced —
    // the browser's back button, say — should not be covered retroactively.
    if (phase !== 'idle' && getPendingLabel(pathname) !== null) {
      setPhase('holding');
    }
  }, [pathname, phase]);

  useEffect(() => {
    hasMountedOnce = true;
    if (phase !== 'holding') return;

    // A separate commit, so the class transitions rather than the element
    // simply rendering in its final position.
    const leave = window.setTimeout(() => setPhase('leaving'), HOLD_MS);
    return () => window.clearTimeout(leave);
  }, [phase]);

  const go = useCallback(() => {
    const href = pendingHrefRef.current;
    if (!href) return;
    pendingHrefRef.current = null;
    router.push(href);
  }, [router]);

  const slideTo = useCallback(
    (href: string, nextLabel: string) => {
      if (pendingHrefRef.current || prefersReducedMotion()) {
        router.push(href);
        return;
      }

      pendingHrefRef.current = href;
      // The slide takes well over a second to cover and name the page; fetch
      // the destination during it so the route change itself has nothing to
      // wait for.
      router.prefetch(href);
      // Left where the arriving instance can pick it up.
      setPendingTransition(href, nextLabel);
      setLabel(nextLabel);
      setPhase('rising');

      window.setTimeout(go, FALLBACK_MS);
    },
    [go, router],
  );

  const covered =
    phase === 'rising' || phase === 'named' || phase === 'holding';
  const naming = phase === 'named' || phase === 'holding';

  return (
    <RouteSlideContext.Provider value={{ slideTo }}>
      {/* h-full is load-bearing: this wrapper sits between body and the page,
          and the deck's layout is a chain of h-full down from body. Without it
          the chain resolves against a zero-height div and the page collapses.

          Deliberately untransformed — the case study's scroller, rail and
          chrome are all `position: fixed`, and a transform here would make them
          resolve against this div instead of the viewport. The arriving page's
          entrance belongs to the page, on an element with no fixed children. */}
      <div className="route-content h-full">{children}</div>

      <div
        aria-hidden
        onTransitionEnd={(e) => {
          // The name's own fade bubbles up here too; only the slide itself
          // should advance the sequence.
          if (e.target !== e.currentTarget || e.propertyName !== 'transform') {
            return;
          }
          if (phase === 'rising') {
            setPhase('named');
            window.setTimeout(go, NAME_IN_MS + NAME_HOLD_MS);
          } else if (phase === 'leaving') {
            setPhase('idle');
          }
        }}
        className={`route-transition fixed inset-0 z-[100] bg-surface pointer-events-none flex items-center justify-center transition-transform ease-in-out ${
          phase === 'leaving' ? 'duration-[700ms]' : 'duration-[900ms]'
        } ${covered ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Set as the project names are — .title-wide, same size token — so
            the name the slide carries is the same lettering that is waiting
            underneath it. No mix-blend here: the panel is already bg-surface,
            and difference against black returns the colour unchanged. */}
        <span
          className={`title-wide text-[length:var(--transition-title-size)] leading-[0.95] whitespace-nowrap uppercase tracking-tight text-invert transition-opacity duration-[350ms] ease-out ${
            naming ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {label}
        </span>
      </div>
    </RouteSlideContext.Provider>
  );
}
