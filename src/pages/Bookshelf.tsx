import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useDispatch } from 'react-redux';
import { useSetRecoilState } from 'recoil';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import { BookCard } from '@/components/BookCard';
import { GRAB_CONFIG } from '@/animations/bookGrab.config';
import { generateSampleDocument } from '@/lib/sampleDocument';
import { setStatus, setCurrentDocumentId } from '@/store/appSlice';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import { processPDFBufferInWorker } from '@/lib/pipeline/pipelineWorkerClient';
import { listBooks, type ApiBook, type BookListResponse, fetchPdfBuffer } from '@/lib/booksApi';
import '@/animations/bookGrab.css';

// Mock library kept as fallback when no books have been uploaded yet
const MOCK_LIBRARY: Array<{ id: string; title: string; author: string; coverImage?: string }> = [
  { id: 'mock-1', title: 'The Antigravity Handbook', author: 'Dr. Float' },
  { id: 'mock-2', title: 'Quantum Kinetics', author: 'Marie Physics' },
  { id: 'mock-3', title: 'A Short History of Nearly Everything', author: 'Bill Bryson' },
  { id: 'mock-4', title: 'Cosmos', author: 'Carl Sagan' },
  { id: 'mock-5', title: 'GSAP Animation Strategies', author: 'Frontend Guru' },
];

const PAGE_SIZE = 12;

export default function Bookshelf() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const setDocument = useSetRecoilState(processedDocumentAtom);
  const gridRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressDetail, setProgressDetail] = useState('');

  const { data, isLoading, isError } = useQuery<BookListResponse>({
    queryKey: ['/api/books', page, PAGE_SIZE],
    queryFn: () => listBooks(page, PAGE_SIZE),
  });

  const userBooks: ApiBook[] = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const showMocks = page === 1 && userBooks.length === 0;
  const displayItems = showMocks
    ? MOCK_LIBRARY.map(b => ({ kind: 'mock' as const, id: b.id, title: b.title, author: b.author, coverUrl: undefined as string | undefined }))
    : userBooks.map(b => ({ kind: 'user' as const, id: b.id, title: b.title, author: b.author, coverUrl: b.coverUrl ?? undefined, book: b }));

  // Ambient float animation
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
      stagger: { each: GRAB_CONFIG.AMBIENT_FLOAT_STAGGER, from: "random" as any },
    });
    const ambientSway = gsap.to(cards, {
      rotationZ: GRAB_CONFIG.AMBIENT_FLOAT_ROT_Z,
      duration: GRAB_CONFIG.AMBIENT_SWAY_DURATION,
      ease: GRAB_CONFIG.AMBIENT_SWAY_EASE,
      repeat: GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,
      yoyo: GRAB_CONFIG.AMBIENT_FLOAT_YOYO,
      stagger: { each: GRAB_CONFIG.AMBIENT_FLOAT_STAGGER, from: "random" as any },
    });
    const ambientBreathe = gsap.to(cards, {
      scale: GRAB_CONFIG.AMBIENT_FLOAT_SCALE,
      duration: GRAB_CONFIG.AMBIENT_BREATHE_SCALE_DURATION,
      ease: GRAB_CONFIG.AMBIENT_FLOAT_EASE,
      repeat: GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,
      yoyo: GRAB_CONFIG.AMBIENT_FLOAT_YOYO,
      stagger: { each: GRAB_CONFIG.AMBIENT_FLOAT_STAGGER, from: "random" as any },
    });
    return () => { ambientY.kill(); ambientSway.kill(); ambientBreathe.kill(); };
  }, [displayItems.length]);

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
      // Fetch the raw PDF bytes from the server (server supports HTTP Range,
      // so the browser/PDF.js can fetch sub-ranges efficiently as well).
      const buffer = await fetchPdfBuffer(book.pdfUrl);
      // Run through the same Web Worker pipeline used for locally uploaded
      // PDFs so rendering stays identical regardless of source.
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
            <p className="text-muted-foreground" data-testid="text-processing-stage">{progressStage || 'Analyzing document structure'}</p>

            <div className="flex justify-center py-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl" />
                <svg className="transform -rotate-90" width="160" height="160" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/20" strokeLinecap="round" />
                  <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={`${circumference} ${circumference}`}
                    className="text-primary transition-all duration-500 ease-out"
                    strokeLinecap="round"
                    style={{ strokeDashoffset: dashoffset }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-primary" data-testid="text-processing-percent">{progressPercent}%</span>
                </div>
              </div>
            </div>

            {progressDetail && (
              <div className="mt-4 rounded-lg bg-muted/50 backdrop-blur-sm border border-border p-4 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5"><div className="w-2 h-2 bg-primary rounded-full animate-pulse" /></div>
                  <p className="text-sm text-foreground font-mono flex-1">{progressDetail}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-12 text-center text-zinc-100">
        <h1 className="text-4xl font-serif font-medium drop-shadow-md">Your Library</h1>
        <p className="mt-2 text-zinc-400">
          {data ? `${data.total} ${data.total === 1 ? 'book' : 'books'} in your library` : 'Select a book to start reading'}
        </p>
        <button
          onClick={() => navigate('/upload')}
          className="mt-6 rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 border border-zinc-700"
          data-testid="button-add-book"
        >
          + Add New Book
        </button>
      </div>

      {/* GRID */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-zinc-300" data-testid="text-loading-library">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading library…
        </div>
      ) : isError ? (
        <div className="text-red-400" data-testid="text-library-error">Failed to load library. Refresh to try again.</div>
      ) : (
        <>
          <div
            ref={gridRef}
            className="book-grid is-antigravity flex flex-wrap justify-center gap-8 md:gap-12 w-full max-w-6xl p-8 rounded-xl"
            data-testid="grid-bookshelf"
          >
            {displayItems.map((item) => (
              <BookCard
                key={item.id}
                title={item.title}
                author={item.author}
                coverImage={item.coverUrl}
                onGrabCompleted={() =>
                  item.kind === 'user' ? handleUserBookSelected(item.book) : handleMockSelected(item.id)
                }
              />
            ))}
          </div>

          {/* Pagination */}
          {!showMocks && totalPages > 1 && (
            <div className="mt-8 flex items-center gap-4 text-zinc-200" data-testid="pagination-bookshelf">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-zinc-800"
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-sm text-zinc-400" data-testid="text-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-zinc-800"
                data-testid="button-next-page"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
