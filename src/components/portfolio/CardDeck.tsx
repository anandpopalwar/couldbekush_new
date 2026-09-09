"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import gsap from "gsap";
import { Project } from "@/types/portfolio";
import { ChevronDown, ExternalLink } from "lucide-react";

interface CardDeckProps {
  projects: Project[];
  currentIndex: number;
  onGoToIndex: (
    index: number,
    direction?: "up" | "down",
    stepDelta?: number,
  ) => void;
  onSelectProject: (project: Project) => void;
}

export function CardDeck({
  projects,
  currentIndex,
  onGoToIndex,
  onSelectProject,
}: CardDeckProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const imgsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [hintVisible, setHintVisible] = useState(true);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const currentDragDeltaRef = useRef(0);
  const totalCount = projects.length;

  // Auto-hide gesture hint after 4.5s
  useEffect(() => {
    const timer = setTimeout(() => {
      setHintVisible(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  // Update card positions with GSAP matching exact 3D deck trajectory in reference image
  const updateDeckPositions = useCallback(
    (immediate = false) => {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      const xFactor = isMobile ? 0.45 : 1.0;
      const yFactor = isMobile ? 0.75 : 1.0;

      projects.forEach((_, idx) => {
        const card = cardsRef.current[idx];
        const imgContainer = imgsRef.current[idx];
        if (!card || !imgContainer) return;

        let diff = idx - currentIndex;
        while (diff > totalCount / 2) diff -= totalCount;
        while (diff < -totalCount / 2) diff += totalCount;

        let targetX = 0;
        let targetY = 0;
        let targetRot = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        let targetScale = 1;
        let targetOpacity = 1;
        let targetZ = 10;
        let imgY = 0;
        let pointerEvents = "auto";

        if (diff === 0) {
          // Center Selected Featured Card (Top-most focus)
          targetX = 0;
          targetY = 0;
          targetRot = 0;
          targetRotX = 0;
          targetRotY = 0;
          targetScale = 1;
          targetOpacity = 1;
          targetZ = 40;
          imgY = 0;
          pointerEvents = "auto";
        } else if (diff === -1) {
          // Card of Bottom-Left Stack (1.2x scale)
          targetX = -370 * xFactor;
          targetY = 480 * yFactor;
          targetRot = 6;
          targetRotX = -16;
          targetRotY = -24;
          targetScale = 1.02;
          targetOpacity = 0.96;
          targetZ = 32;
          imgY = 0;
          pointerEvents = "auto";
        } else if (diff === -2) {
          // Card of Bottom-Left Stack (1.2x scale)
          targetX = -405 * xFactor;
          targetY = 530 * yFactor;
          targetRot = 8;
          targetRotX = -18;
          targetRotY = -28;
          targetScale = 1.02;
          targetOpacity = 0.88;
          targetZ = 34;
          imgY = 0;
          pointerEvents = "auto";
        } else if (diff === -3) {
          // Card of Bottom-Left Stack (1.2x scale)
          targetX = -440 * xFactor;
          targetY = 580 * yFactor;
          targetRot = 10;
          targetRotX = -20;
          targetRotY = -32;
          targetScale = 1.02;
          targetOpacity = 0.78;
          targetZ = 36;
          imgY = 0;
          pointerEvents = "auto";
        } else if (diff < -3) {
          // Outer Card of Bottom-Left Stack (Equal scale: 0.85)
          targetX = (-475 - Math.abs(diff + 3) * 35) * xFactor;
          targetY = (630 + Math.abs(diff + 3) * 35) * yFactor;
          targetRot = 12;
          targetRotX = -22;
          targetRotY = -36;
          targetScale = 0.85;
          targetOpacity = 0;
          targetZ = 38;
          imgY = 0;
          pointerEvents = "none";
        } else if (diff === 1) {
          // Front-most Card of Top-Right Stack (1.2x scale)
          targetX = 280 * xFactor;
          targetY = -420 * yFactor;
          targetRot = 6;
          targetRotX = 16;
          targetRotY = 24;
          targetScale = 1.02;
          targetOpacity = 0.96;
          targetZ = 38;
          imgY = 0;
          pointerEvents = "auto";
        } else if (diff === 2) {
          // Second Card of Top-Right Stack (1.2x scale)
          targetX = 325 * xFactor;
          targetY = -460 * yFactor;
          targetRot = 8;
          targetRotX = 18;
          targetRotY = 28;
          targetScale = 0.936;
          targetOpacity = 0.88;
          targetZ = 36;
          imgY = 0;
          pointerEvents = "auto";
        } else if (diff === 3) {
          // Third Card of Top-Right Stack (1.2x scale)
          targetX = 370 * xFactor;
          targetY = -500 * yFactor;
          targetRot = 10;
          targetRotX = 20;
          targetRotY = 32;
          targetScale = 0.852;
          targetOpacity = 0.78;
          targetZ = 34;
          imgY = 0;
          pointerEvents = "auto";
        } else if (diff === 4) {
          // Fourth Card of Top-Right Stack (Perspective angle matching reference image)
          targetX = 415 * xFactor;
          targetY = -630 * yFactor;
          targetRot = -7;
          targetRotX = 14;
          targetRotY = 40;
          targetScale = 0.64;
          targetOpacity = 0.65;
          targetZ = 32;
          imgY = 0;
          pointerEvents = "auto";
        } else {
          targetX = (460 + (diff - 4) * 45) * xFactor;
          targetY = (-680 - (diff - 4) * 40) * yFactor;
          targetRot = -8;
          targetRotX = 16;
          targetRotY = 44;
          targetScale = 0.57;
          targetOpacity = 0;
          targetZ = 12;
          imgY = 0;
          pointerEvents = "none";
        }

        // Cards wrapping around the invisible arc (abs diff > 3) - instant, invisible
        const isWrapping = Math.abs(diff) > 3;

        if (immediate || isWrapping) {
          gsap.set(card, {
            x: targetX,
            y: targetY,
            rotation: targetRot,
            rotateX: targetRotX,
            rotateY: targetRotY,
            scale: targetScale,
            opacity: 0,
            zIndex: targetZ,
            pointerEvents: "none",
          });
          gsap.set(imgContainer, { yPercent: imgY });
        } else {
          gsap.to(card, {
            x: targetX,
            y: targetY,
            rotation: targetRot,
            rotateX: targetRotX,
            rotateY: targetRotY,
            scale: targetScale,
            opacity: targetOpacity,
            zIndex: targetZ,
            duration: 0.65,
            ease: "power3.out",
            overwrite: "auto",
            onStart: () => {
              card.style.pointerEvents = pointerEvents;
            },
          });
          gsap.to(imgContainer, {
            yPercent: imgY,
            duration: 0.65,
            ease: "power3.out",
            overwrite: "auto",
          });
        }
      });
    },
    [currentIndex, projects, totalCount],
  );

  useEffect(() => {
    updateDeckPositions();
  }, [currentIndex, updateDeckPositions]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => updateDeckPositions(true);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateDeckPositions]);

  // Pointer drag gestures
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    currentDragDeltaRef.current = 0;
    if (stageRef.current) {
      stageRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    currentDragDeltaRef.current = e.clientY - startYRef.current;

    const activeCard = cardsRef.current[currentIndex];
    if (activeCard) {
      gsap.set(activeCard, {
        x: currentDragDeltaRef.current * -0.5,
        y: currentDragDeltaRef.current * 0.75,
        rotation: currentDragDeltaRef.current * -0.015,
        scale:
          1 - Math.min(Math.abs(currentDragDeltaRef.current) * 0.0004, 0.08),
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const delta = currentDragDeltaRef.current;
    if (delta < -45) {
      onGoToIndex(currentIndex - 1, "up");
    } else if (delta > 45) {
      onGoToIndex(currentIndex + 1, "down");
    } else {
      updateDeckPositions();
    }
    currentDragDeltaRef.current = 0;
  };

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="col-span-1 md:col-span-6 h-full relative perspective-stage flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing overflow-visible touch-none select-none"
    >
      {/* Scaled card dimension stage */}
      <div className="relative w-[75vw] sm:w-[315px] md:w-[335px] lg:w-[370px] aspect-[4/3] flex items-center justify-center">
        {/* Interactive Card Stack Container */}
        <div className="relative w-full h-full">
          {projects.map((project, idx) => {
            const isCenter = idx === currentIndex;
            return (
              <div
                key={project.id}
                ref={(el) => {
                  cardsRef.current[idx] = el;
                }}
                onClick={() => {
                  if (isCenter) {
                    onSelectProject(project);
                  } else {
                    let diff = idx - currentIndex;
                    while (diff > totalCount / 2) diff -= totalCount;
                    while (diff < -totalCount / 2) diff += totalCount;
                    onGoToIndex(idx, diff > 0 ? "down" : "up", diff);
                  }
                }}
                className="absolute inset-0 w-full h-full rounded-sm card-deck-shadow overflow-hidden bg-[#151515] transition-shadow duration-500 will-change-transform select-none cursor-pointer group"
                data-index={idx}
              >
                <div className="relative w-full h-full overflow-hidden">
                  <div
                    ref={(el) => {
                      imgsRef.current[idx] = el;
                    }}
                    className="w-full h-full relative will-change-transform overflow-hidden"
                  >
                    <Image
                      src={project.image}
                      alt={project.title}
                      fill
                      sizes="(max-width: 768px) 75vw, 370px"
                      priority={idx < 3}
                      className={`object-cover object-center pointer-events-none transition-transform duration-500 ease-out ${
                        isCenter ? "group-hover:scale-105" : "scale-100"
                      }`}
                    />
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                  {/* Card Corner Details */}
                  <div className="absolute top-3.5 left-4 text-white/90 font-mono text-[9.5px] tracking-widest flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>{project.category}</span>
                  </div>

                  {/* Hover indicator for active card */}
                  {isCenter && (
                    <div className="absolute top-3.5 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-mono text-white/90 flex items-center space-x-1">
                      <span>EXPLORE</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end text-white">
                    <div>
                      <p className="font-mono text-[8.5px] tracking-widest uppercase opacity-75">
                        {project.launch}
                      </p>
                      <h3 className="text-lg md:text-xl font-bold tracking-tight uppercase">
                        {project.title}
                      </h3>
                    </div>
                    <div className="font-mono text-xs font-bold opacity-80">
                      {project.id}
                      <span className="text-[10px] opacity-50">/08</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating drag hint overlay */}
      <div
        className={`absolute bottom-6 flex items-center space-x-2 text-inkMuted text-[10px] font-mono tracking-widest uppercase pointer-events-none transition-opacity duration-700 ${
          hintVisible ? "opacity-60" : "opacity-0"
        }`}
      >
        <ChevronDown className="w-3 h-3 animate-bounce" />
        <span>Swipe / Scroll / Click</span>
      </div>
    </div>
  );
}
