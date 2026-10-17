'use client';

/**
 * The couldbekush logo in 3D chrome — the header's brand mark.
 *
 * - `public/logo.svg` extruded into a bevelled mesh, mirror chrome lit by a
 *   studio built in code (no HDR file), tinted by `--color-chrome`.
 * - Drag across to spin it freely, all the way round, with inertia; it stays
 *   where it's thrown. Drag up and down to tilt it, held to `maxTilt` so it
 *   is never seen upside down, and the tilt eases back level. A gentle idle
 *   float, off under reduced motion. Otherwise the original ChromeLogo's
 *   motion.
 * - On top of it, a slow spin about the logo's own vertical axis, face
 *   travelling left to right (`IDLE_SPIN`). It pauses while dragged and is
 *   off under reduced motion. It lives on its own group inside the tilt, so
 *   a tilt always leans the spinning logo the way you dragged.
 * - Transparent, and the canvas bleeds past the box (`bleed`) so a tilted
 *   corner never clips; the bleed is click-through.
 * - Three loads on demand, like the deck's paper. There is no flat fallback:
 *   until the first frame, and without WebGL, the box is empty.
 */

import { useEffect, useRef } from 'react';
import type * as THREE_NS from 'three';

/** The slow spin, in radians per second (~12.5s a turn). Positive turns the
 *  face left to right; make it negative for the other way. */
const IDLE_SPIN = 0.5;

export type ChromeLogoProps = {
  className?: string;
  /** 0 = mirror, higher = brushed/satin. */
  roughness?: number;
  /** Extrusion depth relative to the logo's height. */
  depth?: number;
  /** Max up/down tilt in radians while dragging (~43°). Across is free. */
  maxTilt?: number;
  /** Ease the up/down tilt back to level after release. */
  returnToRest?: boolean;
  /** Gentle idle float when not being dragged. */
  idle?: boolean;
  /** How far the canvas extends past the box on every side, as a fraction of its width. */
  bleed?: number;
};

