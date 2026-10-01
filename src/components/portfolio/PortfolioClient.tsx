'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Project, NavSection } from '@/types/portfolio';
import { useAudioFeedback } from '@/hooks/useAudioFeedback';
import { useDeckScroll } from '@/hooks/useDeckScroll';
import { GrainOverlay } from '@/components/ui/GrainOverlay';
import { Toast } from '@/components/ui/Toast';
import { TopHeader } from '@/components/portfolio/TopHeader';
import { LeftSidebar } from '@/components/portfolio/LeftSidebar';
import { CardDeck } from '@/components/portfolio/CardDeck';
import { RightSidebar } from '@/components/portfolio/RightSidebar';
import { useRouter } from 'next/navigation';
import { useRouteSlide } from '@/app/(frontend)/template';
import { SectionModal } from '@/components/portfolio/SectionModal';
import { CardDeck2 } from './CardDeck2';
import { MobileChrome } from '@/components/portfolio/MobileChrome';

// Wheel, touch, drag and their snapping all live in useDeckScroll, which runs
// the deck on Lenis. What's left here is the keyboard and the sidebar.

// Leaving for a case study: the deck is covered before the route changes, so it
// doesn't simply vanish. The template plays the arrival at the far end, and both
// panels are --color-surface, so the handoff between them is invisible.
// The slide's own duration lives in its Tailwind class (duration-[900ms]) so
// one declaration owns the transition. This is only the backstop: transitionend
// Rate limit for keys, so a held arrow doesn't retarget every frame.
const STEP_COOLDOWN_MS = 110;

export function PortfolioClient({ projects }: { projects: Project[] }) {
  const totalCount = projects.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('work');
  // Mobile menu. Held here so the deck's input handlers can ignore wheel and
  // key events while the full-screen panel is open.
  const [menuOpen, setMenuOpen] = useState(false);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // The deck's position in card units — the single source of truth for where it
  // is. Integers centre a card; anything between means the deck is mid-scroll.
  const positionRef = useRef(0);
  const deckScroll = useDeckScroll({
    positionRef,
    enabled: activeSection === 'work' && !menuOpen,
  });
  const { goTo, step } = deckScroll;

  const router = useRouter();
  const { slideTo } = useRouteSlide();
  const { audioEnabled, toggleAudio, playDeckSound } = useAudioFeedback();

  // The slide, its timings and its panel all live in the template, which owns
  // both halves of the transition — see useRouteSlide.
  const openProject = useCallback(
    (project: Project) => {
      slideTo(`/project/${project.slug}`, project.title);
    },
    [slideTo],
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  }, []);

  const lastTriggerTimeRef = useRef<number>(0);

  // Jump to a specific project by the shortest way round the deck.
  const goToIndex = useCallback(
    (newIndex: number) => {
      const from = Math.round(positionRef.current);
      const wrapped = ((from % totalCount) + totalCount) % totalCount;
      let delta = newIndex - wrapped;
      while (delta > totalCount / 2) delta -= totalCount;
      while (delta < -totalCount / 2) delta += totalCount;
      goTo(from + delta);
    },
    [goTo, totalCount]
  );

  // The deck tells us when a different card became the centred one.
  const handleCentreChange = useCallback(
    (index: number, direction: 'up' | 'down') => {
      setCurrentIndex(index);
      playDeckSound(direction);
    },
    [playDeckSound]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeSection !== 'work' || menuOpen) return;

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

      step(isUp ? 1 : -1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, activeSection, menuOpen]);

  const activeProject = projects[currentIndex];

  return (
    <div className="app-shell w-full h-full relative overflow-hidden select-none">
      <GrainOverlay />

      {/* What Lenis actually scrolls — invisible and click-through. The deck
          reads its offset as a position; see useDeckScroll. */}
      <div
        ref={deckScroll.scrollerRef}
        aria-hidden
        className="deck-scroller fixed inset-0 overflow-hidden invisible pointer-events-none"
      >
        <div ref={deckScroll.spacerRef} />
      </div>

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
      <main className="app-viewport page-canvas w-full h-full grid grid-cols-1 compact:grid-cols-12 relative z-20 overflow-hidden pointer-events-none">
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
          onSelectProject={(project) =>
            openProject(project)
          }
        /> */}
        <CardDeck2
          projects={projects}
          positionRef={positionRef}
          onCentreChange={handleCentreChange}
          onGoToIndex={goToIndex}
          onDragStart={deckScroll.dragStart}
          onDrag={deckScroll.drag}
          onDragEnd={deckScroll.dragEnd}
          onSelectProject={(project) =>
            openProject(project)
          }
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
