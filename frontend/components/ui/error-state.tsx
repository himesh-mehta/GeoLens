import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  retryText?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  className,
  title = "Something went wrong",
  message,
  details,
  onRetry,
  retryText = "Try again",
  ...props
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={clsx(
        "border border-status-error-border bg-status-error-bg/10 rounded-brand-md p-5 max-w-md mx-auto shadow-brand-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 text-status-error-text mr-3 mt-0.5">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-semibold text-status-error-text">{title}</h4>
          <p className="text-sm text-brand-neutral-900 mt-1">{message}</p>
          
          {onRetry && (
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={onRetry}>
                {retryText}
              </Button>
            </div>
          )}
          
          {details && (
            <div className="mt-4 border-t border-brand-neutral-200/60 pt-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center text-xs font-medium text-brand-neutral-700 hover:text-brand-neutral-900"
              >
                {showDetails ? "Hide technical details" : "Show technical details"}
                {showDetails ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
              </button>
              
              {showDetails && (
                <pre className="mt-2 p-3 bg-brand-neutral-50 rounded border border-brand-neutral-200 text-xs text-brand-neutral-700 overflow-x-auto max-h-36 font-mono whitespace-pre-wrap">
                  {details}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
