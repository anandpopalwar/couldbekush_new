'use client';

import { useCallback, useState } from 'react';
import { NavSection, Project } from '@/types/portfolio';
import { useTransitionBlur } from '@/hooks/useTransitionBlur';
import { MobileMenu } from '@/components/portfolio/MobileMenu';
import { MenuToggle } from '@/components/portfolio/MenuToggle';

/**
 * The stacked layout below 1100px (`compact`), where both sidebars are hidden
 * and the deck stands alone. Mirrors the reference site, which runs a single
 * stacked variant up to 1099 and has no tablet layout at all.
 *
 *   ┌────────────────────┐
 *   │ ☰    couldbekush   │  menu left, brand centred
 *   │ 01 /19             │  page number beneath the menu
 *   │                    │
 *   │      [ card ]      │  the deck, centred by CardDeck2 itself
 *   │                    │
 *   │   Agency & Studio  │  subtitle
 *   │    FROMANOTHER     │  title
 *   │         —          │
 *   │   A fresh website  │  description
 *   │       ▪ ▪ ▪        │  theme swatches
 *   └────────────────────┘
 *
 * Everything here is `compact:hidden`, so it never reaches the desktop layout.
 */

interface MobileChromeProps {
  activeProject: Project;
  totalCount: number;
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  // Menu state lives in PortfolioClient so the deck's wheel and keyboard
  // handlers can ignore input while the panel is open.
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
}

export function MobileChrome({
  activeProject,
  totalCount,
  activeSection,
  onSelectSection,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
}: MobileChromeProps) {
  // Same blink as the desktop sidebar: blurred while the deck moves, sharp once
  // it settles. Attached to the page number and the project block below.
  const blurRef = useTransitionBlur(activeProject.id);

  // The panel outlives the dismiss request: `closing` runs its blur-out, and
  // only when that finishes does onCloseMenu unmount it. Without this the
  // toggle would tear the panel off screen with no outro.
  const [closing, setClosing] = useState(false);
  const finishClose = useCallback(() => {
    setClosing(false);
    onCloseMenu();
  }, [onCloseMenu]);

  return (
    <>
      {/* The toggle positions itself (fixed, top-left) and sits above the panel,
          so it persists across open/close and morphs in place. */}
      <MenuToggle
        open={menuOpen && !closing}
        onToggle={menuOpen ? () => setClosing(true) : onOpenMenu}
      />

      {/* Brand, centred on the viewport independently of the button. */}
      <div className="compact:hidden fixed top-5 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <span className="text-title-h6 text-ink tracking-tight leading-none">
          couldbekush
        </span>
      </div>

      {/* Page number, stacked under the menu button. */}
      <div
        ref={blurRef}
        className="compact:hidden fixed top-20 left-6 z-30 flex items-start gap-x-2 pointer-events-none"
      >
        <span className="text-title-h1 text-ink leading-none tabular-nums">
          {activeProject.id}
        </span>
        <span className="text-label-xs text-inkMuted tabular-nums">
          /{String(totalCount).padStart(2, '0')}
        </span>
      </div>

      {/* Project detail, beneath the deck. Same order and type as the right
          sidebar's centred item, so the two layouts read as one design.

          Inverted against the deck and the page, exactly like the counter.
          The blend MUST sit on this outermost positioned element: z-30 puts it
          above main (z-20) so main's pixels are its backdrop, and anything
          nested inside a positioned ancestor would be isolated from them and
          render solid white. The blur is on this same element for the same
          reason — a filter on a parent would create that isolating context. */}
      <div
        ref={blurRef}
        className="compact:hidden fixed bottom-32 left-0 right-0 z-30 px-6 flex flex-col items-center text-center pointer-events-none text-invert mix-blend-difference"
      >
        <span className="rs-sub font-code uppercase">
          {activeProject.subtitle}
        </span>

        <h2 className="text-title-h5 uppercase mt-1">{activeProject.title}</h2>

        <span aria-hidden className="my-1">
          —
        </span>

        <p className="text-paragraph-sm max-w-[320px] line-clamp-3">
          {activeProject.description}
        </p>
      </div>

      {/* Swatches are a separate block, not nested in the one above: mix-blend
          composites an element together with its descendants, so inside it the
          theme colours would render inverted rather than as themselves. */}
      {activeProject.themeColors && activeProject.themeColors.length > 0 && (
        <div
          ref={blurRef}
          className="compact:hidden fixed bottom-24 left-0 right-0 z-30 flex justify-center gap-x-1.5 pointer-events-none"
        >
          {activeProject.themeColors.map((color, i) => (
            <span
              key={i}
              className="w-3.5 h-3.5 rounded-[3px] inline-block"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {menuOpen && (
        <MobileMenu
          activeSection={activeSection}
          onSelectSection={onSelectSection}
          onRequestClose={() => setClosing(true)}
          closing={closing}
          onClosed={finishClose}
        />
      )}
    </>
  );
}
