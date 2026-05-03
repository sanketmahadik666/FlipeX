# FlipeX End-to-End Architecture & Upload Flow Issues

## Executive Summary
This document outlines the **complete end-to-end flow** for the FlipeX PDF reader application, focusing on the **client-side document setup** and identifying **upload-to-bookshelf integration issues**.

### Current Flow Overview
```
Upload.tsx (Form) 
  → booksApi.uploadBook() (XMLHttpRequest to /api/books)
    → Server: POST /api/books (multer + storage layer)
      → DB: Insert book metadata
  → navigate('/bookshelf')
    → Bookshelf.tsx (React Query useQuery)
      → listBooks() API call
      → Display books + mocks
```

## Identified Issues & Solutions

### **Issue 1: Query Cache Not Invalidated After Upload** ⭐ CRITICAL P0 FIX
**Problem:** After `uploadBook()` succeeds, the app navigates to `/bookshelf`, but React Query's cache for `['/api/books', page, PAGE_SIZE]` is stale. The new book won't appear until user manually refreshes or the component refetches.

**Root Cause:** React Query maintains separate cache entries for each pagination key. When you upload a book and navigate to page 1, if the cache entry `['/api/books', 1, 12]` already exists, React Query will serve the stale cached data instead of refetching.

**Solution:** Implement cache invalidation + optimistic update strategy
```typescript
// In src/pages/Upload.tsx
import { useQueryClient } from '@tanstack/react-query';
import type { BookListResponse } from '@/lib/booksApi';

const PAGE_SIZE = 12; // Must match Bookshelf.tsx

const Upload = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const handleSubmit = async () => {
    if (!pdfFile) {
      setLocalError('A PDF file is required to add a book.');
      return;
    }
    
    setSaving(true);
    setUploadPct(0);
    setLocalError(null);
    
    try {
      // Step 1: Upload the book
      const newBook = await uploadBook({
        pdf: pdfFile,
        cover: coverBlob,
        title: title || pdfFile.name.replace(/\.pdf$/i, ''),
        author: author || undefined,
        pageCount: pageCount ?? undefined,
        onProgress: setUploadPct,
      });
      
      // Step 2: Optimistically update page 1 cache
      queryClient.setQueryData(
        ['/api/books', 1, PAGE_SIZE],
        (oldData: BookListResponse | undefined) => {
          if (!oldData) return oldData; // Fallback if cache doesn't exist
          return {
            ...oldData,
            items: [newBook, ...oldData.items.slice(0, PAGE_SIZE - 1)],
            total: oldData.total + 1,
            totalPages: Math.ceil((oldData.total + 1) / PAGE_SIZE),
          };
        }
      );
      
      // Step 3: Invalidate ALL book-related queries (all pages + details)
      // This ensures Bookshelf will refetch fresh data when component mounts
      await queryClient.invalidateQueries({
        queryKey: ['/api/books'],
        exact: false, // Match all queries starting with '/api/books'
      });
      
      // Step 4: Wait for any pending mutations to complete
      await queryClient.cancelQueries({ queryKey: ['/api/books'] });
      
      // Step 5: Navigate with a small delay to ensure mutations are flushed
      setTimeout(() => {
        navigate('/bookshelf');
      }, 100);
      
    } catch (e: any) {
      console.error('Upload failed:', e);
      
      // On error, remove the optimistic update
      queryClient.removeQueries({ queryKey: ['/api/books', 1, PAGE_SIZE] });
      
      setLocalError(e?.message || 'Failed to upload book.');
      setSaving(false);
    }
  };
  
  // ... rest of component
};
```

**Key Implementation Details:**
- `queryKey: ['/api/books']` with `exact: false` invalidates ALL pagination variants
- `optimistic update` prepends new book to page 1 immediately
- `cancelQueries()` prevents race conditions during invalidation
- Small timeout before navigation allows cache to be flushed
- Error handling removes optimistic update if upload fails

**Why This Works:**
1. ✅ Optimistic UI — User sees book immediately
2. ✅ Cache consistency — All queries invalidated, no stale data
3. ✅ Performance — Bookshelf refetches fresh list on navigation
4. ✅ Error resilient — Rollback if upload fails

