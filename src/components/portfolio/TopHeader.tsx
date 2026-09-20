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
      {/* Far-left vertical brand mark, reading bottom-to-top.
          -rotate-90 turns the strip counter-clockwise, so its length runs UP
          from the transform origin and its thickness runs RIGHT. It therefore
          has to be anchored at the BOTTOM-left: with origin-top-left and top-8
          it rotated up out of the viewport and was clipped entirely. */}
      {/* <div className="fixed bottom-8 left-4 z-40 hidden xl:flex flex-col items-start origin-bottom-left -rotate-90 pointer-events-auto select-none whitespace-nowrap">
        <div className="flex items-baseline gap-x-4">
          <span className="font-extrabold text-ink text-title-h6 leading-none tracking-tight">
            couldbekush®
          </span>
          <span className="font-mono text-micro-sm tracking-widest text-inkMuted uppercase">
            copyright 2026
          </span>
 
        </div>
      </div> */}

      {/* Top header row — Menu + nav live in the left sidebar and occupy the left zone.
          The header itself is click-through except for its interactive controls. */}
      {/* Everything in this header is right-aligned. Audio and "Working
          globally" used to sit centred at the top, where they competed with the
          deck; the top-left is not free either — the sidebar's Menu nav starts
          at the same inset. Stacked above the contact line they read as one
          block of status, and the top of the page is left to the work. */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 compact:px-9 py-6 flex justify-end pointer-events-none text-ink">
        <div className="flex flex-col items-end gap-y-1.5">
                <div className="font-mono text-micro-md tracking-wider text-ink pointer-events-auto">
            <span className="text-inkMuted hidden sm:inline mr-2 normal-case">
              For inquiries
            </span>
            <a
              href="mailto:couldbekush@gmail.com"
              className="font-bold underline hover:opacity-75 transition-opacity"
            >
              couldbekush@gmail.com
            </a>
          </div>
          {/* Same type as the contact line above it — mono, micro-md, tracking
              -wider, bold — so the two read as one block. */}
          <span className="hidden compact:block font-mono text-micro-md tracking-wider font-bold text-ink pointer-events-auto">
            Working globally
          </span>
        </div>
      </header>

      {/* Audio sits with the scroll hint in the bottom-left corner rather than
          in the header: both are instructions for using the page, not
          information about the work. */}
      <button
        onClick={onToggleAudio}
        className="hidden compact:flex fixed bottom-12 left-5 z-40 items-center gap-x-2 font-mono text-micro-md tracking-wider uppercase pointer-events-auto hover:opacity-70 transition-opacity"
      >
        <span className="text-inkMuted">Audio</span>
        <span className="font-bold text-ink">
          {audioEnabled ? 'On —' : 'Off —'}
        </span>
      </button>
    </>
  );
}
