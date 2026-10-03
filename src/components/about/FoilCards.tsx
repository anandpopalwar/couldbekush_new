'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FOIL_CARDS, cardFontsReady } from '@/lib/foilCards';
import { drawnCard, flat, uploadedCard } from '@/lib/foilLayers';
import type { FoilCardScene, FoilLayout, FoilSceneFrame } from '@/lib/foilCardScene';
import type { MagazineData } from '@/types/magazines';
import { useTransitionBlur } from '@/hooks/useTransitionBlur';

/**
 * The About page: the magazines — hot-foil cards — on a diagonal track, and
 * the front one's details laid over it.
 *
 * They come from the CMS, as image layers (see lib/foilLayers.ts); with none
 * published, the five built-in ones, drawn in code, stand in.
 *
 * Two layers. The stage fills the page and holds the track — drawn by
 * lib/foilCardScene.ts, which appends its own canvas and runs its own loop.
 * Over it sits the UI, click-through: one note centred under the front card
 * saying what it is, and nothing else. There are no buttons — the track is
 * moved by the wheel, a drag or the arrow keys, and the front card opens on a
 * tap. This component labels itself from what the scene reports back, and
 * measures where the UI leaves room, since the scene frames the front card in
 * that space.
 *
 * Where WebGL isn't available the front card is drawn flat instead.
 */

// Texture width for the 3D cards — all five are on the track at once.
const TEXTURE_WIDTH = 768;
// The flat stand-in for the track, px wide.
const FLAT_WIDTH = 640;
// Room left around the front card, px: under the top UI, and between an open
// card and the screen's edge.
const BAND_CLEAR = 6;
const EDGE_CLEAR = 10;

const MICRO_LABEL = 'font-mono text-micro-md tracking-widest uppercase';
// The note's main line. The line height is marked important: a text-* token
// inside a breakpoint carries its own and would beat a plain leading-* class.
const NOTE_TEXT =
  'font-display text-label-md compact:text-title-h5 wide:text-title-h4 [@media(max-height:640px)]:text-title-h6 uppercase !leading-none tracking-tight text-balance';


