"use client";

import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation, SUPPORTED_LANGUAGES, LangCode } from '@/lib/i18n';

export const LanguageSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { lang: currentLang, setLang } = useTranslation();

  const languages = [
    { code: 'en' as LangCode, name: 'English' },
    { code: 'hi' as LangCode, name: 'हिन्दी (Hindi)' },
    { code: 'mr' as LangCode, name: 'मराठी (Marathi)' }
  ];

  const handleLanguageChange = (code: LangCode) => {
    setLang(code);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-neutral-700 hover:text-brand-neutral-900 border border-brand-neutral-200 bg-white hover:bg-brand-neutral-50 rounded-brand-md transition-colors cursor-pointer"
          id="menu-button"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <Globe className="h-4 w-4" />
          <span>{languages.find(l => l.code === currentLang)?.name.split(' ')[0]}</span>
        </button>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute left-0 bottom-full z-20 mb-1.5 w-44 origin-bottom-left rounded-brand-md bg-white border border-brand-neutral-200 shadow-brand-md focus:outline-none"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="menu-button"
          >
            <div className="py-1" role="none">
              {languages.map((langItem) => (
                <button
                  key={langItem.code}
                  onClick={() => handleLanguageChange(langItem.code)}
                  className={clsx(
                    "flex items-center justify-between w-full px-4 py-2.5 text-sm text-left hover:bg-brand-neutral-50 transition-colors cursor-pointer",
                    {
                      "text-brand-green-700 font-medium": currentLang === langItem.code,
                      "text-brand-neutral-900": currentLang !== langItem.code
                    }
                  )}
                  role="menuitem"
                >
                  <span>{langItem.name}</span>
                  {currentLang === langItem.code && <Check className="h-4 w-4 text-brand-green-700" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
