import { memo, useMemo, useCallback, useEffect, useState, useRef, forwardRef } from 'react';
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

const BOOK_ZOOM_MIN = 0.5;
const BOOK_ZOOM_MAX = 1.3;
const BOOK_ZOOM_STEP = 0.1;
const HASH_PREFIX = 'page';

/* ── Pastel colors for chapter bookmark tabs ── */
const TAB_COLORS = [
  'rgba(255, 182, 193, 0.55)', /* light pink */
  'rgba(173, 216, 230, 0.55)', /* light blue */
  'rgba(144, 238, 144, 0.55)', /* light green */
  'rgba(255, 218, 185, 0.55)', /* peach */
  'rgba(221, 160, 221, 0.55)', /* plum */
  'rgba(255, 255, 200, 0.55)', /* light yellow */
  'rgba(176, 224, 230, 0.55)', /* powder blue */
  'rgba(255, 192, 203, 0.55)', /* pink */
  'rgba(152, 251, 152, 0.55)', /* pale green */
  'rgba(230, 230, 250, 0.55)', /* lavender */
];
const TAB_ACTIVE_COLORS = [
  'rgba(255, 182, 193, 0.9)',
  'rgba(173, 216, 230, 0.9)',
  'rgba(144, 238, 144, 0.9)',
  'rgba(255, 218, 185, 0.9)',
  'rgba(221, 160, 221, 0.9)',
  'rgba(255, 255, 200, 0.9)',
  'rgba(176, 224, 230, 0.9)',
  'rgba(255, 192, 203, 0.9)',
  'rgba(152, 251, 152, 0.9)',
  'rgba(230, 230, 250, 0.9)',
];

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
      // pages are string[] arrays directly, not objects with a content property
      const content = Array.isArray(page) ? page : (page.content || []);
      flat.push({
        content,
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
/* react-pageflip requires forwardRef for page children */
const SinglePage = forwardRef<HTMLDivElement, {
  pageData: FlatPage | null;
  fontSize: number;
  lineSpacing: number;
  side: 'left' | 'right' | 'single';
}>(({ pageData, fontSize, lineSpacing, side }, ref) => {
  if (!pageData) {
    return (
      <div ref={ref} className="page-wrapper" style={{ width: '100%', height: '100%' }}>
        <div
          className={`w-full h-full flex flex-col bg-[#faf8f5] overflow-hidden relative ${
            side === 'left' ? 'rounded-l-sm' : side === 'right' ? 'rounded-r-sm' : 'rounded-sm'
          }`}
        >
          <div className="flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="page-wrapper" style={{ width: '100%', height: '100%' }}>
      <div
        className={`w-full h-full flex flex-col overflow-hidden relative ${
          side === 'left' ? 'rounded-l-sm' : side === 'right' ? 'rounded-r-sm' : 'rounded-sm'
        }`}
        style={{ backgroundColor: '#faf8f5' }}
      >
        {/* Spine shadow */}
        {side === 'left' && (
          <div
            className="absolute top-0 bottom-0 right-0 w-8 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.08), transparent)' }}
          />
        )}
        {side === 'right' && (
          <div
            className="absolute top-0 bottom-0 left-0 w-8 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.08), transparent)' }}
          />
        )}

        {/* Page content area - strictly contained within page height */}
        <div
          className={`flex-1 flex flex-col overflow-hidden ${
            side === 'single' ? 'px-6 py-6' : side === 'left' ? 'pl-8 pr-6 py-6' : 'pr-8 pl-6 py-6'
          }`}
          style={{ minHeight: 0 }}
        >
          {pageData.isChapterStart && (
            <h2 className="mb-4 text-center font-serif text-base font-semibold tracking-widest uppercase"
              style={{ color: 'rgba(60,50,40,0.55)' }}
            >
              {pageData.chapterTitle}
            </h2>
          )}
          <div
            className="flex-1 font-serif overflow-hidden"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineSpacing,
              color: 'rgba(30,25,20,0.85)',
              minHeight: 0,
            }}
          >
            {pageData.content?.map((paragraph, i) => (
              <p key={i} className="mb-2.5 text-justify leading-relaxed" style={{ wordBreak: 'break-word' }}>
                {paragraph}
              </p>
            ))}
          </div>

          {/* Page number at bottom */}
          <div className="mt-auto pt-2 text-center">
            <span className="text-xs font-serif" style={{ color: 'rgba(60,50,40,0.35)' }}>
              {pageData.chapterIdx * 10 + pageData.pageIdx + 1}
            </span>
          </div>
        </div>

        {/* Subtle page edge effect */}
        <div
          className="absolute top-0 right-0 w-[3px] h-full pointer-events-none"
          style={{
            background: side === 'left'
              ? 'linear-gradient(to left, rgba(0,0,0,0.04), transparent)'
              : 'none',
          }}
        />
      </div>
    </div>
  );
});

SinglePage.displayName = 'SinglePage';

/** Parse hash #page3 or #3 into 0-based spread index, or null if invalid. */
function spreadIndexFromHash(): number | null {
  const raw = window.location.hash.replace('#', '').trim();
  if (!raw) return null;
  const numStr = raw.replace(HASH_PREFIX, '');
  const n = parseInt(numStr, 10);
  if (Number.isNaN(n) || n < 1) return null;
  return n - 1;
}

/** Write current spread to hash (1-based page number). */
function writeHash(spreadIndex: number) {
  const pageNum = spreadIndex + 1;
  const hash = `#${HASH_PREFIX}${pageNum}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash);
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
  const { startBend, endBend } = usePageFlipBendSound();
  const isMobile = useIsMobile();

  const [spreadIndex, setSpreadIndex] = useState(0);
  const bookRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });

  /* Flatten all pages */
  const allPages = useMemo(() => (doc ? flattenPages(doc) : []), [doc]);

  /* Dynamically calculate page dimensions based on container */
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: rect.width, h: rect.height });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* Calculate page dimensions to fit container */
  const { pageWidth, pageHeight } = useMemo(() => {
    const availW = containerSize.w - 64; // padding
    const availH = containerSize.h - 32; // padding

    if (isMobile) {
      // Single page mode on mobile
      const pw = Math.min(availW - 16, 420);
      const ph = Math.min(availH, Math.round(pw * 1.4));
      return { pageWidth: pw, pageHeight: ph };
    }

    // Two-page spread: each page is half the available width
    const halfW = Math.floor((availW - 8) / 2); // -8 for spine gap
    const pw = Math.min(halfW, 440);
    const ph = Math.min(availH, Math.round(pw * 1.35));
    return { pageWidth: pw, pageHeight: ph };
  }, [containerSize, isMobile]);

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

  /* Calculate current page for display */
  const currentPageIndex = bookRef.current?.pageFlip()?.getCurrentPageIndex() ?? 0;
  const displayPageNum = isMobile
    ? currentPageIndex + 1
    : currentPageIndex % 2 === 0
      ? `${currentPageIndex + 1}–${Math.min(currentPageIndex + 2, allPages.length)}`
      : currentPageIndex + 1;

  const isFirst = currentPageIndex === 0;
  const isLast = currentPageIndex >= allPages.length - (isMobile ? 1 : 2);

  if (!doc || allPages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">No document loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 md:px-4 min-h-0">
      {/* Action bar: Prev | Zoom- | Page X of Y | Zoom+ | Next */}
      <div className="w-full flex items-center justify-center gap-2 py-2 shrink-0">
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
        ref={containerRef}
        className="flex flex-1 items-center justify-center w-full min-h-0 rounded-2xl mx-2 md:mx-4 my-1 md:my-2 p-4 md:p-6"
        style={{
          background: 'linear-gradient(165deg, hsl(var(--muted) / 0.5) 0%, hsl(var(--muted) / 0.25) 50%, hsl(var(--muted) / 0.4) 100%)',
          boxShadow: 'inset 0 1px 2px hsl(var(--foreground) / 0.04), 0 1px 0 hsl(var(--foreground) / 0.03)',
          border: '1px solid hsl(var(--border) / 0.5)',
        }}
      >
        {/* Book with zoom + bookmark tabs */}
        <div
          className="flex items-center justify-center"
          style={{
            transform: `scale(${bookZoom})`,
            transformOrigin: 'center center',
            filter: 'drop-shadow(0 8px 24px hsl(var(--foreground) / 0.12)) drop-shadow(0 2px 8px hsl(var(--foreground) / 0.08))',
          }}
        >
          <div className="relative flex items-stretch">
            {/* The flipbook */}
            <HTMLFlipBook
              width={pageWidth}
              height={pageHeight}
              size="fixed"
              minWidth={200}
              maxWidth={600}
              minHeight={300}
              maxHeight={900}
              showCover={false}
              flippingTime={520}
              drawShadow={true}
              maxShadowOpacity={0.42}
              usePortrait={isMobile}
              mobileScrollSupport={true}
              autoSize={false}
              onFlip={handleFlip}
              onChangeState={handleChangeState}
              ref={bookRef}
              className="book-container"
            >
              {allPages.map((page, idx) => (
                <SinglePage
                  key={idx}
                  pageData={page}
                  fontSize={fontSize}
                  lineSpacing={lineSpacing}
                  side={isMobile ? 'single' : (idx % 2 === 0 ? 'left' : 'right')}
                />
              ))}
            </HTMLFlipBook>

            {/* Chapter bookmark tabs on right edge */}
            {doc && doc.chapters.length > 1 && (
              <div
                className="flex flex-col justify-start py-3"
                style={{
                  width: '18px',
                  height: `${pageHeight}px`,
                  marginLeft: '-2px',
                }}
              >
                {doc.chapters.map((chapter: any, chIdx: number) => {
                  const firstPageIdx = allPages.findIndex(p => p.chapterIdx === chIdx);
                  const isActive = allPages[currentPageIndex]?.chapterIdx === chIdx;
                  const tabH = Math.max(26, Math.floor((pageHeight - 24) / doc.chapters.length) - 3);

                  return (
                    <button
                      key={chIdx}
                      onClick={() => {
                        if (firstPageIdx >= 0 && bookRef.current) {
                          bookRef.current.pageFlip()?.turnToPage(firstPageIdx);
                        }
                      }}
                      title={chapter.title}
                      className="group relative cursor-pointer border-none p-0"
                      style={{
                        width: isActive ? '22px' : '16px',
                        height: `${tabH}px`,
                        marginBottom: '3px',
                        backgroundColor: isActive
                          ? TAB_ACTIVE_COLORS[chIdx % TAB_ACTIVE_COLORS.length]
                          : TAB_COLORS[chIdx % TAB_COLORS.length],
                        borderRadius: '0 5px 5px 0',
                        boxShadow: isActive
                          ? '2px 1px 6px rgba(0,0,0,0.18)'
                          : '1px 0px 3px rgba(0,0,0,0.08)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.width = '24px';
                        el.style.backgroundColor = TAB_ACTIVE_COLORS[chIdx % TAB_ACTIVE_COLORS.length];
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.width = isActive ? '22px' : '16px';
                        el.style.backgroundColor = isActive
                          ? TAB_ACTIVE_COLORS[chIdx % TAB_ACTIVE_COLORS.length]
                          : TAB_COLORS[chIdx % TAB_COLORS.length];
                      }}
                    >
                      {/* Tooltip on hover */}
                      <span
                        className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                        style={{
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                      >
                        {chapter.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ClassicMode.displayName = 'ClassicMode';

export default ClassicMode;