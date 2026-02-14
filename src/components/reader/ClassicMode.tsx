import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useAtomValue } from 'jotai';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { processedDocumentAtom, currentChapterIndexAtom, currentPageIndexAtom } from '@/state/recoilAtoms';
import { fontSizeAtom, lineSpacingAtom } from '@/state/jotaiAtoms';
import { usePageFlipSound } from '@/hooks/usePageFlipSound';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

type FlipDirection = 'none' | 'next' | 'prev';

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
const ClassicMode = memo(() => {
  const doc = useRecoilValue(processedDocumentAtom);
  const [, setChapterIdx] = useRecoilState(currentChapterIndexAtom);
  const [, setPageIdx] = useRecoilState(currentPageIndexAtom);
  const fontSize = useAtomValue(fontSizeAtom);
  const lineSpacing = useAtomValue(lineSpacingAtom);
  const playFlip = usePageFlipSound();
  const isMobile = useIsMobile();

  const [spreadIndex, setSpreadIndex] = useState(0); // index into spreads
  const [flipDir, setFlipDir] = useState<FlipDirection>('none');
  const [isAnimating, setIsAnimating] = useState(false);
  const [flipProgress, setFlipProgress] = useState(0);
  const animFrameRef = useRef<number>();

  const FLIP_DURATION = 550;

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

  /* Previous/next spread data for flip overlay */
  const prevSpread = spreads[spreadIndex - 1] || null;
  const nextSpread = spreads[spreadIndex + 1] || null;

  /* Global page numbers */
  const leftPageNum = isMobile ? spreadIndex + 1 : spreadIndex * 2 + 1;
  const rightPageNum = isMobile ? null : spreadIndex * 2 + 2;

  const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const animateFlip = useCallback((startTime: number) => {
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / FLIP_DURATION, 1);
      setFlipProgress(progress);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setFlipProgress(0);
        setIsAnimating(false);
        setFlipDir('none');
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [FLIP_DURATION]);

  const navigate = useCallback(
    (dir: 'prev' | 'next') => {
      if (isAnimating) return;
      if (dir === 'next' && isLast) return;
      if (dir === 'prev' && isFirst) return;

      // Update spread index immediately
      setSpreadIndex(s => dir === 'next' ? s + 1 : s - 1);

      playFlip();
      setFlipDir(dir);
      setIsAnimating(true);
      setFlipProgress(0);
      animateFlip(performance.now());
    },
    [isFirst, isLast, isAnimating, playFlip, animateFlip]
  );

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

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

  const easedProgress = ease(flipProgress);
  const shadowIntensity = Math.sin(easedProgress * Math.PI) * 0.35;

  /* For next: the right page of the OLD spread flips from right→left (rotateY from 0 to -180, origin left)
     For prev: the left page of the OLD spread flips from left→right (rotateY from 0 to 180, origin right) */

  const flipRotation = flipDir === 'next'
    ? -180 * easedProgress
    : 180 * easedProgress;

  // The flipping page shows the page from the previous spread that's "turning away"
  const flippingPageData = flipDir === 'next'
    ? prevSpread?.[1] // right page of previous spread flips away
    : nextSpread?.[0]; // left page of next spread flips away

  const flippingStyle: React.CSSProperties = prefersReducedMotion ? {} : {
    transform: `rotateY(${flipRotation}deg)`,
    transformOrigin: flipDir === 'next' ? 'left center' : 'right center',
    backfaceVisibility: 'hidden' as const,
    willChange: 'transform',
    zIndex: 10,
    boxShadow: `${flipDir === 'next' ? '-' : ''}${shadowIntensity * 25}px 0 ${shadowIntensity * 35}px -8px hsl(var(--foreground) / ${shadowIntensity})`,
  };

  return (
    <div className="flex flex-1 items-center justify-center px-2 md:px-4">
      {/* Navigation buttons */}
      <div className="fixed bottom-6 right-6 z-20 flex items-center gap-3">
        <Button
          variant="outline" size="icon"
          onClick={() => navigate('prev')}
          disabled={isFirst || isAnimating}
          className="h-12 w-12 rounded-full shadow-md border-border/50 bg-card/90 backdrop-blur-sm hover:bg-accent"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="outline" size="icon"
          onClick={() => navigate('next')}
          disabled={isLast || isAnimating}
          className="h-12 w-12 rounded-full shadow-md border-border/50 bg-card/90 backdrop-blur-sm hover:bg-accent"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Book with perspective */}
      <div
        className={`relative ${isMobile ? 'w-full max-w-[400px]' : 'w-full max-w-[960px]'}`}
        style={{
          aspectRatio: isMobile ? '3 / 4' : '3 / 2',
          maxHeight: '82vh',
          perspective: '1800px',
          perspectiveOrigin: 'center center',
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
            {/* Fold shadow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: flipDir === 'next'
                ? `linear-gradient(to right, hsl(var(--foreground) / ${shadowIntensity * 0.15}), transparent 40%)`
                : `linear-gradient(to left, hsl(var(--foreground) / ${shadowIntensity * 0.15}), transparent 40%)`,
              zIndex: 5,
            }} />
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
  );
});

ClassicMode.displayName = 'ClassicMode';
export default ClassicMode;