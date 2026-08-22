"use client";

import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Esc', desc: 'Close any open overlay, popover, or chat panel' },
    { key: 'Ctrl + K  /  ⌘K', desc: 'Focus location search bar' },
    { key: 'Ctrl + Enter  /  ⌘↵', desc: 'Trigger "Analyze Area" satellite prediction' },
    { key: '↑  /  ↓', desc: 'Navigate AI Assistant suggested questions' },
    { key: 'Enter  /  ↵', desc: 'Select focused AI question chip' },
    { key: '?', desc: 'Open / Close this keyboard shortcuts guide' },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
          isLight ? 'bg-white border-[#E5E7DE] text-[#2D3B27]' : 'bg-[#131B2E] border-[#1E293B] text-[#F1F5F9]'
        }`}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${isLight ? 'bg-[#F0F2EB] border-[#D8DCCF] text-[#4C7A3D]' : 'bg-[#0F172A] border-slate-700 text-[#14B8A6]'}`}>
              <Keyboard className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-wider">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'hover:bg-[#F0F2EB] text-[#6B7568]' : 'hover:bg-[#1E293B] text-slate-400'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((item) => (
            <div
              key={item.key}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'
              }`}
            >
              <span className={`font-medium ${isLight ? 'text-[#3D4A37]' : 'text-slate-300'}`}>{item.desc}</span>
              <kbd className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold border shadow-2xs whitespace-nowrap ml-3 ${
                isLight ? 'bg-white border-[#D8DCCF] text-[#2D3B27]' : 'bg-[#1E293B] border-slate-700 text-[#14B8A6]'
              }`}>
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isLight ? 'bg-[#4C7A3D] text-white hover:bg-[#3D6330]' : 'bg-[#14B8A6] text-white hover:bg-[#0F766E]'
            }`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
