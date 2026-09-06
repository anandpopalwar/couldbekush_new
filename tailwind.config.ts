import type { Config } from "tailwindcss";

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
    },
  },
  plugins: [],
};
export default config;
