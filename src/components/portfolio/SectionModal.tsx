'use client';

import { X, Mail, MapPin, ArrowUpRight, Github, Twitter, Linkedin, Code } from 'lucide-react';
import { NavSection } from '@/types/portfolio';

interface SectionModalProps {
  section: NavSection | null;
  onClose: () => void;
}

export function SectionModal({ section, onClose }: SectionModalProps) {
  if (!section || section === 'work') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md animate-in fade-in transition-all duration-300">
      <div 
        className="relative w-full max-w-2xl bg-[#e7e7e5] text-ink rounded-lg shadow-2xl overflow-hidden border border-ink/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#e7e7e5] border-b border-ink/10 flex items-center justify-between">
          <span className="font-mono text-xs text-inkMuted uppercase tracking-widest">
            HUYVU® — {section}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-ink/10 transition-colors text-ink"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content per Section */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[75vh]">
          {section === 'about' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight text-ink mb-3">
                  Design Direction & Digital Architecture
                </h2>
                <p className="text-sm leading-relaxed text-ink/80">
                  HUYVU® is an independent design direction practice operating at the intersection of haute digital aesthetics, kinetic interaction design, and high-performance WebGL frontend engineering.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-ink/10 font-mono text-xs">
                <div>
                  <span className="text-inkMuted block text-[9px] uppercase tracking-wider mb-1">Location</span>
                  <span className="font-semibold text-ink flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-inkMuted" /> Saigon / Remote
                  </span>
                </div>
                <div>
                  <span className="text-inkMuted block text-[9px] uppercase tracking-wider mb-1">Focus</span>
                  <span className="font-semibold text-ink">3D Web / Brand Systems</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-mono tracking-widest text-inkMuted uppercase">Awards & Accolades</h3>
                <ul className="space-y-1.5 font-mono text-xs text-ink/90">
                  <li className="flex justify-between border-b border-ink/5 pb-1">
                    <span>Awwwards Site of the Year Nominee</span>
                    <span className="text-inkMuted">2023</span>
                  </li>
                  <li className="flex justify-between border-b border-ink/5 pb-1">
                    <span>FWA of the Month Winner</span>
                    <span className="text-inkMuted">2022</span>
                  </li>
                  <li className="flex justify-between border-b border-ink/5 pb-1">
                    <span>CSSDA Studio of the Year finalist</span>
                    <span className="text-inkMuted">2021</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {section === 'playground' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold uppercase tracking-tight text-ink mb-2">
                  Experimental Lab & Shaders
                </h2>
                <p className="text-xs font-mono text-inkMuted">
                  R&D interactive prototypes, WebGL shaders, fluid dynamics, and layout physics.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                <div className="p-4 bg-white/60 rounded border border-ink/10 space-y-2">
                  <div className="flex items-center justify-between text-ink font-bold">
                    <span>Kinetic Typo Mesh</span>
                    <Code className="w-4 h-4 text-inkMuted" />
                  </div>
                  <p className="text-[11px] text-inkMuted font-sans">
                    Real-time SVG displacement shaders driven by mouse velocity vector maps.
                  </p>
                </div>

                <div className="p-4 bg-white/60 rounded border border-ink/10 space-y-2">
                  <div className="flex items-center justify-between text-ink font-bold">
                    <span>Deck Physics 3D</span>
                    <Code className="w-4 h-4 text-inkMuted" />
                  </div>
                  <p className="text-[11px] text-inkMuted font-sans">
                    Spring-damper matrix physics engine implemented for 60fps mobile touch decks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'contact' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight text-ink mb-2">
                  Initiate a Project
                </h2>
                <p className="text-sm text-ink/80">
                  Currently accepting select design direction and website build commissions for Q3/Q4 2026.
                </p>
              </div>

              <div className="p-4 bg-white/70 rounded-lg border border-ink/10 space-y-3 font-mono">
                <span className="text-[10px] text-inkMuted uppercase tracking-wider block">Direct Contact</span>
                <a 
                  href="mailto:contact@huyvu.design" 
                  className="text-lg md:text-xl font-bold text-ink hover:underline flex items-center gap-2"
                >
                  <Mail className="w-5 h-5 text-inkMuted" />
                  <span>contact@huyvu.design</span>
                </a>
              </div>

              <div className="flex space-x-4 font-mono text-xs pt-2">
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center space-x-1.5 text-ink font-semibold hover:opacity-75 transition-opacity"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub</span>
                  <ArrowUpRight className="w-3 h-3 text-inkMuted" />
                </a>
                <a 
                  href="https://twitter.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center space-x-1.5 text-ink font-semibold hover:opacity-75 transition-opacity"
                >
                  <Twitter className="w-4 h-4" />
                  <span>Twitter</span>
                  <ArrowUpRight className="w-3 h-3 text-inkMuted" />
                </a>
                <a 
                  href="https://linkedin.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center space-x-1.5 text-ink font-semibold hover:opacity-75 transition-opacity"
                >
                  <Linkedin className="w-4 h-4" />
                  <span>LinkedIn</span>
                  <ArrowUpRight className="w-3 h-3 text-inkMuted" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
