/**
 * coverExtractor.ts — Render the first page of a PDF as a cover image.
 *
 * Used by the upload flow when the user does not provide an explicit cover.
 */
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ExtractedCover {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Extract the first page of a PDF as a JPEG blob suitable for upload.
 *
 * @param file       PDF file
 * @param maxWidth   Maximum width in pixels (default 800)
 */
export async function extractCoverFromPdf(
  file: File,
  maxWidth = 800
): Promise<ExtractedCover | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / baseViewport.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );

    canvas.width = 0;
    canvas.height = 0;

    if (!blob) return null;
    return {
      blob,
      dataUrl,
      width: viewport.width,
      height: viewport.height,
    };
  } catch (err) {
    console.warn("Cover extraction failed:", err);
    return null;
  }
}

/**
 * Quickly read the page count of a PDF without rendering.
 */
export async function getPdfPageCount(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch {
    return null;
  }
}
