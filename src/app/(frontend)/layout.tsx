import type { Metadata } from 'next';
import { Google_Sans_Code, Google_Sans_Flex } from 'next/font/google';
import './globals.css';

// The only typeface on the site. Google Sans Flex is variable on six axes; we
// request opsz and wdth alongside the default wght, because Google Fonts
// otherwise serves a single-axis instance and both would silently do nothing.
const googleSans = Google_Sans_Flex({
  subsets: ['latin'],
  variable: '--font-google-sans',
  display: 'swap',
  axes: ['opsz', 'wdth'],
  // Next builds a size-adjusted fallback from its own metrics database so text
  // doesn't shift when the real font swaps in. Google Sans Flex isn't in that
  // database yet, so it warns and skips the fallback anyway. Turning the
  // attempt off silences the warning; the stack below stands in, picked because
  // its metrics are close enough to keep the swap unobtrusive.
  adjustFontFallback: false,
  fallback: ['Helvetica Neue', 'Arial', 'system-ui', 'sans-serif'],
});

// The monospaced companion, used where the design calls for a code face —
// currently the right sidebar's subtitle line.
const googleSansCode = Google_Sans_Code({
  subsets: ['latin'],
  variable: '--font-google-sans-code',
  display: 'swap',
  // Same story — no metrics shipped for this family either.
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

export const metadata: Metadata = {
  title: 'couldbekush',
  description:
    'Selected work by couldbekush, an independent designer working globally.',
  openGraph: {
    title: 'couldbekush',
    description:
      'Selected work by couldbekush, an independent designer working globally.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: browser extensions add their own classes to
    // <html> before React hydrates, and React reports that as a mismatch. It
    // covers this element's attributes only, not anything inside it.
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full select-none ${googleSans.variable} ${googleSansCode.variable}`}
    >
      {/* h-dvh, not h-screen: 100vh on a phone is the height with the browser's
          toolbar hidden, so while the bar is showing the page is taller than
          what's visible and the deck's centre sits below the real middle. dvh
          tracks the visible height as the bar comes and goes. */}
      <body className="page-canvas h-dvh w-screen relative font-sans select-none overflow-hidden p-0 text-micro-lg leading-relaxed tracking-tight antialiased">
        {children}
      </body>
    </html>
  );
}
