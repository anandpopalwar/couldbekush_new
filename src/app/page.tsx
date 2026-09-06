'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { PROJECTS } from '@/data/projects';
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

const totalCount = PROJECTS.length;
const CENTER_SET = 2;

export default function PortfolioPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [virtualIndex, setVirtualIndex] = useState(CENTER_SET * totalCount);
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
      // Allow fluid transitions with a smooth 150ms cooldown for high-precision trackpads
      if (now - lastTriggerTimeRef.current < 150) return;

      let step =
        typeof stepDelta === 'number'
          ? stepDelta
          : newIndex - currentIndex;
      while (step > totalCount / 2) step -= totalCount;
      while (step < -totalCount / 2) step += totalCount;

      setVirtualIndex((prev) => prev + step);

      const wrappedIndex = ((newIndex % totalCount) + totalCount) % totalCount;
      const dir = direction || (step > 0 ? 'down' : 'up');

      lastTriggerTimeRef.current = now;
      setCurrentIndex(wrappedIndex);

      playDeckSound(dir);
    },
    [currentIndex, playDeckSound]
  );

  // Liquid human-action native wheel scroll handler
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (selectedProject || activeSection !== 'work') return;
      e.preventDefault();

      wheelDeltaRef.current += e.deltaY;

      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        wheelDeltaRef.current *= 0.3; // Liquid velocity decay
      }, 100);

      const threshold = 18; // Micro-responsive threshold
      if (Math.abs(wheelDeltaRef.current) >= threshold) {
        const now = Date.now();
        if (now - lastTriggerTimeRef.current >= 150) {
          if (wheelDeltaRef.current > 0) {
            goToIndex(currentIndex - 1, 'up');
          } else {
            goToIndex(currentIndex + 1, 'down');
          }
          // Liquid decay: retain partial residual momentum for continuous fluid scrolling
          wheelDeltaRef.current *= 0.2;
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

  const activeProject = PROJECTS[currentIndex];

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

      {/* Main Viewport */}
      <main className="w-full h-full grid grid-cols-1 md:grid-cols-12 relative z-20 items-center overflow-hidden pointer-events-none">
        <LeftSidebar
          activeProject={activeProject}
          currentIndex={currentIndex}
          totalCount={totalCount}
          activeSection={activeSection}
          onSelectSection={(section) => {
            setActiveSection(section);
          }}
        />

        <CardDeck
          projects={PROJECTS}
          currentIndex={currentIndex}
          onGoToIndex={goToIndex}
          onSelectProject={(project) => {
            setSelectedProject(project);
            showToast(`Viewing: ${project.title}`);
          }}
        />

        <RightSidebar
          projects={PROJECTS}
          virtualIndex={virtualIndex}
          onGoToIndex={goToIndex}
          onUpdateVirtualIndex={setVirtualIndex}
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
