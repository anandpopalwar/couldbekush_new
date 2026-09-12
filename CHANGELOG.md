# Changelog

## 2026-09-13 — Portfolio UI pass (left sidebar, right sidebar, counter, top bar)

### RightSidebar (`src/components/portfolio/RightSidebar.tsx`)
- Replaced the binary `opacity-15` fade with a **progressive distance-based fade** (`Math.pow(0.52, dist)`); the selected/center card stays fully opaque and bold.
- Switched item text from `text-gray-400` to `text-ink` so the fade reads as a clean ink gradient.
- **Disabled scroll/swipe navigation on the sidebar itself** — the wheel handler now just `preventDefault` + `stopPropagation` (no bubbling to the global page scroll), and the pointer-drag handlers were removed. Clicking a card still navigates.
- **Reversed order to "next-on-top"** so the sidebar scrolls the same direction as the center card deck (next project above center, previous below).
- **Rewrote as a windowed carousel**: renders a fixed set of 17 slots (center ±8); every navigation glides exactly one card and returns to a fixed rest position, so it never drifts, never teleports, and the first↔last wrap is a single-card move (no "jump"/sweep). Fade is fixed per slot (no opacity flash).
- Removed CSS transitions on list items (they caused a fade flash at recenter).
- Increased right padding to `pl-6 pr-20` for more breathing room on the right edge.

### LeftSidebar (`src/components/portfolio/LeftSidebar.tsx`)
- **Two-column metadata**: Role in the left gutter; Launch + Recognition stacked in the main column. Labels are muted Title-case (dropped `uppercase`/`font-mono`).
- **Fixed vertical anchoring** so labels/counter don't shift with content length: metadata is `absolute top-[43%]`, counter is pinned to the bottom, nav sits at the top row.
- **Counter** reworked to `Selected work` (left) · big number · `/NN` (right), with a very large number.
- Counter number uses **`text-white` + `mix-blend-difference`** so it inverts against its backdrop (dark on the light page, light over the dark cards). See memory `counter-mix-blend-stacking`.
- **Blur-on-scroll**: metadata blurs while the deck transitions and sharpens once scrolling settles (debounced), replacing the old vertical bounce. The counter number is intentionally excluded from the blur (a `filter` would break its mix-blend).
- Nav raised to the top header row with larger items.

### CardDeck (`src/components/portfolio/CardDeck.tsx`)
- Removed the text overlays from card images (category label, EXPLORE hover chip, launch/title/id block); cards now show just the photo + gradient.
- (A cursor-follow parallax was prototyped and then removed at the user's request.)

### TopHeader (`src/components/portfolio/TopHeader.tsx`)
- Enlarged the vertical brand mark (`HUYVU® · copyright 2026 · hcmc, vn · +84`).
- Removed the "HUYVU® Selected Works" block; the header is now click-through (`pointer-events-none`) except its controls, so it doesn't block the nav/cards beneath.
- Audio is text-only ("Audio Off —"); "Working globally / HCMC, …"; "For inquiries hello@huyvu.design".

### page.tsx (`src/app/page.tsx`)
- Gave `main` the page background so the counter's `mix-blend-difference` has a real backdrop.
- **Reordered DOM** (CardDeck before LeftSidebar) and pinned all three regions with explicit `col-start-*` + `row-start-1`, so the left sidebar (and its counter) paints on top of the cards **and** shares `main`'s blend group — without breaking the left/center/right layout.

### Tooling
- Installed skills into `.agents/skills/`: `frontend-design` (anthropics/skills, kept) and `design-taste-frontend` (leonxlnx/taste-skill).
