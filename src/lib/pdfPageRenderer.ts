import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ProcessedDocument, Chapter } from '@/state/recoilAtoms';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* ═══════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════ */

/** Scale for rendering — higher = sharper but more memory */
const RENDER_SCALE = 1.8;

/* ═══════════════════════════════════════════════
   PDF PAGE RENDERER
   Renders each PDF page as a high-res image,
   preserving the original layout exactly.
   ═══════════════════════════════════════════════ */

interface PageImage {
  dataUrl: string;
  width: number;
  height: number;
  pageNum: number;
}

/**
 * Render a single PDF page to a data URL using pdfjs-dist.
 */
async function renderPageToImage(
  pdfPage: any,
  scale: number
): Promise<PageImage> {
  const viewport = pdfPage.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await pdfPage.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  const dataUrl = canvas.toDataURL('image/webp', 0.88);

  // Clean up
  canvas.width = 0;
  canvas.height = 0;

  return {
    dataUrl,
    width: viewport.width,
    height: viewport.height,
    pageNum: pdfPage.pageNumber,
  };
}

/**
 * Extract PDF metadata using pdf-lib
 */
async function extractPdfMetadata(arrayBuffer: ArrayBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
    });

    const title = pdfDoc.getTitle() || '';
    const author = pdfDoc.getAuthor() || '';
    const subject = pdfDoc.getSubject() || '';
    const pageCount = pdfDoc.getPageCount();

    // Get page dimensions from pdf-lib for accuracy
    const pageDimensions = pdfDoc.getPages().map((page) => ({
      width: page.getWidth(),
      height: page.getHeight(),
    }));

    return { title, author, subject, pageCount, pageDimensions };
  } catch (err) {
    console.warn('pdf-lib metadata extraction failed:', err);
    return { title: '', author: '', subject: '', pageCount: 0, pageDimensions: [] };
  }
}

/**
 * Process a PDF by rendering each page as an image.
 * Returns a ProcessedDocument where each "page" has the rendered image.
 *
 * Pages are grouped into chapters of 10 pages each for navigation,
 * or single-chapter if the doc is small.
 */
export async function processPDFAsImages(
  file: File,
  progressCallback?: (msg: string, progress?: number) => void
): Promise<ProcessedDocument> {
  const arrayBuffer = await file.arrayBuffer();

  // Use pdf-lib for metadata
  progressCallback?.('Extracting document metadata...', 2);
  const metadata = await extractPdfMetadata(arrayBuffer);

  const docTitle =
    metadata.title ||
    file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');

  // Use pdfjs-dist for rendering
  progressCallback?.('Loading PDF pages...', 5);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const numPages = pdf.numPages;

  // Render all pages as images
  const pageImages: PageImage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const percent = Math.round(5 + (i / numPages) * 85);
    progressCallback?.(`Rendering page ${i} of ${numPages}...`, percent);

    const pdfPage = await pdf.getPage(i);
    const img = await renderPageToImage(pdfPage, RENDER_SCALE);
    pageImages.push(img);

    // Release page resources
    pdfPage.cleanup();
  }

  progressCallback?.('Building document structure...', 92);

  // Group pages into chapters
  // For small docs: single chapter
  // For larger docs: group every 10 pages as a "section"
  const chapters: Chapter[] = [];

  if (numPages <= 12) {
    // Single chapter
    const pages: string[][] = pageImages.map((img) => [
      `__IMAGE__${img.dataUrl}`,
    ]);
    chapters.push({
      title: docTitle,
      paragraphs: pageImages.map(
        (_, idx) => `[Page ${idx + 1}]`
      ),
      pages,
    });
  } else {
    // Group into chapters of ~10 pages
    const chunkSize = 10;
    for (let start = 0; start < numPages; start += chunkSize) {
      const end = Math.min(start + chunkSize, numPages);
      const chapterImages = pageImages.slice(start, end);
      const chapterNum = Math.floor(start / chunkSize) + 1;

      const pages: string[][] = chapterImages.map((img) => [
        `__IMAGE__${img.dataUrl}`,
      ]);

      chapters.push({
        title: `Section ${chapterNum}`,
        paragraphs: chapterImages.map(
          (_, idx) => `[Page ${start + idx + 1}]`
        ),
        pages,
      });
    }
  }

  progressCallback?.('Document ready!', 100);

  return {
    id: crypto.randomUUID(),
    title: docTitle,
    chapters,
    totalPages: numPages,
    totalParagraphs: numPages,
  };
}
