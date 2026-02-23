import { z } from 'zod';

/* ═══════════════════════════════════════════════
   CONTENT BLOCK SCHEMAS
   Typed content blocks for rich document rendering
   ═══════════════════════════════════════════════ */

export const HeadingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().min(1),
});

export const ParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1),
});

export const TableBlockSchema = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const ListBlockSchema = z.object({
  type: z.literal('list'),
  ordered: z.boolean(),
  items: z.array(z.string().min(1)),
});

export const ImageBlockSchema = z.object({
  type: z.literal('image'),
  dataUrl: z.string(),
  alt: z.string(),
});

export const CodeBlockSchema = z.object({
  type: z.literal('code'),
  language: z.string().optional(),
  text: z.string(),
});

export const BlockquoteBlockSchema = z.object({
  type: z.literal('blockquote'),
  text: z.string().min(1),
});

export const ContentBlockSchema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  TableBlockSchema,
  ListBlockSchema,
  ImageBlockSchema,
  CodeBlockSchema,
  BlockquoteBlockSchema,
]);

/* ═══════════════════════════════════════════════
   PAGE & CHAPTER SCHEMAS
   ═══════════════════════════════════════════════ */

export const PageContentSchema = z.object({
  blocks: z.array(ContentBlockSchema).min(1),
  pageNumber: z.number().int().positive(),
});

export const ChapterSchema = z.object({
  title: z.string().min(1),
  pages: z.array(PageContentSchema),
  paragraphs: z.array(z.string()), // backward compat for FocusMode/ScrollMode
  metadata: z.record(z.unknown()).optional(),
});

export const ProcessedDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  chapters: z.array(ChapterSchema).min(1),
  totalPages: z.number().int().nonnegative(),
  totalParagraphs: z.number().int().nonnegative(),
});

/* ═══════════════════════════════════════════════
   RAW TEXT ITEM SCHEMA (from PDF.js)
   ═══════════════════════════════════════════════ */

export const RawTextItemSchema = z.object({
  str: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fontName: z.string(),
  fontSize: z.number().optional(),
  isBold: z.boolean().optional(),
  isItalic: z.boolean().optional(),
});

/* ═══════════════════════════════════════════════
   PIPELINE CONFIGURATION SCHEMA
   ═══════════════════════════════════════════════ */

export const PipelineConfigSchema = z.object({
  maxCharsPerPage: z.number().int().positive().default(800),
  minParagraphLength: z.number().int().nonnegative().default(15),
  headerFooterMargin: z.number().min(0).max(0.5).default(0.08),
  lineYTolerance: z.number().positive().default(4),
  columnGapThreshold: z.number().positive().default(100),
  textThreshold: z.number().int().nonnegative().default(50),
  ocrCanvasScale: z.number().positive().default(2.5),
  ocrConfidenceThreshold: z.number().min(0).max(100).default(60),
  enableOcr: z.boolean().default(true),
  estimatedLineHeightPx: z.number().positive().default(20),
  estimatedPageHeightPx: z.number().positive().default(600),
});

/* ═══════════════════════════════════════════════
   WORKER MESSAGE SCHEMAS
   ═══════════════════════════════════════════════ */

export const WorkerInputSchema = z.object({
  type: z.literal('process'),
  arrayBuffer: z.instanceof(ArrayBuffer),
  fileName: z.string(),
  config: PipelineConfigSchema.partial().optional(),
});

export const WorkerProgressSchema = z.object({
  type: z.literal('progress'),
  stage: z.string(),
  percent: z.number().min(0).max(100),
  detail: z.string().optional(),
});

export const WorkerCompleteSchema = z.object({
  type: z.literal('complete'),
  data: ProcessedDocumentSchema,
});

export const WorkerErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  stage: z.string().optional(),
});

export const WorkerOutputSchema = z.discriminatedUnion('type', [
  WorkerProgressSchema,
  WorkerCompleteSchema,
  WorkerErrorSchema,
]);

/* ═══════════════════════════════════════════════
   TYPE EXPORTS
   ═══════════════════════════════════════════════ */

export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;
export type ParagraphBlock = z.infer<typeof ParagraphBlockSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type ListBlock = z.infer<typeof ListBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type PageContent = z.infer<typeof PageContentSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type ProcessedDocument = z.infer<typeof ProcessedDocumentSchema>;
export type RawTextItem = z.infer<typeof RawTextItemSchema>;
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;
export type WorkerInput = z.infer<typeof WorkerInputSchema>;
export type WorkerProgress = z.infer<typeof WorkerProgressSchema>;
export type WorkerComplete = z.infer<typeof WorkerCompleteSchema>;
export type WorkerError = z.infer<typeof WorkerErrorSchema>;
export type WorkerOutput = z.infer<typeof WorkerOutputSchema>;
