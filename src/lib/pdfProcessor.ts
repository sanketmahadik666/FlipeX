import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ProcessedDocument, Chapter } from '@/state/recoilAtoms';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* ═══════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════ */

const MAX_CHARS_PER_PAGE = 2000;           // Increased for more natural content flow
const MIN_PARAGRAPH_LENGTH = 10;           // Keep more content fragments
const MIN_WIDOW_CHARS = 100;               // Adjusted for better page balance
const MIN_ORPHAN_CHARS = 100;              // Adjusted for better page balance
const HEADER_FOOTER_MARGIN = 0.10;         // Slightly wider margin to capture headers
const LINE_Y_TOLERANCE = 3;                // Tighter tolerance for line detection
const COLUMN_GAP_THRESHOLD = 50;           // Lower threshold for multi-column detection

/* ═══════════════════════════════════════════════
   TEXT EXTRACTION — handles columns, headers/footers, hyphenation
   ═══════════════════════════════════════════════ */

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  dir?: string; // Direction for RTL support
}

function extractTextItems(content: any): TextItem[] {
  return content.items
    .filter((item: any) => item.str && item.str.length > 0)
    .map((item: any) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
      height: Math.abs(item.transform[0]) || 12,
      fontName: item.fontName || '',
      dir: item.dir,
    }));
}

/** Detect and filter repeating headers/footers by position zone + repetition across pages */
function isInHeaderFooterZone(item: TextItem, pageHeight: number): boolean {
  if (pageHeight <= 0) return false;
  const normalizedY = item.y / pageHeight;
  // Use a more nuanced check for top/bottom zones
  return normalizedY < HEADER_FOOTER_MARGIN || normalizedY > (1 - HEADER_FOOTER_MARGIN);
}

/** Detect page numbers (standalone short numbers) */
function isPageNumber(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 15) return false;
  return /^\d{1,4}$/.test(trimmed) || 
         /^[-–—]\s*\d{1,4}\s*[-–—]$/.test(trimmed) ||
         /^page\s+\d+/i.test(trimmed) || 
         /^\d{1,4}\s*of\s*\d{1,4}$/i.test(trimmed) ||
         /^\[\d+\]$/.test(trimmed);
}

/** Detect if items form multiple columns by analyzing x-position clusters */
function detectColumns(items: TextItem[]): TextItem[][] {
  if (items.length < 10) return [items];

  // Group by x-position clusters
  const clusters: { x: number; items: TextItem[] }[] = [];
  const sortedByX = [...items].sort((a, b) => a.x - b.x);
  
  let currentCluster: TextItem[] = [sortedByX[0]];
  for (let i = 1; i < sortedByX.length; i++) {
    const item = sortedByX[i];
    const prevItem = sortedByX[i-1];
    if (item.x - (prevItem.x + prevItem.width) > COLUMN_GAP_THRESHOLD) {
      clusters.push({ x: currentCluster[0].x, items: currentCluster });
      currentCluster = [item];
    } else {
      currentCluster.push(item);
    }
  }
  clusters.push({ x: currentCluster[0].x, items: currentCluster });

  // Only return multiple columns if they are significant
  const significantClusters = clusters.filter(c => c.items.length > items.length * 0.1);
  
  if (significantClusters.length >= 2) {
    return significantClusters.map(c => 
      c.items.sort((a, b) => b.y - a.y || a.x - b.x)
    );
  }

  return [items.sort((a, b) => b.y - a.y || a.x - b.x)];
}

/** Group items into lines, rejoin hyphenated words */
function itemsToLines(items: TextItem[]): string[] {
  if (items.length === 0) return [];

  const lines: string[] = [];
  let currentLine = items[0].str;
  let lastY = items[0].y;
  let lastEndX = items[0].x + items[0].width;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const isNewLine = Math.abs(item.y - lastY) > LINE_Y_TOLERANCE;

    if (isNewLine) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = item.str;
    } else {
      const gap = item.x - lastEndX;
      // Smarter spacing: if gap is small and we're not already ending/starting with space
      if (gap > 1 && !currentLine.endsWith(' ') && !item.str.startsWith(' ')) {
        currentLine += ' ';
      }
      currentLine += item.str;
    }
    lastY = item.y;
    lastEndX = item.x + item.width;
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  // Better hyphenation handling
  const rejoined: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (line.endsWith('-') && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const match = nextLine.match(/^(\S+)(.*)/);
      if (match) {
        line = line.slice(0, -1) + match[1];
        lines[i + 1] = match[2].trim();
        if (!lines[i + 1]) {
          i++;
        }
      } else {
        break;
      }
    }
    rejoined.push(line);
  }

  return rejoined;
}

/** Track repeating text across pages to detect running headers/footers */
class HeaderFooterDetector {
  private topTexts = new Map<string, number>();
  private bottomTexts = new Map<string, number>();
  private pageCount = 0;

