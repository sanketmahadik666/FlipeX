import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useAtomValue } from 'jotai';
import { ArrowLeft } from 'lucide-react';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import { readingModeAtom, readingThemeAtom } from '@/state/jotaiAtoms';
import ReaderControls from '@/components/reader/ReaderControls';
import ClassicMode from '@/components/reader/ClassicMode';
import FocusMode from '@/components/reader/FocusMode';
import ScrollMode from '@/components/reader/ScrollMode';
import { Button } from '@/components/ui/button';

const themeStyles: Record<string, string> = {
  light: 'bg-background text-foreground',
  dark: 'bg-[hsl(222,47%,11%)] text-[hsl(210,40%,98%)]',
  sepia: 'bg-[hsl(39,70%,90%)] text-[hsl(30,20%,20%)]',
  antique: 'bg-[hsl(45,25%,97%)] text-[hsl(30,25%,18%)]',
};

const Reader = () => {
  const navigate = useNavigate();
  const doc = useRecoilValue(processedDocumentAtom);
  const mode = useAtomValue(readingModeAtom);
  const theme = useAtomValue(readingThemeAtom);

  const themeClass = themeStyles[theme] || themeStyles.light;

  const ModeComponent = useMemo(() => {
    switch (mode) {
      case 'focus': return FocusMode;
      case 'scroll': return ScrollMode;
      default: return ClassicMode;
    }
  }, [mode]);

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No document loaded.</p>
          <Button onClick={() => navigate('/upload')}>Upload a Book</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col transition-colors duration-500 ${themeClass}`}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="sm" onClick={() => navigate('/experience')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="font-serif text-sm font-medium truncate max-w-[50%]">{doc.title}</h1>
        <div className="w-16" />
      </header>

      {/* Reader */}
      <main className="flex flex-1 flex-col py-6">
        <ModeComponent />
      </main>

      {/* Controls */}
      <footer className="px-4 py-3">
        <ReaderControls />
      </footer>
    </div>
  );
};

export default Reader;