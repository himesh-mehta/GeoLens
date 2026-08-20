import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'link' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          // Base styles
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          
          // Variants
          {
            // Primary: Restrained Green
            "bg-brand-green-700 hover:bg-brand-green-800 text-white shadow-brand-sm rounded-brand-md": 
              variant === 'primary',
            // Secondary: Clean Neutral
            "border border-brand-neutral-200 bg-white hover:bg-brand-neutral-100 text-brand-neutral-900 shadow-brand-sm rounded-brand-md": 
              variant === 'secondary',
            // Outline
            "border border-brand-neutral-300 bg-transparent hover:bg-brand-neutral-100 text-brand-neutral-900 rounded-brand-md":
              variant === 'outline',
            // Ghost
            "bg-transparent hover:bg-brand-neutral-100 text-brand-neutral-800 rounded-brand-md shadow-none":
              variant === 'ghost',
            // Danger: Red
            "bg-status-error-text hover:bg-red-700 text-white shadow-brand-sm rounded-brand-md": 
              variant === 'danger',
            // Link: Inline
            "text-brand-green-700 hover:text-brand-green-800 hover:underline bg-transparent border-none p-0 shadow-none": 
              variant === 'link',
          },
          
          // Sizes
          {
            "px-3 py-1.5 text-sm": size === 'sm' && variant !== 'link',
            "px-4 py-2 text-sm md:text-base": size === 'md' && variant !== 'link',
            "px-5 py-2.5 text-base md:text-lg": size === 'lg' && variant !== 'link',
          },
          
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {!isLoading && leftIcon && <span className="mr-2 inline-flex">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2 inline-flex">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
