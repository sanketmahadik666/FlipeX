import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import _ from 'lodash';
import {
  PipelineConfigSchema,
  type PipelineConfig,
  type RawTextItem,
  type ContentBlock,
  type ProcessedDocument,
} from './schemas';
import {
  extractTextItems,
  groupIntoLines,
  classifyLines,
  medianFontSize,
  HeaderFooterDetector,
  detectColumns,
} from './textExtractor';
import { detectTables } from './tableDetector';
import {
  filterHeaderFooterItems,
  removeConsumedItems,
  normalizeBlocks,
  mergeAdjacentParagraphs,
} from './contentNormalizer';
import { buildChapters } from './chapterBuilder';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* ═══════════════════════════════════════════════
   PDF PROCESSING PIPELINE
   Complete pipeline from raw PDF to structured
   ProcessedDocument, designed to run in a
   Web Worker or on the main thread.
   ═══════════════════════════════════════════════ */

type ProgressFn = (stage: string, percent: number, detail?: string) => void;

/**
 * Default pipeline configuration
 */
const DEFAULT_CONFIG: PipelineConfig = PipelineConfigSchema.parse({});

/**
 * Extract PDF metadata using pdf-lib
 */
async function extractMetadata(arrayBuffer: ArrayBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return {
      title: pdfDoc.getTitle() || '',
      author: pdfDoc.getAuthor() || '',
      subject: pdfDoc.getSubject() || '',
      pageCount: pdfDoc.getPageCount(),
    };
  } catch {
    return { title: '', author: '', subject: '', pageCount: 0 };
  }
}

/**
 * Main processing pipeline
 */
export async function processDocument(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  config: Partial<PipelineConfig> = {},
  onProgress?: ProgressFn
): Promise<ProcessedDocument> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const progress = onProgress || (() => {});

  // ── Stage 1: Metadata ──
  progress('Extracting metadata', 2, 'Reading document properties...');
  const metadata = await extractMetadata(arrayBuffer);
  const docTitle = metadata.title || fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');

  // ── Stage 2: Parse PDF ──
  progress('Loading PDF', 5, 'Parsing document pages...');
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const numPages = pdf.numPages;

  // ── Stage 3: First pass — collect header/footer patterns ──
  progress('Analyzing structure', 8, 'Detecting headers and footers...');
  const hfDetector = new HeaderFooterDetector();

  interface PageData {
    items: RawTextItem[];
    pageHeight: number;
    pageWidth: number;
  }

  const pageDataCache: PageData[] = [];

  for (let i = 1; i <= numPages; i++) {
    const percent = 8 + Math.round((i / numPages) * 20);
    progress('Analyzing structure', percent, `Scanning page ${i} of ${numPages}...`);

    const pdfPage = await pdf.getPage(i);
    const content = await pdfPage.getTextContent();
    const viewport = pdfPage.getViewport({ scale: 1 });
    const items = extractTextItems(content);

    hfDetector.addPage(items, viewport.height);
    pageDataCache.push({
      items,
      pageHeight: viewport.height,
      pageWidth: viewport.width,
    });

    pdfPage.cleanup();
  }

  const repeatingPatterns = hfDetector.getRepeatingPatterns();

  // ── Stage 4: Second pass — rich content extraction ──
  progress('Extracting content', 30, 'Building content blocks...');

  const allBlocks: ContentBlock[] = [];
  const allItems: RawTextItem[] = [];

  // Collect all items across pages for global font analysis
  for (const { items } of pageDataCache) {
    allItems.push(...items);
  }
  const globalMedianFont = medianFontSize(allItems);

  for (let i = 0; i < pageDataCache.length; i++) {
    const percent = 30 + Math.round(((i + 1) / numPages) * 45);
    progress('Extracting content', percent, `Processing page ${i + 1} of ${numPages}...`);

    const { items, pageHeight, pageWidth } = pageDataCache[i];

    // Filter header/footer items
    let filtered = filterHeaderFooterItems(items, pageHeight, repeatingPatterns, cfg.headerFooterMargin);

    // Filter standalone page numbers
    filtered = filtered.filter(item => {
      const isStandalonePn = item.str.trim().length < 5 &&
        /^\d{1,4}$/.test(item.str.trim());
      return !isStandalonePn;
    });

    if (filtered.length === 0) continue;

    // Detect tables
    const detectedTables = detectTables(filtered);

    // Add table blocks
    for (const table of detectedTables) {
      allBlocks.push(table.block);
    }

    // Remove table-consumed items from remaining items
    const consumedItems = new Set<RawTextItem>();
    for (const table of detectedTables) {
      table.consumedItems.forEach(item => consumedItems.add(item));
    }
    const remainingItems = removeConsumedItems(filtered, consumedItems);

    // Detect columns
    const columns = detectColumns(remainingItems, cfg.columnGapThreshold);

    // Process each column
    for (const colItems of columns) {
      if (colItems.length === 0) continue;

      const lines = groupIntoLines(colItems);
      const blocks = classifyLines(lines, globalMedianFont);
      allBlocks.push(...blocks);
    }
  }

  // ── Stage 5: Normalize ──
  progress('Normalizing content', 78, 'Cleaning and deduplicating...');

  let normalizedBlocks = normalizeBlocks(allBlocks);
  normalizedBlocks = mergeAdjacentParagraphs(normalizedBlocks);

  // ── Stage 6: Build chapters & paginate ──
  progress('Building chapters', 85, 'Detecting chapters and paginating...');

  const chapters = buildChapters(normalizedBlocks);

  // ── Stage 7: Finalize ──
  progress('Finalizing', 95, 'Building document structure...');

  const totalPages = chapters.reduce((sum, ch) => sum + ch.pages.length, 0);
  const totalParagraphs = chapters.reduce((sum, ch) => sum + ch.paragraphs.length, 0);

  const doc: ProcessedDocument = {
    id: crypto.randomUUID(),
    title: docTitle,
    chapters,
    totalPages,
    totalParagraphs,
  };

  progress('Complete', 100, 'Document ready!');

  return doc;
}

/* ═══════════════════════════════════════════════
   WEB WORKER MESSAGE HANDLER
   When this file runs as a worker, listen for messages
   ═══════════════════════════════════════════════ */

// Detect if running in worker context
const isWorker = typeof self !== 'undefined' &&
  typeof (self as any).WorkerGlobalScope !== 'undefined';

if (isWorker) {
  self.onmessage = async (event: MessageEvent) => {
    const { arrayBuffer, fileName, config } = event.data;

    try {
      const doc = await processDocument(
        arrayBuffer,
        fileName,
        config,
        (stage, percent, detail) => {
          self.postMessage({
            type: 'progress',
            stage,
            percent,
            detail,
          });
        }
      );

      self.postMessage({
        type: 'complete',
        data: doc,
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Processing failed',
        stage: 'unknown',
      });
    }
  };
}
