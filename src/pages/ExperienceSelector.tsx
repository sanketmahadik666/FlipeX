import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useSetAtom } from 'jotai';
import { BookOpen, Focus, ScrollText } from 'lucide-react';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import { readingModeAtom, type ReadingMode } from '@/state/jotaiAtoms';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const modes = [
  {
    id: 'classic' as ReadingMode,
    title: 'Classic Book',
    description: 'Page-by-page reading with real book aesthetics, serif typography, and elegant page turns.',
    icon: BookOpen,
  },
  {
    id: 'focus' as ReadingMode,
    title: 'Focus / Zen',
    description: 'One paragraph at a time for deep concentration. Minimal chrome, maximum immersion.',
    icon: Focus,
  },
  {
    id: 'scroll' as ReadingMode,
    title: 'Scroll',
    description: 'Continuous vertical reading for articles and long-form content with chapter headings.',
    icon: ScrollText,
  },
];

const ExperienceSelector = () => {
  const navigate = useNavigate();
  const doc = useRecoilValue(processedDocumentAtom);
  const setMode = useSetAtom(readingModeAtom);

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

  const selectMode = (mode: ReadingMode) => {
    setMode(mode);
    navigate('/reader');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl font-bold text-foreground">Choose Your Experience</h1>
          <p className="text-muted-foreground">
            Reading <span className="font-medium text-foreground">{doc.title}</span> — {doc.totalPages} pages, {doc.chapters.length} chapter{doc.chapters.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {modes.map((mode) => (
            <Card
              key={mode.id}
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
              onClick={() => selectMode(mode.id)}
            >
              <CardHeader className="text-center space-y-4">
                <div className="mx-auto rounded-full bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                  <mode.icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="font-serif text-xl">{mode.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {mode.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate('/upload')}>
            ← Upload Different Book
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExperienceSelector;