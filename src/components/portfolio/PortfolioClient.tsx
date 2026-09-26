'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import { Project, NavSection } from '@/types/portfolio';
import { useAudioFeedback } from '@/hooks/useAudioFeedback';
import { GrainOverlay } from '@/components/ui/GrainOverlay';
import { Toast } from '@/components/ui/Toast';
import { TopHeader } from '@/components/portfolio/TopHeader';
import { LeftSidebar } from '@/components/portfolio/LeftSidebar';
import { CardDeck } from '@/components/portfolio/CardDeck';
import { RightSidebar } from '@/components/portfolio/RightSidebar';
import { ProjectModal } from '@/components/portfolio/ProjectModal';
import { SectionModal } from '@/components/portfolio/SectionModal';
import { CardDeck2 } from './CardDeck2';
import { MobileChrome } from '@/components/portfolio/MobileChrome';

// How the wheel drives the deck.
//
//   'follow' — the deck tracks your scroll continuously and settles onto the
//     nearest card when you stop. It can rest between two cards, so there is no
//     threshold to cross, no lock, and nothing to mistake inertia for. This is
//     what makes a trackpad feel native rather than ratcheted.
//
//   'step' — the earlier model, kept for comparison: measure a gesture, jump a
//     whole number of cards, then ignore input for a moment to swallow inertia.
//     Fine on a mouse wheel, mechanical on a trackpad.
//
// Both handlers live below; this is the only line to change.
const SCROLL_MODEL: 'follow' | 'step' = 'follow';

// -- follow ----------------------------------------------------------------
// deltaY for one card. A mouse notch (~100) moves most of a card and then
// settles onto it, so a notch still reads as exactly one card.
const WHEEL_TRAVEL_PER_CARD = 140;
// A single event can't throw the deck further than this, so one violent flick
// stays legible instead of teleporting.
const WHEEL_MAX_EVENT_DELTA = 220;
// Quiet for this long means the gesture is over — settle.
const WHEEL_SETTLE_MS = 90;
const SNAP_DURATION = 0.42;
const SNAP_EASE = 'power3.out';

// -- step (kept for later) --------------------------------------------------
const WHEEL_STEP_THRESHOLD = 90;
const WHEEL_MAX_STEPS = 3;
const WHEEL_MAX_PENDING = WHEEL_STEP_THRESHOLD * WHEEL_MAX_STEPS;
const WHEEL_GESTURE_LOCK_MS = 260;

// Rate limit for keys, so a held arrow doesn't retarget every frame.
const STEP_COOLDOWN_MS = 110;

