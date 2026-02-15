import { ReactElement } from 'react';

interface CircularProgressProps {
  progress: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
}

/**
 * Circular Progress Bar Component
 * Beautiful animated progress indicator for long-running operations
 */
export function CircularProgress({
  progress,
  label = 'Progress',
  size = 120,
  strokeWidth = 8,
  showPercentage = true,
}: CircularProgressProps): ReactElement {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Calculate SVG circle properties
  const radius = (100 - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedProgress}
        className="transform -rotate-90"
        height={size}
        role="progressbar"
        width={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background Circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
          strokeLinecap="round"
        />

        {/* Progress Circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-500 ease-out"
          strokeLinecap="round"
        />
      </svg>

      {/* Center Text */}
      {showPercentage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {Math.round(normalizedProgress)}%
          </span>
          {label && normalizedProgress < 100 && (
            <span className="text-xs text-muted-foreground mt-1">
              {label}
            </span>
          )}
          {normalizedProgress === 100 && (
            <span className="text-xs text-primary font-medium mt-1">
              Complete!
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Linear Progress Bar Component
 * Alternative progress indicator for compact spaces
 */
interface LinearProgressProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function LinearProgress({
  progress,
  label,
  showPercentage = true,
  className = '',
}: LinearProgressProps): ReactElement {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`space-y-2 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && (
            <span className="font-medium text-foreground">
              {Math.round(normalizedProgress)}%
            </span>
          )}
        </div>
      )}
      
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${normalizedProgress}%` }}
          role="progressbar"
          aria-label={label || 'Progress'}
          aria-valuenow={normalizedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