export function ChromeLogo({
  className = '',
  roughness = 0.12,
  depth = 0.18,
  maxTilt = 0.75,
  returnToRest = true,
  idle = true,
  bleed = 0.35,
}: ChromeLogoProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const [THREE, { SVGLoader }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/SVGLoader.js'),
      ]);
      const svg = await new SVGLoader().loadAsync('/logo.svg');
      if (cancelled) return;

      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // no WebGL: no logo
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      const cs = canvas.style;
      cs.position = 'absolute';
      cs.pointerEvents = 'none'; // the bleed never blocks what's underneath
      mount.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(buildStudio(THREE), 0.02).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
      // Hard lights give the bevel crisp highlights.
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 3, 4);
      const rim = new THREE.DirectionalLight(0xffffff, 1.2);
      rim.position.set(-3, -1, -2);
      scene.add(key, rim);

      // ---------- geometry from the SVG ----------
      const shapes = svg.paths.flatMap((p) => p.toShapes());
      const flat = new THREE.ShapeGeometry(shapes);
      flat.computeBoundingBox();
      const svgW = flat.boundingBox!.max.x - flat.boundingBox!.min.x;
      const svgH = flat.boundingBox!.max.y - flat.boundingBox!.min.y;
      flat.dispose();

      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: svgH * depth,
        bevelEnabled: true,
        bevelThickness: svgH * 0.045,
        bevelSize: svgH * 0.03,
        bevelOffset: 0,
        bevelSegments: 8,
        curveSegments: 48,
      });
      geometry.center();
      const s = 4 / svgW; // 4 units wide
      geometry.scale(s, s, s);
      geometry.computeBoundingBox();

      // The tint is a token: `R G B` channels, sRGB.
      const [r, g, b] = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-chrome')
        .trim()
        .split(/\s+/)
        .map((n) => Number(n) / 255);
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setRGB(r ?? 1, g ?? 1, b ?? 1, THREE.SRGBColorSpace),
        metalness: 1,
        roughness,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.25,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = Math.PI; // SVG is y-down: stand it upright
      const spinner = new THREE.Group(); // the slow spin
      spinner.add(mesh);
      const pivot = new THREE.Group(); // the drag tilt and idle float
      pivot.add(spinner);
      scene.add(pivot);

      // ---------- fit the camera to the box ----------
      const logoW = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x;
      const logoH = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
      const fit = () => {
        const w = mount.clientWidth || 1;
        const h = mount.clientHeight || 1;
        // The bleed is a share of the WIDTH on every side: the logo is ~4×
        // wider than tall, so tilted it swings far past its own height —
        // a bleed sized from the height cut it off.
        const b = Math.round(bleed * w);
        const cw = w + 2 * b;
        const ch = h + 2 * b;
        cs.left = cs.top = `${-b}px`;
        cs.width = `${cw}px`;
        cs.height = `${ch}px`;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        // The logo fills the box (with 4% air); the rest of the canvas is bleed.
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const distH = (logoH * 1.04 * (ch / h)) / 2 / tan;
        const distW = (logoW * 1.04 * (cw / w)) / 2 / tan / camera.aspect;
        camera.position.set(0, 0, Math.max(distH, distW) + 0.3);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(mount);

      // ---------- drag ----------
      const target = { x: 0, y: 0 }; // the rotation being eased toward
      // Inertia after release, in radians per SECOND — measured from the
      // pointer's real speed and applied per frame with dt, so the throw is
      // the same whatever the display's refresh rate or the OS's pointer
      // event rate (a 120Hz Mac, X11/Wayland). Per-event deltas applied per
      // frame, as the original did, threw differently on every machine.
      const vel = { x: 0, y: 0 };
      // The original's 0.9-per-frame decay at 60fps, as a rate per second.
      const VEL_DECAY = -Math.log(0.9) * 60;
      let dragId: number | null = null;
      let last = { x: 0, y: 0, t: 0 };
      const sens = () => (Math.PI * 1.1) / Math.max(mount.clientWidth, 120);
      const clamp = THREE.MathUtils.clamp;

      const onDown = (e: PointerEvent) => {
        if (dragId !== null) return; // one pointer per drag
        // Primary button only: a right-click (ctrl-click on a Mac) or a
        // middle-click (paste on Linux) is not a drag.
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault(); // no text selection or native drag starting
        dragId = e.pointerId;
        last = { x: e.clientX, y: e.clientY, t: performance.now() };
        vel.x = vel.y = 0;
        try {
          mount.setPointerCapture(e.pointerId);
        } catch {
          // a pointer that is already gone can't be captured; the drag still works
        }
        mount.style.cursor = 'grabbing';
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerId !== dragId) return;
        const now = performance.now();
        const k = sens();
        const dy = (e.clientX - last.x) * k;
        const dx = (e.clientY - last.y) * k;
        target.y += dy; // across is free: it spins all the way round
        target.x = clamp(target.x + dx, -maxTilt, maxTilt);
        // Speed, smoothed: coalesced or bunched events can arrive a fraction
        // of a millisecond apart, and one alone would spike it.
        const sec = Math.max((now - last.t) / 1000, 1 / 240);
        vel.y += (dy / sec - vel.y) * 0.5;
        vel.x += (dx / sec - vel.x) * 0.5;
        last = { x: e.clientX, y: e.clientY, t: now };
      };
      const end = (e: PointerEvent) => {
        if (e.pointerId !== dragId) return;
        dragId = null;
        mount.style.cursor = '';
        // Held still before letting go: no throw.
        if (performance.now() - last.t > 80) vel.x = vel.y = 0;
      };
      // If the OS takes the pointer mid-drag (Cmd-Tab, a gesture, Safari
      // dropping capture) no pointerup ever comes, and the logo would stay
      // grabbed — not spinning, not settling. Losing capture ends the drag.
      const onBlur = () => {
        if (dragId === null) return;
        dragId = null;
        mount.style.cursor = '';
        vel.x = vel.y = 0;
      };
      // The deck's scroller (Lenis) reads touches off the whole window, so a
      // swipe on the logo would scroll the deck too. Keep them here.
      const keepTouch = (e: TouchEvent) => e.stopPropagation();
      mount.addEventListener('touchstart', keepTouch, { passive: true });
      mount.addEventListener('touchmove', keepTouch, { passive: true });
      mount.addEventListener('pointerdown', onDown);
      mount.addEventListener('pointermove', onMove);
      mount.addEventListener('pointerup', end);
      mount.addEventListener('pointercancel', end);
      mount.addEventListener('lostpointercapture', end);
      window.addEventListener('blur', onBlur);

      // ---------- loop ----------
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let prev = performance.now();
      const t0 = prev;
      let raf = 0;
      let visible = true;
      let floatMix = 0; // 0–1: the idle float fades in and out, never snaps
      const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
      io.observe(mount);

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const now = performance.now();
        const dt = Math.min((now - prev) / 1000, 0.05);
        prev = now;
        const t = (now - t0) / 1000;
        const dragging = dragId !== null;

        if (!dragging) {
          // inertia
          target.x = clamp(target.x + vel.x * dt, -maxTilt, maxTilt);
          target.y += vel.y * dt;
          const decay = Math.exp(-VEL_DECAY * dt);
          vel.x *= decay;
          vel.y *= decay;
          // spring back to rest
          if (returnToRest) {
            const back = 1 - Math.exp(-2.5 * dt);
            // Only the up/down tilt comes back. A spin across stays where
            // it's thrown — no face to return to, and no unwinding.
            target.x -= target.x * back;
          }
        }

        if (!dragging && !reduceMotion) spinner.rotation.y += IDLE_SPIN * dt;

        const float = idle && !dragging && !reduceMotion;
        floatMix += ((float ? 1 : 0) - floatMix) * (1 - Math.exp(-3 * dt));
        const ix = Math.sin(t * 0.9) * 0.06 * floatMix;
        const iy = Math.sin(t * 0.6) * 0.12 * floatMix;
        const follow = 1 - Math.exp(-14 * dt);
        pivot.rotation.x += (target.x + ix - pivot.rotation.x) * follow;
        pivot.rotation.y += (target.y + iy - pivot.rotation.y) * follow;

        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        mount.removeEventListener('touchstart', keepTouch);
        mount.removeEventListener('touchmove', keepTouch);
        mount.removeEventListener('pointerdown', onDown);
        mount.removeEventListener('pointermove', onMove);
        mount.removeEventListener('pointerup', end);
        mount.removeEventListener('pointercancel', end);
        mount.removeEventListener('lostpointercapture', end);
        window.removeEventListener('blur', onBlur);
        geometry.dispose();
        material.dispose();
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss(); // free the context now, not at GC
        canvas.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [roughness, depth, maxTilt, returnToRest, idle, bleed]);

  return (
    <div
      ref={mountRef}
      role="img"
      aria-label="couldbekush"
      className={`relative touch-none select-none cursor-grab pointer-events-auto ${className}`}
    />
  );
}

