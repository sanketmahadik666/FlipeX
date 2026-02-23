import type { ContentBlock, PageContent } from './schemas';

/* ═══════════════════════════════════════════════
   CONTENT-AWARE PAGINATOR
   Splits content blocks into pages with intelligent
   height estimation, table protection, and
   widow/orphan control.
   ═══════════════════════════════════════════════ */

export interface PaginationConfig {
  maxPageHeightPx: number;
  lineHeightPx: number;
  headingHeightPx: number;
  tableRowHeightPx: number;
  listItemHeightPx: number;
  imageHeightPx: number;
  blockquoteHeightPx: number;
  codeLineHeightPx: number;
  pageMarginPx: number;
}

const MIN_WIDOW_HEIGHT = 40;     // min height on last page
const MIN_ORPHAN_HEIGHT = 40;    // min height for first block on new page
const HEADING_KEEP_WITH_NEXT = 60; // min space after heading before page break

/**
 * Estimate the rendered height of a content block
 */
function estimateBlockHeight(block: ContentBlock, config: PaginationConfig): number {
  switch (block.type) {
    case 'heading':
      return config.headingHeightPx + 8; // heading + margin

    case 'paragraph': {
      // Estimate lines: ~60 chars per line
      const lines = Math.max(1, Math.ceil(block.text.length / 60));
      return lines * config.lineHeightPx + 10; // + paragraph margin
    }

    case 'table': {
      const headerHeight = config.tableRowHeightPx;
      const rowsHeight = block.rows.length * config.tableRowHeightPx;
      return headerHeight + rowsHeight + 20; // + table margin
    }

    case 'list':
      return block.items.length * config.listItemHeightPx + 10;

    case 'image':
      return config.imageHeightPx + 10;

    case 'blockquote': {
      const lines = Math.max(1, Math.ceil(block.text.length / 55));
      return lines * config.blockquoteHeightPx + 16;
    }

    case 'code': {
      const codeLines = block.text.split('\n').length;
      return codeLines * config.codeLineHeightPx + 20;
    }

    default:
      return config.lineHeightPx;
  }
}

/**
 * Paginate content blocks into pages with height constraints
 */
export function paginateBlocks(
  blocks: ContentBlock[],
  config: PaginationConfig
): PageContent[] {
  if (blocks.length === 0) {
    return [{ blocks: [{ type: 'paragraph', text: '' }], pageNumber: 1 }];
  }

  const maxHeight = config.maxPageHeightPx - config.pageMarginPx;
  const pages: PageContent[] = [];
  let currentPageBlocks: ContentBlock[] = [];
  let currentHeight = 0;
  let pageNumber = 1;

  const flushPage = () => {
    if (currentPageBlocks.length > 0) {
      pages.push({
        blocks: [...currentPageBlocks],
        pageNumber,
      });
      pageNumber++;
      currentPageBlocks = [];
      currentHeight = 0;
    }
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockHeight = estimateBlockHeight(block, config);

    // Would this block exceed the page?
    if (currentPageBlocks.length > 0 && currentHeight + blockHeight > maxHeight) {
      // Heading protection: don't leave a heading alone at page bottom
      if (currentPageBlocks.length > 0) {
        const lastBlock = currentPageBlocks[currentPageBlocks.length - 1];
        if (lastBlock.type === 'heading') {
          const remainingHeight = maxHeight - (currentHeight - estimateBlockHeight(lastBlock, config));
          if (remainingHeight < HEADING_KEEP_WITH_NEXT) {
            // Move heading to next page
            currentPageBlocks.pop();
            currentHeight -= estimateBlockHeight(lastBlock, config);
            flushPage();
            currentPageBlocks.push(lastBlock);
            currentHeight += estimateBlockHeight(lastBlock, config);
          } else {
            flushPage();
          }
        } else {
          flushPage();
        }
      }
    }

    // Tables: never split mid-table; if it doesn't fit, give it its own page
    if (block.type === 'table' && blockHeight > maxHeight) {
      flushPage();
      // Table gets its own page even if oversized
      pages.push({
        blocks: [block],
        pageNumber,
      });
      pageNumber++;
      continue;
    }

    // Images: give large images their own page
    if (block.type === 'image' && blockHeight > maxHeight * 0.7) {
      flushPage();
      pages.push({
        blocks: [block],
        pageNumber,
      });
      pageNumber++;
      continue;
    }

    // Long paragraphs: split at sentence boundaries if needed
    if (block.type === 'paragraph' && blockHeight > maxHeight && currentPageBlocks.length === 0) {
      const splitBlocks = splitParagraph(block as { type: 'paragraph'; text: string }, maxHeight, config);
      for (const splitBlock of splitBlocks) {
        currentPageBlocks.push(splitBlock);
        currentHeight += estimateBlockHeight(splitBlock, config);
        if (currentHeight >= maxHeight * 0.85) {
          flushPage();
        }
      }
      continue;
    }

    currentPageBlocks.push(block);
    currentHeight += blockHeight;
  }

  flushPage();

  // Widow/orphan fix pass
  return applyWidowOrphanFix(pages, config);
}

/**
 * Split a long paragraph at sentence boundaries
 */
function splitParagraph(
  block: { type: 'paragraph'; text: string },
  maxHeight: number,
  config: PaginationConfig
): ContentBlock[] {
  const maxChars = Math.floor((maxHeight / config.lineHeightPx) * 60);
  const result: ContentBlock[] = [];
  let remaining = block.text;

  while (remaining.length > maxChars) {
    const sub = remaining.slice(0, maxChars + 50);
    const sentenceEnds = [...sub.matchAll(/[.!?]["'"'']?\s+/g)];

    let splitAt = maxChars;
    for (let i = sentenceEnds.length - 1; i >= 0; i--) {
      const end = sentenceEnds[i].index! + sentenceEnds[i][0].length;
      if (end <= maxChars) {
        splitAt = end;
        break;
      }
    }

    result.push({ type: 'paragraph' as const, text: remaining.slice(0, splitAt).trim() });
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) {
    result.push({ type: 'paragraph', text: remaining });
  }

  return result;
}

/**
 * Fix widow/orphan pages
 */
function applyWidowOrphanFix(pages: PageContent[], config: PaginationConfig): PageContent[] {
  if (pages.length <= 1) return pages;

  const result = [...pages];

  for (let i = result.length - 1; i > 0; i--) {
    const page = result[i];
    const totalHeight = page.blocks.reduce(
      (h, b) => h + estimateBlockHeight(b, config), 0
    );

    // Widow: last page has very little content
    if (totalHeight < MIN_WIDOW_HEIGHT && i === result.length - 1) {
      const prevPage = result[i - 1];
      const prevHeight = prevPage.blocks.reduce(
        (h, b) => h + estimateBlockHeight(b, config), 0
      );

      if (prevHeight + totalHeight < config.maxPageHeightPx * 1.15) {
        // Pull widow content back to previous page
        prevPage.blocks.push(...page.blocks);
        result.splice(i, 1);
      }
    }
  }

  // Re-number pages
  result.forEach((page, idx) => {
    page.pageNumber = idx + 1;
  });

  return result;
}
