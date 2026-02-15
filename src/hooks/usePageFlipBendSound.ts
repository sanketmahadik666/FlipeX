import { useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { soundEnabledAtom } from '@/state/jotaiAtoms';

/** Duration of the bend sound buffer (s) — should cover max flip duration */
const BEND_BUFFER_DURATION = 0.6;

/** Filter frequency (Hz): low = muffled, high = papery. Peaks mid-bend. */
function bendFilterFreq(progress: number): number {
  const t = progress;
  if (t < 0.5) return 800 + 3200 * (t * 2); // 800 -> 4000 as we bend
  return 4000 - 3000 * ((t - 0.5) * 2);     // 4000 -> 1000 as we settle
}

/** Gain envelope: rise, peak mid-flip, then land softly. */
function bendGain(progress: number): number {
  const t = progress;
  if (t <= 0) return 0;
  if (t >= 1) return 0;
  const peak = 0.22;
  const rise = t < 0.15 ? t / 0.15 : 1;
  const fall = t > 0.7 ? (1 - t) / 0.3 : 1;
  return peak * Math.min(rise, fall);
}

/**
 * Page-flip sound that follows the bend: filter and volume are driven by flip progress
 * so it sounds like paper bending during the flip, then settling.
 */
export function usePageFlipBendSound() {
  const soundEnabled = useAtomValue(soundEnabledAtom);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const startedRef = useRef(false);

  const startBend = useCallback(() => {
    if (!soundEnabled) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;

      // Reuse or create nodes
      if (!filterRef.current) {
        filterRef.current = ctx.createBiquadFilter();
        filterRef.current.type = 'bandpass';
        filterRef.current.Q.value = 0.7;
      }
      if (!gainRef.current) {
        gainRef.current = ctx.createGain();
        gainRef.current.connect(ctx.destination);
      }

      const filter = filterRef.current;
      const gain = gainRef.current;
      filter.frequency.value = bendFilterFreq(0);
      gain.gain.setValueAtTime(0, ctx.currentTime);

      // Noise buffer: paper-like (slightly filtered character over time)
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(BEND_BUFFER_DURATION * sampleRate);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 2.5) * (1 - t / BEND_BUFFER_DURATION);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.14;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      source.start(0);
      sourceRef.current = source;
      startedRef.current = true;
    } catch {
      startedRef.current = false;
    }
  }, [soundEnabled]);

  const updateBend = useCallback((progress: number) => {
    if (!startedRef.current || !filterRef.current || !gainRef.current || !ctxRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    filterRef.current.frequency.setTargetAtTime(bendFilterFreq(progress), now, 0.02);
    gainRef.current.gain.setTargetAtTime(bendGain(progress), now, 0.015);
  }, []);

  const endBend = useCallback(() => {
    if (sourceRef.current && startedRef.current) {
      try {
        sourceRef.current.stop(0);
      } catch {
        // already stopped
      }
      sourceRef.current = null;
      startedRef.current = false;
    }
  }, []);

  return { startBend, updateBend, endBend };
}
