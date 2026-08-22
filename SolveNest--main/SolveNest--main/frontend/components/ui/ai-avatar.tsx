"use client";

import React from 'react';
import { clsx } from 'clsx';

export interface AIAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export const AIAvatar: React.FC<AIAvatarProps> = ({ size = 'md', className }) => {
  return (
    <div
      className={clsx(
        'rounded-full overflow-hidden flex-shrink-0 border border-[#4C7A3D]/30 shadow-xs bg-slate-900',
        sizeClasses[size],
        className
      )}
    >
      <img
        src="/agri-space-bot.png"
        alt="AI Assistant Avatar"
        className="w-full h-full object-cover"
      />
    </div>
  );
};
