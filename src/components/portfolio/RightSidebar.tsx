"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { Project } from "@/types/portfolio";

interface RightSidebarProps {
  projects: Project[];
  currentIndex: number;
  onGoToIndex: (
    index: number,
    direction?: "up" | "down",
    stepDelta?: number,
  ) => void;
}

const ITEM_HEIGHT = 150;
const LOOP_BUFFER = 3;

export function RightSidebar({
  projects,
  currentIndex,
  onGoToIndex,
}: RightSidebarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const currentDeltaRef = useRef(0);
  const totalCount = projects.length;

  const getOffsetIndex = useCallback(() => {
    return currentIndex + LOOP_BUFFER * totalCount;
  }, [currentIndex, totalCount]);

  const updateTrackPosition = useCallback(
    (immediate = false) => {
      if (!viewportRef.current || !trackRef.current) return;
      const viewportHeight =
        viewportRef.current.clientHeight || window.innerHeight;
      const offsetIndex = getOffsetIndex();
      const itemCenterInTrack = offsetIndex * ITEM_HEIGHT + ITEM_HEIGHT / 2;
      const targetTrackY = viewportHeight / 2 - itemCenterInTrack;

      if (immediate) {
        gsap.set(trackRef.current, { y: targetTrackY });
      } else {
        gsap.to(trackRef.current, {
          y: targetTrackY,
          duration: 0.38,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    },
    [getOffsetIndex],
  );

  useEffect(() => {
    updateTrackPosition();
  }, [currentIndex, updateTrackPosition]);

  useEffect(() => {
    const handleResize = () => updateTrackPosition(true);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateTrackPosition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    currentDeltaRef.current = 0;
    if (trackRef.current) {
      trackRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    currentDeltaRef.current = e.clientY - startYRef.current;

    if (trackRef.current) {
      const offsetIndex = getOffsetIndex();
      const baseY =
        -(offsetIndex * ITEM_HEIGHT) +
        (viewportRef.current?.clientHeight || window.innerHeight) / 2 -
        ITEM_HEIGHT / 2;
      gsap.set(trackRef.current, { y: baseY + currentDeltaRef.current });
    }
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const delta = currentDeltaRef.current;
    if (Math.abs(delta) > 40) {
      const step = delta > 0 ? -1 : 1;
      onGoToIndex(currentIndex + step, step > 0 ? "down" : "up");
    }
    currentDeltaRef.current = 0;
  };

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) > 5) {
        const step = e.deltaY > 0 ? 1 : -1;
        onGoToIndex(currentIndex + step, step > 0 ? "down" : "up");
      }
    },
    [currentIndex, onGoToIndex],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const offsetIndex = getOffsetIndex();
  const loopStart = -LOOP_BUFFER;
  const loopEnd = totalCount + LOOP_BUFFER;

  return (
    <aside className="hidden md:flex md:col-span-3 h-full flex-col justify-between pointer-events-auto px-6 overflow-hidden relative z-30">
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        <div ref={trackRef} className="w-full relative will-change-transform">
          {Array.from(
            { length: (loopEnd - loopStart) * totalCount },
            (_, i) => {
              const globalIdx = loopStart * totalCount + i;
              const pIdx = ((globalIdx % totalCount) + totalCount) % totalCount;
              const project = projects[pIdx];
              const visualDist = Math.abs(globalIdx - offsetIndex);
              const isCenter = visualDist === 0;

              return (
                <div
                  key={`${pIdx}-${globalIdx}`}
                  onClick={() => {
                    if (isCenter) return;
                    const diff = globalIdx - offsetIndex;
                    onGoToIndex(pIdx, diff > 0 ? "down" : "up");
                  }}
                  className={`h-[150px] relative flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all duration-300 px-2 ${
                    isCenter ? "opacity-100" : "opacity-15"
                  }`}
                >
                  <span
                    className={`uppercase mb-1 transition-colors duration-300 ${
                      isCenter
                        ? "text-black font-extrabold text-[10.5px] tracking-widest"
                        : "text-gray-400 font-normal text-[9px] tracking-normal"
                    }`}
                  >
                    {project.subtitle}
                  </span>

                  <h4
                    className={`uppercase transition-all duration-300 ${
                      isCenter
                        ? "text-black font-black text-[19px] md:text-[21px] tracking-tight"
                        : "text-gray-400 font-normal text-[14px] tracking-normal"
                    }`}
                  >

                    {project.title}
                  </h4>

                  <span
                    className={`transition-colors duration-300 ${
                      isCenter
                        ? "text-black font-black text-sm my-1"
                        : "text-gray-400 font-normal text-[10px] my-0.5"
                    }`}
                  >
                    —
                  </span>

                  <p
                    className={`max-w-[280px] line-clamp-3 transition-colors duration-300 ${
                      isCenter
                        ? "text-black font-black text-[12px] leading-snug"
                        : "text-gray-400 font-normal text-[10px]"
                    }`}
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
            },
          )}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-30 font-mono text-[10px] font-bold text-ink uppercase tracking-wider flex items-center space-x-1 hover:opacity-75 transition-opacity cursor-pointer">
        <span className="underline font-black">'25 showreel</span>
        <span className="text-[8px]">▶</span>
      </div>
    </aside>
  );
}
