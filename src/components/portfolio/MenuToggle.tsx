'use client';

/**
 * The menu button for the stacked layout — one element in both states, so it
 * morphs rather than being swapped out.
 *
 *   closed      open
 *   ─────        ╲╱
 *   ─────        ╱╲     (the same two rules, crossed)
 *
 * The two rules slide to the middle and rotate past each other. Rendered above
 * the panel (z-60 over z-50) and outside it, so it stays sharp while the panel
 * resolves out of blur.
 */

// Open state: the rules span the diagonals of the 64×28 button — 70px at 24°.
// Written literally in the class strings below — Tailwind scans source text, so
// an interpolated `w-[${n}px]` would never be generated.

interface MenuToggleProps {
  open: boolean;
  onToggle: () => void;
}

export function MenuToggle({ open, onToggle }: MenuToggleProps) {
  const rule =
    'absolute left-1/2 h-px bg-ink origin-center -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out';

  return (
    <button
      onClick={onToggle}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      className="compact:hidden fixed top-5 left-4 z-[60] w-16 h-7 pointer-events-auto hover:opacity-70 transition-opacity"
    >
      <span
        className={`${rule} ${
          open ? 'top-1/2 w-[70px] rotate-[24deg]' : 'top-[30%] w-16 rotate-0'
        }`}
      />
      <span
        className={`${rule} ${
          open ? 'top-1/2 w-[70px] -rotate-[24deg]' : 'top-[70%] w-16 rotate-0'
        }`}
      />
    </button>
  );
}
