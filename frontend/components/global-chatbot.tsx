"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AIAssistant } from '@/components/analysis/ai-assistant';
import { AIAvatar } from '@/components/ui/ai-avatar';
import { useTheme } from '@/lib/theme/theme-context';
import { useActiveAnalysis } from '@/lib/analysis-context';

export function GlobalChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const { activeAnalysis } = useActiveAnalysis();
  const isLight = theme === 'light';

  const defaultContext = {
    locationId: 'All Regions',
    areaName: 'All Regions'
  };

  return (
    <>
      {/* ── FLOATING SLIDE-IN CHAT WIDGET OVERLAY (Original Full-Height Drawer: 380-420px width, h-[calc(100vh-104px)]) ── */}
      <div
        className={`fixed top-20 right-6 z-[9999] w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[calc(100vh-104px)] rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-all duration-300 ease-out ${
          isOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'translate-x-[115%] opacity-0 pointer-events-none'
        } ${
          isLight ? 'bg-white border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
        }`}
        style={{ boxShadow: isLight ? '0 12px 36px rgba(0,0,0,0.18)' : '0 12px 36px rgba(0,0,0,0.55)' }}
      >
        <AIAssistant
          context={activeAnalysis || defaultContext}
          onSelectFindingById={() => {}}
          onClose={() => setIsOpen(false)}
          title="Orbit — Earth Intelligence AI"
        />
      </div>

      {/* ── FLOATING BOT CIRCLE TRIGGER BUTTON (Original 72px Diameter Circle) ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        title={isOpen ? "Close Orbit AI Assistant" : "Ask Orbit AI Assistant"}
        className={`fixed bottom-8 right-8 z-[9998] w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-2 overflow-hidden shadow-2xl hover:scale-105 active:scale-95 ${
          isLight
            ? 'bg-[#FFFFFF] border-[#4C7A3D]'
            : 'bg-[#131B2E] border-[#14B8A6]'
        }`}
        style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}
      >
        {isOpen ? (
          <X className={`h-7 w-7 ${isLight ? 'text-[#2D3B27]' : 'text-white'}`} />
        ) : (
          <div className="relative w-full h-full p-0.5 flex items-center justify-center">
            <AIAvatar size="xl" className="w-full h-full" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full animate-ping" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full shadow-xs" />
          </div>
        )}
      </button>
    </>
  );
}