/** A photo studio: a dark room with bright softbox strips. High-contrast
 *  reflections are what make metal read as chrome rather than grey plastic. */
function buildStudio(THREE: typeof THREE_NS): THREE_NS.Scene {
  const scene = new THREE.Scene();

  // Room: bright sky → dark horizon → mid-grey floor.
  const roomGeo = new THREE.SphereGeometry(20, 64, 32);
  const pos = roomGeo.getAttribute('position');
  const cols: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20;
    const v = y > 0 ? 0.08 + Math.pow(y, 0.6) * 1.6 : 0.05 + Math.pow(-y, 0.8) * 0.45;
    cols.push(v, v, v * 1.02);
  }
  roomGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(roomGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  const light = (v: number) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), side: THREE.DoubleSide });

  // A big softbox behind the viewer with a crisp diagonal edge: the front face
  // reflects it, a bright/dark split that sweeps across as the logo tilts.
  const boxGeo = new THREE.PlaneGeometry(30, 30);
  boxGeo.translate(0, 15.15, 0);
  boxGeo.rotateZ(0.6);
  const box = new THREE.Mesh(boxGeo, light(1.7));
  box.position.z = 10;
  scene.add(box);

  const strip = (w: number, h: number, v: number, p: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), light(v));
    m.position.set(...p);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  strip(14, 2, 6, [0, 9, 2]); // top bar: the hot highlight on the upper bevels
  strip(1.5, 12, 5, [-9, 0, 2]); // left
  strip(1.5, 12, 4, [9, 0, 3]); // right
  strip(6, 6, 1.5, [0, 3, -10]); // back rim
  return scene;
}
