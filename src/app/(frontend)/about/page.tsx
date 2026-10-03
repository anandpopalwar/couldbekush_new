import type { Metadata } from 'next';
import { ProjectChrome } from '@/components/portfolio/ProjectChrome';
import { FoilCards } from '@/components/about/FoilCards';
import { getMagazines } from '@/lib/getMagazines';

export const metadata: Metadata = {
  title: 'About — couldbekush',
  description: 'Hot-foil magazines on a track: scroll through them, and open the one at the front.',
};

/**
 * About — one full-bleed stage. The magazines run across it on a diagonal
 * track and the front one's details are laid over them; see FoilCards.
 *
 * The magazines are the published ones from the CMS. The page is static, and
 * rebuilt when an editor changes one (src/collections/revalidate.ts). With
 * none published — or the CMS out of reach — the viewer shows its five
 * built-in magazines, so the page is never empty.
 *
 * Nothing scrolls here: the wheel and a drag both move the track, so the page
 * is exactly one viewport, like the deck.
 */
export default async function AboutPage() {
  const magazines = await getMagazines();

  return (
    <main className="about-page page-canvas fixed inset-0 overflow-hidden text-ink">
      <ProjectChrome active="about" />
      <FoilCards magazines={magazines} />
    </main>
  );
}