  addPage(items: TextItem[], pageHeight: number) {
    this.pageCount++;
    if (pageHeight <= 0) return;

    const topZone = items.filter(i => i.y / pageHeight > (1 - HEADER_FOOTER_MARGIN));
    const bottomZone = items.filter(i => i.y / pageHeight < HEADER_FOOTER_MARGIN);

    // Normalize text (remove page numbers)
    const normalizeForMatch = (text: string) =>
      text.replace(/\d+/g, '#').trim().toLowerCase();

    if (topZone.length > 0) {
      const text = normalizeForMatch(topZone.map(i => i.str).join(' '));
      if (text.length > 2) this.topTexts.set(text, (this.topTexts.get(text) || 0) + 1);
    }
    if (bottomZone.length > 0) {
      const text = normalizeForMatch(bottomZone.map(i => i.str).join(' '));
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

/* ═══════════════════════════════════════════════
   PARAGRAPH BUILDING
   ═══════════════════════════════════════════════ */

function linesToParagraphs(lines: string[]): string[] {
  if (lines.length === 0) return [];

  const paragraphs: string[] = [];
  let current = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (current.trim()) {
        paragraphs.push(current.trim());
        current = '';
      }
      continue;
    }

    if (isPageNumber(line)) continue;

    // Detect if line is likely a header
    const isHeader = i < lines.length - 1 && 
                     line.length < 60 && 
                     /^[A-Z][^a-z]*$/.test(line) && 
                     !/[.!?]$/.test(line);

    if (isHeader && current.trim()) {
      paragraphs.push(current.trim());
      current = line;
      paragraphs.push(current.trim());
      current = '';
      continue;
    }

    if (current) {
      // Heuristic for paragraph continuation:
      // If previous line doesn't end with sentence terminator, or current line doesn't start with uppercase
      const prevLine = current.trim();
      const endsWithSentenceTerminator = /[.!?:"'”]$/.test(prevLine);
      const startsWithLowercase = /^[a-z]/.test(line);
      const isListItem = /^(\d+\.|\*|-|•)\s+/.test(line);

      if ((!endsWithSentenceTerminator || startsWithLowercase) && !isListItem) {
        current += ' ' + line;
      } else {
        paragraphs.push(current.trim());
        current = line;
      }
    } else {
      current = line;
    }
  }

  if (current.trim()) paragraphs.push(current.trim());

  return paragraphs
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length >= MIN_PARAGRAPH_LENGTH);
}

/* ═══════════════════════════════════════════════
   PAGINATION — with widow/orphan control
   ═══════════════════════════════════════════════ */

function splitAtSentenceBoundary(text: string, maxChars: number): [string, string] {
  // Find the last sentence end within maxChars
  const sub = text.slice(0, maxChars + 50); // look a bit ahead for a sentence end
  const sentenceEnds = [...sub.matchAll(/[.!?]["'""']?\s+/g)];

  for (let i = sentenceEnds.length - 1; i >= 0; i--) {
    const end = sentenceEnds[i].index! + sentenceEnds[i][0].length;
    if (end <= maxChars) {
      return [text.slice(0, end).trim(), text.slice(end).trim()];
    }
  }

  // Fallback: split at last space before limit
  const lastSpace = text.lastIndexOf(' ', maxChars);
  if (lastSpace > maxChars * 0.3) {
    return [text.slice(0, lastSpace).trim(), text.slice(lastSpace).trim()];
  }

  return [text.slice(0, maxChars).trim(), text.slice(maxChars).trim()];
}

function segmentIntoPages(paragraphs: string[]): string[][] {
  if (paragraphs.length === 0) return [['']];

  const pages: string[][] = [];
  let currentPage: string[] = [];
  let currentCharCount = 0;

  const flushPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentCharCount = 0;
    }
  };

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];

    // Would this paragraph overflow the current page?
    if (currentPage.length > 0 && currentCharCount + para.length > MAX_CHARS_PER_PAGE) {
      flushPage();
    }

    // Handle very long paragraphs — split by sentences
    if (para.length > MAX_CHARS_PER_PAGE) {
      let remaining = para;
      while (remaining.length > 0) {
        const available = MAX_CHARS_PER_PAGE - currentCharCount;

        if (remaining.length <= available) {
          currentPage.push(remaining);
          currentCharCount += remaining.length;
          remaining = '';
        } else if (available > MIN_ORPHAN_CHARS) {
          const [chunk, rest] = splitAtSentenceBoundary(remaining, available);
          if (chunk.length > 0) {
            currentPage.push(chunk);
            flushPage();
            remaining = rest;
          } else {
            flushPage();
          }
        } else {
          flushPage();
          const [chunk, rest] = splitAtSentenceBoundary(remaining, MAX_CHARS_PER_PAGE);
          currentPage.push(chunk);
          currentCharCount = chunk.length;
          flushPage();
          remaining = rest;
        }
      }
    } else {
      currentPage.push(para);
      currentCharCount += para.length;
    }
  }

  flushPage();

  // ── Widow / orphan fix pass ──
  if (pages.length > 1) {
    const fixedPages = applyWidowOrphanFix(pages);
    return fixedPages;
  }

