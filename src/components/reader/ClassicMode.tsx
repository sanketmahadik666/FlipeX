import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import HTMLFlipBook from 'react-pageflip-enhanced';
import { processedDocumentAtom, currentChapterIndexAtom, currentPageIndexAtom } from '@/state/recoilAtoms';
import { fontSizeAtom, lineSpacingAtom, bookZoomAtom } from '@/state/jotaiAtoms';
import { usePageFlipSound } from '@/hooks/usePageFlipSound';
import { usePageFlipBendSound } from '@/hooks/usePageFlipBendSound';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const BOOK_ZOOM_MIN = 0.85;
const BOOK_ZOOM_MAX = 1.3;
const BOOK_ZOOM_STEP = 0.15;
const HASH_PREFIX = 'page';

/* ── Flatten all pages across chapters into a single list ── */
interface FlatPage {
  content: string[];
  chapterTitle: string;
  isChapterStart: boolean;
  chapterIdx: number;
  pageIdx: number;
}

function flattenPages(doc: any): FlatPage[] {
  const flat: FlatPage[] = [];
  doc.chapters.forEach((chapter: any, chIdx: number) => {
    chapter.pages.forEach((page: any, pIdx: number) => {
      flat.push({
        content: page.content,
        chapterTitle: chapter.title,
        isChapterStart: pIdx === 0,
        chapterIdx: chIdx,
        pageIdx: pIdx,
      });
    });
  });
  return flat;
}

