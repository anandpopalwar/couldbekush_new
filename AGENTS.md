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
- **WebGL**: Three.js — the deck's cards as paper, loaded on demand
- **Smooth scrolling**: Lenis 1.3 (the home deck's input — see Interactions)
- **Icons**: Lucide React
- **Fonts**: Google Sans Flex (everything), Google Sans Code (the mono line)
- **Build**: PostCSS, Autoprefixer

## Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with fonts, metadata (no padding)
│   ├── page.tsx            # Main portfolio page (client component)
│   ├── template.tsx        # The route transition, both halves — useRouteSlide()
│   ├── project/[slug]/     # The case study page
│   └── globals.css         # Global styles, 3D perspective, shadows
├── components/
│   ├── transition/
│   │   └── SlideLink.tsx   # Anchor that navigates through the slide
│   ├── portfolio/
│   │   ├── ProjectChrome.tsx # The site's furniture on a case study
│   │   ├── HeavyScroll.tsx # Weighted scroller; publishes the two fade vars
│   │   ├── PageEnter.tsx   # Step 4 of the transition — the arrival bounce
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
├── lib/
│   ├── routeTransition.ts  # Carries the destination name across the boundary
│   ├── magazinePaper.ts    # The deck's shared WebGL paper renderer
│   └── magazinePaperShader.ts # Its GLSL: flex, coat, shadow
├── hooks/
│   ├── useAudioFeedback.ts # Web Audio API paper flip sounds
│   ├── useDeckScroll.ts    # Lenis-driven wheel/touch/drag + snapping for the deck
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
  `useDeckScroll` is what writes it — see Interactions.
  That is what lets a scroll be *followed* as it happens and snapped only when
  it stops; a stepping model can never rest between two cards.
- **Conveyor, not carousel**: a short ring of slots around the rounded position,
  each keyed by its virtual index. Keys never repeat, so a card element is never
  reused for another position — no wrap, no teleport to catch when scrolling
  fast. Cards mount and unmount beyond the screen edge.
- **Slot geometry**: slot ±1 is parked with its centre on the viewport edge,
  pushed out by `SLOT_NUDGE` × the card's height (0.165 — 60px on the 366px
  desktop card) so the gap to the centre card keeps its proportion on every
  screen; the distance is viewport-relative (`innerHeight / 2`), not a fixed
  pixel gap. The intro is a layout effect that runs before `measure()`, so it
  reads the card's height itself. Slot ±2 is a full card height
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
  GSAP's `overwrite: "auto"` won't catch it. An interrupted intro doesn't cut
  to the live poses: `endIntro()` reads each card's pose back out of gsap and
  the frame loop blends from there over `HANDOVER_MS`.
- **Cards are placed once.** The card refs are inline, so React detaches and
  re-attaches them on every render; `placedRef` makes sure only a newly mounted
  card gets `placeCard()`, which would otherwise stamp the live pose over a
  blend for a frame.
- **Cursor tilt** — the whole stack leans toward the pointer anywhere over
  `deck-stage`, not only over the centre card — up to `TILT_MAX_Y` (4°,
  left/right) and `TILT_MAX_X` (3.5°, up/down) at the section's edge, eased
  with `gsap.quickTo`. Small on purpose: a magazine turned in the hand, not a
  trading card. It sets the viewing angle the paper's reflections answer,
  never the light. The frame carries its own `TILT_PERSPECTIVE` (1100px) —
  also where the paper's eye is. It rotates `deck-frame`, never the cards: the
  frame loop owns every card's transform and would overwrite it. Mouse and
  pen only, off under reduced motion. The return to flat goes through the same
  quickTo — overwriting it with a separate tween leaves quickTo driving a dead
  tween.
