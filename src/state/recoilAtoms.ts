import { atom } from 'recoil';
import type {
  ContentBlock,
  PageContent,
  Chapter as PipelineChapter,
  ProcessedDocument as PipelineDocument,
} from '@/lib/pipeline/schemas';

/* ═══════════════════════════════════════════════
   RE-EXPORT PIPELINE TYPES
   ═══════════════════════════════════════════════ */
export type { ContentBlock, PageContent };

/* ═══════════════════════════════════════════════
   CHAPTER
   Uses the new PageContent model with rich ContentBlocks,
   but keeps `paragraphs: string[]` for FocusMode/ScrollMode
   backward compatibility.
   ═══════════════════════════════════════════════ */
export interface Chapter {
  title: string;
  pages: PageContent[] | string[][];   // new pipeline → PageContent[]; legacy → string[][]
  paragraphs: string[];
  metadata?: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════
   PROCESSED DOCUMENT
   ═══════════════════════════════════════════════ */
export interface ProcessedDocument {
  id: string;
  title: string;
  chapters: Chapter[];
  totalPages: number;
  totalParagraphs: number;
}

/* ═══════════════════════════════════════════════
   HELPER: Detect if pages use the new ContentBlock model
   ═══════════════════════════════════════════════ */
export function isRichPage(page: PageContent | string[]): page is PageContent {
  return typeof page === 'object' && 'blocks' in page && Array.isArray(page.blocks);
}

/* ═══════════════════════════════════════════════
   RECOIL ATOMS
   ═══════════════════════════════════════════════ */

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

export interface UserBook {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  file?: File;
}

export const userLibraryAtom = atom<UserBook[]>({
  key: 'userLibrary',
  default: [],
});
