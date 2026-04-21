import { pgTable, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author").notNull().default("Unknown Author"),
  pdfFileName: text("pdf_file_name").notNull(),
  pdfPath: text("pdf_path").notNull(),
  pdfSize: integer("pdf_size").notNull(),
  coverPath: text("cover_path"),
  coverMimeType: text("cover_mime_type"),
  pageCount: integer("page_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
});

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export const bookMetadataSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(500).optional(),
});
export type BookMetadata = z.infer<typeof bookMetadataSchema>;
