import { useCallback, useRef, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { soundEnabledAtom } from '@/state/jotaiAtoms';

/**
 * Vite: glob all MP3s in the page-flip sound effects folder.
 * Eager + ?url gives resolved public URLs for each file.
 */
const SOUND_URLS: string[] = (() => {
  const mod = import.meta.glob<{ default: string }>(
    '../assets/pageFlipingSoundEffects/*.mp3',
    { query: '?url', import: 'default', eager: true }
  );
  return Object.values(mod).filter((v): v is string => typeof v === 'string');
})();

const DEFAULT_VOLUME = 0.45;
const REDUCED_MOTION_VOLUME = 0;

/**
 * Plays a random page-flip sound from assets on each flip.
 * Preloads and decodes buffers for low-latency playback and avoids
 * repeating the same sound twice in a row when multiple files exist.
 */
export function usePageFlipSoundEffects() {
  const soundEnabled = useAtomValue(soundEnabledAtom);
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<AudioBuffer[]>([]);
  const lastIndexRef = useRef<number>(-1);
  const [ready, setReady] = useState(false);

  /* Preload: decode all MP3s into buffers for instant playback. */
  useEffect(() => {
    if (SOUND_URLS.length === 0) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    Promise.all(
      SOUND_URLS.map((url) =>
        fetch(url)
          .then((r) => r.arrayBuffer())
          .then((buf) => ctx.decodeAudioData(buf))
      )
    )
      .then((buffers) => {
        if (!cancelled) {
          buffersRef.current = buffers.filter((b): b is AudioBuffer => b != null);
          ctxRef.current = ctx;
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const playSynthesizedFallback = useCallback((ctx: AudioContext) => {
    const duration = 0.1;
    const length = Math.floor(duration * ctx.sampleRate);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const envelope = Math.exp(-t * 35);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.08;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  }, []);

  const play = useCallback(() => {
    if (!soundEnabled) return;

    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const buffers = buffersRef.current;
    const ctx = ctxRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (!ctxRef.current) ctxRef.current = ctx;

    try {
      if (ctx.state === 'suspended') ctx.resume();

      if (buffers.length > 0) {
        let index = Math.floor(Math.random() * buffers.length);
        if (buffers.length > 1 && index === lastIndexRef.current) {
          index = (index + 1) % buffers.length;
        }
        lastIndexRef.current = index;
        const source = ctx.createBufferSource();
        source.buffer = buffers[index];
        const gain = ctx.createGain();
        gain.gain.value = DEFAULT_VOLUME;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
      } else {
        playSynthesizedFallback(ctx);
      }
    } catch {
      // Non-critical
    }
  }, [soundEnabled, playSynthesizedFallback]);

  return { play, ready, count: SOUND_URLS.length };
}
