import { useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { soundEnabledAtom } from '@/state/jotaiAtoms';

/**
 * Generates a subtle page-flip sound using the Web Audio API.
 * No external audio file needed — pure synthesis.
 */
export function usePageFlipSound() {
  const soundEnabled = useAtomValue(soundEnabledAtom);
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback(() => {
    if (!soundEnabled) return;

    // Respect reduced motion / prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;

      // White noise burst shaped like a soft paper rustle
      const duration = 0.12;
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(duration * sampleRate);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        // Filtered noise with exponential decay
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 35); // fast decay
        data[i] = (Math.random() * 2 - 1) * envelope * 0.08; // low volume
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Bandpass filter to sound more like paper
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000;
      filter.Q.value = 0.5;

      const gain = ctx.createGain();
      gain.gain.value = 0.15;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // Silently fail — sound is non-critical
    }
  }, [soundEnabled]);

  return play;
}