export type LangCode = 'en' | 'hi' | 'mr';

export const SUPPORTED_LANGUAGES: { code: LangCode; nativeName: string }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'hi', nativeName: 'हिन्दी' },
  { code: 'mr', nativeName: 'मराठी' },
];

export const DEFAULT_LANG: LangCode = 'en';
export const STORAGE_KEY = 'solvenest_lang';
