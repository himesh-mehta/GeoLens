import React from 'react';
import { clsx } from 'clsx';
import { Button } from './button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  className,
  title,
  description,
  icon,
  actionText,
  onAction,
  ...props
}) => {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-brand-neutral-200 rounded-brand-md bg-white min-h-[250px]",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 text-brand-neutral-300 flex items-center justify-center h-12 w-12">
          {icon}
        </div>
      )}
      <h3 className="text-base md:text-lg font-semibold text-brand-neutral-900">{title}</h3>
      <p className="text-sm text-brand-neutral-700 mt-2 max-w-sm">{description}</p>
      {actionText && onAction && (
        <div className="mt-5">
          <Button variant="primary" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};
