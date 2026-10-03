'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FOIL_CARDS, cardFontsReady, flat } from '@/lib/foilCards';
import type { FoilCardScene } from '@/lib/foilCardScene';

/**
 * The About page's card viewer: a folded hot-foil card on a table, a rack of
 * the others beneath it, and the selected card's details beside it.
 *
 * Renders two grid items for the page to place — the stage column and the
 * details. The card itself is lib/foilCardScene.ts, which appends its own
 * canvas to the stage and runs its own loop; this component only tells it
 * what was asked for and labels the buttons from what it reports back. Where
 * WebGL isn't available the same designs are drawn flat instead, and
 * everything but turning the card over still works.
 */

// Texture width for the 3D card. A phone shows it smaller and bakes it slower.
const TEXTURE_WIDTH = { fine: 1024, coarse: 768 };
// The rack's thumbnails are drawn at twice the 46 × 64 they're shown at.
const THUMB_WIDTH = 92;
const THUMB_HEIGHT = 128;
// The flat stand-in for the stage, px wide.
const FLAT_WIDTH = 640;

const RULED_ROW = 'flex justify-between items-start gap-x-3 border-t border-ink py-2';
const MICRO_LABEL = 'font-mono text-micro-md tracking-widest uppercase';

const pad = (n: number) => String(n).padStart(2, '0');

