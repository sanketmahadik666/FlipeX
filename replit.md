# Rediscover Reading

A PDF reader application that transforms PDFs into an immersive, book-like reading experience.

## Architecture
- **Frontend-only** Vite + React + TypeScript application (no backend server)
- Uses React Router for navigation
- State management: Recoil, Jotai, and Redux Toolkit
- UI: shadcn/ui components with Tailwind CSS
- PDF processing: pdfjs-dist, pdf-lib, tesseract.js (OCR)
- Page flip: react-pageflip-enhanced

## Project Structure
- `src/pages/` - Route pages (Landing, Index, Upload, Reader, ExperienceSelector, NotFound)
- `src/components/` - Reusable components (UI, reader components, etc.)
- `src/hooks/` - Custom hooks (toast, mobile detection, page flip sounds)
- `src/lib/` - Utility libraries (PDF processing, OCR, image preprocessing)
- `src/state/` - State atoms (Jotai, Recoil)
- `src/store/` - Redux store and slices

## Running
- `npm run dev` starts the Vite dev server on port 5000
- `npm run build` builds for production

## Notes
- Migrated from Lovable to Replit
- Vite config updated to use port 5000 and host 0.0.0.0 for Replit compatibility