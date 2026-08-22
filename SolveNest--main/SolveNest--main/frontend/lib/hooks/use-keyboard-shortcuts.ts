"use client";

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onEscape?: () => void;
  onSearchFocus?: () => void;
  onAnalyzeSubmit?: () => void;
  onToggleShortcutsHelp?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // 1. Esc key - works everywhere
      if (event.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }

      // 2. Ctrl+K or Cmd+K - Focus Search Bar
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handlers.onSearchFocus?.();
        return;
      }

      // 3. Ctrl+Enter or Cmd+Enter - Analyze Area shortcut
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handlers.onAnalyzeSubmit?.();
        return;
      }

      // 4. ? key (Shift + /) - Toggle Shortcuts Modal (when not typing)
      if (event.key === '?' && !isInput) {
        event.preventDefault();
        handlers.onToggleShortcutsHelp?.();
        return;
      }

      // 5. Arrow Up / Down / Enter (when not typing in an input)
      if (!isInput) {
        if (event.key === 'ArrowUp') {
          handlers.onArrowUp?.();
        } else if (event.key === 'ArrowDown') {
          handlers.onArrowDown?.();
        } else if (event.key === 'Enter') {
          handlers.onEnter?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
