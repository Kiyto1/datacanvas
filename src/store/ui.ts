import { create } from 'zustand';
import { applyTheme, readTheme, type ThemeChoice } from '../core/theme';
import i18n, { applyDocumentLang, type Lang } from '../i18n';

// Lightweight UI state only. Datasets live in the worker, never here.
interface UiState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

export const useUi = create<UiState>((set) => ({
  lang: 'ar',
  setLang: (lang) => {
    void i18n.changeLanguage(lang);
    applyDocumentLang(lang);
    set({ lang });
  },
  theme: readTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
