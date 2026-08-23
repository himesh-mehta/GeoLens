"use client";

/**
 * lib/i18n/index.tsx
 *
 * Language context, provider, and useTranslation hook.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { en, TranslationMap } from './translations/en';
import { hi } from './translations/hi';
import { mr } from './translations/mr';
import { DEFAULT_LANG, STORAGE_KEY, LangCode } from './config';

const translations: Record<LangCode, TranslationMap> = { en, hi, mr };

function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(str: string, params?: Record<string, string>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}

interface LanguageContextValue {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'hi' || saved === 'mr') {
      setLangState(saved as LangCode);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      const active = translations[lang];
      const val = getNestedValue(active as Record<string, unknown>, key);
      if (val !== undefined) return interpolate(val, params);

      const enVal = getNestedValue(en as Record<string, unknown>, key);
      if (enVal !== undefined) return interpolate(enVal, params);

      return key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}

export type { LangCode };
export { SUPPORTED_LANGUAGES } from './config';
