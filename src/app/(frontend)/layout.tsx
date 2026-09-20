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
});

// The monospaced companion, used where the design calls for a code face —
// currently the right sidebar's subtitle line.
const googleSansCode = Google_Sans_Code({
  subsets: ['latin'],
  variable: '--font-google-sans-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'couldbekush — selected work',
  description:
    'Selected work by couldbekush, an independent designer working globally.',
  openGraph: {
    title: 'couldbekush — selected work',
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
    <html
      lang="en"
      className={`h-full select-none ${googleSans.variable} ${googleSansCode.variable}`}
    >
      <body className="page-canvas h-screen w-screen relative font-sans select-none overflow-hidden p-0 text-micro-lg leading-relaxed tracking-tight antialiased">
        {children}
      </body>
    </html>
  );
}