- **Two layers, one job each.** The DOM is the carousel — every card is an
  element the deck places, scales, blurs, fades and deals. What a card
  *shows* is a sheet of paper drawn in WebGL by `lib/magazinePaper.ts` into
  `<canvas data-paper-canvas>` inside it. Until that sheet has been drawn, or
  without WebGL 2 (or on a lost context), the card shows its DOM face
  (`[data-face]`: the image, the scrim and `.card-paper`'s static finish).
  `data-paper` on the card is the switch, set only after a successful draw,
  so there's never a blank frame. There is no CSS bend any more.
- **One renderer for the whole deck.** Offscreen, one geometry, two materials
  (printed face, underside) sharing one uniform set, a shadow material, and a
  texture per project. Drawing a card sets its uniforms, renders, and copies
  into its canvas in the same task. The canvas inherits every transform the
  deck gives the card, so it's aligned by construction — never position it
  beyond the margins the renderer reports (`paper.margins`, for the curl's
  room and the shadow). Cards past `PAPER_RADIUS` hand their canvas back;
  past `PAPER_SHARP_RADIUS` (blurred anyway) they draw at half resolution.
  - The camera is an **off-axis frustum through the canvas's rectangle**, from
    where the page's eye really is relative to this card — so the flat sheet
    maps exactly onto the canvas and only relief moves off it.
  - Artwork loads through `/_next/image` (same-origin, no CORS), as an sRGB
    texture, clamped, mipmapped, anisotropic, object-cover cropped in the
    shader. The scrim (`from-black/70 … to-black/20`) is mixed in sRGB like
    the CSS gradient it replaces, so a flat card is pixel-for-pixel its
    artwork plus the coat.
  - The paper loop is a ticker callback registered *after* the frame loop, so
    it draws this frame's positions and curl, and it only draws when a card's
    offset, the tilt, the curl or the hover zoom changed. The centre card's
    hover zoom lives here now (`HOVER_ZOOM`).
  - `dispose()` forces a context loss; the lost handler ignores it, or
    StrictMode's discarded instance would switch the live one off.
- **Paper flex** — while the deck moves, the sheets flex like paper pushed
  through air. The frame loop measures the deck's speed from `positionRef`
  and a curl chases it through a spring (`BEND_STIFFNESS` / `BEND_DAMPING`,
  ζ≈0.6 — one small flick past flat, no wobble), capped at `BEND_MAX`, weaker
  for touch (`BEND_TOUCH_SCALE`), zero under reduced motion; only cards within
  `BEND_RADIUS` flex. The shape is the vertex shader's
  (`lib/magazinePaperShader.ts`): the trailing edge curls back with the curl
  growing as distance² from the leading edge — integrated along the sheet so
  it keeps its length — the leading edge runs ahead (`BEND_LEAD`), the sheet
  bows slightly across its width and a faint ripple runs down the curl. At
  rest the geometry is exactly flat. Scroll down → the bottom edges curl.
  - **Thickness** is an underside sheet one paper-thickness behind the face,
    in the stock colour, that only exists while the sheet bends — flat, it
    would peek past the face as a hairline on the off-centre cards. It's
    polygon-offset back and the depth range hugs the card; with a near plane
    at 1px it fought the face in white shards.
  - **Never clamp the curl's arc length to the sheet.** The mesh has a 2px
    antialiasing pad past both edges; clamped, the pad collapsed onto the
    edge, its normal normalised to NaN and the GPU dropped the edge rows of
    triangles — any curl at all made the sheet ~6px shorter at each end, and
    it popped back to size the instant the spring reached exactly 0.
- **Shadow** — cast in WebGL, two layers: a small, darker *contact* shadow
  tucked under the sheet and a larger, lighter *ambient* one with a long tail
  (`SHADOW_CONTACT` / `SHADOW_AMBIENT`). At each point it's cast from how high
  that part of the sheet is above the surface — `SHADOW_LIFT` less the curl
  (closed-form, no loop: it runs for every canvas pixel) less the tilt
  (`SHADOW_TILT_LIFT`) — so lower is tighter and darker, higher softer and
  further along the light. The offset comes from the studio's key light
  (`keyLight()` inverts the HDRI lookup at `KEY_LIGHT_UV`, so shadow and
  reflection agree: top-left light, shadow down-right), turned into the
  card's frame by the tilt. It spreads with `uMotion` (the bend spring), and
  fades out over the canvas's last 16px (`uBounds`) so its edge never shows.
  The footprint follows the flexing sheet (the curl integral, on the CPU).
  **This was the border bug:** a CSS box-shadow is fixed to the card's rest rectangle, so as
  the paper curled away the uncovered rectangle showed as a pale ghost card
  ringed by shadow. `.card-edge` now applies only to the flat DOM face.
- **Studio light** — image-based, from a studio HDRI baked by
  `scripts/bake-studio-env.py` into three prefiltered equirects in
  `public/env/` (coat ~2°, sheen ~12°, diffuse ~45°). Fixed in the room; the
  reflection moves only because the paper does (deck travel, tilt, flex).
  - A card only reflects a narrow cone of the room behind the viewer (about
    ±14° × ±11°), so `ENV_YAW` / `ENV_PITCH` aim one light into it: the
    studio's square LED panel, whose corner rests on the centred card's top
    left. Aim by rendering `env()` over a wide window, not by guessing.
  - The coat: Schlick Fresnel (F0 0.04) × the studio at two roughnesses, plus
    a grazing lift; the paper under it is lit by the diffuse map *relative to
    the flat card*, so only a bend changes the print. `EXPOSURE` is low on
    purpose — the panel is ~25× the floor, and a higher value fogs the print
    with the room.
  - The paper is a height field (fibre, tooth, orange peel) tipping the normal
    a fraction of a degree; its frequency is capped under the canvas's Nyquist
    limit, or it aliases into a moiré. Off on coarse pointers.
  - The baked maps are read top row first: `HDRLoader` sets `flipY`, which is
    turned off.
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
- **Five cards on show** (`VISIBLE_RADIUS` 2). `SLOT_RADIUS` is one more, so
  the card gliding in has a slot to come from; `slotFade()` takes a slot to 0
  over its last card of travel past the visible radius, and `slotShown()`
  turns its clicks off (`inert` at rest).
- **The gap is `ITEM_HEIGHT`** (180px) — it sets the slot height inline and
  the glide distance, so change it nowhere else. At that pitch the outer cards
  reach the header on a 900px-tall screen, which is why the viewport carries
  `rs-edge-fade` (a top/bottom mask, depth `--rs-edge-fade`).
- **Only the centre slot opens.** It's a `SlideLink` to `/project/<slug>`
  with the project's title as the label — the same pair the deck's centre card
  passes to `slideTo`, so the two always open the same case study. Every other
  slot is a `<button>` that calls `onGoToIndex` and brings its project to the
  centre; click it again once it's there to open it.
- Color swatches on active item

### LeftSidebar.tsx
- Navigation menu (WORK, ABOUT, PLAYGROUND, CONTACT)
- Project metadata grid (Role, then Launch below it; Recognition is not shown)
- Large project counter — the number alone, centred on the **card** via
  `left-[var(--card-shift)] w-screen flex justify-center` — the aside is only
  3 of 12 columns but starts at the viewport edge, and `--card-shift` is how
  far the deck sits off the screen's centre. Never centre it with `-translate-x-1/2` or
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

## The case study route

`/project/[slug]` — one project, full width, reached from the deck or from the
previous case study. `body` is `overflow: hidden` for the deck, so the page
carries its own scroller rather than fighting that rule.

### Layout
- **The work is centred on the viewport, not on its grid track.** The rail is
  `fixed` on the left and the minimap `fixed` on the right, so the middle column
  is sized by `--shot-width` and positioned by `--shot-lead`, which is
  back-solved from it. The trailing `1fr` track is empty and **must stay
  declared** — it is what balances the lead track. The shots keep an explicit
  `compact:col-start-2` for the same reason grid auto-placement bit before:
  taking an item out of flow frees its cell and the survivors shuffle into it.
- `--shot-width` has a floor (`100vw - 48rem`) that keeps the column clear of
  the fixed rail; below ~1290px that floor is what is actually in effect.
- `--shot-top` centres the *first* shot on the viewport, plus `--shot-drop`.
- **Below `compact` the page restructures**: the scroller becomes
  `flex flex-col` purely so the title can be `order-first` while staying last in
  the DOM, the rail and minimap return to the flow, and the minimap is hidden.

### The two fades
`HeavyScroll` publishes two custom properties on the scroller and everything
inside inherits them — no element needs its own listener.

| Property | Class | Meaning |
|----------|-------|---------|
| `--scroll-fade` | `.fade-on-scroll` | 0 at the top, 1 past `FADE_DISTANCE` |
| `--outro-fade` | `.fade-at-end` | 0 while the last screen is below the fold, 1 once it fills |

`data-outro="on"` also drops the faded elements out of the pointer path, so an
invisible rail can't swallow a click meant for the full-screen link under it.
**Both rules are scoped to `min-width: 1100px`** — below that neither element is
furniture any more and fading them against scroll would dissolve the page's own
heading the moment you moved.

### The route transition
Owned end to end by `src/app/(frontend)/template.tsx`, which exports
`useRouteSlide()`. `SlideLink` is the anchor that calls it; `routeTransition.ts`
carries the destination's name across the boundary, keyed by href so a stale
label can't leak.

    rising → named → (navigate) → holding → leaving → idle

1. the slide rises over the page being left
2. the destination's name fades in on it, then the route changes
3. the arriving side picks the slide up and carries it down
4. the page bounces in underneath (`PageEnter`)

Things that are load-bearing:
- **Phase is decided in a lazy `useState` initialiser, not an effect.** An
  effect runs after first paint, so the arriving route flashes uncovered.
- **A template's key is its own segment level.** This one is keyed `/project`
  for *every* case study, so going from one to the next does **not** remount it
  — the initialiser never re-runs. A `pathname` effect picks the slide up in
  that case, and `page.tsx` keys `<HeavyScroll>` on the slug so the page, its
  scroll position and `PageEnter` all actually reset.
- **An empty label is not "no label".** `""` means an announced arrival with
  nothing to paint (the trip home); `null` means nothing announced it. Test for
  `null`, never truthiness.
- **The slides are CSS class transitions, not gsap.** gsap animates `yPercent`
  through its own transform cache while Tailwind writes `--tw-translate-y`; the
  two disagree about where the element starts and the slide snaps instead of
  travelling. This cost three separate debugging rounds.
- `route-content` must stay untransformed and keep `h-full` — the case study's
  scroller, rail and chrome are all `fixed`, and a transform on an ancestor
  makes them resolve against *it* instead of the viewport.

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
  - Accents: `accentDot`, `--color-grain`, `--color-gloss` (the varnish on
    a flat DOM card face), `--color-stock` (the paper's underside and edge),
    `--color-shadow`
- **The card's size** is `--card-width` / `--card-height`. From 1100px up it
  is at most 488 × 366, grown from the old 320 × 240 **to the left only** —
  `--card-shift` moves `deck-frame` (by CSS `left`, since gsap owns its
  transform) so the centre card's right edge stays put; the shift is scaled
  by `--card-centre-scale`, which must match `CENTER_SCALE`. Below 1100 the
  stacked layout keeps the small 4:3 steps. The shift then closes a fifth of
  the gap to the right rail (`+ 5vw - anchor/2 × scale / 5`: the deck's
  column spans 25–75% of the screen). The work counter and `deck-hint` follow
  `--card-shift`, so both stay centred on the card.
- **Case study layout** is tokenized too: `--shot-width` (45vw less 10%, floored so the
  column never runs under the fixed rail), `--shot-lead` (the grid track that
  puts it on the *viewport* centre rather than its own track) and `--shot-top`
  (the padding that centres the first shot vertically on load).
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

### Marker classes
Every component's root element carries one unprefixed class naming **where it
sits**, so the DOM is readable in the inspector without matching Tailwind
strings against source files.

| Region | Markers |
|--------|---------|
| Shell | `app-shell`, `app-viewport`, `route-content`, `route-transition` |
| Chrome | `chrome-header`, `chrome-contact`, `chrome-status`, `chrome-audio`, `chrome-brand`, `chrome-nav` |
| Left rail | `rail-left`, `rail-left-nav`, `rail-left-meta`, `work-counter`, `scroll-hint` |
| Right rail | `rail-right`, `rail-right-viewport`, `rail-right-track`, `rail-right-slot`, `rail-right-swatches`, `rail-right-showreel` |
| Deck | `deck-scroller`, `deck-stage`, `deck-frame`, `deck-card`, `deck-hint` |
| Below 1100 | `menu-toggle`, `mobile-brand`, `mobile-counter`, `mobile-detail`, `mobile-swatches`, `mobile-menu`, `mobile-menu-nav`, `mobile-menu-footer` |
| Case study | `case-study`, `case-study-body`, `case-study-rail`, `case-study-shots`, `case-study-shot`, `case-study-minimap`, `case-study-title`, `case-study-next` |
| Overlays | `grain-overlay`, `toast` |

**They carry no styles and must not be given any.** Styling lives in Tailwind
tokens; these exist only to identify. The styled non-Tailwind classes are a
separate, named set — `page-canvas`, `rs-*`, `counter-numeral`, `title-wide`,
`font-display` / `font-text`, `fade-on-scroll` / `fade-at-end`,
`card-paper`, `card-edge`,
`perspective-stage`, `no-scrollbar` — and those do
carry rules in globals.css.

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
The deck runs on **Lenis**, owned by `src/hooks/useDeckScroll.ts`; constants
live at the top of that file.

- **A hidden scroller.** Lenis scrolls an element and the deck isn't one, so
  `PortfolioClient` renders `deck-scroller` — fixed, invisible, click-through —
  holding one very tall spacer parked at `SCROLL_ORIGIN`. Lenis scrolls that,
  and each frame the offset becomes card units in `positionRef`. Lenis steps on
  gsap's ticker, *prioritised*, so the deck never draws a frame-old position.
- **Not `infinite` mode** — its `reset()` (end of every animation) re-reads the
  wrapped scrollTop, so the unwrapped value jumps a whole loop and every card
  changes key at once. The finite range is thousands of cards long and
  re-bases on `SCROLL_ORIGIN` at rest once it drifts past `REBASE_DISTANCE`.
- **Not `lenis/snap`** — it snaps to a finite list of points; any integer is a
  card here. `settle` instead waits `SETTLE_MS` of quiet, then commits to the
  next card **in the direction of travel** once the gesture is past
  `COMMIT_THRESHOLD` (0.12) of one — so a mouse notch is exactly one card, a
  small nudge springs back, and a trackpad's momentum is followed all the way
  out. It aims from `lenis.targetScroll`, i.e. where Lenis is heading, never
  more than `MAX_THROW_CARDS` away.
- **Landing is a spring, never a tween.** A tween starts from rest on its own
  curve, so the deck slowed under Lenis, paused, then got pulled in again — the
  "unnatural snap". The spring (`SPRING_STIFFNESS` 11, `SPRING_DAMPING` 1 =
  critical, no overshoot) inherits the deck's measured speed, so follow and
  land are one motion. Every move that ends on a card — settle, drag release,
  key, sidebar — goes through `goTo()`; retargeting mid-flight keeps the speed.
- **Who owns `positionRef`.** Lenis, except while the spring or a mouse drag is
  moving the deck (`manualRef`): then the hook writes it directly and ignores
  Lenis's emits, and `handBack()` re-syncs Lenis when it's done. Lenis's offset
  is rounded to device pixels by the DOM — a visible stutter on a slow landing.
  New input fires `virtual-scroll` *before* Lenis applies it, which is where
  the hand-back happens, so the new gesture continues from the spring's spot.
- **Momentum tail.** Small wheel events (`MOMENTUM_TAIL_DELTA`) heading the way
  the spring is already landing are swallowed — they're a trackpad's inertia
  dribbling out, and handing back for them stalls the deck short of the card.
- **Wheel** — `WHEEL_LERP` 0.085 and `WHEEL_MULTIPLIER` 0.72 (the huyml.co
  feel; don't take lerp under 0.06), then `WHEEL_TRAVEL_PER_CARD` (260 scroll
  px) per card. One event is clamped to `WHEEL_MAX_EVENT_DELTA` in Lenis's
  `virtualScroll` hook (which may mutate the deltas).
- **Touch** is Lenis's `syncTouch` — direct under the finger, with inertia on
  release (`TOUCH_INERTIA_*`). It must stay on: the scroller is click-through,
  so there's no native touch scroll for Lenis to fall back to. `touchMultiplier` puts it on the wheel's scale
  at `DRAG_TRAVEL_PER_CARD` (300px) per card. CardDeck2 only resolves taps for
  touch.
- **Mouse / pen drag** is CardDeck2's pointer handlers → `dragStart` / `drag`
  / `dragEnd`, written straight to `positionRef` (direct manipulation isn't
  smoothed). Release is aimed `DRAG_THROW_MS` ahead and the spring starts at
  the pointer's speed. Taking over stops Lenis's glide with
  `lenis.stop(); lenis.start()` — `reset()` is private, and a `scrollTo` to
  the current value is a no-op.
- **Gating**: `enabled` is false while a section modal or the mobile menu is
  open; `virtualScroll` then returns false so the input passes through
  natively. Don't use `lenis.stop()` for this — a stopped Lenis still
  `preventDefault`s the wheel, which would freeze the modal's own scrolling.
  Horizontal-dominant gestures are also passed through (back/forward swipe).
- **All inputs must agree on direction.** Scrolling down, dragging up and
  Arrow Down all go to `position - 1`, which brings the card below up into
  centre.
- **Keyboard** (arrows, space) calls `step()`, which builds on the card the
  deck is already heading for, so quick presses accumulate. Rate-limited by
  `STEP_COOLDOWN_MS` in `PortfolioClient`.
- There is no detent warp on the drawn position any more. It made the card
  cross the midpoint at 2.4× the input speed, which under eased motion read as
  a lurch; the landing spring does that job now.

## Content and caching
The frontend is **static, with no timer**. Nothing re-reads Payload until an
editor changes something.

- `getProjects()` (`src/lib/getProjects.ts`) reads the published projects and
  falls back to `src/data/projects.ts` when the CMS is empty or unreachable.
  It is wrapped in React's `cache`, so one render asks once however many
  callers there are — a case study asks three times (its metadata, the
  project, the next one).
- `/project/[slug]` exports `generateStaticParams`, so every case study is
  prerendered at build. Without it the route is rendered on demand for each
  visit — a cold function, a fresh database connection and the query, all
  before the first byte. A project published after the build renders on its
  first visit and is cached from then on.
- **Rebuilding is on demand.** `src/collections/revalidate.ts` holds two
  Payload hooks — after a change, after a delete — wired into Projects,
  Categories and Media. Either calls `revalidatePath('/', 'layout')`, marking
  the whole frontend stale at once: the deck and every case study read the
  same list (order, numbering, "next project"), so one edit can touch any of
  them. Each page regenerates on its next visit. A draft autosave is skipped
  unless the document was already published.
- Neither page exports `revalidate`. Don't add one back to cure stale content
  — find out why the hook didn't fire.
- A build that can't reach the database bakes in the placeholder list, and
  keeps it until someone saves in the admin or the site is redeployed.
- `slideTo` prefetches the destination as the slide starts, so the route
  change itself has nothing left to wait for.

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
