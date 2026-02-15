import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
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

/** 3D page-flip artifact: tunable parameters for gesture and feel */
const FLIP_ARTIFACT = {
  /** Perspective distance (px). Larger = gentler depth, smaller = more dramatic. */
  perspectivePx: 2000,
  /** Flip duration (ms). Slightly shorter = snappier, longer = more dramatic. */
  durationMs: 520,
  /** Easing exponent for t^exp then inverse. >1 = soft settle at end (paper landing). */
  easeSettleExponent: 2.2,
  /** Max intensity (0–1) of the cast shadow under the flipping page. */
  shadowCastIntensity: 0.42,
  /** Blur and spread of cast shadow (px). */
  shadowCastBlur: 48,
  shadowCastSpread: -12,
  /** Extra ambient shadow for depth. */
  shadowAmbientBlur: 24,
  shadowAmbientIntensity: 0.18,
  /** Fold crease: gradient opacity at spine (0–1). */
  foldCreaseIntensity: 0.28,
  /** Fold gradient width (% of page). */
  foldGradientWidthPct: 42,
  /** Subtle "lift" scale at mid-flip (1 = none). Gives tactile lift-off feel. */
  liftScaleMid: 1.018,
  /** Slight translateZ (px) at mid-flip so page feels like it leaves the spine. */
  liftTranslateZPx: 3,
  /** Paper edge highlight on the lifting edge (0 = off). */
  edgeHighlightIntensity: 0.06,
} as const;

type FlipDirection = 'none' | 'next' | 'prev';

