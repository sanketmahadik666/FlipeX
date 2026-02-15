import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useAtomValue } from 'jotai';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { processedDocumentAtom, currentChapterIndexAtom, currentPageIndexAtom } from '@/state/recoilAtoms';
import { fontSizeAtom, lineSpacingAtom, readingThemeAtom } from '@/state/jotaiAtoms';
import { usePageFlipSoundEffects } from '@/hooks/usePageFlipSoundEffects';
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

/* ── Parchment texture (subtle noise for antique pages) ── */
const parchmentNoise = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

/* ── Single page renderer ── */
const SinglePage = memo(({
  pageData,
  fontSize,
  lineSpacing,
  side,
  antique,
}: {
  pageData: FlatPage | null;
  fontSize: number;
  lineSpacing: number;
  side: 'left' | 'right' | 'single';
  antique?: boolean;
}) => {
  const pageBg = antique
    ? { backgroundImage: `linear-gradient(180deg, hsl(42,38%,92%) 0%, hsl(38,35%,88%) 100%), ${parchmentNoise}` }
    : undefined;
  const pageClass = antique ? 'antique-page' : '';
  const textColor = antique ? 'text-[hsl(28,20%,22%)]' : 'text-foreground/90';
  const titleColor = antique ? 'text-[hsl(28,25%,35%)]' : 'text-foreground/60';

  if (!pageData) {
    return (
      <div
        className={`flex-1 flex flex-col overflow-hidden relative ${
          side === 'left' ? 'rounded-l-sm' : side === 'right' ? 'rounded-r-sm' : 'rounded-sm'
        } ${pageClass} ${!antique ? 'bg-card' : ''}`}
        style={antique ? pageBg : undefined}
      >
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div
      className={`flex-1 flex flex-col overflow-hidden relative ${
        side === 'left' ? 'rounded-l-sm' : side === 'right' ? 'rounded-r-sm' : 'rounded-sm'
      } ${pageClass} ${!antique ? 'bg-card' : ''}`}
      style={antique ? pageBg : undefined}
    >
      {/* Aged edge speckles (antique only) */}
      {antique && (
        <>
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{
            backgroundImage: `radial-gradient(circle at 10% 20%, hsl(25,30%,30%) 1px, transparent 1px),
              radial-gradient(circle at 90% 80%, hsl(25,30%,30%) 1px, transparent 1px),
              radial-gradient(circle at 50% 50%, hsl(25,30%,30%) 0.5px, transparent 0.5px)`,
            backgroundSize: '24px 24px',
          }} />
        </>
      )}
      {/* Spine shadow */}
      {side === 'left' && (
        <div className="absolute top-0 bottom-0 right-0 w-6 pointer-events-none"
          style={{ background: antique ? 'linear-gradient(to left, hsl(28,25%,25% / 0.12), transparent)' : 'linear-gradient(to left, hsl(var(--foreground) / 0.06), transparent)' }}
        />
      )}
      {side === 'right' && (
        <div className="absolute top-0 bottom-0 left-0 w-6 pointer-events-none"
          style={{ background: antique ? 'linear-gradient(to right, hsl(28,25%,25% / 0.12), transparent)' : 'linear-gradient(to right, hsl(var(--foreground) / 0.06), transparent)' }}
        />
      )}

      <div className={`flex flex-1 flex-col justify-between py-8 ${
        side === 'left' ? 'pl-8 pr-10 md:pl-10 md:pr-12' :
        side === 'right' ? 'pl-10 pr-8 md:pl-12 md:pr-10' :
        'px-10 md:px-14'
      } md:py-10`}>
        {pageData.isChapterStart && (
          <h2 className={`mb-4 text-center font-serif text-lg font-semibold tracking-wide uppercase ${titleColor}`}>
            {pageData.chapterTitle}
          </h2>
        )}
        <div
          className={`flex-1 font-serif overflow-hidden ${textColor}`}
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
  const theme = useAtomValue(readingThemeAtom);
  const { play: playFlip } = usePageFlipSoundEffects();
  const isMobile = useIsMobile();
  const isAntique = theme === 'antique';

  const [spreadIndex, setSpreadIndex] = useState(0); // index into spreads
  const [flipDir, setFlipDir] = useState<FlipDirection>('none');
  const [isAnimating, setIsAnimating] = useState(false);
  const [flipProgress, setFlipProgress] = useState(0);
  const animFrameRef = useRef<number>();

  const FLIP_DURATION = 620;

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

  /* Smoother ease: soft ease-in-out (smooth start and end, fluid through the middle). */
  const ease = (t: number) => {
    const s = 1.7; // smoothness: higher = gentler acceleration
    return t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5
      ? 0.5 * Math.pow(t * 2, s)
      : 1 - 0.5 * Math.pow(2 - t * 2, s);
  };

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
  const shadowIntensity = Math.sin(flipProgress * Math.PI) * 0.35;

  /* For next: right page flips right→left (rotateY 0 → -180). For prev: left page flips left→right (0 → 180). */
  const flipRotation = flipDir === 'next'
    ? -180 * easedProgress
    : 180 * easedProgress;

  /* Elevated trajectory: page follows an arc (lifts up through the middle of the flip). */
  const arcPeakPx = 38;
  const arcY = -arcPeakPx * 4 * flipProgress * (1 - flipProgress); // parabola: 0 at 0 and 1, max lift at 0.5

  /* Lift toward viewer at mid-flip (translateZ). */
  const liftZ = Math.sin(flipProgress * Math.PI) * 12;

  /* Middle bend: page curves like real paper; more angular rotation through the flip. */
  const bendDegrees = 28;
  const bendX = Math.sin(flipProgress * Math.PI) * bendDegrees;

  const flippingPageData = flipDir === 'next'
    ? prevSpread?.[1]
    : nextSpread?.[0];

  /* Page thickness (visible edge when flipping). */
  const pageThicknessPx = 14;

  /* Transform: first translate (arc + lift in screen space), then bend, then flip. */
  const flippingStyle: React.CSSProperties = prefersReducedMotion ? {} : {
    transform: `translateY(${arcY}px) translateZ(${liftZ}px) rotateX(${bendX}deg) rotateY(${flipRotation}deg)`,
    transformOrigin: flipDir === 'next' ? 'left center' : 'right center',
    transformStyle: 'preserve-3d',
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

      {/* Book with perspective (preserve-3d so flip arc and bend render in 3D) */}
      <div
        className={`relative ${isMobile ? 'w-full max-w-[400px]' : 'w-full max-w-[960px]'}`}
        style={{
          aspectRatio: isMobile ? '3 / 4' : '3 / 2',
          maxHeight: '82vh',
          perspective: '1800px',
          perspectiveOrigin: 'center center',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Antique book shell: cover, gilded edge, corners, spine ribbon, bookmark ribbons */}
        {isAntique && (
          <>
            {/* Left binding strip (red cover) */}
            <div
              className="absolute left-0 top-0 bottom-0 w-3 md:w-4 rounded-l-sm pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, hsl(0,55%,28%) 0%, hsl(0,50%,22%) 100%)',
                boxShadow: 'inset 1px 0 0 hsl(0,40%,45%)',
                zIndex: 0,
              }}
            />
            {/* Right binding strip (red cover) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-3 md:w-4 rounded-r-sm pointer-events-none"
              style={{
                background: 'linear-gradient(270deg, hsl(0,55%,28%) 0%, hsl(0,50%,22%) 100%)',
                boxShadow: 'inset -1px 0 0 hsl(0,40%,45%)',
                zIndex: 0,
              }}
            />
            {/* Gilded fore-edge (gold outer edge) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1 pointer-events-none rounded-r-sm"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, hsl(45,70%,55%) 30%, hsl(42,75%,60%) 50%, hsl(45,70%,55%) 70%, transparent 100%)',
                boxShadow: '0 0 8px hsl(45,60%,50% / 0.4)',
                zIndex: 2,
              }}
            />
            {/* Gold corner embellishments */}
            <div className="absolute top-0 left-0 w-4 h-4 md:w-5 md:h-5 pointer-events-none" style={{ zIndex: 3 }}>
              <div className="absolute inset-0 border-l-2 border-t-2 border-[hsl(45,65%,55%)] rounded-tl-sm" style={{ boxShadow: '0 0 6px hsl(45,60%,50% / 0.5)' }} />
            </div>
            <div className="absolute top-0 right-0 w-4 h-4 md:w-5 md:h-5 pointer-events-none" style={{ zIndex: 3 }}>
              <div className="absolute inset-0 border-r-2 border-t-2 border-[hsl(45,65%,55%)] rounded-tr-sm" style={{ boxShadow: '0 0 6px hsl(45,60%,50% / 0.5)' }} />
            </div>
            <div className="absolute bottom-0 left-0 w-4 h-4 md:w-5 md:h-5 pointer-events-none" style={{ zIndex: 3 }}>
              <div className="absolute inset-0 border-l-2 border-b-2 border-[hsl(45,65%,55%)] rounded-bl-sm" />
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 md:w-5 md:h-5 pointer-events-none" style={{ zIndex: 3 }}>
              <div className="absolute inset-0 border-r-2 border-b-2 border-[hsl(45,65%,55%)] rounded-br-sm" />
            </div>
            {/* Spine ribbon (bottom center) */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-6 pointer-events-none rounded-t"
              style={{
                background: 'linear-gradient(180deg, hsl(0,55%,35%) 0%, hsl(0,50%,28%) 100%)',
                zIndex: 4,
              }}
            />
            {/* Green bookmark ribbons draped over top corners */}
            <div className="absolute top-0 left-[10%] w-8 h-10 md:w-10 md:h-12 pointer-events-none" style={{ zIndex: 15 }}>
              <div
                className="absolute w-full h-full rounded-b-md opacity-90"
                style={{
                  background: 'linear-gradient(135deg, hsl(142,35%,42%) 0%, hsl(140,30%,38%) 100%)',
                  boxShadow: 'inset 0 0 8px hsl(142,25%,55%), 2px 2px 6px hsl(0,0%,0% / 0.15)',
                  border: '1px solid hsl(142,25%,50%)',
                }}
              />
              <div className="absolute inset-0 rounded-b-md opacity-30" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
            </div>
            <div className="absolute top-0 right-[10%] w-8 h-10 md:w-10 md:h-12 pointer-events-none" style={{ zIndex: 15 }}>
              <div
                className="absolute w-full h-full rounded-b-md opacity-90"
                style={{
                  background: 'linear-gradient(225deg, hsl(142,35%,42%) 0%, hsl(140,30%,38%) 100%)',
                  boxShadow: 'inset 0 0 8px hsl(142,25%,55%), -2px 2px 6px hsl(0,0%,0% / 0.15)',
                  border: '1px solid hsl(142,25%,50%)',
                }}
              />
              <div className="absolute inset-0 rounded-b-md opacity-30" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
            </div>
          </>
        )}

        {/* Outer book shadow & edge */}
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            boxShadow: isAntique
              ? '0 4px 30px -6px hsl(28,25%,20% / 0.2), 0 1px 6px hsl(28,25%,15% / 0.12)'
              : '0 4px 30px -6px hsl(var(--foreground) / 0.12), 0 1px 6px hsl(var(--foreground) / 0.06)',
            zIndex: 0,
          }}
        />

        {/* Pages container */}
        <div className="absolute inset-0 flex rounded-sm overflow-hidden" style={{ zIndex: 1 }}>
          {isMobile ? (
            <SinglePage
              pageData={currentSpread[0] || null}
              fontSize={fontSize}
              lineSpacing={lineSpacing}
              side="single"
              antique={isAntique}
            />
          ) : (
            <>
              <SinglePage
                pageData={currentSpread[0] || null}
                fontSize={fontSize}
                lineSpacing={lineSpacing}
                side="left"
                antique={isAntique}
              />
              {/* Spine divider */}
              <div
                className="w-[2px] relative z-10"
                style={isAntique ? { background: 'linear-gradient(180deg, hsl(0,40%,30%) 0%, hsl(0,35%,25%) 100%)' } : { backgroundColor: 'hsl(var(--border) / 0.3)' }}
              />
              <SinglePage
                pageData={currentSpread[1] || null}
                fontSize={fontSize}
                lineSpacing={lineSpacing}
                side="right"
                antique={isAntique}
              />
            </>
          )}
        </div>

        {/* 3D flipping page overlay */}
        {isAnimating && flipDir !== 'none' && flippingPageData && !prefersReducedMotion && (
          <div
            className={`absolute top-0 bottom-0 overflow-hidden ${
              isAntique ? '' : 'bg-card'
            } ${isMobile ? 'left-0 right-0 rounded-sm' : flipDir === 'next' ? 'right-0 rounded-r-sm' : 'left-0 rounded-l-sm'}`}
            style={{
              ...flippingStyle,
              width: isMobile ? '100%' : '50%',
              ...(flipDir === 'next' && !isMobile ? { left: '50%', right: 'auto' } : {}),
              ...(flipDir === 'prev' && !isMobile ? { right: '50%', left: 'auto' } : {}),
              ...(isAntique ? { background: 'linear-gradient(180deg, hsl(42,38%,92%) 0%, hsl(38,35%,88%) 100%)' } : {}),
            }}
          >
            {/* Page thickness strip (spine edge; visible during flip) */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                ...(flipDir === 'next' ? { left: 0 } : { right: 0 }),
                width: pageThicknessPx,
                transform: flipDir === 'next' ? 'rotateY(-90deg)' : 'rotateY(90deg)',
                transformOrigin: flipDir === 'next' ? 'left center' : 'right center',
                background: isAntique
                  ? 'linear-gradient(180deg, hsl(38,25%,78%) 0%, hsl(35,22%,72%) 50%, hsl(38,25%,76%) 100%)'
                  : 'linear-gradient(180deg, hsl(var(--muted-foreground) / 0.2) 0%, hsl(var(--foreground) / 0.12) 50%, hsl(var(--muted-foreground) / 0.18) 100%)',
                boxShadow: 'inset 0 0 4px hsl(0,0%,0% / 0.06)',
                zIndex: 0,
              }}
            />
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
              antique={isAntique}
            />
          </div>
        )}

        {/* Page numbers */}
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center z-10">
          <span className={`font-serif text-xs tracking-widest ${isAntique ? 'text-[hsl(28,20%,35%)]' : 'text-muted-foreground/50'}`}>
            {rightPageNum && currentSpread[1]
              ? `${leftPageNum}–${rightPageNum}`
              : leftPageNum
            } / {allPages.length}
          </span>
        </div>

        {/* Paper stack illusion */}
        <div
          className="absolute inset-x-[2px] bottom-[-2px] h-[3px] rounded-b-sm"
          style={{ zIndex: 0, boxShadow: '0 1px 2px hsl(var(--foreground) / 0.04)', backgroundColor: isAntique ? 'hsl(38,30%,82%)' : 'hsl(var(--card))' }}
        />
        <div
          className="absolute inset-x-[4px] bottom-[-4px] h-[3px] rounded-b-sm"
          style={{ zIndex: -1, boxShadow: '0 1px 2px hsl(var(--foreground) / 0.02)', backgroundColor: isAntique ? 'hsl(38,28%,75%)' : 'hsl(var(--card) / 0.6)' }}
        />
      </div>
    </div>
  );
});

ClassicMode.displayName = 'ClassicMode';
export default ClassicMode;