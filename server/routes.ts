import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { bookMetadataSchema } from "../shared/schema";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const PDF_DIR = path.join(UPLOAD_ROOT, "pdfs");
const COVER_DIR = path.join(UPLOAD_ROOT, "covers");

for (const dir of [PDF_DIR, COVER_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) => {
      cb(null, file.fieldname === "cover" ? COVER_DIR : PDF_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || (file.fieldname === "cover" ? ".png" : ".pdf");
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB cap
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "pdf") {
      if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
        return cb(null, true);
      }
      return cb(new Error("PDF must be application/pdf"));
    }
    if (file.fieldname === "cover") {
      if (file.mimetype.startsWith("image/")) return cb(null, true);
      return cb(new Error("Cover must be an image"));
    }
    cb(null, false);
  },
});

export function buildRouter(): Router {
  const router = Router();

  // POST /api/books — multipart upload (pdf + optional cover + metadata)
  router.post(
    "/books",
    upload.fields([
      { name: "pdf", maxCount: 1 },
      { name: "cover", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const pdfFile = files?.pdf?.[0];
        const coverFile = files?.cover?.[0];
        if (!pdfFile) {
          return res.status(400).json({ error: "Missing pdf file" });
        }

        const meta = bookMetadataSchema.parse({
          title: req.body.title || pdfFile.originalname.replace(/\.pdf$/i, ""),
          author: req.body.author || undefined,
        });

        const pageCountRaw = req.body.pageCount;
        const pageCount = pageCountRaw ? Number(pageCountRaw) : undefined;

        const book = await storage.createBook({
          title: meta.title,
          author: meta.author || "Unknown Author",
          pdfFileName: pdfFile.originalname,
          pdfPath: path.relative(UPLOAD_ROOT, pdfFile.path),
          pdfSize: pdfFile.size,
          coverPath: coverFile ? path.relative(UPLOAD_ROOT, coverFile.path) : null,
          coverMimeType: coverFile ? coverFile.mimetype : null,
          pageCount: Number.isFinite(pageCount) ? pageCount! : null,
        });

        res.status(201).json(book);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid metadata", issues: err.issues });
        }
        console.error("Upload failed:", err);
        res.status(500).json({ error: err.message || "Upload failed" });
      }
    }
  );

  // GET /api/books?page=1&pageSize=20 — paginated list
  router.get("/books", async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const { items, total } = await storage.listBooks({ limit: pageSize, offset });
    res.json({
      items: items.map(stripPaths),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  });

  // GET /api/books/:id
  router.get("/books/:id", async (req, res) => {
    const book = await storage.getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "Not found" });
    res.json(stripPaths(book));
  });

  // GET /api/books/:id/cover
  router.get("/books/:id/cover", async (req, res) => {
    const book = await storage.getBook(req.params.id);
    if (!book || !book.coverPath) return res.status(404).end();
    const abs = path.join(UPLOAD_ROOT, book.coverPath);
    res.setHeader("Content-Type", book.coverMimeType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    fs.createReadStream(abs).pipe(res);
  });

  // GET /api/books/:id/pdf — supports HTTP Range for paginated PDF.js loading
  router.get("/books/:id/pdf", async (req: Request, res: Response) => {
    const book = await storage.getBook(req.params.id);
    if (!book) return res.status(404).end();
    const abs = path.join(UPLOAD_ROOT, book.pdfPath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      return res.status(404).end();
    }
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (!match) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", String(end - start + 1));
      fs.createReadStream(abs, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", String(fileSize));
      fs.createReadStream(abs).pipe(res);
    }
  });

  // DELETE /api/books/:id
  router.delete("/books/:id", async (req, res) => {
    const book = await storage.deleteBook(req.params.id);
    if (!book) return res.status(404).json({ error: "Not found" });
    // best-effort delete files
    for (const rel of [book.pdfPath, book.coverPath].filter(Boolean) as string[]) {
      try {
        fs.unlinkSync(path.join(UPLOAD_ROOT, rel));
      } catch {}
    }
    res.json({ ok: true });
  });

  return router;
}

function stripPaths(book: any) {
  const { pdfPath, coverPath, coverMimeType, ...rest } = book;
  return {
    ...rest,
    hasCover: !!coverPath,
    coverUrl: coverPath ? `/api/books/${book.id}/cover` : null,
    pdfUrl: `/api/books/${book.id}/pdf`,
  };
}
