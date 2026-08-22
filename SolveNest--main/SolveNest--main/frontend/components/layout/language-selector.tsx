"use client";

import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation, LangCode } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/theme-context';

export const LanguageSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { lang: currentLang, setLang } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const languages = [
    { code: 'en' as LangCode, name: 'English', label: 'English' },
    { code: 'hi' as LangCode, name: 'हिन्दी', label: 'हिन्दी (Hindi)' },
    { code: 'mr' as LangCode, name: 'मराठी', label: 'मराठी (Marathi)' }
  ];

  const currentLangObj = languages.find(l => l.code === currentLang) || languages[0];

  const handleLanguageChange = (code: LangCode) => {
    setLang(code);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full inline-flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer",
          isLight
            ? "bg-[#FFFFFF] border-[#E5E7DE] text-[#2D3B27] hover:bg-[#F0F2EB]"
            : "bg-[#131B2E] border-[#1E293B] text-[#F1F5F9] hover:bg-[#1E293B]"
        )}
        id="menu-button"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex items-center gap-2">
          <Globe className={`h-3.5 w-3.5 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
          <span>{currentLangObj.label}</span>
        </div>
        <span className="text-[10px] opacity-60">▾</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={clsx(
              "absolute left-0 bottom-full z-50 mb-1.5 w-full rounded-lg border shadow-xl overflow-hidden py-1",
              isLight
                ? "bg-white border-[#E5E7DE] text-[#2D3B27]"
                : "bg-[#131B2E] border-[#334155] text-[#F1F5F9]"
            )}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="menu-button"
          >
            {languages.map((langItem) => (
              <button
                key={langItem.code}
                onClick={() => handleLanguageChange(langItem.code)}
                className={clsx(
                  "flex items-center justify-between w-full px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer",
                  currentLang === langItem.code
                    ? isLight
                      ? "bg-[#F0F2EB] text-[#4C7A3D] font-bold"
                      : "bg-[#1E293B] text-[#14B8A6] font-bold"
                    : isLight
                      ? "hover:bg-[#FAFAF7] text-[#2D3B27]"
                      : "hover:bg-slate-800 text-slate-200"
                )}
              >
                <span>{langItem.label}</span>
                {currentLang === langItem.code && (
                  <Check className={`h-3.5 w-3.5 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
