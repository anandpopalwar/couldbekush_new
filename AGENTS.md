# Project Knowledge: couldbekush Portfolio

## Overview
The portfolio of **couldbekush**, an independent designer working globally.
Selected work is presented as a vertical card deck the visitor scrolls through,
with the project's details either side of it on desktop or stacked beneath it on
phones. Content comes from Payload CMS.

(The design started from the HUYVU/huyml.co reference site; a few notes below
still cite it as the source of a layout decision.)

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **CMS**: Payload 3 (MongoDB), media on Vercel Blob
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.4
- **Animations**: GSAP 3.12
- **Icons**: Lucide React
- **Fonts**: Google Sans Flex (everything), Google Sans Code (the mono line)
- **Build**: PostCSS, Autoprefixer

## Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with fonts, metadata (no padding)
│   ├── page.tsx            # Main portfolio page (client component)
│   └── globals.css         # Global styles, 3D perspective, shadows
├── components/
│   ├── portfolio/
│   │   ├── TopHeader.tsx   # Brand mark, nav, audio toggle, inquiries
│   │   ├── LeftSidebar.tsx # Menu nav, project metadata, counter
│   │   ├── CardDeck.tsx    # Diagonal 3D card stack (superseded by CardDeck2)
│   │   ├── CardDeck2.tsx   # Vertical conveyor deck — the one in use
│   │   ├── PortfolioClient.tsx # Client shell: owns the deck position + input
│   │   ├── RightSidebar.tsx# Infinite scroll project list (center bold)
│   │   ├── MobileChrome.tsx# The stacked layout below 1100px
│   │   ├── MobileMenu.tsx  # Full-screen menu for that layout
│   │   ├── MenuToggle.tsx  # The two rules that morph into a cross
│   │   ├── ProjectModal.tsx# Full project detail modal
│   │   └── SectionModal.tsx# About, Playground, Contact modals
│   └── ui/
│       ├── GrainOverlay.tsx # Film grain texture overlay
│       └── Toast.tsx        # Toast notifications
├── data/
│   └── projects.ts         # 8 portfolio projects with metadata
├── hooks/
│   ├── useAudioFeedback.ts # Web Audio API paper flip sounds
│   └── useTransitionBlur.ts# Blur-while-moving, shared by sidebar + mobile
└── types/
    └── portfolio.ts        # Project & NavSection types
