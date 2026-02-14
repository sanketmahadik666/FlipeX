import { memo } from 'react';
import { useRecoilValue } from 'recoil';
import { useAtomValue } from 'jotai';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import { fontSizeAtom, lineSpacingAtom } from '@/state/jotaiAtoms';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState, useRef } from 'react';

const ScrollMode = memo(() => {
  const doc = useRecoilValue(processedDocumentAtom);
  const fontSize = useAtomValue(fontSizeAtom);
  const lineSpacing = useAtomValue(lineSpacingAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (!doc) return null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-4 py-2">
        <Progress value={progress} className="h-1" />
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto scroll-smooth px-4">
        <div className="mx-auto max-w-2xl py-8">
          {doc.chapters.map((chapter, ci) => (
            <div key={ci} className="mb-12">
              <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground/80 text-center">
                {chapter.title}
              </h2>
              <div
                className="font-serif text-foreground transition-all duration-300"
                style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
              >
                {chapter.paragraphs.map((para, pi) => (
                  <p key={pi} className="mb-5 text-justify indent-8">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

ScrollMode.displayName = 'ScrollMode';
export default ScrollMode;