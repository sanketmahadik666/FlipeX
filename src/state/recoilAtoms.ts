import { atom } from 'recoil';

export interface Chapter {
  title: string;
  paragraphs: string[];
  pages: string[][]; // Each page is an array of paragraphs
}

export interface ProcessedDocument {
  id: string;
  title: string;
  chapters: Chapter[];
  totalPages: number;
  totalParagraphs: number;
}

export const processedDocumentAtom = atom<ProcessedDocument | null>({
  key: 'processedDocument',
  default: null,
});

export const currentChapterIndexAtom = atom<number>({
  key: 'currentChapterIndex',
  default: 0,
});

export const currentPageIndexAtom = atom<number>({
  key: 'currentPageIndex',
  default: 0,
});

export const currentParagraphIndexAtom = atom<number>({
  key: 'currentParagraphIndex',
  default: 0,
});
