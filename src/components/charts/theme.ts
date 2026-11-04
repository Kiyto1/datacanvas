import { useEffect, useState } from 'react';

export type Scheme = 'light' | 'dark';

/** Mirrors the tokens in index.css (validated reference palette). Canvas can't read CSS vars, so keep in sync. */
export const PALETTE: Record<Scheme, { series: string[]; ink: string; muted: string; faint: string; grid: string; axis: string; surface: string }> = {
  light: {
    series: ['#2b2e34', '#3d74b8', '#b7791f', '#7a6bb5', '#2e8b62', '#7c828d', '#c0504d', '#b9578f'],
    ink: '#171717',
    muted: '#5e636e',
    faint: '#5e636e',
    grid: '#e1e1de',
    axis: '#cfcfcb',
    surface: '#fbfbfa',
  },
  dark: {
    series: ['#e4e4e7', '#6fa8e8', '#e3a84a', '#a89bea', '#5ec48e', '#8a8a93', '#e58585', '#e58fc4'],
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
