import _ from 'lodash';
import type { RawTextItem, ContentBlock } from './schemas';

/* ═══════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════ */

const LINE_Y_TOLERANCE = 4;         // px tolerance for same-line grouping
const HEADING_SIZE_RATIO = 1.25;    // font size ≥ 1.25× median → heading
const H1_SIZE_RATIO = 1.6;         // font size ≥ 1.6× median → H1
const H2_SIZE_RATIO = 1.35;        // font size ≥ 1.35× median → H2
const MIN_PARAGRAPH_LENGTH = 10;
const HEADER_FOOTER_MARGIN = 0.08;  // top/bottom 8% of page

/* ═══════════════════════════════════════════════
   FONT ANALYSIS
   ═══════════════════════════════════════════════ */

/** Parse font name to detect bold/italic */
export function parseFontStyle(fontName: string): { isBold: boolean; isItalic: boolean } {
  const lower = fontName.toLowerCase();
  return {
    isBold: lower.includes('bold') || lower.includes('heavy') || lower.includes('black'),
    isItalic: lower.includes('italic') || lower.includes('oblique'),
  };
}

/** Calculate median font size from text items */
export function medianFontSize(items: RawTextItem[]): number {
  if (items.length === 0) return 12;
  const sizes = items.map(i => i.height).sort((a, b) => a - b);
  const mid = Math.floor(sizes.length / 2);
  return sizes.length % 2 ? sizes[mid] : (sizes[mid - 1] + sizes[mid]) / 2;
}

/* ═══════════════════════════════════════════════
   TEXT ITEM EXTRACTION FROM PDF.JS
   ═══════════════════════════════════════════════ */

/** Extract typed text items from PDF.js text content */
export function extractTextItems(content: any): RawTextItem[] {
  return content.items
    .filter((item: any) => item.str && item.str.trim().length > 0)
    .map((item: any) => {
      const fontName = item.fontName || '';
      const { isBold, isItalic } = parseFontStyle(fontName);
      return {
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || 0,
        height: item.height || item.transform[0] || 12,
        fontName,
        fontSize: item.height || item.transform[0] || 12,
        isBold,
        isItalic,
      };
    });
}

/* ═══════════════════════════════════════════════
   LINE GROUPING
   Group text items into lines by Y-coordinate
   ═══════════════════════════════════════════════ */

export interface TextLine {
  items: RawTextItem[];
  y: number;
  text: string;
  avgFontSize: number;
  isBold: boolean;
  isItalic: boolean;
}

/** Group items into lines, sorted top-to-bottom, left-to-right */
export function groupIntoLines(items: RawTextItem[]): TextLine[] {
  if (items.length === 0) return [];

  // Sort top-to-bottom (high Y = top in PDF coords), left-to-right
  const sorted = _.orderBy(items, [i => -i.y, i => i.x]);

  const lines: TextLine[] = [];
  let currentLineItems: RawTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= LINE_Y_TOLERANCE) {
      currentLineItems.push(item);
    } else {
      lines.push(buildLine(currentLineItems));
      currentLineItems = [item];
      currentY = item.y;
    }
  }
  if (currentLineItems.length > 0) {
    lines.push(buildLine(currentLineItems));
  }

  return lines;
}

function buildLine(items: RawTextItem[]): TextLine {
  // Sort left-to-right within line
  const sorted = _.orderBy(items, [i => i.x]);

  // Build line text with proper spacing
  let text = '';
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const gap = item.x - (prev.x + prev.width);
      if (gap > item.height * 0.3 && !text.endsWith(' ') && !item.str.startsWith(' ')) {
        text += ' ';
      }
    }
    text += item.str;
  }

  const avgFontSize = _.meanBy(sorted, i => i.height);
  const isBold = sorted.some(i => i.isBold === true);
  const isItalic = sorted.some(i => i.isItalic === true);

  return {
    items: sorted,
    y: sorted[0].y,
    text: text.trim(),
    avgFontSize,
    isBold,
    isItalic,
  };
}

/* ═══════════════════════════════════════════════
   HEADER / FOOTER DETECTION
   ═══════════════════════════════════════════════ */

