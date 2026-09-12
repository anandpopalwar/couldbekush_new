'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Project, NavSection } from '@/types/portfolio';

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
  const metaContainerRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const prevProjectRef = useRef<string>(activeProject.id);
  const blurRef = useRef({ v: 0 });
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While the deck is transitioning between projects, blur the sidebar content; once scrolling
  // settles (debounced) sharpen it back. Replaces the old vertical "bounce" animation.
  useEffect(() => {
    if (prevProjectRef.current === activeProject.id) return;
    prevProjectRef.current = activeProject.id;

    const applyBlur = () => {
      const px = `blur(${blurRef.current.v}px)`;
      // Only blur the metadata. The counter number is NOT blurred: a `filter` on it would
      // create a stacking context and break its mix-blend-difference against the cards/bg.
      if (metaContainerRef.current) metaContainerRef.current.style.filter = px;
    };

    // Ramp the blur up quickly as the card starts moving.
    gsap.to(blurRef.current, {
      v: 6,
      duration: 0.15,
      ease: 'power1.out',
      overwrite: true,
      onUpdate: applyBlur,
    });

    // Sharpen only once scrolling has settled, so rapid scrolling stays blurred throughout.
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      gsap.to(blurRef.current, {
        v: 0,
        duration: 0.45,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: applyBlur,
        onComplete: () => {
          if (metaContainerRef.current) metaContainerRef.current.style.filter = '';
        },
      });
    }, 170);
  }, [activeProject]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const navItems: { id: NavSection; label: string }[] = [
    { id: 'work', label: 'WORK' },
    { id: 'about', label: 'ABOUT' },
    { id: 'playground', label: 'PLAYGROUND' },
    { id: 'contact', label: 'CONTACT' },
  ];

  return (
    <aside className="hidden md:flex md:col-start-1 md:col-span-3 md:row-start-1 h-full flex-col pointer-events-none text-ink relative">
      {/* Primary Section Nav Links — indented to the main column (aligns with Launch),
          raised to sit at the top header row like the reference. */}
      <div className="pt-6 pr-6 pl-[50%] pointer-events-auto">
        <span className="block text-[10px] font-mono tracking-widest text-inkMuted uppercase mb-8">
          Menu
        </span>
        <nav className="space-y-0 uppercase font-extrabold tracking-tight text-[20px] md:text-[24px] leading-[1.1]">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <div key={item.id}>
                <button
                  onClick={() => onSelectSection(item.id)}
                  className={`inline-flex items-center transition-colors ${
                    isActive
                      ? 'text-ink font-black'
                      : 'text-inkMuted hover:text-ink font-bold'
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
        ref={metaContainerRef}
        className="absolute top-[43%] left-0 right-6 grid grid-cols-2 gap-x-6 items-start"
      >
        {/* Left column: Role */}
        <div className="grid grid-cols-3 gap-2 items-start content-start">
          <span className="text-[10px] tracking-wide text-inkMuted">
            Role
          </span>
          <p className="col-span-2 text-[12px] md:text-[13px] font-bold text-ink leading-snug">
            {activeProject.role}
          </p>
        </div>

        {/* Right column: Launch, then Recognition */}
        <div className="space-y-8">
          <div className="grid grid-cols-3 gap-2 items-start">
            <span className="text-[10px] tracking-wide text-inkMuted">
              Launch
            </span>
            <p className="col-span-2 text-[12px] md:text-[13px] font-bold text-ink">
              {activeProject.launch}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 items-start">
            <span className="text-[10px] tracking-wide text-inkMuted">
              Recognition
            </span>
            <ul className="col-span-2 space-y-1 text-ink text-[11px] font-semibold leading-tight">
              {activeProject.recognition.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom selected work counter — huge number overlapping the card deck (z above cards,
          pointer-events-none so it doesn't block card interaction). */}
      <div className="absolute bottom-2 left-[50%] pointer-events-none">
        <div className="flex items-start gap-x-4">
          <span className="text-[10px] tracking-wide text-inkMuted mt-3 whitespace-nowrap">
            Selected work
          </span>
          <span
            ref={counterRef}
            className="text-[8rem] md:text-[10rem] lg:text-[12rem] font-medium tracking-tight text-white mix-blend-difference inline-block leading-none"
          >
            {activeProject.id}
          </span>
          <span className="text-[13px] font-semibold text-inkMuted mt-2">
            /{String(totalCount).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Scroll hint — far-left gutter, very bottom */}
      <div className="absolute bottom-6 left-0 text-[10px] tracking-wide text-inkMuted">
        Scroll
      </div>
    </aside>
  );
}