export function FoilCards() {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [turned, setTurned] = useState(false);
  // 'pressing' until the first card is up; 'flat' where there is no WebGL.
  const [mode, setMode] = useState<'pressing' | 'lit' | 'flat'>('pressing');
  // The lettering's faces have loaded, so the flat renders can be drawn.
  const [lettered, setLettered] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef<HTMLCanvasElement>(null);
  const thumbsRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const sceneRef = useRef<FoilCardScene | null>(null);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Bring the scene up, client-side, once the lettering can be drawn.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cancelled = false;
    let scene: FoilCardScene | null = null;

    (async () => {
      await cardFontsReady();
      if (cancelled) return;
      setLettered(true);

      const tokens = getComputedStyle(document.documentElement);
      const { FoilCardScene } = await import('@/lib/foilCardScene');
      const created = await FoilCardScene.create(stage, {
        cards: FOIL_CARDS,
        index: indexRef.current,
        textureWidth: window.matchMedia('(pointer: coarse)').matches
          ? TEXTURE_WIDTH.coarse
          : TEXTURE_WIDTH.fine,
        shadow: tokens.getPropertyValue('--color-shadow'),
        shadowStrength: Number(tokens.getPropertyValue('--card-shadow-strength')) || 1,
        onState: (state) => {
          setIndex(state.index);
          setOpen(state.open);
          setTurned(state.turned);
        },
        onReady: () => setMode('lit'),
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
  }, []);

  const select = useCallback((next: number, dir: 1 | -1) => {
    const count = FOIL_CARDS.length;
    const i = ((next % count) + count) % count;
    const scene = sceneRef.current;
    if (scene) {
      scene.select(i, dir);
      return;
    }
    setIndex(i);
    setOpen(false);
  }, []);

  const toggleOpen = useCallback(() => {
    const scene = sceneRef.current;
    if (scene) scene.toggleOpen();
    else setOpen((was) => !was);
  }, []);

  // Left and right walk the rack from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      select(indexRef.current + dir, dir);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [select]);

  // The rack's thumbnails, once.
  useEffect(() => {
    if (!lettered) return;
    FOIL_CARDS.forEach((card, i) => {
      thumbsRef.current[i]?.getContext('2d')?.drawImage(flat(card, THUMB_WIDTH, 'front'), 0, 0);
    });
  }, [lettered]);

  // Without WebGL the stage shows the card flat — its cover, or its inside.
  useEffect(() => {
    const canvas = flatRef.current;
    if (mode !== 'flat' || !lettered || !canvas) return;
    const drawn = flat(FOIL_CARDS[index], FLAT_WIDTH, open ? 'inside' : 'front');
    canvas.width = drawn.width;
    canvas.height = drawn.height;
    canvas.getContext('2d')?.drawImage(drawn, 0, 0);
  }, [mode, lettered, index, open]);

  const card = FOIL_CARDS[index];
  const specs: [string, React.ReactNode][] = [
    ['Stock', card.stockName],
    [
      'Foil',
      <>
        <span
          aria-hidden
          className="inline-block w-3.5 h-3.5 rounded-[3px] mr-2 align-[-3px]"
          style={{ backgroundImage: `linear-gradient(135deg, ${card.grad.join(',')})` }}
        />
        {card.foilName}, hot-foil stamped
      </>,
    ],
    ['Size', '5 × 7 in, folded'],
    ['Finish', card.finish],
    ['Inside', card.foilMessage ? 'Message in foil' : 'Message in ink'],
    ['Envelope', card.envelope],
  ];

  return (
    <>
      <section className="about-stage-column flex flex-col min-w-0 min-h-0 compact:col-start-4 compact:col-span-6 compact:row-start-1 compact:h-full">
        {/* pan-y: a sideways drag turns the card, an up-and-down one still
            scrolls the page on a phone. */}
        <div
          ref={stageRef}
          tabIndex={0}
          role="group"
          aria-label="Card viewer. Press Enter to open or close the card."
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            toggleOpen();
          }}
          className="about-stage relative h-[min(60svh,540px)] min-h-[320px] compact:h-auto compact:min-h-0 compact:flex-1 cursor-grab active:cursor-grabbing [touch-action:pan-y] outline-none focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ink"
        >
          {mode === 'pressing' && (
            <p className={`absolute inset-0 grid place-items-center pointer-events-none text-inkMuted ${MICRO_LABEL}`}>
              Pressing foil…
            </p>
          )}
          {mode === 'flat' && (
            <canvas
              ref={flatRef}
              role="img"
              aria-label={`${card.name}, ${open ? 'inside' : 'front'}`}
              className="card-edge absolute inset-0 m-auto max-w-[82%] max-h-[82%]"
            />
          )}
        </div>

        <p className={`about-hint px-6 text-center text-inkMuted ${MICRO_LABEL}`}>
          {mode === 'flat'
            ? 'Use the arrows to browse · Open card shows the inside'
            : 'Move to catch the light · Drag to turn · Tap the card to open it'}
        </p>

        <nav
          aria-label="Choose a card"
          className="about-rack flex items-center justify-center gap-x-2.5 min-w-0 pt-4 pb-2 compact:pb-6"
        >
          <button
            type="button"
            aria-label="Previous card"
            onClick={() => select(index - 1, -1)}
            className="grid place-items-center flex-none w-9 h-9 rounded-full border border-ink/20 text-label-md text-ink hover:border-ink transition-colors"
          >
            ←
          </button>
          <div className="no-scrollbar flex gap-x-3.5 min-w-0 overflow-x-auto px-1 py-2">
            {FOIL_CARDS.map((item, i) => {
              const active = i === index;
              return (
                <button
                  key={item.name}
                  type="button"
                  aria-label={item.name}
                  aria-pressed={active}
                  onClick={() => select(i, i > index ? 1 : -1)}
                  className="group grid justify-items-center gap-y-2 flex-none px-1.5 py-1"
                >
                  <canvas
                    ref={(el) => {
                      thumbsRef.current[i] = el;
                    }}
                    width={THUMB_WIDTH}
                    height={THUMB_HEIGHT}
                    style={{ backgroundColor: item.stock }}
                    className={`card-edge block w-[46px] h-[64px] transition-transform duration-200 group-hover:-translate-y-0.5 ${
                      active ? 'outline outline-1 outline-offset-4 outline-ink' : ''
                    }`}
                  />
                  <span className={`whitespace-nowrap ${MICRO_LABEL} ${active ? 'text-ink' : 'text-inkMuted'}`}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Next card"
            onClick={() => select(index + 1, 1)}
            className="grid place-items-center flex-none w-9 h-9 rounded-full border border-ink/20 text-label-md text-ink hover:border-ink transition-colors"
          >
            →
          </button>
        </nav>
      </section>

      {/* The selected card. Ruled like the deck's Role / Launch block: a rule
          over each row, label on the left, value on the right. */}
      <aside
        aria-live="polite"
        className="about-dossier flex flex-col gap-y-4 min-w-0 compact:col-start-10 compact:col-span-3 compact:row-start-1 compact:self-center compact:pr-9"
      >
        <p className={`text-inkMuted tabular-nums ${MICRO_LABEL}`}>
          Gildfold · No. {pad(index + 1)} of {pad(FOIL_CARDS.length)}
        </p>
        <h2 className="font-display text-title-h4 wide:text-title-h3 uppercase">{card.name}</h2>
        <p className="text-paragraph-sm text-inkMuted max-w-[40ch]">{card.desc}</p>

        <dl className="flex flex-col border-b border-ink">
          {specs.map(([label, value]) => (
            <div key={label} className={RULED_ROW}>
              <dt className="text-label-xs text-inkMuted">{label}</dt>
              <dd className="text-label-xs text-ink min-w-0 text-right">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={toggleOpen}
            className="min-w-[8.5em] px-4 py-3 rounded-sm border border-ink bg-ink text-label-sm text-canvas hover:opacity-80 transition-opacity"
          >
            {open ? 'Close card' : 'Open card'}
          </button>
          {mode !== 'flat' && (
            <button
              type="button"
              onClick={() => sceneRef.current?.turnOver()}
              className="px-4 py-3 rounded-sm border border-ink text-label-sm text-ink hover:opacity-60 transition-opacity"
            >
              {turned ? 'Turn back' : 'Turn over'}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
