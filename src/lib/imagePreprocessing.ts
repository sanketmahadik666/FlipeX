/**
 * Image Preprocessing for OCR
 * Enhances image quality for better text recognition
 */

/**
 * Preprocess image for better OCR accuracy
 * Applies grayscale, contrast enhancement, and binarization
 * @param canvas - Canvas element containing the image
 * @returns Base64 encoded preprocessed image
 */
export function preprocessImage(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Step 1: Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    // Weighted average for better grayscale conversion
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  
  // Step 2: Enhance contrast
  const avgGray = calculateAverageGray(data);
  const contrastFactor = 1.5; // Increase contrast by 50%
  
  for (let i = 0; i < data.length; i += 4) {
    const enhanced = ((data[i] - avgGray) * contrastFactor) + avgGray;
    data[i] = data[i + 1] = data[i + 2] = clamp(enhanced);
  }
  
  // Step 3: Binarization using threshold
  const threshold = calculateOtsuThreshold(data);
  
  for (let i = 0; i < data.length; i += 4) {
    const binary = data[i] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = binary;
  }
  
  // Put processed data back on canvas
  ctx.putImageData(imageData, 0, 0);
  
  // Return as base64 PNG
  return canvas.toDataURL('image/png');
}

/**
 * Calculate average grayscale value
 */
function calculateAverageGray(data: Uint8ClampedArray): number {
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
    count++;
  }
  
  return sum / count;
}

/**
 * Calculate optimal threshold using Otsu's method
 * Finds threshold that minimizes intra-class variance
 */
function calculateOtsuThreshold(data: Uint8ClampedArray): number {
  // Build histogram
  const histogram = new Array(256).fill(0);
  const total = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.round(data[i])]++;
  }
  
  // Normalize histogram
  const normalizedHistogram = histogram.map(v => v / total);
  
  // Calculate cumulative sums and means
  let maxVariance = 0;
  let threshold = 0;
  let w0 = 0;
  let sum0 = 0;
  
  // Calculate total mean
  let totalMean = 0;
  for (let i = 0; i < 256; i++) {
    totalMean += i * normalizedHistogram[i];
  }
  
  // Find optimal threshold
  for (let t = 0; t < 256; t++) {
    w0 += normalizedHistogram[t];
    if (w0 === 0) continue;
    
    const w1 = 1 - w0;
    if (w1 === 0) break;
    
    sum0 += t * normalizedHistogram[t];
    
    const mean0 = sum0 / w0;
    const mean1 = (totalMean - sum0) / w1;
    
    // Calculate between-class variance
    const variance = w0 * w1 * (mean0 - mean1) * (mean0 - mean1);
    
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  
  return threshold;
}

/**
 * Clamp value between 0 and 255
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

/**
 * Simple preprocessing without binarization (faster, less aggressive)
 */
export function simplePreprocess(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Just grayscale and slight contrast boost
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const enhanced = clamp((gray - 128) * 1.2 + 128);
    data[i] = data[i + 1] = data[i + 2] = enhanced;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
