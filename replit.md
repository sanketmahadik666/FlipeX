# Replit MD

## Overview

This is an immersive PDF reader web application that transforms PDF documents into a book-like reading experience. Users upload a PDF, the app processes and extracts text (handling columns, headers/footers, hyphenation), then presents the content in one of three reading modes: Classic (page-by-page with book aesthetics), Focus (one paragraph at a time for deep reading), or Scroll (continuous vertical reading). The app supports multiple visual themes (light, dark, sepia), adjustable font size and line spacing, and synthesized page-flip sounds.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend-Only SPA
This is a client-side single-page application with no backend server. All processing happens in the browser. There is no database, no API server, and no authentication system.

- **Build Tool**: Vite with React SWC plugin for fast development and hot module replacement
- **Language**: TypeScript (with relaxed strictness — `noImplicitAny: false`, unused vars allowed)
- **UI Framework**: React 18 with react-router-dom for client-side routing
- **Styling**: Tailwind CSS with CSS variables for theming (HSL color system), shadcn/ui component library built on Radix UI primitives
- **Dev server port**: 8080

### Routing Structure
Four routes defined in `src/App.tsx`:
- `/` — Landing page (marketing/intro)
- `/upload` — PDF file upload with drag-and-drop
- `/experience` — Reading mode selector (classic, focus, scroll)
- `/reader` — The main reading interface with the selected mode

### State Management (Three Systems)
The app uses three different state management libraries, each for a specific purpose:

1. **Redux Toolkit** (`src/store/`) — Global app status tracking (idle, uploading, processing, ready, error) and current document ID. Used for application-level workflow state.

2. **Recoil** (`src/state/recoilAtoms.ts`) — Document data and reading position. Stores the `ProcessedDocument` (extracted chapters, pages, paragraphs) and navigation indices (current chapter, page, paragraph). This is the core content state.

3. **Jotai** (`src/state/jotaiAtoms.ts`) — User preferences for the reading experience: font size, line spacing, reading mode, theme, and sound toggle. These are lightweight reactive atoms for UI settings.

### PDF Processing Pipeline
`src/lib/pdfProcessor.ts` handles all PDF parsing client-side using `pdfjs-dist` (PDF.js). Key features:
- Web Worker-based PDF parsing for non-blocking processing
- Smart text extraction handling multi-column layouts, header/footer detection, and hyphenation
- Content is structured into chapters, each with paragraphs and pre-paginated pages
- Output type: `ProcessedDocument` with `{ id, title, chapters[], totalPages, totalParagraphs }`

### Reading Modes (Components)
Three reader components in `src/components/reader/`:
- **ClassicMode** — Book-style page-by-page reading with page flip animations and dual-page layout on desktop
- **FocusMode** — Single paragraph display for distraction-free reading
- **ScrollMode** — Continuous scroll with progress indicator
- **ReaderControls** — Shared toolbar for theme, font size, line spacing, mode switching, and sound toggle

### Design System
- Fonts: Inter (UI), Lora (serif/reading), Space Mono (monospace)
- Color system: HSL CSS custom properties defined in `src/index.css`
- Component library: shadcn/ui (extensive set of Radix-based components in `src/components/ui/`)
- Three reading themes: light, dark, sepia (applied via CSS classes in Reader)

### Testing
- Vitest with jsdom environment and React Testing Library
- Test setup in `src/test/setup.ts` with `matchMedia` mock
- Run tests with `npm test` or `npm run test:watch`

### Audio
`src/hooks/usePageFlipSound.ts` generates a synthesized page-flip sound using the Web Audio API (white noise burst with bandpass filter). No external audio files needed. Respects `prefers-reduced-motion` and can be toggled via settings.

## External Dependencies

### Core Libraries
- **React 18** — UI framework
- **Vite** — Build tool and dev server
- **TypeScript** — Type safety

### State Management
- **@reduxjs/toolkit** + **react-redux** — App workflow state
- **recoil** — Document content and navigation state
- **jotai** — User preference atoms

### UI Components
- **shadcn/ui** — Component library (not a package, source code lives in `src/components/ui/`)
- **@radix-ui/*** — Accessible UI primitives (dialog, dropdown, tabs, toast, etc.)
- **lucide-react** — Icon library
- **class-variance-authority** + **clsx** + **tailwind-merge** — Utility-first CSS helpers
- **embla-carousel-react** — Carousel component
- **vaul** — Drawer component
- **sonner** — Toast notifications
- **recharts** — Charts (available but may not be actively used)
- **react-day-picker** + **date-fns** — Calendar/date functionality
- **cmdk** — Command palette
- **input-otp** — OTP input component

### PDF Processing
- **pdfjs-dist** — Mozilla's PDF.js for client-side PDF parsing (uses web worker via `?url` import)

### Routing & Data Fetching
- **react-router-dom** — Client-side routing
- **@tanstack/react-query** — Async state management (available for future API integration)
- **react-hook-form** + **@hookform/resolvers** — Form handling

### Theming
- **next-themes** — Theme provider (used by sonner toaster)
- **tailwindcss** + **autoprefixer** + **postcss** — CSS toolchain

### Development Tools
- **vitest** — Test runner
- **@testing-library/jest-dom** — DOM assertion matchers
- **lovable-tagger** — Development-only component tagging plugin
- **eslint** + **typescript-eslint** — Linting

### No Backend Services
There is no database, no server-side API, and no external service integrations. Everything runs in the browser. If a backend is added later, consider using the existing `@tanstack/react-query` setup for data fetching.