"use client";

import {
  X,
  Mail,
  ArrowUpRight,
  Github,
  Twitter,
  Linkedin,
  Code,
} from "lucide-react";
import { NavSection } from "@/types/portfolio";

interface SectionModalProps {
  section: NavSection | null;
  onClose: () => void;
}

export function SectionModal({ section, onClose }: SectionModalProps) {
  if (!section || section === "work") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md animate-in fade-in transition-all duration-300">
      <div
        className="relative w-full max-w-2xl bg-canvas text-ink rounded-lg shadow-2xl overflow-hidden border border-ink/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-canvas border-b border-ink/10 flex items-center justify-between">
          <span className="font-mono text-paragraph-xs text-inkMuted uppercase tracking-widest">
            couldbekush — {section}
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
          {section === "playground" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold uppercase tracking-tight text-ink mb-2">
                  Experimental Lab & Shaders
                </h2>
                <p className="text-paragraph-xs font-mono text-inkMuted">
                  R&D interactive prototypes, WebGL shaders, fluid dynamics, and
                  layout physics.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-paragraph-xs">
                <div className="p-4 bg-white/60 rounded border border-ink/10 space-y-2">
                  <div className="flex items-center justify-between text-ink font-bold">
                    <span>Kinetic Typo Mesh</span>
                    <Code className="w-4 h-4 text-inkMuted" />
                  </div>
                  <p className="text-micro-lg text-inkMuted font-sans">
                    Real-time SVG displacement shaders driven by mouse velocity
                    vector maps.
                  </p>
                </div>

                <div className="p-4 bg-white/60 rounded border border-ink/10 space-y-2">
                  <div className="flex items-center justify-between text-ink font-bold">
                    <span>Deck Physics 3D</span>
                    <Code className="w-4 h-4 text-inkMuted" />
                  </div>
                  <p className="text-micro-lg text-inkMuted font-sans">
                    Spring-damper matrix physics engine implemented for 60fps
                    mobile touch decks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === "contact" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight text-ink mb-2">
                  Initiate a Project
                </h2>
                <p className="text-paragraph-sm text-ink/80">
                  Currently accepting select design direction and website build
                  commissions for Q3/Q4 2026.
                </p>
              </div>

              <div className="p-4 bg-white/70 rounded-lg border border-ink/10 space-y-3 font-mono">
                <span className="text-micro-md text-inkMuted uppercase tracking-wider block">
                  Direct Contact
                </span>
                <a
                  href="mailto:couldbekush@gmail.com"
                  className="text-paragraph-lg md:text-title-h6 font-bold text-ink hover:underline flex items-center gap-2"
                >
                  <Mail className="w-5 h-5 text-inkMuted" />
                  <span>couldbekush@gmail.com</span>
                </a>
              </div>

              <div className="flex space-x-4 font-mono text-paragraph-xs pt-2">
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
