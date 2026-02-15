import { createWorker, createScheduler, Worker } from 'tesseract.js';

/**
 * OCR Worker Pool Manager
 * Manages a pool of Tesseract.js workers for efficient parallel OCR processing
 */
class OCRWorkerPool {
  private scheduler: any = null;
  private workers: Worker[] = [];
  private isInitialized = false;
  private readonly workerCount = Math.min(navigator.hardwareConcurrency || 2, 4);
  
  /**
   * Initialize the worker pool with specified language
   * @param language - Tesseract language code (default: 'eng')
   */
  async initialize(language = 'eng'): Promise<void> {
    if (this.isInitialized) {
      console.log('OCR Worker Pool already initialized');
      return;
    }
    
    console.log(`Initializing OCR worker pool with ${this.workerCount} workers...`);
    
    this.scheduler = createScheduler();
    
    // Create worker pool
    const workerPromises = Array.from({ length: this.workerCount }, async (_, index) => {
      try {
        const worker = await createWorker(language, 1, {
          logger: (m) => {
            // Progress logging for debugging
            if (m.status === 'recognizing text') {
              console.log(`Worker ${index + 1} Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
          // Use CDN for worker files to reduce bundle size
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5/dist/worker.min.js',
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5',
        });
        
        this.workers.push(worker);
        this.scheduler.addWorker(worker);
        
        console.log(`Worker ${index + 1} initialized`);
        return worker;
      } catch (error) {
        console.error(`Failed to initialize worker ${index + 1}:`, error);
        throw error;
      }
    });
    
    await Promise.all(workerPromises);
    this.isInitialized = true;
    console.log('OCR Worker Pool ready');
  }
  
  /**
   * Recognize text from an image using the worker pool
   * @param imageData - Image data (base64 string, ImageData, or File)
   * @param options - Additional Tesseract options
   * @returns Extracted text
   */
  async recognize(imageData: string | ImageData | File, options?: any): Promise<string> {
    if (!this.isInitialized) {
      console.log('Worker pool not initialized, initializing now...');
      await this.initialize();
    }
    
    try {
      const { data: { text } } = await this.scheduler.addJob('recognize', imageData, options);
      return text;
    } catch (error) {
      console.error('OCR recognition failed:', error);
      
      // Retry logic for worker crashes
      if (error instanceof Error && error.message.includes('terminated')) {
        console.log('Worker was terminated, reinitializing pool...');
        await this.terminate();
        await this.initialize();
        
        // Retry once
        const { data: { text } } = await this.scheduler.addJob('recognize', imageData, options);
        return text;
      }
      
      throw error;
    }
  }
  
  /**
   * Check if the pool is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Terminate all workers and clean up resources
   */
  async terminate(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    console.log('Terminating OCR worker pool...');
    
    try {
      await this.scheduler.terminate();
      
      for (const worker of this.workers) {
        await worker.terminate();
      }
    } catch (error) {
      console.error('Error terminating workers:', error);
    }
    
    this.workers = [];
    this.scheduler = null;
    this.isInitialized = false;
    console.log('OCR Worker Pool terminated');
  }
}

// Export singleton instance
export const ocrPool = new OCRWorkerPool();
