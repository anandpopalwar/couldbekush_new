'use client';

import { Project, NavSection } from '@/types/portfolio';
import { useTransitionBlur } from '@/hooks/useTransitionBlur';

interface LeftSidebarProps {
  activeProject: Project;
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

export function LeftSidebar({
  activeProject,
  activeSection,
  onSelectSection,
}: LeftSidebarProps) {
  // Blurred while the deck moves between projects, sharp once it settles.
  // Shared with the mobile stack — see useTransitionBlur.
  const blurRef = useTransitionBlur(activeProject.id);

  const navItems: { id: NavSection; label: string }[] = [
    { id: 'work', label: 'WORK' },
    { id: 'about', label: 'ABOUT' },
    { id: 'playground', label: 'PLAYGROUND' },
    { id: 'contact', label: 'CONTACT' },
  ];

  return (
    <aside className="rail-left hidden compact:flex compact:col-start-1 compact:col-span-3 compact:row-start-1 h-full flex-col pointer-events-none text-ink relative">
      {/* Primary Section Nav Links — indented to the main column (aligns with Launch),
          raised to sit at the top header row like the reference. */}
      <div className="rail-left-nav p-6 pointer-events-auto">
        <span className="block text-micro-md font-mono tracking-widest text-inkMuted uppercase mb-4">
          Menu
        </span>
        {/* 24/32, no tracking, weight 500 — exactly the title-h5 token. */}
        <nav className="group space-y-0 uppercase text-title-h5">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <div key={item.id}>
                <button
                  onClick={() => onSelectSection(item.id)}
                  className={`inline-flex items-center transition-all duration-200 group-hover:blur-[3px] hover:!blur-none ${
                    isActive ? 'text-ink' : 'hover:text-ink'
                  }`}
                >
                  {isActive && <span className="mr-1.5 text-ink">→</span>}
                  <span>{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Dynamic Project Metadata — anchored at a FIXED vertical position so the Role/Launch
          labels never shift with content length. Launch sits directly below Role. */}
      {/* Label column is `auto`, not a fixed 5rem: a fixed track left a short
          label like "Role" stranded far from its value. Role and Launch share
          one grid so `auto` resolves to the same width for both and their
          values line up.

          min-w-0 on the value matters — a grid item defaults to min-width:auto,
          so a long word (Architecture) would overflow its track. */}
      <div
        ref={blurRef}
        className="rail-left-meta absolute top-[43%] left-5 right-6 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-start content-start"
      >
        <span className="text-label-xs text-inkMuted">Role</span>
        <p className="text-label-xs text-ink min-w-0">{activeProject.role}</p>

        <span className="text-label-xs text-inkMuted">Launch</span>
        <p className="text-label-xs text-ink min-w-0">{activeProject.launch}</p>
      </div>

      {/* Bottom selected work counter — huge number overlapping the card deck (z above cards,
          pointer-events-none so it doesn't block card interaction).

          Centred on the card, not on this aside: the aside is only 3 of 12 columns but
          starts at the viewport's left edge, so a w-screen box spans the window and the
          flex centres the group inside it — moved by --card-shift, the same offset the
          deck sits off the screen's centre, so it lands on the card. Do NOT swap this
          for -translate-x-1/2 or
          position:fixed — both create a stacking context, and the number below would then
          blend against that instead of against main's background and the cards, which
          renders it solid white. */}
      <div className="work-counter absolute bottom-2 left-[var(--card-shift)] w-screen flex justify-center pointer-events-none">
        <span
          ref={blurRef}
          className="counter-numeral text-[length:var(--counter-size)] tracking-tight text-invert mix-blend-difference inline-block leading-none tabular-nums"
        >
          {activeProject.id}
        </span>
      </div>

      {/* Scroll hint — bottom, inset from the left edge to match the right-side padding */}
      <div className="scroll-hint absolute bottom-6 left-5 text-micro-md tracking-wide text-inkMuted">
        Scroll
      </div>
    </aside>
  );
}
