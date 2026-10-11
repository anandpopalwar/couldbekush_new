'use client';

import { useMemo } from 'react';
import type { CodeEmbedBlock } from '@/payload-types';
import { codeEmbedDoc } from '@/lib/codeEmbedDoc';

/**
 * An editor's HTML, CSS and JS, running in a frame of its own.
 *
 * sandbox is `allow-scripts` and nothing else. Never add `allow-same-origin`
 * beside it: the frame could then reach this page, read its cookies and
 * storage, and take its own sandbox off.
 */
export function CodeEmbed({ title, html, css, js, height, caption }: CodeEmbedBlock) {
  // Rebuilt only when the code changes — a new srcDoc reloads the frame and
  // the widget would lose its state.
  const srcDoc = useMemo(() => codeEmbedDoc({ html, css, js }), [html, css, js]);
  if (!html?.trim() && !css?.trim() && !js?.trim()) return null;

  return (
    <figure className="case-study-embed flex w-full flex-col gap-y-2">
      <iframe
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        loading="lazy"
        // The height is the editor's, per widget — content, not a token.
        style={{ height: height ?? 400 }}
        className="block w-full border border-ink/10 bg-surface"
      />
      <figcaption className="text-label-xs text-ink">
        {title}
        {caption && <span className="text-inkMuted"> — {caption}</span>}
      </figcaption>
    </figure>
  );
}