export function PortfolioClient({ projects }: { projects: Project[] }) {
  const totalCount = projects.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('work');
  // Mobile menu. Held here so the deck's input handlers can ignore wheel and
  // key events while the full-screen panel is open.
  const [menuOpen, setMenuOpen] = useState(false);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastWheelTimeRef = useRef(0);
  const settleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // The deck's position in card units — the single source of truth for where it
  // is. Integers centre a card; anything between means the deck is mid-scroll.
  const positionRef = useRef(0);

  const { audioEnabled, toggleAudio, playDeckSound } = useAudioFeedback();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  }, []);

  const lastTriggerTimeRef = useRef<number>(0);

  // Ease the deck to an exact card. gsap tweens the ref's own `current`, and
  // CardDeck2's frame loop renders whatever it finds there — so every input,
  // animated or direct, goes through this one number.
  const animateTo = useCallback((target: number) => {
    gsap.killTweensOf(positionRef);
    gsap.to(positionRef, {
      current: target,
      duration: SNAP_DURATION,
      ease: SNAP_EASE,
      overwrite: true,
    });
  }, []);

  const settle = useCallback(() => {
    animateTo(Math.round(positionRef.current));
  }, [animateTo]);

  const grab = useCallback(() => {
    gsap.killTweensOf(positionRef);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  // Jump to a specific project by the shortest way round the deck.
  const goToIndex = useCallback(
    (newIndex: number) => {
      const from = Math.round(positionRef.current);
      const wrapped = ((from % totalCount) + totalCount) % totalCount;
      let delta = newIndex - wrapped;
      while (delta > totalCount / 2) delta -= totalCount;
      while (delta < -totalCount / 2) delta += totalCount;
      animateTo(from + delta);
    },
    [animateTo, totalCount]
  );

  // The deck tells us when a different card became the centred one.
  const handleCentreChange = useCallback(
    (index: number, direction: 'up' | 'down') => {
      setCurrentIndex(index);
      playDeckSound(direction);
    },
    [playDeckSound]
  );

  // Liquid human-action native wheel scroll handler
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (selectedProject || activeSection !== 'work' || menuOpen) return;
      e.preventDefault();

      if (SCROLL_MODEL === 'follow') {
        // Move the deck by exactly what was scrolled. Scrolling down (deltaY > 0)
        // walks back through the deck, so the cards travel up with the gesture.
        const delta = Math.max(
          -WHEEL_MAX_EVENT_DELTA,
          Math.min(WHEEL_MAX_EVENT_DELTA, e.deltaY),
        );
        gsap.killTweensOf(positionRef);
        positionRef.current -= delta / WHEEL_TRAVEL_PER_CARD;

        // Settle onto the nearest card once the wheel goes quiet. Inertia keeps
        // the deck moving while it lasts, exactly as a native scroll would,
        // instead of needing to be told apart from a deliberate push.
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(settle, WHEEL_SETTLE_MS);
        return;
      }

      // -- step model, kept for comparison --
      wheelDeltaRef.current = Math.max(
        -WHEEL_MAX_PENDING,
        Math.min(WHEEL_MAX_PENDING, wheelDeltaRef.current + e.deltaY),
      );

      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        wheelDeltaRef.current = 0;
      }, 100);

      if (Math.abs(wheelDeltaRef.current) < WHEEL_STEP_THRESHOLD) return;

      const now = Date.now();
      if (now - lastWheelTimeRef.current < WHEEL_GESTURE_LOCK_MS) return;
      lastWheelTimeRef.current = now;

      const direction = Math.sign(wheelDeltaRef.current);
      const steps = Math.min(
        Math.round(Math.abs(wheelDeltaRef.current) / WHEEL_STEP_THRESHOLD),
        WHEEL_MAX_STEPS,
      );

      animateTo(Math.round(positionRef.current) - direction * steps);
      wheelDeltaRef.current = 0;
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [settle, animateTo, selectedProject, activeSection, menuOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedProject || activeSection !== 'work' || menuOpen) return;

      // Match the wheel and the drag: scrolling down (deltaY > 0) and dragging
      // up both go to currentIndex - 1, bringing the card below up into centre.
      // The keys were mapped the other way round, so arrows fought the deck.
      const isUp = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
      const isDown =
        e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ';
      if (!isUp && !isDown) return;

      e.preventDefault();
      const now = Date.now();
      if (now - lastTriggerTimeRef.current < STEP_COOLDOWN_MS) return;
      lastTriggerTimeRef.current = now;

      animateTo(Math.round(positionRef.current) + (isUp ? 1 : -1));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [animateTo, selectedProject, activeSection, menuOpen]);

  const activeProject = projects[currentIndex];

  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      <GrainOverlay />

      <TopHeader
        audioEnabled={audioEnabled}
        onToggleAudio={() => {
          toggleAudio();
          showToast(!audioEnabled ? 'UI Audio Enabled' : 'UI Audio Muted');
        }}
        onSelectSection={(section) => {
          setActiveSection(section);
        }}
      />

      {/* Main Viewport — carries the page background so the counter's mix-blend-difference
          has a real backdrop to invert against (main is a z-20 stacking context, so a
          transparent main would blend against nothing and render the number solid white). */}
      <main className="page-canvas w-full h-full grid grid-cols-1 compact:grid-cols-12 relative z-20 overflow-hidden pointer-events-none">
        {/* Paint order (all pinned to row 1 via explicit grid columns, so DOM order only
            controls stacking, not layout):
            1. RightSidebar  — bottom, so the top-stack cards paint over it
            2. CardDeck      — above the right sidebar
            3. LeftSidebar   — last, so the mix-blend counter stays on top of the cards */}
        <RightSidebar
          projects={projects}
          currentIndex={currentIndex}
          onGoToIndex={goToIndex}
        />

        {/* <CardDeck
          projects={projects}
          currentIndex={currentIndex}
          onGoToIndex={goToIndex}
          onSelectProject={(project) => {
            setSelectedProject(project);
            showToast(`Viewing: ${project.title}`);
          }}
        /> */}
        <CardDeck2
          projects={projects}
          positionRef={positionRef}
          onCentreChange={handleCentreChange}
          onGoToIndex={goToIndex}
          onSettle={settle}
          onGrab={grab}
          onSelectProject={(project) => {
            setSelectedProject(project);
            showToast(`Viewing: ${project.title}`);
          }}
        />

        <LeftSidebar
          activeProject={activeProject}
          activeSection={activeSection}
          onSelectSection={(section) => {
            setActiveSection(section);
          }}
        />
      </main>

      {/* Stacked layout below 1100px, where both sidebars are hidden. */}
      <MobileChrome
        activeProject={activeProject}
        totalCount={totalCount}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
      />

      {/* Interactive Project Detail Modal */}
      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      {/* Interactive Section Modals (About, Playground, Contact) */}
      <SectionModal
        section={activeSection}
        onClose={() => setActiveSection('work')}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}
