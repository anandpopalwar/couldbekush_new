'use client';

import { useState, useCallback, useRef } from 'react';

export function useAudioFeedback() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const nextState = !prev;
      if (nextState) {
        if (!audioCtxRef.current) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
      }
      return nextState;
    });
  }, []);

  // Authentic physical book page turn / paper rustle sound synthesis
  const playPaperFlipSound = useCallback(
    (direction: 'up' | 'down' = 'down') => {
      if (!audioEnabled) return;
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }
        const ctx = audioCtxRef.current;
        if (!ctx) return;

        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;
        const duration = 0.16;

        // 1. Friction Noise Layer (Paper grain sliding against air)
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          const t = i / bufferSize;
          // Dual-peak noise profile mimicking page release + flutter
          const envelope = Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(t * Math.PI * 4));
          output[i] = (Math.random() * 2 - 1) * envelope;
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        // Paper Texture Filter (Bandpass resonance)
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(1.6, now);

        if (direction === 'down') {
          filter.frequency.setValueAtTime(2800, now);
          filter.frequency.exponentialRampToValueAtTime(750, now + duration);
        } else {
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.exponentialRampToValueAtTime(3000, now + duration);
        }

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.40, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noiseSource.start(now);
        noiseSource.stop(now + duration);

        // 2. Page Snap / Mechanical Air Displacement Layer
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();

        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(direction === 'down' ? 220 : 260, now);
        snapOsc.frequency.exponentialRampToValueAtTime(45, now + 0.07);

        snapGain.gain.setValueAtTime(0.22, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);

        snapOsc.start(now);
        snapOsc.stop(now + 0.07);
      } catch {
        // Audio playback failed silently
      }
    },
    [audioEnabled]
  );

  return { audioEnabled, toggleAudio, playDeckSound: playPaperFlipSound };
}
