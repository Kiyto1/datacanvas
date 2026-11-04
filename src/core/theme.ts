export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'datacanvas.theme';

export function readTheme(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage can be blocked; light is the default */
  }
  return 'light';
}

/** "system" removes the attribute so the prefers-color-scheme rule in index.css decides. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = choice;
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    /* ignore */
  }
}
