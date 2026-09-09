'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { Project } from '@/types/portfolio';

interface RightSidebarProps {
  projects: Project[];
  virtualIndex: number;
  onGoToIndex: (index: number, direction?: 'up' | 'down', stepDelta?: number) => void;
  onUpdateVirtualIndex: (newVirtualIndex: number) => void;
}

const ITEM_HEIGHT = 150;
const SETS_COUNT = 5;

export function RightSidebar({
  projects,
  virtualIndex,
  onGoToIndex,
  onUpdateVirtualIndex,
}: RightSidebarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const totalCount = projects.length;

  const [items, setItems] = useState<
    { vIdx: number; pIdx: number; project: Project }[]
  >([]);

  useEffect(() => {
    const list: { vIdx: number; pIdx: number; project: Project }[] = [];
    for (let s = 0; s < SETS_COUNT; s++) {
      projects.forEach((project, pIdx) => {
        const vIdx = s * totalCount + pIdx;
        list.push({ vIdx, pIdx, project });
      });
    }
    setItems(list);
  }, [projects, totalCount]);

  const updateTrackPosition = useCallback(
    (immediate = false) => {
      if (!viewportRef.current || !trackRef.current) return;
      const viewportHeight = viewportRef.current.clientHeight || window.innerHeight;
      const itemCenterInTrack = virtualIndex * ITEM_HEIGHT + ITEM_HEIGHT / 2;
      const targetTrackY = viewportHeight / 2 - itemCenterInTrack;

      if (immediate) {
        gsap.set(trackRef.current, { y: targetTrackY });
      } else {
        gsap.to(trackRef.current, {
          y: targetTrackY,
          duration: 0.38,
          ease: 'power2.out',
          overwrite: 'auto',
          onComplete: () => {
            if (virtualIndex >= totalCount * 3 + totalCount / 2) {
              onUpdateVirtualIndex(virtualIndex - totalCount * 2);
            } else if (virtualIndex < totalCount * 2 - totalCount / 2) {
              onUpdateVirtualIndex(virtualIndex + totalCount * 2);
            }
          },
        });
      }
    },
    [virtualIndex, onUpdateVirtualIndex, totalCount]
  );

  useEffect(() => {
    updateTrackPosition();
  }, [virtualIndex, updateTrackPosition]);

  useEffect(() => {
    const handleResize = () => updateTrackPosition(true);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateTrackPosition]);

  return (
    <aside className="hidden md:flex md:col-span-3 h-full flex-col justify-between pointer-events-auto px-6 overflow-hidden relative z-30">
      <div
        ref={viewportRef}
        className="w-full h-full relative overflow-hidden flex items-center justify-center"
      >
        <div ref={trackRef} className="w-full relative will-change-transform">
          {items.map(({ vIdx, pIdx, project }) => {
            const visualDist = Math.abs(vIdx - virtualIndex);
            const isCenter = visualDist === 0;

            let opacityClass = 'opacity-15';
            let titleColorClass = 'text-[#8b8b87] font-normal text-[14px] tracking-normal';
            let subtitleColorClass = 'text-[#b0b0ac] font-normal text-[9px] tracking-normal';
            let descColorClass = 'text-[#b0b0ac] font-normal text-[10px]';
            let dashClass = 'text-[#b0b0ac] font-normal text-[10px] my-0.5';

            if (isCenter) {
              opacityClass = 'opacity-100';
              titleColorClass = 'text-ink font-black text-[19px] md:text-[21px] tracking-tight';
              subtitleColorClass = 'text-ink font-extrabold text-[10.5px] tracking-widest';
              descColorClass = 'text-ink font-black text-[12px] leading-snug';
              dashClass = 'text-ink font-black text-sm my-1';
            }

            return (
              <div
                key={vIdx}
                onClick={() => {
                  if (isCenter) return;
                  const diff = vIdx - virtualIndex;
                  onGoToIndex(pIdx, diff > 0 ? 'down' : 'up', diff);
                }}
                className={`h-[150px] relative flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all duration-300 px-2 ${opacityClass}`}
              >
                <span
                  className={`uppercase mb-1 transition-colors duration-300 ${subtitleColorClass}`}
                >
                  {project.subtitle}
                </span>

                <h4
                  className={`uppercase transition-all duration-300 ${titleColorClass}`}
                >
                  {project.title}
                </h4>

                <span className={`transition-colors duration-300 ${dashClass}`}>—</span>

                <p
                  className={`max-w-[280px] line-clamp-3 transition-colors duration-300 ${descColorClass}`}
                >
                  {project.description}
                </p>

                {isCenter && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden xl:flex space-x-1.5 pointer-events-none">
                    <span className="w-3.5 h-3.5 bg-pink-200 rounded-xs inline-block shadow-xs" />
                    <span className="w-3.5 h-3.5 bg-indigo-200 rounded-xs inline-block shadow-xs" />
                    <span className="w-3.5 h-3.5 bg-amber-100 rounded-xs inline-block shadow-xs" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-30 font-mono text-[10px] font-bold text-ink uppercase tracking-wider flex items-center space-x-1 hover:opacity-75 transition-opacity cursor-pointer">
        <span className="underline font-black">'25 showreel</span>
        <span className="text-[8px]">▶</span>
      </div>
    </aside>
  );
}
