import { memo, useMemo, useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useAtomValue } from 'jotai';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { processedDocumentAtom, currentChapterIndexAtom, currentParagraphIndexAtom } from '@/state/recoilAtoms';
import { fontSizeAtom, lineSpacingAtom } from '@/state/jotaiAtoms';
import { Button } from '@/components/ui/button';

const FocusMode = memo(() => {
  const doc = useRecoilValue(processedDocumentAtom);
  const [chapterIdx, setChapterIdx] = useRecoilState(currentChapterIndexAtom);
  const [paraIdx, setParaIdx] = useRecoilState(currentParagraphIndexAtom);
  const fontSize = useAtomValue(fontSizeAtom);
  const lineSpacing = useAtomValue(lineSpacingAtom);

  const chapter = doc?.chapters[chapterIdx];
  const paragraph = chapter?.paragraphs[paraIdx];

  const totalParas = useMemo(() => {
    if (!doc) return 0;
    return doc.chapters.reduce((s, c) => s + c.paragraphs.length, 0);
  }, [doc]);

  const globalParaNum = useMemo(() => {
    if (!doc) return 0;
    let count = 0;
    for (let i = 0; i < chapterIdx; i++) count += doc.chapters[i].paragraphs.length;
    return count + paraIdx + 1;
  }, [doc, chapterIdx, paraIdx]);

  const navigate = useCallback((dir: 'prev' | 'next') => {
    if (!doc || !chapter) return;
    if (dir === 'next') {
      if (paraIdx < chapter.paragraphs.length - 1) {
        setParaIdx(paraIdx + 1);
      } else if (chapterIdx < doc.chapters.length - 1) {
        setChapterIdx(chapterIdx + 1);
        setParaIdx(0);
      }
    } else {
      if (paraIdx > 0) {
        setParaIdx(paraIdx - 1);
      } else if (chapterIdx > 0) {
        const prev = doc.chapters[chapterIdx - 1];
        setChapterIdx(chapterIdx - 1);
        setParaIdx(prev.paragraphs.length - 1);
      }
    }
  }, [doc, chapter, chapterIdx, paraIdx, setChapterIdx, setParaIdx]);

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

  if (!doc || !chapter || !paragraph) return null;

  const isFirst = chapterIdx === 0 && paraIdx === 0;
  const isLast = chapterIdx === doc.chapters.length - 1 && paraIdx === chapter.paragraphs.length - 1;

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4">
      <div className="w-full max-w-xl text-center">
        <p
          className="font-serif text-foreground transition-all duration-300"
          style={{ fontSize: `${fontSize + 2}px`, lineHeight: lineSpacing + 0.2 }}
        >
          {paragraph}
        </p>

        <div className="mt-12 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('prev')} disabled={isFirst}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {globalParaNum} / {totalParas}
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('next')} disabled={isLast}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

FocusMode.displayName = 'FocusMode';
export default FocusMode;