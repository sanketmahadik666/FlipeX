import _ from 'lodash';
import type { RawTextItem, ContentBlock } from './schemas';

/* ═══════════════════════════════════════════════
   CONTENT NORMALIZER
   Uses Lodash for data cleaning, deduplication,
   and transformation of extracted content blocks.
   ═══════════════════════════════════════════════ */

/**
 * Remove duplicate content blocks (same text + type appearing consecutively)
 */
export function deduplicateBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return _.uniqWith(blocks, (a, b) => {
    if (a.type !== b.type) return false;
    if (a.type === 'paragraph' && b.type === 'paragraph') return a.text === b.text;
    if (a.type === 'heading' && b.type === 'heading') return a.text === b.text && a.level === b.level;
    return false;
  });
}

/**
 * Filter out header/footer items based on repeating patterns
 */
export function filterHeaderFooterItems(
  items: RawTextItem[],
  pageHeight: number,
  repeatingPatterns: Set<string>,
  headerFooterMargin: number
): RawTextItem[] {
  return items.filter(item => {
    if (pageHeight <= 0) return true;

    const normalizedY = item.y / pageHeight;
    const inHFZone = normalizedY < headerFooterMargin || normalizedY > (1 - headerFooterMargin);

    if (inHFZone) {
      const normalizedText = item.str.replace(/\d+/g, '#').trim().toLowerCase();
      if (repeatingPatterns.has(normalizedText)) return false;
      if (isStandalonePageNumber(item.str)) return false;
    }

    return true;
  });
}

function isStandalonePageNumber(text: string): boolean {
  const trimmed = text.trim();
  return /^\d{1,4}$/.test(trimmed) ||
    /^[-–—]\s*\d{1,4}\s*[-–—]$/.test(trimmed) ||
    /^page\s+\d+/i.test(trimmed);
}

/**
 * Remove items that were consumed by table detection
 */
export function removeConsumedItems(
  items: RawTextItem[],
  consumed: Set<RawTextItem>
): RawTextItem[] {
  return items.filter(item => !consumed.has(item));
}

/**
 * Clean and normalize paragraph text
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')          // collapse whitespace
    .replace(/\u00AD/g, '')         // remove soft hyphens
    .replace(/\u200B/g, '')         // remove zero-width spaces
    .replace(/\uFEFF/g, '')         // remove BOM
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
    .trim();
}

/**
 * Merge adjacent paragraph blocks that should be one paragraph
 * (e.g., a paragraph split across lines)
 */
export function mergeAdjacentParagraphs(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      const last = result[result.length - 1];
      if (last && last.type === 'paragraph') {
        // Check if they should merge
        const lastText = last.text;
        const shouldMerge =
          !lastText.endsWith('.') &&
          !lastText.endsWith('!') &&
          !lastText.endsWith('?') &&
          !lastText.endsWith(':') &&
          lastText.length < 200;

        if (shouldMerge) {
          (last as { type: 'paragraph'; text: string }).text =
            normalizeText(lastText + ' ' + block.text);
          continue;
        }
      }
    }
    result.push({ ...block });
  }

  return result;
}

/**
 * Normalize all content blocks
 */
export function normalizeBlocks(blocks: ContentBlock[]): ContentBlock[] {
  let normalized = blocks.map(block => {
    switch (block.type) {
      case 'paragraph':
        return { ...block, text: normalizeText(block.text) };
      case 'heading':
        return { ...block, text: normalizeText(block.text) };
      case 'blockquote':
        return { ...block, text: normalizeText(block.text) };
      case 'table':
        return {
          ...block,
          headers: block.headers.map(h => normalizeText(h)),
          rows: block.rows.map(row => row.map(cell => normalizeText(cell))),
        };
      case 'list':
        return {
          ...block,
          items: block.items.map(item => normalizeText(item)),
        };
      default:
        return block;
    }
  });

  // Remove empty blocks
  normalized = normalized.filter(block => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'blockquote':
        return block.text.length >= 3;
      case 'table':
        return block.rows.length > 0;
      case 'list':
        return block.items.length > 0;
      default:
        return true;
    }
  });

  // Deduplicate
  normalized = deduplicateBlocks(normalized);

  return normalized;
}

/**
 * Extract flat paragraph strings from content blocks
 * (for backward compatibility with FocusMode/ScrollMode)
 */
export function blocksToFlatParagraphs(blocks: ContentBlock[]): string[] {
  const paragraphs: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        paragraphs.push(block.text);
        break;
      case 'heading':
        paragraphs.push(block.text);
        break;
      case 'blockquote':
        paragraphs.push(`"${block.text}"`);
        break;
      case 'table': {
        // Flatten table to text representation
        const headerLine = block.headers.join(' | ');
        const rowLines = block.rows.map(row => row.join(' | '));
        paragraphs.push([headerLine, ...rowLines].join('\n'));
        break;
      }
      case 'list': {
        const prefix = block.ordered ? (i: number) => `${i + 1}. ` : () => '• ';
        const listText = block.items.map((item, i) => prefix(i) + item).join('\n');
        paragraphs.push(listText);
        break;
      }
      case 'code':
        paragraphs.push(block.text);
        break;
      default:
        break;
    }
  }

  return paragraphs.filter(p => p.length >= 5);
}
