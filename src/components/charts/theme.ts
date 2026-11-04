import { useEffect, useState } from 'react';

export type Scheme = 'light' | 'dark';

/** Mirrors the tokens in index.css (validated reference palette). Canvas can't read CSS vars, so keep in sync. */
export const PALETTE: Record<Scheme, { series: string[]; ink: string; muted: string; faint: string; grid: string; axis: string; surface: string }> = {
  light: {
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    ink: '#0b0b0b',
    muted: '#52514e',
    faint: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    surface: '#fcfcfb',
  },
  dark: {
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    ink: '#f0efec',
    muted: '#c3c2b7',
    faint: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    surface: '#1a1a19',
  },
};

function current(): Scheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  if (document.documentElement.dataset.theme === 'light') return 'light';
  if (document.documentElement.dataset.theme === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useScheme(): Scheme {
  const [scheme, setScheme] = useState<Scheme>(current);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setScheme(current());
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return scheme;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
