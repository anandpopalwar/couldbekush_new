'use client';

import { NavSection } from '@/types/portfolio';

interface TopHeaderProps {
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onSelectSection: (section: NavSection) => void;
}

export function TopHeader({ audioEnabled, onToggleAudio }: TopHeaderProps) {
  return (
    <>
      {/* Far-left vertical rotated brand mark */}
      <div className="fixed top-8 left-4 z-40 hidden xl:flex flex-col items-start origin-top-left -rotate-90 pointer-events-auto select-none whitespace-nowrap">
        <div className="flex items-baseline gap-x-4">
          <span className="font-extrabold text-ink text-[20px] leading-none tracking-tight">
            HUYVU®
          </span>
          <span className="font-mono text-[9px] tracking-widest text-inkMuted uppercase">
            copyright 2026
          </span>
          <span className="font-mono text-[9px] tracking-widest text-inkMuted uppercase">
            hcmc, vn
          </span>
          <span className="font-mono text-[9px] tracking-widest text-ink font-bold uppercase">
            +84
          </span>
        </div>
      </div>

      {/* Top header row — Menu + nav live in the left sidebar and occupy the left zone.
          The header itself is click-through except for its interactive controls. */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 md:px-9 py-6 flex justify-between items-start pointer-events-none text-ink">
        {/* Left spacer (keeps Audio/Working centered via justify-between) */}
        <div aria-hidden className="w-px" />

        {/* Center: Audio status + location */}
        <div className="hidden lg:flex items-start gap-x-16 font-mono text-[10px] tracking-wider uppercase text-ink">
          <button
            onClick={onToggleAudio}
            className="flex items-center gap-x-2 hover:opacity-70 transition-opacity pointer-events-auto"
          >
            <span className="text-inkMuted">Audio</span>
            <span className="font-bold text-ink">{audioEnabled ? 'On —' : 'Off —'}</span>
          </button>

          <div className="flex flex-col leading-tight pointer-events-auto">
            <span className="font-bold text-ink normal-case text-[11px] tracking-normal">
              Working globally
            </span>
            <span className="text-inkMuted">HCMC, 00:57</span>
          </div>
        </div>

        {/* Right: contact inquiries */}
        <div className="font-mono text-[10px] tracking-wider uppercase text-ink pointer-events-auto">
          <span className="text-inkMuted hidden sm:inline mr-2 normal-case">For inquiries</span>
          <a
            href="mailto:hello@huyvu.design"
            className="font-bold underline hover:opacity-75 transition-opacity"
          >
            hello@huyvu.design
          </a>
        </div>
      </header>
    </>
  );
}
