'use client';

import { useRouteSlide } from '@/app/(frontend)/template';

/**
 * A link that goes through the covering slide instead of cutting straight to
 * the next route — the same transition in both directions.
 *
 * Rendered as a real anchor so middle-click, open-in-new-tab and the status-bar
 * URL all still work; only a plain left click is taken over. A modified click
 * is left alone, because those are meant to leave this page behind entirely.
 */
export function SlideLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  /** Shown on the slide while the next route loads. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { slideTo } = useRouteSlide();

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        slideTo(href, label);
      }}
    >
      {children}
    </a>
  );
}