  return pages;
}

/** Post-process pages to fix widows and orphans */
function applyWidowOrphanFix(pages: string[][]): string[][] {
  const result = [...pages.map(p => [...p])];

  for (let i = 0; i < result.length; i++) {
    const pageText = result[i].join(' ');

    // WIDOW: last page of a chapter/section has very little content
    if (i === result.length - 1 && pageText.length < MIN_WIDOW_CHARS && i > 0) {
      // Pull this content back to the previous page if it fits reasonably
      const prevPageText = result[i - 1].join(' ');
      if (prevPageText.length + pageText.length < MAX_CHARS_PER_PAGE * 1.15) {
        result[i - 1] = [...result[i - 1], ...result[i]];
        result.splice(i, 1);
        break;
      }
    }

    // ORPHAN: first paragraph on a page is very short (< MIN_ORPHAN_CHARS)
    // and it's a continuation (not a chapter start)
    if (i > 0 && result[i].length > 0) {
      const firstPara = result[i][0];
      if (firstPara.length < MIN_ORPHAN_CHARS && !detectChapterTitle(firstPara)) {
        // Try to move it to the previous page
        const prevPageChars = result[i - 1].join(' ').length;
        if (prevPageChars + firstPara.length < MAX_CHARS_PER_PAGE * 1.1) {
          result[i - 1].push(firstPara);
          result[i].shift();
          if (result[i].length === 0) {
            result.splice(i, 1);
            i--;
          }
        }
      }
    }
  }

  // Remove any empty pages
  return result.filter(p => p.length > 0 && p.some(t => t.trim().length > 0));
}

/* ═══════════════════════════════════════════════
   CHAPTER DETECTION
   ═══════════════════════════════════════════════ */

function detectChapterTitle(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 200) return false;

  const patterns = [
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
    /^[A-Z\s]{5,50}$/, // All caps short titles
  ];
  return patterns.some((p) => p.test(trimmed));
}

function buildChapters(paragraphs: string[]): Chapter[] {
  const chapters: Chapter[] = [];
  let currentChapter: Chapter = {
    title: 'Beginning',
    paragraphs: [],
    pages: [],
  };

  for (const para of paragraphs) {
    if (detectChapterTitle(para)) {
      if (currentChapter.paragraphs.length > 0) {
        currentChapter.pages = segmentIntoPages(currentChapter.paragraphs);
        chapters.push(currentChapter);
      }
      currentChapter = { title: para.slice(0, 80), paragraphs: [], pages: [] };
    } else {
      currentChapter.paragraphs.push(para);
    }
  }

  if (currentChapter.paragraphs.length > 0) {
    currentChapter.pages = segmentIntoPages(currentChapter.paragraphs);
    chapters.push(currentChapter);
  }

  if (chapters.length === 0) {
    chapters.push({
      title: 'Document',
      paragraphs: ['No readable content found.'],
      pages: [['No readable content found.']],
    });
  }

  return chapters;
}

/* ═══════════════════════════════════════════════
   MAIN PROCESSOR
   ═══════════════════════════════════════════════ */

export async function processPDF(file: File): Promise<ProcessedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const hfDetector = new HeaderFooterDetector();

  // First pass: collect header/footer patterns
  const pageDataCache: { items: TextItem[]; pageHeight: number }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const pdfPage = await pdf.getPage(i);
    const content = await pdfPage.getTextContent();
    const viewport = pdfPage.getViewport({ scale: 1 });
    const items = extractTextItems(content);
    const pageHeight = viewport.height;

    hfDetector.addPage(items, pageHeight);
    pageDataCache.push({ items, pageHeight });
  }

  const repeatingPatterns = hfDetector.getRepeatingPatterns();

  // Second pass: extract text with filtering
  const allLines: string[] = [];

  for (const { items, pageHeight } of pageDataCache) {
    // Filter out header/footer zone items
    let filtered = items.filter(item => {
      const normalizedText = item.str.replace(/\d+/g, '#').trim().toLowerCase();
      if (isInHeaderFooterZone(item, pageHeight)) {
        if (repeatingPatterns.has(normalizedText) || isPageNumber(item.str)) {
          return false;
        }
      }
      return true;
    });

    // Detect columns and process each
    const columns = detectColumns(filtered);
    for (const colItems of columns) {
      const lines = itemsToLines(colItems);
      allLines.push(...lines);
    }

    // Explicit page separator for paragraph detection
    if (allLines.length > 0 && allLines[allLines.length - 1] !== '') {
      allLines.push('');
    }
  }

  const paragraphs = linesToParagraphs(allLines);
  const chapters = buildChapters(paragraphs);

  const totalPages = chapters.reduce((sum, ch) => sum + ch.pages.length, 0);
  const totalParagraphs = chapters.reduce((sum, ch) => sum + ch.paragraphs.length, 0);

  return {
    id: crypto.randomUUID(),
    title: file.name.replace(/\.pdf$/i, ''),
    chapters,
    totalPages,
    totalParagraphs,
  };
}