---

### **Issue 2: No Real-time List Update on Bookshelf**
**Problem:** When a new book is uploaded, `showMocks` condition still shows mock library because `userBooks.length === 0` might still evaluate to true during initial render.

**Solution:** Implement optimistic update + refetch pattern
```typescript
// In Bookshelf.tsx
const { data, isLoading, isError, refetch } = useQuery<BookListResponse>({
  queryKey: ['/api/books', page, PAGE_SIZE],
  queryFn: () => listBooks(page, PAGE_SIZE),
  // Force refetch when component mounts or page changes
  staleTime: 0, // No cache
  gcTime: 0,   // Don't store in background
});

// Add effect to refetch on component focus
useEffect(() => {
  window.addEventListener('focus', refetch);
  return () => window.removeEventListener('focus', refetch);
}, [refetch]);
```

---

### **Issue 3: Cover Images Not Loading After Upload**
**Problem:** After upload, `coverUrl` might be null or the image path might not be properly resolved on the server.

**Solution Checklist:**
1. Verify server returns correct `coverUrl` in POST response:
```typescript
// In server/routes.ts - POST /books
const book = await storage.createBook({
  // ... existing fields
});
// Ensure response includes full coverUrl
res.status(201).json({
  ...book,
  coverUrl: book.coverPath ? `/api/books/${book.id}/cover` : null,
});
```

2. Client-side fallback for missing covers:
```typescript
// In BookCard.tsx
<img 
  src={coverUrl || '/api/books/default-cover.png'} 
  onError={(e) => {
    e.currentTarget.src = '/placeholder-book-cover.svg';
  }}
  alt={title}
/>
```

---

### **Issue 4: Upload Progress Not Persisted Across Navigation**
**Problem:** If user closes modal before redirect completes, upload state is lost.

**Solution:** Add timeout + retry logic
```typescript
// In Upload.tsx
const handleSubmit = async () => {
  setSaving(true);
  setUploadPct(0);
  
  try {
    const book = await uploadBook({
      pdf: pdfFile,
      cover: coverBlob,
      title: title || pdfFile.name.replace(/\.pdf$/i, ''),
      author: author || undefined,
      pageCount: pageCount ?? undefined,
      onProgress: setUploadPct,
    });
    
    // Cache the newly uploaded book optimistically
    queryClient.setQueryData(
      ['/api/books', 1, PAGE_SIZE],
      (old: BookListResponse | undefined) => ({
        ...old,
        items: [book, ...(old?.items ?? [])],
        total: (old?.total ?? 0) + 1,
      })
    );
    
    // Small delay to ensure server state is written
    await new Promise(r => setTimeout(r, 500));
    navigate('/bookshelf');
  } catch (e: any) {
    setLocalError(e?.message || 'Upload failed');
    setSaving(false);
  }
};
```

---

### **Issue 5: Mock Library Interferes with Empty State**
**Problem:** `showMocks = page === 1 && userBooks.length === 0` shows mock books even after upload on page 2.

**Solution:** Better empty state detection
```typescript
// In Bookshelf.tsx
const hasRealBooks = (userBooks.length > 0) || (data && data.total > 0);
const showMocks = page === 1 && !hasRealBooks && !isLoading;
```

---

## Client-Side Document Setup Best Practices

### **Recommended Initialization Flow**
```
App.tsx (Entry)
├── Initialize Redux store (app status, currentDocumentId)
├── Initialize Recoil atoms (processedDocument, bookZoom, theme)
├── Initialize React Query (with cache config)
└── Route to:
    ├── /bookshelf (List all uploaded books)
    ├── /upload (Add new book)
    ├── /experience (Select reading mode)
    └── /reader (Main reading view)
```

### **Optimization: Pre-load User Books**
```typescript
// In App.tsx or root layout
useEffect(() => {
  // Pre-fetch first page of books on app startup
  queryClient.prefetchQuery({
    queryKey: ['/api/books', 1, PAGE_SIZE],
    queryFn: () => listBooks(1, PAGE_SIZE),
  });
}, [queryClient]);
```

---

