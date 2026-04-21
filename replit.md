# Rediscover Reading

A PDF reader application that transforms PDFs into an immersive, book-like reading experience.

## Architecture
- **Frontend**: Vite + React + TypeScript on port 5000
- **Backend**: Express + TypeScript on port 3001 (proxied via Vite at `/api`)
- **Database**: PostgreSQL (Replit-managed) via Drizzle ORM
- **File storage**: Raw PDFs and cover images on local disk under `uploads/`
  - `uploads/pdfs/` — uploaded PDF files (raw, original format)
  - `uploads/covers/` — cover images (uploaded or auto-extracted from page 1)
- State management: Recoil, Jotai, Redux Toolkit
- UI: shadcn/ui + Tailwind CSS
- PDF processing: pdfjs-dist, pdf-lib, tesseract.js (OCR)
- Page flip: react-pageflip-enhanced

## Project Structure
- `src/pages/` — Route pages (Landing, Bookshelf, Upload, Reader, ExperienceSelector, NotFound)
- `src/components/` — Reusable components (UI, reader, BookCard)
- `src/lib/` — Utility libs
  - `booksApi.ts` — REST client for the backend library
  - `coverExtractor.ts` — Renders page 1 of a PDF as the auto-cover
  - `pipeline/` — PDF processing pipeline (text extraction, OCR, layout analysis)
  - `pdfPageRenderer.ts`, `pdfProcessor.ts`, `ocrWorkerPool.ts`, `imagePreprocessing.ts`
- `src/state/` — Jotai + Recoil atoms
- `src/store/` — Redux store and slices
- `server/` — Express API
  - `index.ts` — entry point
  - `routes.ts` — REST routes (uploads, list, fetch, range-aware PDF stream, delete)
  - `storage.ts` — Drizzle-backed `IStorage` (createBook / listBooks / getBook / deleteBook)
  - `db.ts` — pg pool + drizzle client
- `shared/schema.ts` — Drizzle schema + Zod insert/select types (books table)
- `drizzle.config.ts` — Drizzle Kit config

## API
- `POST   /api/books` — multipart upload `{pdf, cover?, title, author?, pageCount?}`
- `GET    /api/books?page=&pageSize=` — paginated list
- `GET    /api/books/:id` — single book metadata
- `GET    /api/books/:id/cover` — cover image
- `GET    /api/books/:id/pdf` — raw PDF (supports HTTP `Range` for paged delivery)
- `DELETE /api/books/:id` — remove book + files

## Paginated PDF page delivery
- The server streams the original PDF and honors `Range` requests (`206 Partial Content`).
- PDF.js can be configured with `getDocument({ url, disableAutoFetch: true })` to fetch only the byte ranges for visible pages, providing on-demand page loading.
- The current pipeline downloads the whole buffer once for OCR/text extraction, but the same URL endpoint serves both whole-file and ranged requests.

## Running
- Workflow `Start application` runs both servers concurrently:
  `npx concurrently -k -n backend,frontend "tsx server/index.ts" "vite"`
- Schema sync: `npx drizzle-kit push --force`

## Notes
- Migrated from Lovable to Replit
- Original IndexedDB persistence (`src/lib/bookStorage.ts`, `userLibraryAtom`) is now superseded by the server API and is no longer used (kept for reference).
- Vite proxies `/api` → `http://127.0.0.1:3001`
