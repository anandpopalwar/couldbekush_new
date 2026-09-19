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
      colors: {
        canvas: "#e7e7e5",
        canvasDark: "#dededc",
        ink: "#111111",
        inkMuted: "#8b8b87",
        inkSubtle: "#b0b0ac",
        accentDot: "#2b2b2b",
      },
      fontFamily: {
        sans: ['var(--font-inter)', '"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-jetbrains)', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
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
      },
    },
  },
  plugins: [],
};
export default config;
