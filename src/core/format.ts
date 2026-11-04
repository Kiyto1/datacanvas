import type { Lang } from '../i18n';

// Western (Latin) digits in both languages by default: the common convention in business sheets,
// and it matches how the source data was typed. A digit-style setting can swap the locale later.
function locale(lang: Lang): string {
  return lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
}

export function formatNumber(value: number, lang: Lang, compact = false): string {
  return new Intl.NumberFormat(locale(lang), {
    maximumFractionDigits: Math.abs(value) >= 1000 || Number.isInteger(value) ? 0 : 2,
    ...(compact ? { notation: 'compact' as const } : {}),
  }).format(value);
}

export function formatPercent(fraction: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}
