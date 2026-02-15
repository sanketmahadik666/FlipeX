# FlipeX

A PDF reader with a classic flipbook-style reading experience, focus mode, and scroll mode.

## Running the project

```bash
npm install
npm run dev
```

## Project structure (reference)

```
├── public/                 # Static assets
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── reader/         # Reading experience
│   │   │   ├── ClassicMode.tsx   # Book spread + 3D page flip, zoom, hash sync
│   │   │   ├── FocusMode.tsx
│   │   │   ├── ScrollMode.tsx
│   │   │   └── ReaderControls.tsx
│   │   └── ui/             # shadcn/ui primitives
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── usePageFlipSound.ts
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── pdfProcessor.ts # PDF → text pipeline
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Reader.tsx      # Mounts mode (Classic / Focus / Scroll) + controls
│   │   ├── Upload.tsx
│   │   ├── ExperienceSelector.tsx
│   │   └── ...
│   ├── state/
│   │   ├── jotaiAtoms.ts   # UI state: theme, font size, mode, book zoom, sound
│   │   └── recoilAtoms.ts  # Document state: processed doc, chapter/page index
│   └── store/              # Redux (app slice)
```

## PDF pipeline (`lib/pdfProcessor.ts`)

1. **Load PDF** — `pdfjs-dist` with worker.
2. **Text extraction** — Per-page text items (position, size); columns detected by x-position clusters.
3. **Header/footer removal** — Zone-based (top/bottom 8%) + repetition across pages; page numbers filtered.
4. **Lines** — Items sorted top-to-bottom, left-to-right; same-line grouping with spacing; hyphenation rejoined across lines.
5. **Paragraphs** — Empty-line breaks; short “page number” lines dropped; sentence-boundary heuristics.
6. **Pagination** — `MAX_CHARS_PER_PAGE` (~800); sentence-boundary splits; widow/orphan pass (min chars on first/last line).
7. **Chapters** — Title detection (e.g. “Chapter 1”, “Part I”, “Prologue”); each chapter gets its own `paragraphs` and `pages`.

Output: `ProcessedDocument` with `chapters[]`, each chapter has `pages: string[][]` (page = array of paragraph strings). Used by Classic/Focus/Scroll modes.

## Classic Book mode (flipbook effect)

- **Spread model** — All chapter pages flattened; desktop = left/right spread, mobile = single page.
- **3D flip** — CSS `rotateY` with easing; flipping page overlay with fold shadow; respects `prefers-reduced-motion`.
- **Action bar** — Prev | Zoom out | Page X of Y | Zoom in | Next; keyboard: Arrow Left/Right, Space (next).
- **Book zoom** — `bookZoomAtom` scales the book (0.85–1.3); persisted in session.
- **Hash sync** — URL `#page3` (1-based) for current spread; back/forward and shareable links.
- **Sound** — Optional page-flip sound (Web Audio); toggled in Reader controls.

## UI / state

- **Jotai** — `fontSizeAtom`, `lineSpacingAtom`, `readingModeAtom`, `readingThemeAtom`, `soundEnabledAtom`, `bookZoomAtom`.
- **Recoil** — `processedDocumentAtom`, `currentChapterIndexAtom`, `currentPageIndexAtom`.
