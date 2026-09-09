import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HUYVU® — Selected Works Portfolio',
  description: 'Design Direction & High-End Digital Experience Showcase by HUYVU®.',
  keywords: ['Design Direction', 'Portfolio', 'WebGL', '3D Card Deck', 'Next.js', 'Creative Web Development'],
  openGraph: {
    title: 'HUYVU® — Selected Works Portfolio',
    description: 'Design Direction & High-End Digital Experience Showcase by HUYVU®.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full select-none ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="h-screen w-screen relative font-sans select-none overflow-hidden p-0 text-[11px] leading-relaxed tracking-tight antialiased">
        {children}
      </body>
    </html>
  );
}
