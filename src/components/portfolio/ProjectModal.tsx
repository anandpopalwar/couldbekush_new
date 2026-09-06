'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, ExternalLink, Calendar, UserCheck, Award, Layers } from 'lucide-react';
import { Project } from '@/types/portfolio';

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export function ProjectModal({ project, onClose }: ProjectModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (project) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [project, onClose]);

  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md transition-all duration-300 animate-in fade-in">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#e7e7e5] text-ink rounded-lg shadow-2xl overflow-y-auto border border-ink/10 flex flex-col no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="sticky top-0 bg-[#e7e7e5]/90 backdrop-blur-md px-6 py-4 border-b border-ink/10 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs text-inkMuted">{project.id}</span>
            <h2 className="text-xl font-bold uppercase tracking-tight">{project.title}</h2>
            <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-ink text-white rounded-full">
              {project.category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-ink/10 transition-colors text-ink"
            aria-label="Close project modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Image Showcase */}
        <div className="relative w-full h-[280px] md:h-[400px] bg-black">
          <Image
            src={project.image}
            alt={project.title}
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#e7e7e5] via-transparent to-black/20" />
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-10 space-y-8">
          {/* Overview & Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left 2 Cols: Description & Overview */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-xs font-mono tracking-widest text-inkMuted uppercase">Project Overview</h3>
              <p className="text-base leading-relaxed text-ink/90 font-sans font-normal">
                {project.overview || project.description}
              </p>
              
              {project.techStack && (
                <div className="pt-4">
                  <span className="block text-xs font-mono tracking-widest text-inkMuted uppercase mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Tech Stack
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {project.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="px-3 py-1 bg-white/70 border border-ink/10 text-ink font-mono text-[10px] rounded-md shadow-xs"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Col: Details Card */}
            <div className="bg-white/50 border border-ink/10 rounded-lg p-5 space-y-4 text-xs font-mono">
              <div>
                <span className="text-inkMuted uppercase text-[9px] block mb-1 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Client
                </span>
                <span className="font-semibold text-ink">{project.client || "Confidential Client"}</span>
              </div>

              <div>
                <span className="text-inkMuted uppercase text-[9px] block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Launch Date
                </span>
                <span className="font-semibold text-ink">{project.launch}</span>
              </div>

              <div>
                <span className="text-inkMuted uppercase text-[9px] block mb-1 flex items-center gap-1">
                  <Award className="w-3 h-3" /> Recognition
                </span>
                <ul className="space-y-1 text-ink/80 text-[10px]">
                  {project.recognition.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>

              {project.liveUrl && (
                <div className="pt-2">
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-ink text-white font-mono text-[11px] font-bold tracking-wider rounded uppercase hover:bg-ink/80 transition-colors gap-2"
                  >
                    <span>Visit Live Site</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
