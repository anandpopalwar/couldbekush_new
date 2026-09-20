'use client';

export function GrainOverlay() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none opacity-[0.028] z-[99]"
      style={{
        backgroundImage: `
          radial-gradient(rgb(var(--color-grain)) 15%, transparent 16%) 0 0,
          radial-gradient(rgb(var(--color-grain)) 15%, transparent 16%) 8px 8px
        `,
        backgroundSize: '16px 16px',
      }}
      aria-hidden="true"
    />
  );
}