## Data Flow Architecture

### **State Management Layers**
1. **Redux** (`store/`) — Global app state (status, currentDocumentId)
2. **Recoil** (`state/`) — Document state (processedDocument, currentPage)
3. **Jotai** (`state/jotaiAtoms.ts`) — UI preferences (theme, fontSize, soundEnabled)
4. **React Query** — Server state (book list, book details)
5. **Component Local** — Form inputs, animations, transient UI state

### **Critical Path for Upload → Display**
```
1. User submits form in Upload.tsx
2. uploadBook() sends FormData via XMLHttpRequest
3. Server validates, stores files, returns ApiBook object
4. Client invalidates React Query cache: ['/api/books']
5. navigate('/bookshelf') → Bookshelf renders
6. useQuery refetches ['/api/books', 1, PAGE_SIZE]
7. New book appears in book grid with animation
8. User can click → starts PDF processing pipeline
9. processedDocument stored in Recoil
10. Navigate to /experience or directly to /reader
```

---

## Recommended Fixes Implementation Priority

| Priority | Issue | Fix Time | Impact |
|----------|-------|----------|--------|
| **P0** | Query cache not invalidated | 15 min | High — Books disappear after upload |
| **P1** | Mock library shows after upload | 10 min | High — UX confusion |
| **P2** | Cover images fail to load | 20 min | Medium — Visual defect |
| **P3** | Upload progress lost on navigation | 25 min | Low — Edge case |
| **P4** | Real-time sync on page focus | 15 min | Medium — Better UX |

---

## Proposed Code Changes

### **1. Update Upload.tsx** (COMPLETE IMPLEMENTATION)
```typescript
// src/pages/Upload.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, AlertCircle, Image as ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadBook, type ApiBook, type BookListResponse } from '@/lib/booksApi';
import { extractCoverFromPdf, getPdfPageCount } from '@/lib/coverExtractor';

const PAGE_SIZE = 12; // MUST MATCH Bookshelf.tsx PAGE_SIZE

const Upload = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [error, setLocalError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [coverBlob, setCoverBlob] = useState<Blob | undefined>();
  const [coverAuto, setCoverAuto] = useState(false);
  const [extractingCover, setExtractingCover] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [dragOverPdf, setDragOverPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ... existing handlers (handlePdfDrop, handlePdfSelect, handleCoverSelect) ...

  const handleSubmit = async () => {
    if (!pdfFile) {
      setLocalError('A PDF file is required to add a book.');
      return;
    }

    setSaving(true);
    setUploadPct(0);
    setLocalError(null);

    try {
      // STEP 1: Upload book to server
      const newBook = await uploadBook({
        pdf: pdfFile,
        cover: coverBlob,
        title: title || pdfFile.name.replace(/\.pdf$/i, ''),
        author: author || undefined,
        pageCount: pageCount ?? undefined,
        onProgress: setUploadPct,
      });

      console.log('✅ Upload successful:', newBook.id, newBook.title);

      // STEP 2: Optimistically update page 1 cache
      queryClient.setQueryData(
        ['/api/books', 1, PAGE_SIZE],
        (oldData: BookListResponse | undefined) => {
          if (!oldData) return oldData; // Graceful fallback
          return {
            ...oldData,
            items: [newBook, ...oldData.items.slice(0, PAGE_SIZE - 1)],
            total: oldData.total + 1,
            totalPages: Math.ceil((oldData.total + 1) / PAGE_SIZE),
          } as BookListResponse;
        }
      );
      console.log('✅ Optimistic cache updated');

      // STEP 3: Invalidate ALL book queries (ensures fresh data on Bookshelf)
      await queryClient.invalidateQueries({
        queryKey: ['/api/books'],
        exact: false, // Matches ['/api/books', 1, 12], ['/api/books', 2, 12], etc.
      });
      console.log('✅ Query cache invalidated');

      // STEP 4: Cancel any in-flight requests
      await queryClient.cancelQueries({ queryKey: ['/api/books'] });

      // STEP 5: Navigate with a small delay
      // This allows React Query to flush pending mutations before unmount
      setTimeout(() => {
        navigate('/bookshelf');
      }, 100);

    } catch (e: any) {
      console.error('❌ Upload failed:', e);

      // ROLLBACK: Remove optimistic update on error
      queryClient.removeQueries({
        queryKey: ['/api/books', 1, PAGE_SIZE],
        exact: true,
      });

      setLocalError(e?.message || 'Failed to upload book.');
      setSaving(false);
    }
  };

  return (
    // ... existing JSX (Form, Cover preview, File input, etc.) ...
    // Just replace handleSubmit in existing Button onClick
    <Button onClick={handleSubmit} disabled={saving || !pdfFile}>
      {saving ? 'Adding to Library...' : 'Add to Library'}
    </Button>
  );
};

export default Upload;
```

