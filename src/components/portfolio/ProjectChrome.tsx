'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SlideLink } from '@/components/transition/SlideLink';
import { MenuToggle } from '@/components/portfolio/MenuToggle';
import { MobileMenu } from '@/components/portfolio/MobileMenu';
import { useRouteSlide } from '@/app/(frontend)/template';
import { NavSection } from '@/types/portfolio';

/**
 * The site's furniture, kept on every page that isn't the deck — a case study,
 * About — so each reads as part of the site rather than a document it links
 * out to: the menu. Same position as on the deck, at both layouts.
 *
 * About is a page of its own. Playground and Contact are still panels that
 * belong to the deck, so from here those — in the desktop rail and in the
 * stacked layout's full-screen panel alike — return home rather than trying to
 * reproduce them.
 */

// `label` is what the covering slide names on the way there; the trip home is
// announced but paints nothing (see routeTransition.ts).
const NAV_ITEMS: { id: NavSection; text: string; href: string; label: string }[] = [
  { id: 'work', text: 'Work', href: '/', label: '' },
  { id: 'about', text: 'About', href: '/about', label: 'About' },
  { id: 'playground', text: 'Playground', href: '/', label: '' },
  { id: 'contact', text: 'Contact', href: '/', label: '' },
];

export function ProjectChrome({ active = 'work' }: { active?: NavSection }) {
  const { slideTo } = useRouteSlide();
  const pathname = usePathname();

  // Menu state lives here rather than in a parent: on the deck it is owned by
  // PortfolioClient so the wheel and keyboard handlers can ignore input while
  // the panel is open, but these pages have no such handlers to gate.
  const [menuOpen, setMenuOpen] = useState(false);
  // The panel outlives the dismiss request: `closing` runs its blur-out, and
  // only when that finishes is it unmounted — same dance as MobileChrome.
  const [closing, setClosing] = useState(false);

  const finishClose = useCallback(() => {
    setClosing(false);
    setMenuOpen(false);
  }, []);

  // Picking a section from the panel goes there through the slide. The panel
  // is unmounted outright rather than played out: it would be animating over a
  // page that is already leaving. Picking the page you are on leaves the panel
  // to close the ordinary way.
  const goTo = useCallback(
    (section: NavSection) => {
      const item = NAV_ITEMS.find((entry) => entry.id === section);
      if (!item || item.href === pathname) return;
      setClosing(false);
      setMenuOpen(false);
      slideTo(item.href, item.label);
    },
    [slideTo, pathname],
  );

  return (
    <>
      <div className="chrome-nav hidden compact:block fixed top-6 left-6 z-30 pointer-events-auto">
        <span className="block text-micro-md font-mono tracking-widest text-inkMuted uppercase mb-4">
          Menu
        </span>

        <nav className="group flex flex-col items-start uppercase text-title-h5">
          {NAV_ITEMS.map((item) => (
            <SlideLink
              key={item.id}
              href={item.href}
              label={item.label}
              className="inline-flex items-center transition-all duration-200 group-hover:blur-[3px] hover:!blur-none"
            >
              {/* The marker sits on the section this page belongs to — Work,
                  for a case study. */}
              {item.id === active && <span className="mr-1.5">→</span>}
              <span>{item.text}</span>
            </SlideLink>
          ))}
        </nav>
      </div>

      {/* Below 1100 the rail is gone, so the stacked layout's chrome stands in
          for it — the same toggle and brand as the deck, in the same places, so
          crossing between the routes doesn't move the furniture. */}
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
          activeSection={active}
          onSelectSection={goTo}
          onRequestClose={() => setClosing(true)}
          closing={closing}
          onClosed={finishClose}
        />
      )}
    </>
  );
}
