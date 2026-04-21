import { db } from "./db";
import { books, type Book, type InsertBook } from "../shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  createBook(book: InsertBook): Promise<Book>;
  getBook(id: string): Promise<Book | undefined>;
  listBooks(opts: { limit: number; offset: number }): Promise<{ items: Book[]; total: number }>;
  deleteBook(id: string): Promise<Book | undefined>;
  updateBook(id: string, patch: Partial<InsertBook>): Promise<Book | undefined>;
}

export class DbStorage implements IStorage {
  async createBook(book: InsertBook): Promise<Book> {
    const [row] = await db.insert(books).values(book).returning();
    return row;
  }

  async getBook(id: string): Promise<Book | undefined> {
    const [row] = await db.select().from(books).where(eq(books.id, id));
    return row;
  }

  async listBooks({ limit, offset }: { limit: number; offset: number }) {
    const items = await db
      .select()
      .from(books)
      .orderBy(desc(books.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(books);
    return { items, total: Number(count) };
  }

  async deleteBook(id: string): Promise<Book | undefined> {
    const [row] = await db.delete(books).where(eq(books.id, id)).returning();
    return row;
  }

  async updateBook(id: string, patch: Partial<InsertBook>): Promise<Book | undefined> {
    const [row] = await db
      .update(books)
      .set(patch)
      .where(eq(books.id, id))
      .returning();
    return row;
  }
}

export const storage = new DbStorage();