/** Easing: fast start, soft settle (paper landing). */
function easeFlip(t: number): number {
  const e = FLIP_ARTIFACT.easeSettleExponent;
  return t < 0.5
    ? 4 * Math.pow(t, e)
    : 1 - Math.pow(-2 * t + 2, e) / 2;
}

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
  for (let ci = 0; ci < doc.chapters.length; ci++) {
    const ch = doc.chapters[ci];
    for (let pi = 0; pi < ch.pages.length; pi++) {
      flat.push({
        content: ch.pages[pi],
        chapterTitle: ch.title,
        isChapterStart: pi === 0,
        chapterIdx: ci,
        pageIdx: pi,
      });
    }
  }
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

      <div className={`flex flex-1 flex-col justify-between py-8 ${
        side === 'left' ? 'pl-8 pr-10 md:pl-10 md:pr-12' :
        side === 'right' ? 'pl-10 pr-8 md:pl-12 md:pr-10' :
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
          {pageData.content.map((paragraph, i) => (
            <p key={i} className="mb-5 text-justify indent-6 last:mb-0">
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

  const [spreadIndex, setSpreadIndex] = useState(0); // index into spreads
  const [flipDir, setFlipDir] = useState<FlipDirection>('none');
  const [isAnimating, setIsAnimating] = useState(false);
  const [flipProgress, setFlipProgress] = useState(0);
  const animFrameRef = useRef<number>();

  /* Flatten all pages */
  const allPages = useMemo(() => (doc ? flattenPages(doc) : []), [doc]);

  /* Build spreads: pairs of pages (left, right). On mobile: single pages. */
  const spreads = useMemo(() => {
    if (isMobile) {
      return allPages.map(p => [p]);
    }
    const result: (FlatPage | null)[][] = [];
    for (let i = 0; i < allPages.length; i += 2) {
      result.push([allPages[i], allPages[i + 1] || null]);
    }
    return result;
  }, [allPages, isMobile]);

  const currentSpread = spreads[spreadIndex] || [];
  const isFirst = spreadIndex === 0;
  const isLast = spreadIndex >= spreads.length - 1;

  /* Keep recoil atoms in sync for other components */
  useEffect(() => {
    const leftPage = currentSpread[0];
    if (leftPage) {
      setChapterIdx(leftPage.chapterIdx);
      setPageIdx(leftPage.pageIdx);
    }
  }, [spreadIndex, currentSpread, setChapterIdx, setPageIdx]);

  /* Hash sync: read initial page from URL (#page1, #1, etc.) */
  useEffect(() => {
    const fromHash = spreadIndexFromHash();
    if (fromHash !== null && spreads.length > 0 && fromHash < spreads.length) {
      setSpreadIndex(fromHash);
    }
  }, [spreads.length]); // eslint-disable-line react-hooks/exhaustive-deps -- only on doc load / spread count ready

  /* Hash sync: write current page to URL when spread changes */
  useEffect(() => {
    if (spreads.length === 0) return;
    writeHash(Math.min(spreadIndex, spreads.length - 1));
  }, [spreadIndex, spreads.length]);

  /* Hash sync: respond to browser back/forward or external hash change */
  useEffect(() => {
    const onHashChange = () => {
      const fromHash = spreadIndexFromHash();
      if (fromHash !== null && spreads.length > 0 && fromHash < spreads.length) {
        setSpreadIndex(fromHash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [spreads.length]);

  /* Previous/next spread data for flip overlay */
  const prevSpread = spreads[spreadIndex - 1] || null;
  const nextSpread = spreads[spreadIndex + 1] || null;

  /* Global page numbers */
  const leftPageNum = isMobile ? spreadIndex + 1 : spreadIndex * 2 + 1;
  const rightPageNum = isMobile ? null : spreadIndex * 2 + 2;

  const animateFlip = useCallback((startTime: number) => {
    const duration = FLIP_ARTIFACT.durationMs;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setFlipProgress(progress);
      updateBend(progress);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        endBend();
        setFlipProgress(0);
        setIsAnimating(false);
        setFlipDir('none');
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [updateBend, endBend]);

  const navigate = useCallback(
    (dir: 'prev' | 'next') => {
      if (isAnimating) return;
      if (dir === 'next' && isLast) return;
      if (dir === 'prev' && isFirst) return;

      // Update spread index immediately
      setSpreadIndex(s => dir === 'next' ? s + 1 : s - 1);

      playFlip();
      startBend();
      setFlipDir(dir);
      setIsAnimating(true);
      setFlipProgress(0);
      animateFlip(performance.now());
    },
    [isFirst, isLast, isAnimating, playFlip, startBend, animateFlip]
  );

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      endBend();
    };
  }, [endBend]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); navigate('next'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navigate('prev'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  if (!doc || allPages.length === 0) return null;

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const eased = easeFlip(flipProgress);
  /* Shadow peaks when page is ~90° (mid-flip); sin curve. */
  const shadowT = Math.sin(flipProgress * Math.PI);
  const castIntensity = shadowT * FLIP_ARTIFACT.shadowCastIntensity;
  const ambientIntensity = shadowT * FLIP_ARTIFACT.shadowAmbientIntensity;
  const sign = flipDir === 'next' ? -1 : 1;
  const castShadow = `${sign * 20}px 0 ${FLIP_ARTIFACT.shadowCastBlur}px ${FLIP_ARTIFACT.shadowCastSpread}px hsl(var(--foreground) / ${castIntensity})`;
  const ambientShadow = `0 0 ${FLIP_ARTIFACT.shadowAmbientBlur}px 0 hsl(var(--foreground) / ${ambientIntensity})`;

  /* For next: right page flips right→left (rotateY 0 → -180). For prev: left page flips left→right (0 → 180). */
  const flipRotation = flipDir === 'next' ? -180 * eased : 180 * eased;

  /* Subtle lift at mid-flip: scale and translateZ for tactile "page leaving spine" feel. */
  const liftT = Math.sin(flipProgress * Math.PI);
  const liftScale = 1 + (FLIP_ARTIFACT.liftScaleMid - 1) * liftT;
  const liftZ = FLIP_ARTIFACT.liftTranslateZPx * liftT;

  const flippingPageData = flipDir === 'next'
    ? prevSpread?.[1]
    : nextSpread?.[0];

  const flippingStyle: React.CSSProperties = prefersReducedMotion ? {} : {
    transform: `rotateY(${flipRotation}deg) scale(${liftScale}) translateZ(${liftZ}px)`,
    transformOrigin: flipDir === 'next' ? 'left center' : 'right center',
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden' as const,
    willChange: 'transform',
    zIndex: 10,
    boxShadow: `${castShadow}, ${ambientShadow}`,
  };

  const canZoomIn = bookZoom < BOOK_ZOOM_MAX;
  const canZoomOut = bookZoom > BOOK_ZOOM_MIN;
  const zoomIn = useCallback(() => {
    if (canZoomIn) setBookZoom((z) => Math.min(BOOK_ZOOM_MAX, z + BOOK_ZOOM_STEP));
  }, [canZoomIn, setBookZoom]);
  const zoomOut = useCallback(() => {
    if (canZoomOut) setBookZoom((z) => Math.max(BOOK_ZOOM_MIN, z - BOOK_ZOOM_STEP));
  }, [canZoomOut, setBookZoom]);

  const displayPageNum = isMobile ? spreadIndex + 1 : (currentSpread[1] ? `${spreadIndex * 2 + 1}–${spreadIndex * 2 + 2}` : spreadIndex * 2 + 1);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 md:px-4">
      {/* Action bar: Prev | Zoom- | Page X of Y | Zoom+ | Next (like flipbook reference) */}
      <div className="w-full flex items-center justify-center gap-2 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('prev')}
          disabled={isFirst || isAnimating}
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
          disabled={isLast || isAnimating}
          className="rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Next page"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Visible surrounding: surface so the book sits in a clear space */}
      <div
        className="flex flex-1 items-center justify-center w-full min-h-0 rounded-2xl mx-2 md:mx-4 my-2 md:my-4 p-4 md:p-8"
        style={{
          background: 'linear-gradient(165deg, hsl(var(--muted) / 0.5) 0%, hsl(var(--muted) / 0.25) 50%, hsl(var(--muted) / 0.4) 100%)',
          boxShadow: 'inset 0 1px 2px hsl(var(--foreground) / 0.04), 0 1px 0 hsl(var(--foreground) / 0.03)',
          border: '1px solid hsl(var(--border) / 0.5)',
        }}
      >
        {/* Book with perspective, zoom, and drop shadow onto surface */}
        <div
          className="flex flex-1 items-center justify-center w-full"
          style={{
            transform: `scale(${bookZoom})`,
            transformOrigin: 'center center',
            filter: 'drop-shadow(0 8px 24px hsl(var(--foreground) / 0.12)) drop-shadow(0 2px 8px hsl(var(--foreground) / 0.08))',
          }}
        >
          <div
            className={`relative ${isMobile ? 'w-full max-w-[400px]' : 'w-full max-w-[960px]'}`}
            style={{
              aspectRatio: isMobile ? '3 / 4' : '3 / 2',
              maxHeight: '70vh',
              perspective: `${FLIP_ARTIFACT.perspectivePx}px`,
              perspectiveOrigin: 'center center',
              transformStyle: 'preserve-3d',
            }}
          >
          {/* Outer book shadow & edge */}
          <div
            className="absolute inset-0 rounded-sm"
            style={{
              boxShadow: '0 4px 30px -6px hsl(var(--foreground) / 0.12), 0 1px 6px hsl(var(--foreground) / 0.06)',
              zIndex: 0,
            }}
          />

        {/* Pages container */}
        <div className="absolute inset-0 flex rounded-sm overflow-hidden" style={{ zIndex: 1 }}>
          {isMobile ? (
            /* Single page on mobile */
            <SinglePage
              pageData={currentSpread[0] || null}
              fontSize={fontSize}
              lineSpacing={lineSpacing}
              side="single"
            />
          ) : (
            <>
              {/* Left page */}
              <SinglePage
                pageData={currentSpread[0] || null}
                fontSize={fontSize}
                lineSpacing={lineSpacing}
                side="left"
              />
              {/* Spine divider */}
              <div className="w-[2px] bg-border/30 relative z-10" />
              {/* Right page */}
              <SinglePage
                pageData={currentSpread[1] || null}
                fontSize={fontSize}
                lineSpacing={lineSpacing}
                side="right"
              />
            </>
          )}
        </div>

        {/* 3D flipping page overlay */}
        {isAnimating && flipDir !== 'none' && flippingPageData && !prefersReducedMotion && (
          <div
            className={`absolute top-0 bottom-0 overflow-hidden bg-card ${
              isMobile ? 'left-0 right-0 rounded-sm' :
              flipDir === 'next' ? 'right-0 rounded-r-sm' : 'left-0 rounded-l-sm'
            }`}
            style={{
              ...flippingStyle,
              width: isMobile ? '100%' : '50%',
              ...(flipDir === 'next' && !isMobile ? { left: '50%', right: 'auto' } : {}),
              ...(flipDir === 'prev' && !isMobile ? { right: '50%', left: 'auto' } : {}),
            }}
          >
            {/* Fold crease gradient: darker along spine for paper fold feel */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: flipDir === 'next'
                ? `linear-gradient(to right, hsl(var(--foreground) / ${shadowT * FLIP_ARTIFACT.foldCreaseIntensity}), transparent ${FLIP_ARTIFACT.foldGradientWidthPct}%)`
                : `linear-gradient(to left, hsl(var(--foreground) / ${shadowT * FLIP_ARTIFACT.foldCreaseIntensity}), transparent ${FLIP_ARTIFACT.foldGradientWidthPct}%)`,
              zIndex: 5,
            }} />
            {/* Lifting edge highlight: thin light line on the moving edge */}
            {FLIP_ARTIFACT.edgeHighlightIntensity > 0 && (
              <div className="absolute inset-0 pointer-events-none" style={{
                background: flipDir === 'next'
                  ? `linear-gradient(to left, hsl(var(--background) / ${FLIP_ARTIFACT.edgeHighlightIntensity}), transparent 92%)`
                  : `linear-gradient(to right, hsl(var(--background) / ${FLIP_ARTIFACT.edgeHighlightIntensity}), transparent 92%)`,
                zIndex: 4,
              }} />
            )}
            <SinglePage
              pageData={flippingPageData}
              fontSize={fontSize}
              lineSpacing={lineSpacing}
              side={isMobile ? 'single' : flipDir === 'next' ? 'right' : 'left'}
            />
          </div>
        )}

        {/* Page numbers */}
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center z-10">
          <span className="font-serif text-xs tracking-widest text-muted-foreground/50">
            {rightPageNum && currentSpread[1]
              ? `${leftPageNum}–${rightPageNum}`
              : leftPageNum
            } / {allPages.length}
          </span>
        </div>

        {/* Paper stack illusion */}
        <div className="absolute inset-x-[2px] bottom-[-2px] h-[3px] rounded-b-sm bg-card/80"
          style={{ zIndex: 0, boxShadow: '0 1px 2px hsl(var(--foreground) / 0.04)' }} />
        <div className="absolute inset-x-[4px] bottom-[-4px] h-[3px] rounded-b-sm bg-card/60"
          style={{ zIndex: -1, boxShadow: '0 1px 2px hsl(var(--foreground) / 0.02)' }} />
          </div>
        </div>
      </div>
    </div>
  );
});

ClassicMode.displayName = 'ClassicMode';
export default ClassicMode;