/** Detect repeating headers/footers across multiple pages */
export class HeaderFooterDetector {
  private topTexts = new Map<string, number>();
  private bottomTexts = new Map<string, number>();
  private pageCount = 0;

  addPage(items: RawTextItem[], pageHeight: number) {
    this.pageCount++;
    if (pageHeight <= 0) return;

    const topZone = items.filter(i => i.y / pageHeight > (1 - HEADER_FOOTER_MARGIN));
    const bottomZone = items.filter(i => i.y / pageHeight < HEADER_FOOTER_MARGIN);

    const normalize = (text: string) => text.replace(/\d+/g, '#').trim().toLowerCase();

    if (topZone.length > 0) {
      const text = normalize(topZone.map(i => i.str).join(' '));
      if (text.length > 2) this.topTexts.set(text, (this.topTexts.get(text) || 0) + 1);
    }
    if (bottomZone.length > 0) {
      const text = normalize(bottomZone.map(i => i.str).join(' '));
      if (text.length > 2) this.bottomTexts.set(text, (this.bottomTexts.get(text) || 0) + 1);
    }
  }

  getRepeatingPatterns(): Set<string> {
    const threshold = Math.max(2, this.pageCount * 0.3);
    const patterns = new Set<string>();
    for (const [text, count] of this.topTexts) {
      if (count >= threshold) patterns.add(text);
    }
    for (const [text, count] of this.bottomTexts) {
      if (count >= threshold) patterns.add(text);
    }
    return patterns;
  }
}

/** Check if a text item is in header/footer zone */
export function isInHeaderFooterZone(item: RawTextItem, pageHeight: number): boolean {
  if (pageHeight <= 0) return false;
  const normalizedY = item.y / pageHeight;
  return normalizedY < HEADER_FOOTER_MARGIN || normalizedY > (1 - HEADER_FOOTER_MARGIN);
}

/** Detect standalone page numbers */
export function isPageNumber(text: string): boolean {
  const trimmed = text.trim();
  return /^\d{1,4}$/.test(trimmed) ||
    /^[-–—]\s*\d{1,4}\s*[-–—]$/.test(trimmed) ||
    /^page\s+\d+/i.test(trimmed) ||
    /^\d{1,4}\s*of\s*\d{1,4}$/i.test(trimmed);
}

/* ═══════════════════════════════════════════════
   MULTI-COLUMN DETECTION
   ═══════════════════════════════════════════════ */

export function detectColumns(items: RawTextItem[], columnGapThreshold: number): RawTextItem[][] {
  if (items.length < 4) return [items];

  const xStarts = items.map(i => Math.round(i.x / 10) * 10);
  const xCounts = _.countBy(xStarts);

  const dominantXs = Object.entries(xCounts)
    .filter(([, count]) => count >= 3)
    .map(([x]) => Number(x))
    .sort((a, b) => a - b);

  if (dominantXs.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < dominantXs.length; i++) {
      gaps.push(dominantXs[i] - dominantXs[i - 1]);
    }
    const hasColumnGap = gaps.some(g => g > columnGapThreshold);

    if (hasColumnGap) {
      const midX = dominantXs[0] + gaps[0] / 2;
      const leftCol = _.orderBy(items.filter(i => i.x < midX), [i => -i.y, i => i.x]);
      const rightCol = _.orderBy(items.filter(i => i.x >= midX), [i => -i.y, i => i.x]);
      return [leftCol, rightCol];
    }
  }

  return [items];
}

/* ═══════════════════════════════════════════════
   LINE → CONTENT BLOCK CLASSIFICATION
   Determines if each line is a heading, paragraph,
   list item, blockquote, or part of a table.
   ═══════════════════════════════════════════════ */

/** Chapter title patterns */
const CHAPTER_PATTERNS = [
  /^chapter\s+\d+/i,
  /^chapter\s+[ivxlcdm]+/i,
  /^part\s+\d+/i,
  /^part\s+[ivxlcdm]+/i,
  /^section\s+\d+/i,
  /^book\s+\d+/i,
  /^CHAPTER\s+/,
  /^PART\s+/,
  /^\d+\.\s+[A-Z]/,
  /^[IVXLCDM]+\.\s+/,
  /^prologue$/i,
  /^epilogue$/i,
  /^introduction$/i,
  /^preface$/i,
  /^foreword$/i,
  /^appendix/i,
  /^conclusion$/i,
];

