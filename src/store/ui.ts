import { create } from 'zustand';
import i18n, { applyDocumentLang, type Lang } from '../i18n';

// Lightweight UI state only. Datasets live in the worker, never here.
interface UiState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useUi = create<UiState>((set) => ({
  lang: 'ar',
  setLang: (lang) => {
    void i18n.changeLanguage(lang);
    applyDocumentLang(lang);
    set({ lang });
  },
}));
