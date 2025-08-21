import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {text && <span className="ml-2 text-muted-foreground">{text}</span>}
    </div>
  );
};

interface LoadingCardProps {
  title?: string;
  description?: string;
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  title = 'Loading...',
  description,
  className
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 space-y-4', className)}>
      <LoadingSpinner size="lg" />
      <div className="text-center">
        <h3 className="text-lg font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  );
};

interface LoadingTableProps {
  rows?: number;
  columns?: number;
}

export const LoadingTable: React.FC<LoadingTableProps> = ({
  rows = 5,
  columns = 6
}) => {
  return (
    <div className="w-full space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex space-x-4">
          {Array.from({ length: columns }, (_, j) => (
            <div
              key={j}
              className="h-4 bg-muted rounded animate-pulse flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface LoadingPageProps {
  message?: string;
  className?: string;
}

export const LoadingPage: React.FC<LoadingPageProps> = ({
  message = 'Loading...',
  className
}) => {
  return (
    <div className={cn('flex items-center justify-center min-h-64 w-full', className)}>
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;