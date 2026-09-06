'use client';

interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  return (
    <div
      className={`fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-ink text-white font-mono text-[11px] px-4 py-2 rounded-full pointer-events-none transition-all duration-300 shadow-xl ${
        message ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="status"
      aria-live="polite"
    >
      {message || ''}
    </div>
  );
}
