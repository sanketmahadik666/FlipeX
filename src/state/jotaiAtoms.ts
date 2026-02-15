import { atom } from 'jotai';

export type ReadingMode = 'classic' | 'focus' | 'scroll';
export type ReadingTheme = 'light' | 'dark' | 'sepia' | 'antique';

export const fontSizeAtom = atom<number>(18);
export const lineSpacingAtom = atom<number>(1.8);
export const readingModeAtom = atom<ReadingMode>('classic');
export const readingThemeAtom = atom<ReadingTheme>('light');
export const soundEnabledAtom = atom<boolean>(true);
