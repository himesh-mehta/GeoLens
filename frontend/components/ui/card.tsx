import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'outline';
}

export const Card: React.FC<CardProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  return (
    <div
      className={clsx(
        "rounded-brand-md transition-shadow",
        {
          "bg-white border border-brand-neutral-200 shadow-brand-sm": variant === 'default',
          "bg-brand-neutral-50 border border-brand-neutral-100": variant === 'flat',
          "bg-transparent border border-brand-neutral-200": variant === 'outline',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx("px-4 py-3 md:px-6 md:py-4 border-b border-brand-neutral-100", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3
      className={clsx("text-base md:text-lg font-semibold text-brand-neutral-900", className)}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p
      className={clsx("text-xs md:text-sm text-brand-neutral-700 mt-1", className)}
      {...props}
    >
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={clsx("p-4 md:p-6", className)} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx("px-4 py-3 md:px-6 md:py-4 border-t border-brand-neutral-100 bg-brand-neutral-50/50 rounded-b-brand-md", className)}
      {...props}
    >
      {children}
    </div>
  );
};
