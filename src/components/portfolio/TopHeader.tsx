'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { NavSection } from '@/types/portfolio';

interface TopHeaderProps {
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onSelectSection: (section: NavSection) => void;
}

export function TopHeader({ audioEnabled, onToggleAudio, onSelectSection }: TopHeaderProps) {
  return (
    <>
      {/* Far Left Vertical Rotated Brand Mark (Exact match to reference image left margin) */}
      <div className="fixed top-8 left-4 z-40 hidden xl:flex flex-col items-center space-y-8 font-mono text-[9px] tracking-widest text-inkMuted uppercase origin-top-left -rotate-90 pointer-events-auto">
        <div className="flex items-center space-x-4">
          <span className="font-extrabold text-ink text-[11px] tracking-tight">HUYVU®</span>
          <span>copyright 2026</span>
          <span>hcmc, vn</span>
          <span className="text-ink font-bold">-04</span>
        </div>
      </div>

      {/* Main Top Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 md:px-9 py-5 flex justify-between items-start pointer-events-auto text-ink">
        {/* Left Brand / Nav Anchor */}
        <div className="flex items-center space-x-3">
          <a
            href="#work"
            onClick={(e) => {
              e.preventDefault();
              onSelectSection('work');
            }}
            className="text-base md:text-lg font-extrabold tracking-tighter text-ink flex items-center space-x-1 hover:opacity-80 transition-opacity"
          >
            <span>HUYVU®</span>
          </a>
          <span className="hidden sm:inline-block text-[9px] font-mono tracking-widest text-inkMuted uppercase border-l border-ink/15 pl-3">
            Selected Works
          </span>
        </div>

        {/* Center Section: Audio Status & Location (Matching reference image) */}
        <div className="hidden lg:flex items-center space-x-8 font-mono text-[10px] tracking-wider uppercase text-ink">
          <button
            onClick={onToggleAudio}
            className="flex items-center space-x-2 text-ink hover:opacity-70 transition-opacity"
          >
            <span>Audio</span>
            <span className="font-bold">{audioEnabled ? 'On —' : 'Off —'}</span>
            {audioEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-inkMuted" />
            )}
          </button>

          <div className="flex flex-col text-[9.5px] text-inkMuted leading-tight">
            <span className="font-semibold text-ink">Working globally</span>
            <span>HCMC 18:08</span>
          </div>
        </div>

        {/* Right Section: Contact Inquiries (Matching reference image top-right) */}
        <div className="font-mono text-[10px] tracking-wider uppercase text-ink">
          <span className="text-inkMuted hidden sm:inline mr-1">For Inquiries</span>
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
