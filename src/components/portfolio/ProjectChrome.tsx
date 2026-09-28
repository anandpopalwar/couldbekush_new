'use client';

import { useCallback, useState } from 'react';
import { SlideLink } from '@/components/transition/SlideLink';
import { TopHeader } from '@/components/portfolio/TopHeader';
import { MenuToggle } from '@/components/portfolio/MenuToggle';
import { MobileMenu } from '@/components/portfolio/MobileMenu';
import { useRouteSlide } from '@/app/(frontend)/template';
import { useAudioFeedback } from '@/hooks/useAudioFeedback';

/**
 * The site's furniture, kept on a case study so the page reads as part of the
 * site rather than a document it links out to: the menu, the header, the scroll
 * hint. Same positions as on the deck, at both layouts.
 *
 * The nav sections open panels that belong to the deck, so from here every item
 * — in the desktop rail and in the stacked layout's full-screen panel alike —
 * returns home rather than trying to reproduce them. `useAudioFeedback` is
 * instantiated fresh — the deck is unmounted on this route, so there is no
 * second instance to conflict with.
 */

const NAV_ITEMS = ['Work', 'About', 'Playground', 'Contact'];

export function ProjectChrome() {
  const { audioEnabled, toggleAudio } = useAudioFeedback();
  const { slideTo } = useRouteSlide();

  // Menu state lives here rather than in a parent: on the deck it is owned by
  // PortfolioClient so the wheel and keyboard handlers can ignore input while
  // the panel is open, but a case study has no such handlers to gate.
  const [menuOpen, setMenuOpen] = useState(false);
  // The panel outlives the dismiss request: `closing` runs its blur-out, and
  // only when that finishes is it unmounted — same dance as MobileChrome.
  const [closing, setClosing] = useState(false);

  const finishClose = useCallback(() => {
    setClosing(false);
    setMenuOpen(false);
  }, []);

  // Every section lives on the deck, so picking one from here goes home
  // through the slide. Unmounted outright rather than played out: the panel
  // would be animating over a page that is already leaving.
  const goHome = useCallback(() => {
    setClosing(false);
    setMenuOpen(false);
    slideTo('/', '');
  }, [slideTo]);

  return (
    <>
      <TopHeader
        audioEnabled={audioEnabled}
        onToggleAudio={toggleAudio}
        onSelectSection={() => {}}
      />

      <div className="chrome-nav hidden compact:block fixed top-6 left-6 z-30 pointer-events-auto">
        <span className="block text-micro-md font-mono tracking-widest text-inkMuted uppercase mb-4">
          Menu
        </span>

        <nav className="group flex flex-col items-start uppercase text-title-h5">
          {NAV_ITEMS.map((item, i) => (
            <SlideLink
              key={item}
              href="/"
              label=""
              className="inline-flex items-center transition-all duration-200 group-hover:blur-[3px] hover:!blur-none"
            >
              {/* Work is where this page came from, so it carries the marker. */}
              {i === 0 && <span className="mr-1.5">→</span>}
              <span>{item}</span>
            </SlideLink>
          ))}
        </nav>
      </div>

      <span className="scroll-hint hidden compact:block fixed bottom-6 left-5 z-30 text-micro-md tracking-wide text-inkMuted pointer-events-none">
        Scroll
      </span>

      {/* Below 1100 the rail is gone, so the stacked layout's chrome stands in
          for it — the same toggle and brand as the deck, in the same places, so
          crossing between the two routes doesn't move the furniture. */}
      <MenuToggle
        open={menuOpen && !closing}
        onToggle={menuOpen ? () => setClosing(true) : () => setMenuOpen(true)}
      />

      <div className="mobile-brand compact:hidden fixed top-5 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <span className="text-title-h6 text-ink tracking-tight leading-none">
          couldbekush
        </span>
      </div>

      {menuOpen && (
        <MobileMenu
          activeSection="work"
          onSelectSection={goHome}
          onRequestClose={() => setClosing(true)}
          closing={closing}
          onClosed={finishClose}
        />
      )}
    </>
  );
}