export function FoilCards({ magazines }: { magazines: MagazineData[] }) {
  // Magazines whose layers would not load are left off the track, by name.
  const [skipped, setSkipped] = useState<string[]>([]);
  // The CMS's magazines, or the built-in ones if there are none to show.
  const cards = useMemo(() => {
    const uploaded = magazines.filter((magazine) => !skipped.includes(magazine.name));
    return uploaded.length ? uploaded.map(uploadedCard) : FOIL_CARDS.map(drawnCard);
  }, [magazines, skipped]);

  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  // 'pressing' until the front card is up; 'flat' where there is no WebGL.
  const [mode, setMode] = useState<'pressing' | 'lit' | 'flat'>('pressing');
  // The lettering's face has loaded, so a flat render can be drawn.
  const [lettered, setLettered] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLSpanElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FoilCardScene | null>(null);
  const indexRef = useRef(0);

  const show = useCallback((next: number, nextOpen: boolean) => {
    if (next !== indexRef.current) {
      indexRef.current = next;
      setIndex(next);
    }
    setOpen(nextOpen);
  }, []);

  // Where the UI leaves room for the front card. Read from layout boxes
  // (offset*), which a transform on an ancestor can't shift.
  const measure = useCallback((): FoilSceneFrame => {
    const stage = stageRef.current;
    const top = topRef.current;
    const notes = notesRef.current;
    if (!stage || !top || !notes) {
      return { top: 0, bottom: window.innerHeight, room: window.innerWidth / 2, layout: 'phone' };
    }
    return {
      // The marker's classes set --layout per breakpoint, so the breakpoints
      // themselves aren't repeated here.
      layout: (getComputedStyle(top).getPropertyValue('--layout').trim() || 'wide') as FoilLayout,
      top: top.offsetTop + BAND_CLEAR,
      bottom: notes.offsetTop,
      room: stage.clientWidth / 2 - EDGE_CLEAR,
    };
  }, []);

  // Bring the scene up, client-side, once the lettering can be drawn.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cancelled = false;
    let scene: FoilCardScene | null = null;
    // A shorter track than the last one: start it from the first magazine.
    if (indexRef.current >= cards.length) {
      indexRef.current = 0;
      setIndex(0);
    }
    setMode('pressing');

    (async () => {
      await cardFontsReady();
      if (cancelled) return;
      setLettered(true);

      const { FoilCardScene } = await import('@/lib/foilCardScene');
      const created = await FoilCardScene.create(stage, {
        cards,
        index: indexRef.current,
        textureWidth: TEXTURE_WIDTH,
        frame: measure,
        onState: (state) => show(state.index, state.open),
        onReady: () => setMode('lit'),
        // The track is rebuilt without it.
        onSkip: (skip) => setSkipped((names) => [...names, cards[skip].name]),
      });
      if (cancelled) {
        created?.dispose();
        return;
      }
      scene = created;
      sceneRef.current = created;
      if (!created) setMode('flat');
    })().catch(() => {
      if (!cancelled) setMode('flat');
    });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      scene?.dispose();
    };
  }, [cards, measure, show]);

  const toggleOpen = useCallback(() => {
    const scene = sceneRef.current;
    if (scene) scene.toggleOpen();
    else setOpen((was) => !was);
  }, []);

  // The arrows walk the track from anywhere on the page; Escape closes.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const scene = sceneRef.current;
      if (e.key === 'Escape') {
        if (scene) scene.close();
        else setOpen(false);
        return;
      }
      const forward = e.key === 'ArrowRight' || e.key === 'ArrowUp';
      const back = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
      if (!forward && !back) return;
      e.preventDefault();
      const direction = forward ? 1 : -1;
      if (scene) scene.stepBy(direction);
      else show((indexRef.current + direction + cards.length) % cards.length, false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cards, show]);

  // Without WebGL the stage shows the front card flat — its cover, or its inside.
  useEffect(() => {
    const canvas = flatRef.current;
    if (mode !== 'flat' || !lettered || !canvas) return;
    let stale = false;
    flat(cards[index] ?? cards[0], FLAT_WIDTH, open ? 'inside' : 'front')
      .then((drawn) => {
        if (stale) return;
        canvas.width = drawn.width;
        canvas.height = drawn.height;
        canvas.getContext('2d')?.drawImage(drawn, 0, 0);
      })
      // A layer that won't load leaves the stand-in blank; the 3D path, which
      // can drop the magazine, isn't running here.
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [mode, lettered, cards, index, open]);

  const card = cards[index] ?? cards[0];
  // The note blurs while the track moves between magazines and sharpens once
  // it settles — the same blink as the deck's text, from the same hook.
  const blurRef = useTransitionBlur(card.name);

  return (
    <>
      {/* touch-none: there is nothing to scroll here, and a drag in any
          direction moves the track. A tap, or Enter, opens the front card —
          there is no button for it. */}
      <div
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-label="Magazine track. Scroll, drag or use the arrow keys to browse; press Enter to open the front magazine."
        data-source={cards.length && magazines.length && skipped.length < magazines.length ? 'cms' : 'built-in'}
        onClick={(e) => {
          // Only the flat stand-in: on the track the scene resolves its own taps.
          if (mode === 'flat' && e.target === flatRef.current) toggleOpen();
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          toggleOpen();
        }}
        className="about-stage absolute inset-0 touch-none cursor-grab active:cursor-grabbing outline-none focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ink"
      >
        {mode === 'flat' && (
          <canvas
            ref={flatRef}
            role="img"
            aria-label={`${card.name}, ${open ? `inside: “${card.insideMessage}”` : 'front'}`}
            className="card-edge absolute left-1/2 top-[46%] h-[min(54vh,520px)] w-auto max-w-[80%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] cursor-pointer"
          />
        )}
      </div>

      <div className="about-ui absolute inset-0 pointer-events-none">
        {/* The line the front card is framed under, and which layout this is:
            a phone's carousel up to 760px, the stacked track from there to
            compact, the wide one beyond. The line is under the site's own
            brand and menu button until compact, a little higher after.
            Nothing is drawn. */}
        <span
          ref={topRef}
          aria-hidden
          className="about-top absolute left-0 top-16 [--layout:phone] min-[761px]:[--layout:stacked] compact:top-12 compact:[--layout:wide]"
        />

        {/* One note, centred under the front card: its foil and stock, its
            name, its finish. Every line is short enough to stay on one line,
            so the block keeps its height from card to card and doesn't move.
            It blurs as another card arrives (useTransitionBlur). */}
        <div
          ref={notesRef}
          aria-live="polite"
          className="about-notes absolute left-1/2 -translate-x-1/2 bottom-[34px] w-[calc(100%_-_2rem)] compact:bottom-[clamp(26px,5vh,54px)] compact:w-[min(860px,calc(100%_-_3rem))]"
        >
          <div ref={blurRef} className="grid justify-items-center gap-y-2 text-center">
 
            <span className={MICRO_LABEL}>
              {card.foilName} on {card.stockShort}
            </span>
            <h1 className={NOTE_TEXT}>{card.name}</h1>
            <p className="text-paragraph-xs compact:text-paragraph-sm text-inkMuted">{card.finish}</p>
          </div>
        </div>

        {mode === 'pressing' && (
          <p className={`absolute inset-0 grid place-items-center text-inkMuted ${MICRO_LABEL}`}>
            Pressing foil…
          </p>
        )}
      </div>
    </>
  );
}
