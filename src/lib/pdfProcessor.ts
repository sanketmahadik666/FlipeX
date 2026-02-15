import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ProcessedDocument, Chapter } from '@/state/recoilAtoms';
import { ocrPool } from './ocrWorkerPool';
import { preprocessImage } from './imagePreprocessing';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* ═══════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════ */

const MAX_CHARS_PER_PAGE = 800;
const MIN_PARAGRAPH_LENGTH = 15;       // discard very short fragments
const MIN_WIDOW_CHARS = 80;            // min chars on last page to avoid widow
const MIN_ORPHAN_CHARS = 80;           // min chars on first line of new page to avoid orphan
const HEADER_FOOTER_MARGIN = 0.08;     // top/bottom 8% of page considered header/footer zone
const LINE_Y_TOLERANCE = 4;            // px tolerance for same-line detection
const COLUMN_GAP_THRESHOLD = 100;      // horizontal gap to detect multi-column layout
const TEXT_THRESHOLD = 50;             // min characters to consider page has text
const OCR_CANVAS_SCALE = 2.5;          // higher = better OCR accuracy, slower

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
}

function extractTextItems(content: any): TextItem[] {
  return content.items
    .filter((item: any) => item.str && item.str.trim().length > 0)
    .map((item: any) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
      height: item.height || item.transform[0] || 12,
      fontName: item.fontName || '',
    }));
}

/** Detect and filter repeating headers/footers by position zone + repetition across pages */
function isInHeaderFooterZone(item: TextItem, pageHeight: number): boolean {
  if (pageHeight <= 0) return false;
  const normalizedY = item.y / pageHeight;
  return normalizedY < HEADER_FOOTER_MARGIN || normalizedY > (1 - HEADER_FOOTER_MARGIN);
}

/** Detect page numbers (standalone short numbers) */
function isPageNumber(text: string): boolean {
  const trimmed = text.trim();
  return /^\d{1,4}$/.test(trimmed) || /^[-–—]\s*\d{1,4}\s*[-–—]$/.test(trimmed) ||
    /^page\s+\d+/i.test(trimmed) || /^\d{1,4}\s*of\s*\d{1,4}$/i.test(trimmed);
}

/** Detect if items form multiple columns by analyzing x-position clusters */
function detectColumns(items: TextItem[]): TextItem[][] {
  if (items.length < 4) return [items];

  // Collect unique x start positions (rounded)
  const xStarts = items.map(i => Math.round(i.x / 10) * 10);
  const xCounts = new Map<number, number>();
  xStarts.forEach(x => xCounts.set(x, (xCounts.get(x) || 0) + 1));

  // Find dominant x positions (appearing at least 3 times)
  const dominantXs = [...xCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([x]) => x)
    .sort((a, b) => a - b);

  // Check if there are clearly separated column starts
  if (dominantXs.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < dominantXs.length; i++) {
      gaps.push(dominantXs[i] - dominantXs[i - 1]);
    }
    const hasColumnGap = gaps.some(g => g > COLUMN_GAP_THRESHOLD);

    if (hasColumnGap) {
      // Split into columns
      const midX = dominantXs[0] + gaps[0] / 2;
      const leftCol = items.filter(i => i.x < midX).sort((a, b) => b.y - a.y || a.x - b.x);
      const rightCol = items.filter(i => i.x >= midX).sort((a, b) => b.y - a.y || a.x - b.x);
      return [leftCol, rightCol];
    }
  }

  return [items];
}

