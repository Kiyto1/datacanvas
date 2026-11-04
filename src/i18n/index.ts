import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ar } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'en';

export function dirFor(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function applyDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = dirFor(lang);
}

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: 'ar',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes output
});

export default i18n;
