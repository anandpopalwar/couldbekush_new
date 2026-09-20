import type { Config } from "tailwindcss";

// Typography scale — AlignUI design system ("Typography [Overview]").
// Each token carries its size, line height, tracking and weight, so a single
// `text-*` class reproduces the spec exactly.
//   Titles     — Inter Display (opsz 32, via .font-display), Medium / 500
//   Labels     — Inter, Medium / 500
//   Paragraphs — Inter, Regular / 400
//   Subheading — Inter, Medium / 500, meant to be paired with `uppercase`
//   Docs       — Inter, 18/32
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Layout breakpoints, matching the reference site's page variants. Added
      // alongside Tailwind's defaults (sm/md/lg/xl/2xl still work) rather than
      // replacing them, so existing md:/lg: usages are untouched.
      //
      //   (unprefixed)  0–1099    mobile / small
      //   compact:      1100–1199
      //   desktop:      1200–1439
      //   wide:         1440–2399  ← the primary design target
      //   ultra:        2400+
      //
      // These live here rather than in globals.css because a media query can't
      // read a CSS custom property — this file is their source of truth.
      screens: {
        compact: "1100px",
        desktop: "1200px",
        wide: "1440px",
        ultra: "2400px",
      },
      // Every colour resolves to a token in globals.css :root. Values are stored
      // there as raw channels so `<alpha-value>` keeps opacity modifiers working
      // (bg-ink/80, border-ink/10). Never add a literal colour here.
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        canvasDeep: "rgb(var(--color-canvas-deep) / <alpha-value>)",
        canvasDark: "rgb(var(--color-canvas-dark) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        inkMuted: "rgb(var(--color-ink-muted) / <alpha-value>)",
        inkSubtle: "rgb(var(--color-ink-subtle) / <alpha-value>)",
        inkPlain: "rgb(var(--color-ink-plain) / <alpha-value>)",
        invert: "rgb(var(--color-invert) / <alpha-value>)",
        accentDot: "rgb(var(--color-accent-dot) / <alpha-value>)",
      },
      fontFamily: {
        // One typeface. `mono` is kept as a key only because ~26 places still say
        // font-mono for small tracked labels; it resolves to the same family, so
        // those keep their spacing and lose only the monospaced metrics.
        sans: ['var(--font-google-sans)', '"Google Sans Flex"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-google-sans)', '"Google Sans Flex"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // Google Sans Code — the genuinely monospaced face, used where the
        // design asks for a code look.
        code: ['var(--font-google-sans-code)', '"Google Sans Code"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tighter2: "-0.04em",
        widest2: "0.18em",
      },
      fontSize: {
        // Title / Inter Display — pair with `font-display`
        "title-h1": ["3.5rem", { lineHeight: "4rem", letterSpacing: "-0.01em", fontWeight: "500" }],
        "title-h2": ["3rem", { lineHeight: "3.5rem", letterSpacing: "-0.01em", fontWeight: "500" }],
        "title-h3": ["2.5rem", { lineHeight: "3rem", letterSpacing: "-0.01em", fontWeight: "500" }],
        "title-h4": ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.005em", fontWeight: "500" }],
        "title-h5": ["1.5rem", { lineHeight: "2rem", letterSpacing: "0em", fontWeight: "500" }],
        "title-h6": ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "0em", fontWeight: "500" }],

        // Label / Inter
        "label-xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.015em", fontWeight: "500" }],
        "label-lg": ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.015em", fontWeight: "500" }],
        "label-md": ["1rem", { lineHeight: "1.5rem", letterSpacing: "-0.011em", fontWeight: "500" }],
        "label-sm": ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "-0.006em", fontWeight: "500" }],
        "label-xs": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0em", fontWeight: "500" }],

        // Paragraph / Inter
        "paragraph-xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.015em", fontWeight: "400" }],
        "paragraph-lg": ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.015em", fontWeight: "400" }],
        "paragraph-md": ["1rem", { lineHeight: "1.5rem", letterSpacing: "-0.011em", fontWeight: "400" }],
        "paragraph-sm": ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "-0.006em", fontWeight: "400" }],
        "paragraph-xs": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0em", fontWeight: "400" }],

        // Subheading / Inter — positive tracking, designed for uppercase
        "subheading-md": ["1rem", { lineHeight: "1.5rem", letterSpacing: "0.06em", fontWeight: "500" }],
        "subheading-sm": ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.06em", fontWeight: "500" }],
        "subheading-xs": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.04em", fontWeight: "500" }],
        "subheading-2xs": ["0.6875rem", { lineHeight: "0.75rem", letterSpacing: "0.02em", fontWeight: "500" }],

        // Docs / Inter
        "doc-label": ["1.125rem", { lineHeight: "2rem", letterSpacing: "-0.015em", fontWeight: "500" }],
        "doc-paragraph": ["1.125rem", { lineHeight: "2rem", letterSpacing: "-0.015em", fontWeight: "400" }],

        // Micro — below the AlignUI sheet's smallest step (11px), but this
        // design's chrome runs at 8–11px: the mono labels, the scroll hint, the
        // header meta. Added rather than rounding those up to 12px, which would
        // have changed ~25 elements. Weight 400 and no tracking on purpose, so
        // the font-bold and tracking-* classes already on these elements still
        // win (Tailwind emits both plugins after fontSize).
        "micro-lg": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0em", fontWeight: "400" }],
        "micro-md": ["0.625rem", { lineHeight: "0.875rem", letterSpacing: "0em", fontWeight: "400" }],
        "micro-sm": ["0.5625rem", { lineHeight: "0.75rem", letterSpacing: "0em", fontWeight: "400" }],
        "micro-xs": ["0.5rem", { lineHeight: "0.75rem", letterSpacing: "0em", fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};
export default config;
