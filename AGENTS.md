# Project Knowledge: HUYVU® Portfolio

## Overview
A high-end creative portfolio website for HUYVU® — an independent design direction practice. Features a 3D card deck interface with fluid interactions, kinetic typography, and premium aesthetics.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.4
- **Animations**: GSAP 3.12
- **Icons**: Lucide React
- **Fonts**: Inter (sans), JetBrains Mono (mono)
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
│   │   ├── CardDeck.tsx    # 3D card stack with GSAP animations
│   │   ├── RightSidebar.tsx# Infinite scroll project list (center bold)
│   │   ├── ProjectModal.tsx# Full project detail modal
│   │   └── SectionModal.tsx# About, Playground, Contact modals
│   └── ui/
│       ├── GrainOverlay.tsx # Film grain texture overlay
│       └── Toast.tsx        # Toast notifications
├── data/
│   └── projects.ts         # 8 portfolio projects with metadata
├── hooks/
│   └── useAudioFeedback.ts # Web Audio API paper flip sounds
└── types/
    └── portfolio.ts        # Project & NavSection types
```

## Key Components

### CardDeck.tsx
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
- Infinite scroll track with 5 repeated project sets (40 items)
- Centered viewport with smooth GSAP transitions (0.38s)
- Auto-recenters virtual index at boundaries
- **Center item always bold**: font-black, text-ink, larger sizes
- Non-center items: opacity-15, muted gray colors
- Color swatches on active item

### LeftSidebar.tsx
- Navigation menu (WORK, ABOUT, PLAYGROUND, CONTACT)
- Project metadata grid (Role, Launch, Recognition)
- Large project counter (e.g., "01/08")

### useAudioFeedback.ts
- Web Audio API synthesis
- Paper flip/page turn sounds
- Bandpass filtered noise + triangle oscillator
- Direction-aware frequency sweeps

## Design System

### Colors (Tailwind)
- `canvas`: #e7e7e5 (background)
- `ink`: #111111 (primary text)
- `inkMuted`: #8b8b87 (secondary text)
- `inkSubtle`: #b0b0ac (tertiary text)

### Typography
- Sans: Inter (variable font)
- Mono: JetBrains Mono (variable font)
- Tight tracking on headings
- Widest tracking on labels

### Interactions
- Wheel scroll: threshold 18px, 150ms cooldown
- Drag: 45px threshold for card change
- Keyboard: Arrow keys, Space bar
- Touch: pointer events with capture

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
