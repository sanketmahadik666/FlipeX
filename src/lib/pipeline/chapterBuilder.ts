import type { ContentBlock, Chapter } from './schemas';
import { isChapterTitle } from './textExtractor';
import { blocksToFlatParagraphs } from './contentNormalizer';
import { paginateBlocks, type PaginationConfig } from './paginator';

/* ═══════════════════════════════════════════════
   CHAPTER BUILDER
   Groups content blocks into chapters based on
   heading detection and title patterns.
   ═══════════════════════════════════════════════ */

const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  maxPageHeightPx: 600,
  lineHeightPx: 20,
  headingHeightPx: 36,
  tableRowHeightPx: 24,
  listItemHeightPx: 22,
  imageHeightPx: 300,
  blockquoteHeightPx: 30,
  codeLineHeightPx: 18,
  pageMarginPx: 60,
};

/**
 * Build chapters from a flat list of content blocks.
 * Splits at H1 headings and chapter-title patterns.
 */
export function buildChapters(
  blocks: ContentBlock[],
  paginationConfig: Partial<PaginationConfig> = {}
): Chapter[] {
  const config = { ...DEFAULT_PAGINATION_CONFIG, ...paginationConfig };
  const chapters: Chapter[] = [];
  let currentBlocks: ContentBlock[] = [];
  let currentTitle = 'Beginning';

  const flushChapter = () => {
    if (currentBlocks.length > 0) {
      const pages = paginateBlocks(currentBlocks, config);
      const paragraphs = blocksToFlatParagraphs(currentBlocks);

      chapters.push({
        title: currentTitle,
        pages,
        paragraphs,
      });

      currentBlocks = [];
    }
  };

  for (const block of blocks) {
    // Chapter break: H1 heading or known chapter-title pattern
    if (block.type === 'heading' && block.level === 1) {
      flushChapter();
      currentTitle = block.text.slice(0, 80);
      // Don't include the title heading as a content block — it's the chapter title
      continue;
    }

    // Also detect chapter titles in H2 headings that match patterns
    if (block.type === 'heading' && block.level === 2 && isChapterTitle(block.text)) {
      flushChapter();
      currentTitle = block.text.slice(0, 80);
      continue;
    }

    currentBlocks.push(block);
  }

  flushChapter();

  // Fallback: if no chapters were built
  if (chapters.length === 0) {
    chapters.push({
      title: 'Document',
      pages: [{ blocks: [{ type: 'paragraph', text: 'No readable content found.' }], pageNumber: 1 }],
      paragraphs: ['No readable content found.'],
    });
  }

  return chapters;
}
