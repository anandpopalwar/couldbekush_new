'use client';

/**
 * The couldbekush logo in 3D chrome — the header's brand mark.
 *
 * - `public/logo.svg` extruded into a bevelled mesh, mirror chrome lit by a
 *   studio built in code (no HDR file), tinted by `--color-chrome`.
 * - Drag to tilt it on X and Y; it carries on with inertia and eases back to
 *   face front. A gentle idle float, off under reduced motion.
 * - Transparent, and the canvas bleeds past the box (`bleed`) so a tilted
 *   corner never clips; the bleed is click-through.
 * - Three loads on demand, like the deck's paper. Until the first frame, and
 *   without WebGL, the flat logo stands in, painted in `--color-ink`.
 */

import { useEffect, useRef, useState } from 'react';
import type * as THREE_NS from 'three';

export type ChromeLogoProps = {
  className?: string;
  /** 0 = mirror, higher = brushed/satin. */
  roughness?: number;
  /** Extrusion depth relative to the logo's height. */
  depth?: number;
  /** Max tilt in radians while dragging, per axis (~43°). */
  maxTilt?: number;
  /** Ease back to face front after release. */
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
  // The flat logo shows until the chrome has drawn, and stays without WebGL.
  const [drawn, setDrawn] = useState(false);

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
        return; // no WebGL: the flat logo stays
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
      const pivot = new THREE.Group();
      pivot.add(mesh);
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
      const target = { x: 0, y: 0 };
      const vel = { x: 0, y: 0 };
      let dragId: number | null = null;
      let last = { x: 0, y: 0 };
      const sens = () => (Math.PI * 1.1) / Math.max(mount.clientWidth, 120);
      const clamp = THREE.MathUtils.clamp;

      const onDown = (e: PointerEvent) => {
        if (dragId !== null) return; // one pointer per drag
        dragId = e.pointerId;
        last = { x: e.clientX, y: e.clientY };
        vel.x = vel.y = 0;
        mount.setPointerCapture(e.pointerId);
        mount.style.cursor = 'grabbing';
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerId !== dragId) return;
        const k = sens();
        vel.y = (e.clientX - last.x) * k;
        vel.x = (e.clientY - last.y) * k;
        last = { x: e.clientX, y: e.clientY };
        target.y = clamp(target.y + vel.y, -maxTilt, maxTilt);
        target.x = clamp(target.x + vel.x, -maxTilt, maxTilt);
      };
      const onUp = (e: PointerEvent) => {
        if (e.pointerId !== dragId) return;
        dragId = null;
        mount.style.cursor = '';
      };
      mount.addEventListener('pointerdown', onDown);
      mount.addEventListener('pointermove', onMove);
      mount.addEventListener('pointerup', onUp);
      mount.addEventListener('pointercancel', onUp);

      // ---------- loop ----------
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let prev = performance.now();
      const t0 = prev;
      let raf = 0;
      let visible = true;
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
          target.x = clamp(target.x + vel.x, -maxTilt, maxTilt);
          target.y = clamp(target.y + vel.y, -maxTilt, maxTilt);
          vel.x *= 0.9;
          vel.y *= 0.9;
          if (returnToRest) {
            const back = 1 - Math.exp(-2.5 * dt);
            target.x -= target.x * back;
            target.y -= target.y * back;
          }
        }

        const float = idle && !dragging && !reduceMotion;
        const ix = float ? Math.sin(t * 0.9) * 0.06 : 0;
        const iy = float ? Math.sin(t * 0.6) * 0.12 : 0;
        const follow = 1 - Math.exp(-14 * dt);
        pivot.rotation.x += (target.x + ix - pivot.rotation.x) * follow;
        pivot.rotation.y += (target.y + iy - pivot.rotation.y) * follow;

        renderer.render(scene, camera);
      };
      tick();
      setDrawn(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        mount.removeEventListener('pointerdown', onDown);
        mount.removeEventListener('pointermove', onMove);
        mount.removeEventListener('pointerup', onUp);
        mount.removeEventListener('pointercancel', onUp);
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
    >
      {!drawn && (
        <span className="absolute inset-0 bg-ink [mask:url(/logo.svg)_center/contain_no-repeat]" />
      )}
    </div>
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
