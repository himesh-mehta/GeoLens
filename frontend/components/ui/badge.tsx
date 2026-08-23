import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'info' | 'warning' | 'error' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  children,
  ...props
}) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-brand-full text-xs font-medium border transition-colors",
        {
          "bg-status-success-bg text-status-success-text border-status-success-border": variant === 'success',
          "bg-status-info-bg text-status-info-text border-status-info-border": variant === 'info',
          "bg-status-warning-bg text-status-warning-text border-status-warning-border": variant === 'warning',
          "bg-status-error-bg text-status-error-text border-status-error-border": variant === 'error',
          "bg-brand-neutral-100 text-brand-neutral-700 border-brand-neutral-200": variant === 'neutral',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
