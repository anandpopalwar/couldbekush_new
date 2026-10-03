import type { Metadata } from 'next';
import { ProjectChrome } from '@/components/portfolio/ProjectChrome';
import { PageEnter } from '@/components/portfolio/PageEnter';
import { FoilCards } from '@/components/about/FoilCards';

export const metadata: Metadata = {
  title: 'About — couldbekush',
  description:
    'couldbekush is an independent design direction practice — and a rack of hot-foil cards to turn over in the light.',
};

const RULED_ROW = 'flex justify-between items-start gap-x-3 border-t border-ink py-2';

// Label on the left, value on the right — the practice, then its recognition
// by year.
const FACTS: [string, string][] = [
  ['Location', 'Saigon / Remote'],
  ['Focus', '3D Web / Brand Systems'],
  ['Awwwards Site of the Year Nominee', '2023'],
  ['FWA of the Month Winner', '2022'],
  ['CSSDA Studio of the Year finalist', '2021'],
];

/**
 * About — laid out like the deck it sits beside: the practice's details in the
 * bottom-left corner, an object in the middle, and what that object is on the
 * right. Here the object is a hot-foil card you can turn and open.
 *
 * body is overflow:hidden for the deck, so this page carries its own scroller,
 * as a case study does. It only needs it below 1100, where the three columns
 * stack; at compact+ everything fits the viewport and nothing scrolls.
 */
export default function AboutPage() {
  return (
    <main className="about-page page-canvas fixed inset-0 overflow-y-auto overscroll-y-contain [touch-action:auto] text-ink compact:overflow-hidden">
      <ProjectChrome active="about" />

      {/* Bounces up as the slide leaves over it. Safe to move: nothing in here
          is position:fixed. */}
      <PageEnter className="about-body grid grid-cols-1 gap-y-8 px-6 pt-20 pb-12 compact:grid-cols-12 compact:gap-y-0 compact:h-full compact:p-0">
        <FoilCards />

        {/* Set exactly like rail-left-meta on the deck, in the same corner. */}
        <aside className="about-meta relative min-w-0 compact:col-start-1 compact:col-span-3 compact:row-start-1 compact:h-full">
          <div className="flex flex-col compact:absolute compact:bottom-6 compact:left-5 compact:right-6">
            <h1 className="text-label-sm text-ink">
              Design Direction &amp; Digital Architecture
            </h1>
            <p className="text-paragraph-xs text-inkMuted mt-2 mb-4">
              couldbekush is an independent design direction practice operating
              at the intersection of haute digital aesthetics, kinetic
              interaction design, and high-performance WebGL frontend
              engineering.
            </p>

            {FACTS.map(([label, value]) => (
              <div key={label} className={RULED_ROW}>
                <span className="text-label-xs text-inkMuted">{label}</span>
                <p className="text-label-xs text-ink min-w-0 text-right">{value}</p>
              </div>
            ))}
          </div>
        </aside>
      </PageEnter>
    </main>
  );
}
