'use client';

import { Project, NavSection } from '@/types/portfolio';
import { useTransitionBlur } from '@/hooks/useTransitionBlur';

interface LeftSidebarProps {
  activeProject: Project;
  currentIndex: number;
  totalCount: number;
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

export function LeftSidebar({
  activeProject,
  currentIndex,
  totalCount,
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
    <aside className="hidden compact:flex compact:col-start-1 compact:col-span-3 compact:row-start-1 h-full flex-col pointer-events-none text-ink relative">
      {/* Primary Section Nav Links — indented to the main column (aligns with Launch),
          raised to sit at the top header row like the reference. */}
      <div className="p-6 pointer-events-auto">
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
          labels never shift with content length; Recognition simply grows downward. */}
      <div
        ref={blurRef}
        className="absolute top-[43%] left-5 right-6 grid grid-cols-2 gap-x-6 items-start"
      >
        {/* Left column: Role */}
        <div className="grid grid-cols-[5rem_1fr] gap-6 items-start content-start">
          <span className="text-label-xs text-inkMuted">
            Role
          </span>
          <p className="text-label-xs text-ink">{activeProject.role}</p>
        </div>

        {/* Right column: Launch, then Recognition */}
        <div className="space-y-8">
          <div className="grid grid-cols-[5rem_1fr] gap-6 items-start">
            <span className="text-label-xs text-inkMuted">
              Launch
            </span>
            <p className="text-label-xs text-ink">{activeProject.launch}</p>
          </div>

          <div className="grid grid-cols-[5rem_1fr] gap-6 items-start">
            <span className="text-label-xs text-inkMuted">
              Recognition
            </span>
            <ul className="text-label-xs text-ink whitespace-nowrap">
              {activeProject.recognition.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom selected work counter — huge number overlapping the card deck (z above cards,
          pointer-events-none so it doesn't block card interaction).

          Centred on the screen, not on this aside: the aside is only 3 of 12 columns but
          starts at the viewport's left edge, so left-0 + w-screen spans the window and the
          flex centres the group inside it. Do NOT swap this for -translate-x-1/2 or
          position:fixed — both create a stacking context, and the number below would then
          blend against that instead of against main's background and the cards, which
          renders it solid white. */}
      <div className="absolute bottom-2 left-0 w-screen flex justify-center pointer-events-none">
        <div className="flex items-start gap-x-4">
          <span
            ref={blurRef}
            className="counter-numeral text-[length:var(--counter-size)] font-medium tracking-tight text-invert mix-blend-difference inline-block leading-none tabular-nums"
          >
            {activeProject.id}
          </span>
          <span className="text-label-sm font-semibold text-inkMuted mt-2">
            /{String(totalCount).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Scroll hint — bottom, inset from the left edge to match the right-side padding */}
      <div className="absolute bottom-6 left-5 text-micro-md tracking-wide text-inkMuted">
        Scroll
      </div>
    </aside>
  );
}
