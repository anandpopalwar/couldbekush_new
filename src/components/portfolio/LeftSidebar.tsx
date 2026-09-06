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

  // Crossfade metadata animation on project change
  useEffect(() => {
    if (prevProjectRef.current === activeProject.id) return;
    prevProjectRef.current = activeProject.id;

    if (metaContainerRef.current) {
      gsap.to(metaContainerRef.current, {
        opacity: 0,
        y: 4,
        duration: 0.18,
        ease: 'power1.in',
        onComplete: () => {
          gsap.to(metaContainerRef.current, {
            opacity: 1,
            y: 0,
            duration: 0.32,
            ease: 'power2.out',
          });
        },
      });
    }

    if (counterRef.current) {
      const nextNum = activeProject.id;
      gsap.to(counterRef.current, {
        y: -10,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          if (counterRef.current) {
            counterRef.current.textContent = nextNum;
            gsap.fromTo(
              counterRef.current,
              { y: 10, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' }
            );
          }
        },
      });
    }
  }, [activeProject]);

  const navItems: { id: NavSection; label: string }[] = [
    { id: 'work', label: 'WORK' },
    { id: 'about', label: 'ABOUT' },
    { id: 'playground', label: 'PLAYGROUND' },
    { id: 'contact', label: 'CONTACT' },
  ];

  return (
    <aside className="hidden md:flex md:col-span-3 h-full flex-col justify-between py-12 pointer-events-auto pr-6 text-ink">
      {/* Primary Section Nav Links (Matching reference screenshot Menu header) */}
      <div className="pt-10">
        <span className="block text-[10px] font-mono tracking-widest text-inkMuted uppercase mb-3">
          Menu
        </span>
        <nav className="space-y-1.5 uppercase font-extrabold tracking-tight text-[15px] md:text-[17px] leading-tight">
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

      {/* Dynamic Project Metadata (Matching reference screenshot grid alignment) */}
      <div ref={metaContainerRef} className="space-y-6 py-6">
        <div className="grid grid-cols-3 gap-2 items-start">
          <span className="text-[10px] font-mono tracking-wider text-inkMuted uppercase">
            Role
          </span>
          <p className="col-span-2 text-[12px] md:text-[13px] font-bold text-ink leading-snug">
            {activeProject.role}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 items-start">
          <span className="text-[10px] font-mono tracking-wider text-inkMuted uppercase">
            Launch
          </span>
          <p className="col-span-2 text-[12px] md:text-[13px] font-semibold text-ink">
            {activeProject.launch}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 items-start">
          <span className="text-[10px] font-mono tracking-wider text-inkMuted uppercase">
            Recognition
          </span>
          <ul className="col-span-2 space-y-1 text-ink text-[11px] font-semibold leading-tight">
            {activeProject.recognition.map((rec, idx) => (
              <li key={idx}>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom selected work counter indicator (Matching screenshot massive number layout) */}
      <div className="pb-4">
        <span className="block text-[10px] font-mono tracking-widest text-inkMuted uppercase mb-1">
          Selected work
        </span>
        <div className="flex items-baseline space-x-2 font-mono">
          <span
            ref={counterRef}
            className="text-7xl md:text-8xl font-black tracking-tighter2 text-ink inline-block leading-none"
          >
            {activeProject.id}
          </span>
          <span className="text-xl md:text-2xl font-bold text-inkMuted tracking-tight">
            /{String(totalCount).padStart(2, '0')}
          </span>
        </div>
      </div>
    </aside>
  );
}
