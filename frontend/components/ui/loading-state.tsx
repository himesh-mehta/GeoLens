import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  className,
  message = "Loading information...",
  description,
  size = 'md',
  ...props
}) => {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-8 text-center min-h-[200px]",
        className
      )}
      {...props}
    >
      <Loader2
        className={clsx(
          "animate-spin text-brand-green-700 mb-3",
          {
            "h-6 w-6": size === 'sm',
            "h-10 w-10": size === 'md',
            "h-14 w-14": size === 'lg',
          }
        )}
      />
      <p className="text-base font-medium text-brand-neutral-900">{message}</p>
      {description && (
        <p className="text-sm text-brand-neutral-700 mt-2 max-w-sm">{description}</p>
      )}
    </div>
  );
};