/* ── Single page renderer ── */
const SinglePage = memo(({
  pageData,
  fontSize,
  lineSpacing,
  side,
}: {
  pageData: FlatPage | null;
  fontSize: number;
  lineSpacing: number;
  side: 'left' | 'right' | 'single';
}) => {
  if (!pageData) {
    return (
      <div className={`flex-1 flex flex-col bg-card overflow-hidden relative ${
        side === 'left' ? 'rounded-l-sm' : side === 'right' ? 'rounded-r-sm' : 'rounded-sm'
      }`}>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col bg-card overflow-hidden relative ${
      side === 'left' ? 'rounded-l-sm' : side === 'right' ? 'rounded-r-sm' : 'rounded-sm'
    }`}>
      {/* Spine shadow */}
      {side === 'left' && (
        <div className="absolute top-0 bottom-0 right-0 w-6 pointer-events-none"
          style={{ background: 'linear-gradient(to left, hsl(var(--foreground) / 0.06), transparent)' }}
        />
      )}
      {side === 'right' && (
        <div className="absolute top-0 bottom-0 left-0 w-6 pointer-events-none"
          style={{ background: 'linear-gradient(to right, hsl(var(--foreground) / 0.06), transparent)' }}
        />
      )}

      <div className={`flex-1 flex flex-col py-8 ${
        side === 'single' ? 'px-8' : side === 'left' ? 'pl-8 pr-6' : 'pr-8 pl-6'
      } ${
        'px-10 md:px-14'
      } md:py-10`}>
        {pageData.isChapterStart && (
          <h2 className="mb-4 text-center font-serif text-lg font-semibold tracking-wide text-foreground/60 uppercase">
            {pageData.chapterTitle}
          </h2>
        )}
        <div
          className="flex-1 font-serif text-foreground/90 overflow-hidden"
          style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
        >
          {pageData.content?.map((paragraph, i) => (
            <p key={i} className="mb-3 text-justify">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
});

SinglePage.displayName = 'SinglePage';

/* ── Main component ── */
/** Parse hash #page3 or #3 into 0-based spread index, or null if invalid. */
function spreadIndexFromHash(): number | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const afterPrefix = hash.toLowerCase().startsWith(HASH_PREFIX)
    ? hash.slice(HASH_PREFIX.length).replace(/^[=\s]+/, '')
    : hash;
  const n = parseInt(afterPrefix, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n - 1; // 1-based page number -> 0-based spread index
}

/** Write current spread to hash (1-based page number). */
function writeHash(spreadIndex: number) {
  const pageNum = spreadIndex + 1;
  const newHash = `#${HASH_PREFIX}${pageNum}`;
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash);
  }
}

const ClassicMode = memo(() => {
  const doc = useRecoilValue(processedDocumentAtom);
  const [, setChapterIdx] = useRecoilState(currentChapterIndexAtom);
  const [, setPageIdx] = useRecoilState(currentPageIndexAtom);
  const fontSize = useAtomValue(fontSizeAtom);
  const lineSpacing = useAtomValue(lineSpacingAtom);
  const bookZoom = useAtomValue(bookZoomAtom);
  const setBookZoom = useSetAtom(bookZoomAtom);
  const playFlip = usePageFlipSound();
  const { startBend, updateBend, endBend } = usePageFlipBendSound();
  const isMobile = useIsMobile();

  const [spreadIndex, setSpreadIndex] = useState(0);
  const bookRef = useRef<any>(null);

  /* Flatten all pages */
  const allPages = useMemo(() => (doc ? flattenPages(doc) : []), [doc]);

  /* Calculate dimensions */
  const pageWidth = isMobile ? 400 : 480;
  const pageHeight = isMobile ? Math.round(pageWidth * 4 / 3) : Math.round(pageWidth * 4 / 3);

  /* Event handler: page flip */
  const handleFlip = useCallback((e: any) => {
    const pageNum = e.data;
    const newSpreadIndex = isMobile ? pageNum : Math.floor(pageNum / 2);
    setSpreadIndex(newSpreadIndex);
    writeHash(newSpreadIndex);
    
    // Update Recoil atoms for chapter/page tracking
    const page = allPages[pageNum];
    if (page) {
      setChapterIdx(page.chapterIdx);
      setPageIdx(page.pageIdx);
    }
    
    playFlip();
  }, [isMobile, allPages, setChapterIdx, setPageIdx, playFlip]);

  /* Event handler: state change */
  const handleChangeState = useCallback((e: any) => {
    if (e.data === 'flipping') {
      startBend();
    } else if (e.data === 'read') {
      endBend();
    }
  }, [startBend, endBend]);

  /* Hash sync: read initial page from URL */
  useEffect(() => {
    const fromHash = spreadIndexFromHash();
    if (fromHash !== null && allPages.length > 0 && bookRef.current) {
      const pageNum = isMobile ? fromHash : fromHash * 2;
      const maxPage = allPages.length - 1;
      if (pageNum <= maxPage) {
        setTimeout(() => {
          bookRef.current?.pageFlip()?.turnToPage(pageNum);
        }, 100);
      }
    }
  }, [allPages.length, isMobile]);

  /* Hash sync: respond to browser back/forward */
  useEffect(() => {
    const onHashChange = () => {
      const fromHash = spreadIndexFromHash();
      if (fromHash !== null && allPages.length > 0 && bookRef.current) {
        const pageNum = isMobile ? fromHash : fromHash * 2;
        const maxPage = allPages.length - 1;
        if (pageNum <= maxPage) {
          bookRef.current?.pageFlip()?.turnToPage(pageNum);
        }
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [allPages.length, isMobile]);

  /* Navigation */
  const navigate = useCallback((dir: 'prev' | 'next') => {
    if (!bookRef.current) return;
    const pageFlip = bookRef.current.pageFlip();
    
    if (dir === 'next') {
      pageFlip.flipNext('bottom');
    } else {
      pageFlip.flipPrev('bottom');
    }
  }, []);

  /* Keyboard controls */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        navigate('next');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate('prev');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  /* Zoom controls */
  const canZoomIn = bookZoom < BOOK_ZOOM_MAX;
  const canZoomOut = bookZoom > BOOK_ZOOM_MIN;
  const zoomIn = useCallback(() => {
    if (canZoomIn) setBookZoom((z) => Math.min(BOOK_ZOOM_MAX, z + BOOK_ZOOM_STEP));
  }, [canZoomIn, setBookZoom]);
  const zoomOut = useCallback(() => {
    if (canZoomOut) setBookZoom((z) => Math.max(BOOK_ZOOM_MIN, z - BOOK_ZOOM_STEP));
  }, [canZoomOut, setBookZoom]);

  /* Calculate current page/spread for display */
  const currentPageIndex = bookRef.current?.pageFlip()?.getCurrentPageIndex() ?? 0;
  const displayPageNum = isMobile 
    ? currentPageIndex + 1 
    : currentPageIndex % 2 === 0 
      ? `${currentPageIndex + 1}–${Math.min(currentPageIndex + 2, allPages.length)}` 
      : currentPageIndex + 1;

  const isFirst = currentPageIndex === 0;
  const isLast = currentPageIndex >= allPages.length - 1;

  if (!doc || allPages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">No document loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 md:px-4">
      {/* Action bar: Prev | Zoom- | Page X of Y | Zoom+ | Next */}
      <div className="w-full flex items-center justify-center gap-2 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('prev')}
          disabled={isFirst}
          className="rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomOut}
          disabled={!canZoomOut}
          className="rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Zoom out"
        >
          <Minus className="h-5 w-5" />
        </Button>
        <span className="min-w-[6rem] text-center text-sm text-muted-foreground font-medium">
          Page {displayPageNum} of {allPages.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomIn}
          disabled={!canZoomIn}
          className="rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Zoom in"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('next')}
          disabled={isLast}
          className="rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Next page"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Book surface container */}
      <div
        className="flex flex-1 items-center justify-center w-full min-h-0 rounded-2xl mx-2 md:mx-4 my-2 md:my-4 p-4 md:p-8"
        style={{
          background: 'linear-gradient(165deg, hsl(var(--muted) / 0.5) 0%, hsl(var(--muted) / 0.25) 50%, hsl(var(--muted) / 0.4) 100%)',
          boxShadow: 'inset 0 1px 2px hsl(var(--foreground) / 0.04), 0 1px 0 hsl(var(--foreground) / 0.03)',
          border: '1px solid hsl(var(--border) / 0.5)',
        }}
      >
        {/* Book with zoom */}
        <div
          className="flex flex-1 items-center justify-center w-full"
          style={{
            transform: `scale(${bookZoom})`,
            transformOrigin: 'center center',
            filter: 'drop-shadow(0 8px 24px hsl(var(--foreground) / 0.12)) drop-shadow(0 2px 8px hsl(var(--foreground) / 0.08))',
          }}
        >
          <HTMLFlipBook
            width={pageWidth}
            height={pageHeight}
            size="stretch"
            minWidth={300}
            maxWidth={pageWidth}
            minHeight={Math.round(300 * 4 / 3)}
            maxHeight={pageHeight}
            showCover={false}
            flippingTime={520}
            drawShadow={true}
            maxShadowOpacity={0.42}
            usePortrait={true}
            mobileScrollSupport={true}
            autoSize={false}
            onFlip={handleFlip}
            onChangeState={handleChangeState}
            ref={bookRef}
            className="book-container"
          >
            {allPages.map((page, idx) => (
              <div key={idx} className="page-content">
                <SinglePage
                  pageData={page}
                  fontSize={fontSize}
                  lineSpacing={lineSpacing}
                  side={isMobile ? 'single' : (idx % 2 === 0 ? 'left' : 'right')}
                />
              </div>
            ))}
          </HTMLFlipBook>
        </div>
      </div>
    </div>
  );
});

ClassicMode.displayName = 'ClassicMode';

export default ClassicMode;