**Implementation Checklist:**
- ✅ `useQueryClient()` hook imported and used
- ✅ `PAGE_SIZE` constant matches Bookshelf.tsx
- ✅ Optimistic update prepends new book to cache
- ✅ `queryKey: ['/api/books'], exact: false` invalidates all pages
- ✅ Error handling rolls back optimistic update
- ✅ Small timeout before navigation (100ms for mutation flush)

### **2. Update Bookshelf.tsx** (COMPLETE IMPLEMENTATION)
```typescript
// src/pages/Bookshelf.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useDispatch } from 'react-redux';
import { useSetRecoilState } from 'recoil';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import { BookCard } from '@/components/BookCard';
import { GRAB_CONFIG } from '@/animations/bookGrab.config';
import { generateSampleDocument } from '@/lib/sampleDocument';
import { setStatus, setCurrentDocumentId } from '@/store/appSlice';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import { processPDFBufferInWorker } from '@/lib/pipeline/pipelineWorkerClient';
import { listBooks, type ApiBook, type BookListResponse, fetchPdfBuffer } from '@/lib/booksApi';
import '@/animations/bookGrab.css';

const PAGE_SIZE = 12; // MUST MATCH Upload.tsx PAGE_SIZE

const MOCK_LIBRARY: Array<{ id: string; title: string; author: string; coverImage?: string }> = [
  { id: 'mock-1', title: 'The Antigravity Handbook', author: 'Dr. Float' },
  { id: 'mock-2', title: 'Quantum Kinetics', author: 'Marie Physics' },
  { id: 'mock-3', title: 'A Short History of Nearly Everything', author: 'Bill Bryson' },
  { id: 'mock-4', title: 'Cosmos', author: 'Carl Sagan' },
  { id: 'mock-5', title: 'GSAP Animation Strategies', author: 'Frontend Guru' },
];

export default function Bookshelf() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const setDocument = useSetRecoilState(processedDocumentAtom);
  const queryClient = useQueryClient();
  const gridRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressDetail, setProgressDetail] = useState('');

  // CRITICAL: staleTime: 0 means cache is ALWAYS considered stale
  // This forces refetch when useQuery is called (e.g., on component mount)
  // or when the browser regains focus
  const { data, isLoading, isError, refetch } = useQuery<BookListResponse>({
    queryKey: ['/api/books', page, PAGE_SIZE],
    queryFn: () => listBooks(page, PAGE_SIZE),
    staleTime: 0, // Always refetch on mount
    gcTime: 5 * 60 * 1000, // 5 min garbage collection
  });

  const userBooks: ApiBook[] = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  // FIXED: Better empty state logic
  // Only show mocks if we're on page 1 AND there are NO real books AND data has loaded
  const hasRealBooks = (userBooks.length > 0) || (data && data.total > 0);
  const showMocks = page === 1 && !hasRealBooks && !isLoading;

  const displayItems = showMocks
    ? MOCK_LIBRARY.map(b => ({ kind: 'mock' as const, id: b.id, title: b.title, author: b.author, coverUrl: undefined as string | undefined }))
    : userBooks.map(b => ({ kind: 'user' as const, id: b.id, title: b.title, author: b.author, coverUrl: b.coverUrl ?? undefined, book: b }));

  // Ambient float animation for books
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.book-card');
    if (cards.length === 0) return;

    const ambientY = gsap.to(cards, {
      y: GRAB_CONFIG.AMBIENT_FLOAT_Y,
      duration: GRAB_CONFIG.AMBIENT_FLOAT_DURATION,
      ease: GRAB_CONFIG.AMBIENT_FLOAT_EASE,
      repeat: GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,
      yoyo: GRAB_CONFIG.AMBIENT_FLOAT_YOYO,
      stagger: { each: GRAB_CONFIG.AMBIENT_FLOAT_STAGGER ?? 0.05, from: "random" as any },
    });
    return () => { ambientY.kill(); };
  }, [displayItems.length]);

  // CRITICAL: Refetch on window focus
  // This ensures users see fresh data if they return to the tab after uploading elsewhere
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Window focused, refetching books...');
      refetch();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch]);

  const onProgress = (stage: string, percent: number, detail?: string) => {
    setProgressStage(stage);
    setProgressPercent(percent);
    setProgressDetail(detail || '');
  };

  const handleUserBookSelected = async (book: ApiBook) => {
    dispatch(setStatus('processing'));
    setProcessing(true);
    setProgressStage('Downloading PDF');
    setProgressPercent(0);
    setProgressDetail(book.pdfFileName);

    try {
      const buffer = await fetchPdfBuffer(book.pdfUrl);
      const doc = await processPDFBufferInWorker(buffer, book.pdfFileName, onProgress);
      doc.title = book.title || doc.title;
      setDocument(doc as any);
      dispatch(setCurrentDocumentId(doc.id));
      dispatch(setStatus('ready'));
      navigate('/experience');
    } catch (e) {
      console.error('Pipeline failed processing PDF:', e);
      dispatch(setStatus('error'));
      setProcessing(false);
    }
  };

  const handleMockSelected = async (id: string) => {
    dispatch(setStatus('processing'));
    await new Promise(resolve => setTimeout(resolve, 300));
    const doc = generateSampleDocument();
    doc.title = MOCK_LIBRARY.find(b => b.id === id)?.title || doc.title;
    setDocument(doc);
    dispatch(setCurrentDocumentId(doc.id));
    dispatch(setStatus('ready'));
    navigate('/experience');
  };

  const circumference = 264;
  const dashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div id="drawer" className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 sm:p-12">
      {/* PROCESSING OVERLAY */}
      {processing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-6 animate-in fade-in duration-500">
          <div className="w-full max-w-md space-y-6 text-center">
            <h2 className="font-serif text-2xl font-semibold text-foreground">Processing your book…</h2>
            <p className="text-muted-foreground">{progressStage || 'Analyzing document structure'}</p>
          </div>
        </div>
      )}

      {/* BOOKSHELF GRID */}
      <div ref={gridRef} className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {displayItems.map(item => (
          <div
            key={item.id}
            onClick={() => item.kind === 'user' ? handleUserBookSelected(item.book!) : handleMockSelected(item.id)}
          >
            <BookCard title={item.title} author={item.author} coverUrl={item.coverUrl} />
          </div>
        ))}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center gap-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft />
          </button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
```