export function isChapterTitle(text: string): boolean {
  return CHAPTER_PATTERNS.some(p => p.test(text.trim()));
}

/** Detect list item patterns */
function isBulletItem(text: string): boolean {
  return /^[\u2022\u2023•\-\*◦▪▸►]\s+/.test(text.trim());
}

function isNumberedItem(text: string): boolean {
  return /^\d+[\.\)]\s+/.test(text.trim()) || /^[a-z][\.\)]\s+/i.test(text.trim());
}

/** Classify lines into content blocks */
export function classifyLines(
  lines: TextLine[],
  medianSize: number
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let currentParagraph = '';
  let listItems: string[] = [];
  let listOrdered = false;

  const flushParagraph = () => {
    if (currentParagraph.trim().length >= MIN_PARAGRAPH_LENGTH) {
      blocks.push({ type: 'paragraph', text: currentParagraph.trim() });
    }
    currentParagraph = '';
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: 'list', ordered: listOrdered, items: [...listItems] });
      listItems = [];
    }
  };

  for (const line of lines) {
    const text = line.text.trim();
    if (!text || isPageNumber(text)) continue;

    // Heading detection by font size
    if (line.avgFontSize >= medianSize * H1_SIZE_RATIO && text.length < 200) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 1, text });
      continue;
    }
    if (line.avgFontSize >= medianSize * H2_SIZE_RATIO && text.length < 200) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 2, text });
      continue;
    }
    if (line.avgFontSize >= medianSize * HEADING_SIZE_RATIO && text.length < 200) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 3, text });
      continue;
    }

    // Bold short line → heading-like (H3)
    if (line.isBold && text.length < 100 && text.length > 3) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 3, text });
      continue;
    }

    // Chapter title detection
    if (isChapterTitle(text)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 1, text });
      continue;
    }

    // List detection
    if (isBulletItem(text)) {
      flushParagraph();
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(text.replace(/^[\u2022\u2023•\-\*◦▪▸►]\s+/, ''));
      continue;
    }
    if (isNumberedItem(text)) {
      flushParagraph();
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(text.replace(/^\d+[\.\)]\s+/, '').replace(/^[a-z][\.\)]\s+/i, ''));
      continue;
    }

    // Blockquote detection (indented text)
    const firstItem = line.items[0];
    if (firstItem && firstItem.x > 100 && line.isItalic && text.length < 500) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'blockquote', text });
      continue;
    }

    // Regular paragraph text
    flushList();
    if (currentParagraph.length > 0) {
      // Check if this continues the previous paragraph or starts a new one
      const prevEndsWithPeriod = /[.!?:]\s*$/.test(currentParagraph);
      const startsUppercase = /^[A-Z"'"'(]/.test(text);
      const prevShort = currentParagraph.length < 70;

      if (prevEndsWithPeriod && startsUppercase && prevShort) {
        flushParagraph();
        currentParagraph = text;
      } else {
        const needsSpace = !currentParagraph.endsWith(' ') && !text.startsWith(' ');
        currentParagraph += (needsSpace ? ' ' : '') + text;
      }
    } else {
      currentParagraph = text;
    }
  }

  flushParagraph();
  flushList();

  // Rejoin hyphenated words across paragraph blocks
  for (let i = 0; i < blocks.length - 1; i++) {
    if (blocks[i].type === 'paragraph' && blocks[i + 1].type === 'paragraph') {
      const curr = blocks[i] as { type: 'paragraph'; text: string };
      const next = blocks[i + 1] as { type: 'paragraph'; text: string };
      if (curr.text.endsWith('-')) {
        const words = next.text.split(/\s+/);
        const firstWord = words.shift() || '';
        curr.text = curr.text.slice(0, -1) + firstWord;
        if (words.length > 0) {
          next.text = words.join(' ');
        } else {
          blocks.splice(i + 1, 1);
          i--;
        }
      }
    }
  }

  return blocks;
}
