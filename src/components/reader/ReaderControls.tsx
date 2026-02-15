import { memo } from 'react';
import { useAtom } from 'jotai';
import { Sun, Moon, BookOpen, BookMarked, Minus, Plus, Volume2, VolumeOff } from 'lucide-react';
import {
  fontSizeAtom,
  lineSpacingAtom,
  readingThemeAtom,
  readingModeAtom,
  soundEnabledAtom,
  type ReadingTheme,
  type ReadingMode,
} from '@/state/jotaiAtoms';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const ReaderControls = memo(() => {
  const [fontSize, setFontSize] = useAtom(fontSizeAtom);
  const [lineSpacing, setLineSpacing] = useAtom(lineSpacingAtom);
  const [theme, setTheme] = useAtom(readingThemeAtom);
  const [mode, setMode] = useAtom(readingModeAtom);
  const [soundEnabled, setSoundEnabled] = useAtom(soundEnabledAtom);

  const themes: { id: ReadingTheme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { id: 'sepia', label: 'Sepia', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'antique', label: 'Antique', icon: <BookMarked className="h-4 w-4" /> },
  ];

  const modes: { id: ReadingMode; label: string }[] = [
    { id: 'classic', label: 'Classic' },
    { id: 'focus', label: 'Focus' },
    { id: 'scroll', label: 'Scroll' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-card p-3">
      {/* Theme switcher */}
      <div className="flex items-center gap-1">
        {themes.map((t) => (
          <Button
            key={t.id}
            variant={theme === t.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTheme(t.id)}
            className="h-8 px-2"
          >
            {t.icon}
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Font size */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setFontSize(Math.max(12, fontSize - 2))}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="min-w-[2.5rem] text-center text-xs text-muted-foreground">{fontSize}px</span>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setFontSize(Math.min(32, fontSize + 2))}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Line spacing */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Spacing</span>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setLineSpacing(Math.max(1.2, lineSpacing - 0.2))}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="min-w-[2rem] text-center text-xs text-muted-foreground">{lineSpacing.toFixed(1)}</span>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setLineSpacing(Math.min(3, lineSpacing + 0.2))}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Sound toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => setSoundEnabled(!soundEnabled)}
        aria-label={soundEnabled ? 'Mute page flip sound' : 'Enable page flip sound'}
      >
        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeOff className="h-4 w-4" />}
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Mode switcher */}
      <div className="flex items-center gap-1">
        {modes.map((m) => (
          <Button
            key={m.id}
            variant={mode === m.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode(m.id)}
            className="h-8 text-xs"
          >
            {m.label}
          </Button>
        ))}
      </div>
    </div>
  );
});

ReaderControls.displayName = 'ReaderControls';
export default ReaderControls;