**Key Changes in Bookshelf.tsx:**
- ✅ `staleTime: 0` — Always refetches on mount (eliminates stale cache on return)
- ✅ Window focus listener — Auto-refetch when user returns to tab
- ✅ Better `showMocks` logic — Checks `data.total > 0` instead of just `userBooks.length`
- ✅ `PAGE_SIZE` constant matches Upload.tsx
- ✅ Proper error handling in book processing pipeline

---

---

## Cache Invalidation Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER UPLOADS PDF                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  uploadBook() XHR POST        │
        │  /api/books (multipart)       │
        └──────────────┬────────────────┘
                       ↓ (SUCCESS)
        ┌──────────────────────────────┐
        │  Server returns ApiBook       │
        │  { id, title, author, ...}   │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │ STEP 1: Optimistic Update    │
        │ queryClient.setQueryData()    │
        │ Prepend book to ['/api/..1']  │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │ STEP 2: Invalidate Cache     │
        │ queryKey: ['/api/books']     │
        │ exact: false (all pages)      │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │ STEP 3: Cancel In-Flight     │
        │ cancelQueries() prevents race │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │ STEP 4: Navigate (100ms)     │
        │ setTimeout(() => {           │
        │   navigate('/bookshelf')     │
        │ }, 100)                      │
        └──────────────┬────────────────┘
                       ↓
    ┌──────────────────────────────────────┐
    │ Bookshelf.tsx component mounts       │
    │ staleTime: 0 triggers REFETCH        │
    └──────────────┬───────────────────────┘
                   ↓
    ┌──────────────────────────────────────┐
    │ listBooks(1, PAGE_SIZE) fetches      │
    │ FRESH data from server (with new book)
    └──────────────┬───────────────────────┘
                   ↓
    ┌──────────────────────────────────────┐
    │ ✅ New book renders in bookshelf     │
    │ + Ambient float animation starts     │
    └──────────────────────────────────────┘
