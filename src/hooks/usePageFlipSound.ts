import { useCallback, useRef, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { soundEnabledAtom } from '@/state/jotaiAtoms';

// Import all page flip sound effects
import bookPage from '@/assets/pageFlipingSoundEffects/freesound_community-book_page-45210.mp3';
import clothFlip from '@/assets/pageFlipingSoundEffects/freesound_community-cloth-flip-81024.mp3';
import pageFlipping from '@/assets/pageFlipingSoundEffects/freesound_community-page-flipping-99368.mp3';
import pageTurn from '@/assets/pageFlipingSoundEffects/freesound_community-page-turn-100277.mp3';
import smallPage from '@/assets/pageFlipingSoundEffects/freesound_community-small-page-103398.mp3';
import turnPage from '@/assets/pageFlipingSoundEffects/freesound_community-turnpage-99756.mp3';
import bookOpening from '@/assets/pageFlipingSoundEffects/freesounds123-book-opening-345808.mp3';
import pageFlipSmaller from '@/assets/pageFlipingSoundEffects/oxidvideos-page-flip-smaller-page-453027.mp3';
import pageFlip from '@/assets/pageFlipingSoundEffects/page-flip.mp3';
import turningPageBook from '@/assets/pageFlipingSoundEffects/xpmonster-turning-page-in-a-book-419580.mp3';

const SOUND_URLS = [
  bookPage,
  clothFlip,
  pageFlipping,
  pageTurn,
  smallPage,
  turnPage,
  bookOpening,
  pageFlipSmaller,
  pageFlip,
  turningPageBook,
];

/**
 * Plays a random page-flip sound effect from the collection.
 * Pre-loads all audio buffers on first use for instant playback.
 */
export function usePageFlipSound() {
  const soundEnabled = useAtomValue(soundEnabledAtom);
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<AudioBuffer[]>([]);
  const loadedRef = useRef(false);
  const lastPlayedRef = useRef(-1);

  // Pre-load all sound buffers once
  useEffect(() => {
    if (loadedRef.current) return;

    const loadBuffers = async () => {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new AudioContext();
        }
        const ctx = ctxRef.current;

        const buffers = await Promise.all(
          SOUND_URLS.map(async (url) => {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return ctx.decodeAudioData(arrayBuffer);
          })
        );

        buffersRef.current = buffers;
        loadedRef.current = true;
      } catch (err) {
        console.warn('Failed to preload flip sounds:', err);
      }
    };

    loadBuffers();
  }, []);

  const play = useCallback(() => {
    if (!soundEnabled) return;

    // Respect reduced-motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const buffers = buffersRef.current;

      if (buffers.length === 0) {
        // Buffers not loaded yet — fall back to synthesized sound
        playSynthesized(ctx);
        return;
      }

      // Pick a random sound, avoiding the same one twice in a row
      let idx = Math.floor(Math.random() * buffers.length);
      if (idx === lastPlayedRef.current && buffers.length > 1) {
        idx = (idx + 1) % buffers.length;
      }
      lastPlayedRef.current = idx;

      const source = ctx.createBufferSource();
      source.buffer = buffers[idx];

      // Slight gain control so it's not too loud
      const gain = ctx.createGain();
      gain.gain.value = 0.35;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {
      // Silently fail — sound is non-critical
    }
  }, [soundEnabled]);

  return play;
}

/** Fallback synthesized sound if MP3s haven't loaded yet */
function playSynthesized(ctx: AudioContext) {
  const duration = 0.12;
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
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
  source.start();
}