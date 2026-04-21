import type { ProcessedDocument, PipelineConfig } from './schemas';
import { processDocument } from './pdfPipeline.worker';

/* ═══════════════════════════════════════════════
   PIPELINE WORKER CLIENT
   Main-thread API that spawns a Web Worker if
   available, or falls back to main-thread processing.
   ═══════════════════════════════════════════════ */

export type ProgressCallback = (stage: string, percent: number, detail?: string) => void;

/**
 * Process a PDF file using the pipeline.
 *
 * Tries to use a Web Worker for non-blocking processing.
 * Falls back to main thread if Worker creation fails.
 */
export async function processPDFInWorker(
  file: File,
  onProgress?: ProgressCallback,
  config?: Partial<PipelineConfig>
): Promise<ProcessedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  return processPDFBufferInWorker(arrayBuffer, file.name, onProgress, config);
}

/**
 * Process a PDF that's already been loaded as an ArrayBuffer
 * (e.g. fetched from the server).
 *
 * Uses the same Worker-first / main-thread fallback path as the
 * File-based variant so server-loaded books go through the exact
 * same client-side rendering pipeline as locally-uploaded ones.
 */
export async function processPDFBufferInWorker(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  onProgress?: ProgressCallback,
  config?: Partial<PipelineConfig>
): Promise<ProcessedDocument> {
  try {
    // Clone before transferring so the main thread keeps a copy for fallback.
    const transferable = arrayBuffer.slice(0);
    return await runInWorker(transferable, fileName, config, onProgress);
  } catch (workerError) {
    console.warn('Web Worker failed, falling back to main thread:', workerError);
    return processDocument(arrayBuffer, fileName, config, onProgress);
  }
}

/**
 * Run processing in a Web Worker
 */
function runInWorker(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  config?: Partial<PipelineConfig>,
  onProgress?: ProgressCallback
): Promise<ProcessedDocument> {
  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;

    try {
      // Create worker from the pipeline worker file
      worker = new Worker(
        new URL('./pdfPipeline.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch {
      reject(new Error('Failed to create Web Worker'));
      return;
    }

    const timeout = setTimeout(() => {
      worker?.terminate();
      reject(new Error('Processing timed out (120s)'));
    }, 120_000);

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;

      switch (msg.type) {
        case 'progress':
          onProgress?.(msg.stage, msg.percent, msg.detail);
          break;

        case 'complete':
          clearTimeout(timeout);
          worker?.terminate();
          resolve(msg.data as ProcessedDocument);
          break;

        case 'error':
          clearTimeout(timeout);
          worker?.terminate();
          reject(new Error(msg.message || 'Worker processing failed'));
          break;
      }
    };

    worker.onerror = (error) => {
      clearTimeout(timeout);
      worker?.terminate();
      reject(new Error(`Worker error: ${error.message}`));
    };

    // Send data to worker (transfer ArrayBuffer for zero-copy)
    worker.postMessage(
      { arrayBuffer, fileName, config },
      [arrayBuffer]
    );
  });
}

/**
 * Process a PDF file directly on the main thread
 * (for cases where Web Workers aren't available)
 */
export async function processPDFDirect(
  file: File,
  onProgress?: ProgressCallback,
  config?: Partial<PipelineConfig>
): Promise<ProcessedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  return processDocument(
    arrayBuffer,
    file.name,
    config,
    onProgress
  );
}