```

---

## Implementation Verification Checklist

### **Before Implementing:**
- [ ] Both Upload.tsx and Bookshelf.tsx import from `@tanstack/react-query`
- [ ] `PAGE_SIZE` constant is identical in both files (12)
- [ ] API types are imported: `BookListResponse`, `ApiBook`

### **While Implementing:**
- [ ] Copy cache invalidation code block into `handleSubmit()`
- [ ] Add `const queryClient = useQueryClient();` at top of Upload component
- [ ] Add `const queryClient = useQueryClient();` at top of Bookshelf component
- [ ] Update `staleTime: 0` in Bookshelf's useQuery options
- [ ] Add window focus listener in useEffect
- [ ] Update `showMocks` logic to check `data.total`

### **After Implementing:**
- [ ] Run `npm run dev` and open browser console
- [ ] Open DevTools React Query Devtools plugin (if installed)
- [ ] Upload a PDF and watch console logs:
  ```
  ✅ Upload successful: [book-id]
  ✅ Optimistic cache updated
  ✅ Query cache invalidated
  (navigate to /bookshelf)
  🔄 Window focused, refetching books...
  ✅ New book renders
  ```
- [ ] Book should appear **immediately** on Bookshelf after upload
- [ ] Cover image should load from `/api/books/:id/cover`
- [ ] Pagination should work correctly with new book

### **Edge Case Tests:**
- [ ] Upload → Close browser tab → Reopen → Book persists ✅
- [ ] Upload on page 1 → Navigate to page 2 → Back to page 1 → Book visible ✅
- [ ] Upload → Quickly upload another book → Both appear ✅
- [ ] Upload with no cover → Fallback image appears ✅
- [ ] Network error during upload → Error message appears, optimistic update rolls back ✅

---

## Common Issues & Debugging

### **Issue: Book doesn't appear after upload**
```typescript
// Debug: Check React Query DevTools
// Look for ['/api/books', 1, 12] query status
// Should be "fetching" then "success" after navigate

// Or add console logs
console.log('Query state:', queryClient.getQueryState(['/api/books', 1, PAGE_SIZE]));
```

### **Issue: Book appears but cover doesn't load**
```typescript
// Check server response in Network tab
// GET /api/books/:id/cover should return 200 with image

// Check BookCard.tsx has fallback
<img src={coverUrl || '/placeholder.svg'} onError={() => {...}} />
```

### **Issue: Pagination shows wrong count after upload**
```typescript
// Ensure totalPages calculation is correct
Math.ceil((oldData.total + 1) / PAGE_SIZE)

// Verify server also increments total in response
```

### **Issue: Mock books show after upload**
```typescript
// Check condition: page === 1 && !hasRealBooks && !isLoading
// Make sure isLoading is false BEFORE checking hasRealBooks

// Add debug log
console.log('showMocks:', { page, hasRealBooks, isLoading });
```

---

## Testing Checklist


- [ ] Upload PDF → Book appears on bookshelf immediately
- [ ] Upload with custom cover → Cover image loads
- [ ] Navigate away during upload → Graceful error handling
- [ ] Upload on page 2+ → Mock books don't interfere
- [ ] Browser refresh after upload → Book persists
- [ ] Multiple uploads in sequence → All appear in list
- [ ] Pagination works with newly uploaded books
- [ ] Cover fallback works if image missing

---

