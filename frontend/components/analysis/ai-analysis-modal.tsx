"use client";

import React, { useEffect } from 'react';
import { AIAnalysisPanel } from './ai-analysis-panel';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: any;
  context?: any;
}

export function AIAnalysisModal({ isOpen, onClose, analysisResult, context }: AIAnalysisModalProps) {
  // No body scroll lock needed for side panel
  useEffect(() => {
    // Empty effect, preserving the hook signature just in case
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end pointer-events-none">
      <div className="bg-white w-[500px] h-full flex flex-col shadow-2xl border-l border-slate-200 pointer-events-auto animate-in slide-in-from-right duration-300 ease-out">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">AI Analysis Report</h2>
            <p className="text-sm text-slate-500 mt-1">GPT-OSS Scientific Reasoning</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="rounded-full w-10 h-10 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <AIAnalysisPanel analysisResult={analysisResult} context={context} />
        </div>
      </div>
    </div>
  );
}
