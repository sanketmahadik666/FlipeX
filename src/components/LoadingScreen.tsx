import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

/**
 * Full-screen loading component for suspense fallbacks
 */
export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
        <p className="text-muted-foreground animate-pulse">{message}</p>
      </div>
    </div>
  );
}
