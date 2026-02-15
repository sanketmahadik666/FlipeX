import { Loader2 } from 'lucide-react';
import { CircularProgress, LinearProgress } from './Progress';

interface LoadingScreenProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

/**
 * Full-screen loading component for suspense fallbacks and long operations
 */
export function LoadingScreen({ 
  message = 'Loading...',
  progress,
  showProgress = false,
}: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-6">
        {/* Show circular progress if progress value is provided */}
        {showProgress && progress !== undefined ? (
          <div className="flex justify-center">
            <CircularProgress 
              progress={progress} 
              size={140}
              strokeWidth={10}
            />
          </div>
        ) : (
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
        )}
        
        <div className="space-y-2">
          <p className="text-lg font-medium text-foreground animate-pulse">
            {message}
          </p>
          
          {/* Optional linear progress bar */}
          {showProgress && progress !== undefined && (
            <LinearProgress 
              progress={progress}
              showPercentage={false}
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
}