```

## Key Components

### CardDeck2.tsx (current deck)
The deck actually rendered by `PortfolioClient`. `CardDeck.tsx` is kept for
reference but is commented out.

- **Vertical, not diagonal**: every card sits at `x: 0` with no rotation. The
  selected card is on the exact vertical middle of the viewport.
- **Driven by a continuous position, not steps.** The deck's whole state is one
  float — `positionRef`, in card units, owned by `PortfolioClient`. An integer
  centres that card; 4.5 sits exactly between two. Input writes to it and the
  deck renders whatever it says, once per frame. There are no per-card tweens.
  That is what lets a scroll be *followed* as it happens and snapped only when
  it stops; a stepping model can never rest between two cards.
- **Conveyor, not carousel**: a short ring of slots around the rounded position,
  each keyed by its virtual index. Keys never repeat, so a card element is never
  reused for another position — no wrap, no teleport to catch when scrolling
  fast. Cards mount and unmount beyond the screen edge.
- **Slot geometry**: slot ±1 is parked with its centre on the viewport edge —
  half the card on screen, half cut off — so the distance is viewport-relative
  (`innerHeight / 2`), not a fixed pixel gap. Slot ±2 is a full card height
  beyond that, off screen, and is where cards mount and unmount.
- Centre card is `CENTER_SCALE` (1.3x); depth is carried by scale and a
  depth-of-field blur. The ramps (`SCALE_RAMP`, `OPACITY_RAMP`, `BLUR_RAMP`) are
  read at *fractional* distances, so a card halfway between slots is half-scaled
  and half-blurred. At whole numbers they give the resting values exactly.
- **The frame loop is written to do as little as possible**: it bails on an
  unchanged position, writes styles directly rather than through `gsap.set`,
  skips any property whose value hasn't changed, and caches the viewport height
  so it never reads `innerHeight`. Blur is numeric in `SlotPose` and rounded to
  0.1px — it's the most expensive property here and was being reassigned 60×/s
  with an identical value. `poseToTween()` converts a pose back to GSAP's shape;
  the intro is the only thing that needs it.
- **Intro, once per load**: the deck is set down as a loose hand-stacked pile
  (deterministic per-card jitter), squares up, then cards are flicked out one at
  a time with a spin that unwinds on landing, on an uneven dealer's rhythm
  (`INTRO_BEATS`). Respects `prefers-reduced-motion`. Queued intro tweens are
  killed explicitly if you scroll early — a delayed tween isn't "active", so
  GSAP's `overwrite: "auto"` won't catch it.
- Tunable constants live at the top of the file: `CENTER_SCALE`, `SLOT_NUDGE`,
  `OFFSCREEN_STEP`, `DURATION`/`EASE`, and the `INTRO_*` set.

### CardDeck.tsx (superseded)
- 3D card stack with perspective transforms (1400px perspective)
- GSAP-powered animations (rotation, scale, opacity)
- Pointer drag gestures for card navigation (45px threshold)
- Responsive: mobile uses 0.45x/0.75 factors
- Cards positioned using diff from currentIndex
- **Circular loop flow**: Visible arc (bottom→center→top) animates, invisible arc (top→bottom) instant/hidden
- Wrapping cards (abs(diff) > 3) use gsap.set() with opacity:0

#### Card Positions (diff-based)
| diff | Position | Scale | Rotation | rotateX | rotateY |
|------|----------|-------|----------|---------|---------|
| 0 | Center | 1.0 | 0° | 0° | 0° |
| -1 | Bottom-left | 1.02 | 6° | -16° | -24° |
| -2 | Bottom-left | 1.02 | 8° | -18° | -28° |
| -3 | Bottom-left | 1.02 | 10° | -20° | -32° |
| +1 | Top-right | 1.02 | 6° | 16° | 24° |
| +2 | Top-right | 0.936 | 8° | 18° | 28° |
| +3 | Top-right | 0.852 | 10° | 20° | 32° |

#### Card Flow (Circular Loop)
```
Visible Arc (top half): Bottom cards → Center → Top cards
Invisible Arc (bottom half): Top cards → Bottom cards (instant, opacity 0)
```

### RightSidebar.tsx
- Fixed track of `2*SLOT_RADIUS + 1` slots; a step relabels every slot and
  compensates the track so the picture is unchanged, then glides one card
  (0.38s). The track never scrolls more than one card, so a runaway sweep is
  structurally impossible.
- **Emphasis follows position, not selection.** A slot's colour, size, tracking
  and opacity are derived from its real distance from the viewport centre and
  repainted on every frame of the glide. A boolean `isCenter` can't work here:
  slots are relabeled the instant the selection changes, so the incoming card
  would be fully styled while still a whole slot away, and no element ever
  changes class so a CSS transition would never fire.
  - `slotEmphasis()` → 1 dead centre, 0 a full slot away; `CENTER_RAMP` is the
    exponent, i.e. how late the emphasis arrives (higher = later).
  - `slotFade()` is the old `0.52^d` falloff made continuous.
  - Both collapse to the previous values at rest, so nothing changes visually
    when the list is still.
  - Size and tracking interpolate in CSS against a `--u` custom property
    (`.rs-*` rules in globals.css); colour and opacity are written inline by the
    same pass. First render computes the rest values inline so SSR matches.
- Color swatches on active item

### LeftSidebar.tsx
- Navigation menu (WORK, ABOUT, PLAYGROUND, CONTACT)
- Project metadata grid (Role, Launch, Recognition)
- Large project counter — the number alone, centred on the **screen** via
  `left-0 w-screen flex justify-center` — the aside is only 3 of 12 columns but
  starts at the viewport edge. Never centre it with `-translate-x-1/2` or
  `position: fixed`: both create a stacking context, and the counter's
  `mix-blend-difference` would then blend against that instead of `main`'s
  background and the cards, rendering the number solid white.
- Its size, weight, width and optical size are all `--counter-*` tokens. Weight
  is set through `font-variation-settings` rather than a `font-*` class, since
  the design calls for 550 and Tailwind only offers 500 and 600.

### useAudioFeedback.ts
- Web Audio API synthesis
- Paper flip/page turn sounds
- Bandpass filtered noise + triangle oscillator
- Direction-aware frequency sweeps

## Design System

**Everything is tokenized. Never write a literal colour, size or family in a
component** — no `#hex`, no `rgb()`, no `text-[13px]`, no font name. Add the
token first, then use it. A value should be changeable in one place and land
across the whole project.

