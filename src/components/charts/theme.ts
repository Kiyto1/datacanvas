import { useEffect, useState } from 'react';

export type Scheme = 'light' | 'dark';

/** Mirrors the tokens in index.css (validated reference palette). Canvas can't read CSS vars, so keep in sync. */
export const PALETTE: Record<Scheme, { series: string[]; ink: string; muted: string; faint: string; grid: string; axis: string; surface: string }> = {
  light: {
    series: ['#635bff', '#16a34a', '#d97706', '#0ea5e9', '#dc2626', '#8b83ff', '#475467', '#db2777'],
    ink: '#171717',
    muted: '#667085',
    faint: '#667085',
    grid: '#e6e8ec',
    axis: '#d3d7de',
    surface: '#ffffff',
  },
  dark: {
    series: ['#8b83ff', '#4ade80', '#fbbf24', '#38bdf8', '#f87171', '#a19aff', '#a1a1aa', '#f472b6'],
    ink: '#f5f5f5',
    muted: '#a1a1aa',
    faint: '#a1a1aa',
    grid: '#292929',
    axis: '#3a3a3a',
    surface: '#1a1a1a',
  },
};

function current(): Scheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useScheme(): Scheme {
  const [scheme, setScheme] = useState<Scheme>(current);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setScheme(current());
    query.addEventListener('change', update);
    // The theme switcher changes data-theme on <html>; charts repaint when it does.
    const watch = new MutationObserver(update);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      query.removeEventListener('change', update);
      watch.disconnect();
    };
  }, []);
  return scheme;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