/** Group items into lines, rejoin hyphenated words */
function itemsToLines(items: TextItem[]): string[] {
  if (items.length === 0) return [];

  // Sort top-to-bottom, left-to-right
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > LINE_Y_TOLERANCE) return yDiff;
    return a.x - b.x;
  });

  const lines: string[] = [];
  let currentLine = sorted[0].str;
  let lastY = sorted[0].y;
  let lastEndX = sorted[0].x + sorted[0].width;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const isNewLine = Math.abs(item.y - lastY) > LINE_Y_TOLERANCE;

    if (isNewLine) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = item.str;
    } else {
      // Same line — detect word spacing
      const gap = item.x - lastEndX;
      if (gap > item.height * 0.3 && !currentLine.endsWith(' ') && !item.str.startsWith(' ')) {
        currentLine += ' ';
      }
      currentLine += item.str;
    }
    lastY = item.y;
    lastEndX = item.x + (item.width || item.str.length * 5);
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  // Rejoin hyphenated words across lines
  const rejoined: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.endsWith('-') && i + 1 < lines.length) {
      // Remove hyphen and join with next line's first word
      const nextLine = lines[i + 1];
      const nextWords = nextLine.split(/\s+/);
      const firstWord = nextWords.shift() || '';
      const joined = line.slice(0, -1) + firstWord;
      rejoined.push(joined + (nextWords.length ? '' : ''));
      if (nextWords.length) {
        lines[i + 1] = nextWords.join(' ');
      } else {
        i++; // skip next line entirely
      }
    } else {
      rejoined.push(line);
    }
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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Empty line = paragraph break
      if (current.trim()) {
        paragraphs.push(current.trim());
        current = '';
      }
      continue;
    }

    if (isPageNumber(trimmed)) continue;

    // Heuristics for paragraph break:
    // - Line is short (likely end of paragraph) followed by a new thought
    // - Line starts with uppercase after a sentence-ending previous line
    const prevEndsWithPeriod = /[.!?:]\s*$/.test(current);
    const startsUppercase = /^[A-Z"'"'(]/.test(trimmed);
    const prevLineShort = current.split('\n').pop()?.length || 0;

    if (current && prevEndsWithPeriod && startsUppercase && prevLineShort < 70) {
      paragraphs.push(current.trim());
      current = trimmed;
    } else if (current) {
      // Continue current paragraph — add space if needed
      const needsSpace = !current.endsWith(' ') && !trimmed.startsWith(' ');
      current += (needsSpace ? ' ' : '') + trimmed;
    } else {
      current = trimmed;
    }
  }

  if (current.trim()) paragraphs.push(current.trim());

  return paragraphs.filter(p => p.length >= MIN_PARAGRAPH_LENGTH);
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
  const patterns = [
    /^chapter\s+\d+/i,
    /^chapter\s+[ivxlcdm]+/i,   // roman numerals
    /^part\s+\d+/i,
    /^part\s+[ivxlcdm]+/i,
    /^section\s+\d+/i,
    /^book\s+\d+/i,
    /^CHAPTER\s+/,
    /^PART\s+/,
    /^\d+\.\s+[A-Z]/,
    /^[IVXLCDM]+\.\s+/,         // "III. Title"
    /^prologue$/i,
    /^epilogue$/i,
    /^introduction$/i,
    /^preface$/i,
    /^foreword$/i,
    /^appendix/i,
    /^conclusion$/i,
  ];
  return patterns.some((p) => p.test(text.trim()));
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
   OCR FALLBACK FOR SCANNED PDFS
   ═══════════════════════════════════════════════ */

/**
 * Extract text from a PDF page, using OCR fallback if no text layer exists
 */
async function extractTextFromPage(
  page: any,
  pageNum: number,
  progressCallback?: (msg: string) => void
): Promise<string> {
  // Try text extraction first
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item: any) => item.str)
    .join(' ')
    .trim();
  
  if (text.length > TEXT_THRESHOLD) {
    progressCallback?.(`Page ${pageNum}: Text extracted (${text.length} chars)`);
    return text;
  }
  
  // Fallback to OCR for scanned pages
  progressCallback?.(`Page ${pageNum}: No text layer, performing OCR...`);
  
  try {
    const ocrText = await performOCR(page, pageNum, progressCallback);
    return ocrText;
  } catch (error) {
    console.error(`OCR failed for page ${pageNum}:`, error);
    progressCallback?.(`Page ${pageNum}: OCR failed, skipping`);
    return '';
  }
}

/**
 * Perform OCR on a scanned PDF page
 */
async function performOCR(
  page: any,
  pageNum: number,
  progressCallback?: (msg: string) => void
): Promise<string> {
  // Render page to canvas at high resolution for better OCR
  const viewport = page.getViewport({ scale: OCR_CANVAS_SCALE });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas context');
  }
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;
  
  progressCallback?.(`Page ${pageNum}: Preprocessing image...`);
  
  // Preprocess image for better OCR accuracy
  const preprocessedImage = preprocessImage(canvas);
  
  progressCallback?.(`Page ${pageNum}: Running OCR (may take 10-30 seconds)...`);
  
  // Initialize OCR pool if needed
  if (!ocrPool.initialized) {
    await ocrPool.initialize();
  }
  
  // Perform OCR
  const text = await ocrPool.recognize(preprocessedImage);
  
  progressCallback?.(`Page ${pageNum}: OCR complete (${text.length} chars)`);
  
  return text;
}

/* ═══════════════════════════════════════════════
   MAIN PROCESSOR
   ═══════════════════════════════════════════════ */

export async function processPDF(
  file: File,
  progressCallback?: (msg: string) => void
): Promise<ProcessedDocument> {
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
      if (isInHeaderFooterZone(item, pageHeight)) {
        const normalizedText = item.str.replace(/\d+/g, '#').trim().toLowerCase();
        if (repeatingPatterns.has(normalizedText) || isPageNumber(item.str)) {
          return false;
        }
      }
      return true;
    });

    // Filter standalone page numbers
    filtered = filtered.filter(item => !isPageNumber(item.str.trim()));

    // Detect columns and process each
    const columns = detectColumns(filtered);
    for (const colItems of columns) {
      const lines = itemsToLines(colItems);
      allLines.push(...lines);
    }

    // Page boundary marker
    allLines.push('');
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