### Tokens
The source of truth is `:root` in `src/app/(frontend)/globals.css`.

- **Colours** are stored as raw `R G B` channels, not hex, so Tailwind's
  `<alpha-value>` keeps opacity modifiers working — `border-ink/10` compiles to
  `rgb(var(--color-ink) / 0.1)`. `tailwind.config.ts` maps every theme colour
  onto `rgb(var(--color-…) / <alpha-value>)`.
  - Surfaces: `canvas`, `canvasDeep`, `canvasDark`, `surface` (card back)
  - Text: `ink`, `inkMuted`, `inkSubtle`, `inkPlain` (list items off centre),
    `invert`
  - Accents: `accentDot`, `--color-grain`
- **In raw CSS**, wrap them: `rgb(var(--color-ink))`.
- **In JS**, read them rather than redeclaring — see `ramp()` in
  RightSidebar.tsx, which resolves `--color-ink` / `--color-ink-plain` with
  `getComputedStyle` for its colour interpolation.
- **`.page-canvas`** carries the page ground and is applied to both `body` and
  `main` (main needs its own copy for the counter's blend mode).
- **Text sizes are tokenized.** No `text-[Npx]` literals remain in components.
  Alongside the AlignUI scale there is a **micro** group — `text-micro-lg`
  (11px), `-md` (10), `-sm` (9), `-xs` (8) — for the chrome that sits below the
  sheet's smallest step: mono labels, the scroll hint, header meta. Those
  tokens carry weight 400 and no tracking deliberately, so the `font-bold` and
  `tracking-*` classes already on those elements still win.
- The scale's tracking values were measured for Inter and have not been
  re-checked against Google Sans Flex.

### Typography
**One typeface: Google Sans Flex.** Variable on six axes (`wght` 1–1000,
`opsz` 6–144, `wdth` 25–151, `GRAD`, `ROND`, `slnt`); `opsz` is requested
explicitly in `layout.tsx` because Google Fonts otherwise serves a weight-only
instance.

- `font-sans` and `font-mono` both resolve to it. `mono` is kept only because
  ~26 places still say `font-mono` for small tracked labels.
- `html` sets `font-optical-sizing: auto`, so the optical size tracks the
  rendered font-size. Do **not** pin `font-variation-settings: "opsz" N`
  globally — the axis range is 6–144 here, so a fixed value silently forces the
  wrong cut on everything.
- `.font-display` (opsz 48) / `.font-text` (opsz 18) override it where automatic
  sizing picks the wrong cut.

Scale from the AlignUI "Typography [Overview]" sheet, defined as Tailwind
`fontSize` tokens — each token already carries size, line height, tracking and
weight, so one `text-*` class is the whole style.

| Token | Size/Leading | Tracking | Weight |
|-------|--------------|----------|--------|
| `text-title-h1` … `h3` | 56/64, 48/56, 40/48 | -1% | 500 |
| `text-title-h4` | 32/40 | -0.5% | 500 |
| `text-title-h5`, `h6` | 24/32, 20/28 | 0 | 500 |
| `text-label-xl` … `xs` | 24/32, 18/24, 16/24, 14/20, 12/16 | -1.5%, -1.5%, -1.1%, -0.6%, 0 | 500 |
| `text-paragraph-xl` … `xs` | same sizes as labels | same as labels | 400 |
| `text-subheading-md` … `2xs` | 16/24, 14/20, 12/16, 11/12 | 6%, 6%, 4%, 2% | 500 |
| `text-doc-label` / `text-doc-paragraph` | 18/32 | -1.5% | 500 / 400 |

- Titles pair with `font-display`; subheadings are drawn for `uppercase`.

### Layout breakpoints
Named screens in `tailwind.config.ts`, matching the reference site's page
variants. Added **alongside** Tailwind's defaults, which still work.

| Prefix | Range | Notes |
|--------|-------|-------|
| (none) | 0–1099 | mobile / small |
| `compact:` | 1100–1199 | |
| `desktop:` | 1200–1439 | |
| `wide:` | 1440–2399 | the primary design target |
| `ultra:` | 2400+ | |

They live in the config, not as CSS tokens, because a media query cannot read a
custom property.

Below `compact` the whole layout changes: both sidebars are hidden and
`MobileChrome` renders the stacked variant instead — deck, project detail
beneath it, page number under the menu button. The header's contact line also
collapses to a paper-plane icon there.

Typography breakpoints on the reference use different boundaries again
(display 23/29/40/60px stepping at 1200/1440/1920; body at 1100/1800). Not
adopted — recorded here in case it comes up.

### Interactions
Constants live at the top of `PortfolioClient.tsx`. `SCROLL_MODEL` picks between
two implementations, both present in the file:

- **`'follow'` (in use)** — the wheel moves the position directly
  (`WHEEL_TRAVEL_PER_CARD`, 140px per card) and the deck settles onto the
  nearest card once the wheel is quiet for `WHEEL_SETTLE_MS` (70ms), easing over
  `SNAP_DURATION` (0.32s). There is no threshold and no lock: inertia simply
  keeps moving the deck, as a native scroll would, instead of being something to
  tell apart from intent. Snappiness lives in the settle timings, not in
  `WHEEL_TRAVEL_PER_CARD` — that governs the hand-to-card mapping.
- **`'step'`** — the earlier model: measure a gesture, jump a whole number of
  cards, then ignore input briefly to swallow inertia. Fine on a mouse wheel,
  mechanical on a trackpad. Kept for comparison.
- **Drag** is direct manipulation too — the card follows the pointer at
  `DRAG_TRAVEL_PER_CARD` (220px per card) and settles on release.
- **All three inputs must agree on direction.** Scrolling down, dragging up and
  Arrow Down all go to `position - 1`, which brings the card below up into
  centre. The arrows were once mapped the other way and fought the deck.
- Keyboard: arrows and space, rate-limited by `STEP_COOLDOWN_MS`.

## Projects Data
8 portfolio projects (IDs 01-08):
| ID | Title | Category |
|----|-------|----------|
| 01 | FROMANOTHER | Agency & Studio |
| 02 | IVENTIONS | Promotional |
| 03 | DAFI TROPICDANE | Furniture & Interior |
| 04 | DISTRICT2 STUDIO | Agency & Studio |
| 05 | EST POPULO | Brand Experience |
| 06 | BISON STUDIO | Architectural Studio |
| 07 | WON J. YOU STUDIOS | Design Leadership |
| 08 | MUX STUDIO | Digital Agency |

Each project has: id, title, subtitle, category, description, role, launch, recognition[], image, optional (client, techStack, liveUrl, overview, gallery[])

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Browser Support
- Modern browsers with ES2020+
- WebGL for potential future features
- Web Audio API for sound effects
- CSS 3D transforms for card deck

## Performance Notes
- Images use Next.js Image component with sizes prop
- GSAP animations use will-change and transform
- Lazy loading for non-priority images
- Virtual scrolling for infinite list (RightSidebar)
- Body has no padding (p-0) for edge-to-edge cards

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
