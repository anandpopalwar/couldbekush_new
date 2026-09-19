'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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

// Wheel feel. The deck steps like a ratchet rather than flowing: a step needs a
// deliberate amount of wheel travel, and the leftover delta is dropped after each
// one, so a single flick advances one card instead of coasting through several.
const WHEEL_STEP_THRESHOLD = 60;
// Minimum spacing between steps. Deliberately shorter than the card tween, so a
// sustained scroll starts the next card before the last one has settled and the
// deck streams instead of landing on every card in turn. A single flick is still
// one crisp step — this only bites while the wheel is actually turning.
const STEP_COOLDOWN_MS = 110;
// Ceiling on unspent wheel travel, so one violent flick can't queue a long run
// of steps that keeps firing after the gesture is over.
const WHEEL_MAX_PENDING = WHEEL_STEP_THRESHOLD * 4;

export function PortfolioClient({ projects }: { projects: Project[] }) {
  const totalCount = projects.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('work');

  const isAnimatingRef = useRef(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { audioEnabled, toggleAudio, playDeckSound } = useAudioFeedback();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  }, []);

  const lastTriggerTimeRef = useRef<number>(0);

  const goToIndex = useCallback(
    (newIndex: number, direction?: 'up' | 'down', stepDelta?: number) => {
      const now = Date.now();
      if (now - lastTriggerTimeRef.current < STEP_COOLDOWN_MS) return;

      const wrappedIndex = ((newIndex % totalCount) + totalCount) % totalCount;
      const dir = direction || (newIndex > currentIndex ? 'down' : 'up');

      lastTriggerTimeRef.current = now;
      setCurrentIndex(wrappedIndex);

      playDeckSound(dir);
    },
    [currentIndex, playDeckSound, totalCount]
  );

  // Liquid human-action native wheel scroll handler
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (selectedProject || activeSection !== 'work') return;
      e.preventDefault();

      wheelDeltaRef.current = Math.max(
        -WHEEL_MAX_PENDING,
        Math.min(WHEEL_MAX_PENDING, wheelDeltaRef.current + e.deltaY),
      );

      // A pause discards the part-built step rather than carrying it over, so a
      // gesture never leaks into the next one.
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        wheelDeltaRef.current = 0;
      }, 100);

      if (Math.abs(wheelDeltaRef.current) >= WHEEL_STEP_THRESHOLD) {
        const now = Date.now();
        if (now - lastTriggerTimeRef.current >= STEP_COOLDOWN_MS) {
          const direction = Math.sign(wheelDeltaRef.current);
          if (direction > 0) {
            goToIndex(currentIndex - 1, 'up');
          } else {
            goToIndex(currentIndex + 1, 'down');
          }
          // Spend exactly one step's worth and keep the remainder. Scroll travel
          // then maps to cards proportionally, so a fast scroll keeps feeding the
          // next step instead of throwing the excess away and stalling. It still
          // can't coast: the idle timer clears whatever is left over.
          wheelDeltaRef.current -= direction * WHEEL_STEP_THRESHOLD;
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentIndex, goToIndex, selectedProject, activeSection]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedProject || activeSection !== 'work') return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToIndex(currentIndex - 1, 'up');
      } else if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowRight' ||
        e.key === ' '
      ) {
        e.preventDefault();
        goToIndex(currentIndex + 1, 'down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, goToIndex, selectedProject, activeSection]);

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
      <main
        className="w-full h-full grid grid-cols-1 md:grid-cols-12 relative z-20 overflow-hidden pointer-events-none"
        style={{
          backgroundColor: '#e6e6e4',
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.45) 0%, rgba(230,230,228,0.95) 75%), radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 16px 16px',
        }}
      >
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
          currentIndex={currentIndex}
          onGoToIndex={goToIndex}
          onSelectProject={(project) => {
            setSelectedProject(project);
            showToast(`Viewing: ${project.title}`);
          }}
        />

        <LeftSidebar
          activeProject={activeProject}
          currentIndex={currentIndex}
          totalCount={totalCount}
          activeSection={activeSection}
          onSelectSection={(section) => {
            setActiveSection(section);
          }}
        />
      </main>

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
