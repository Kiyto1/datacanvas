import { buildDisplayMap, displayCell } from '../../normalize/layer';
import { suggestForColumn } from '../../normalize/suggest';

/** One week of a small sales sheet, with the city spellings a real file has. */
export const STORY_HEADERS = ['التاريخ', 'المدينة', 'المنتج', 'المبيعات'] as const;

export const STORY_ROWS: [string, string, string, number][] = [
  ['2026/03/01', 'الرياض', 'حاسب محمول', 5000],
  ['2026/03/02', 'Riyadh', 'هاتف', 3000],
  ['2026/03/02', 'جدة', 'شاشة', 4000],
  ['2026/03/03', 'الرّياض', 'هاتف', 2000],
  ['2026/03/04', 'Jeddah', 'حاسب محمول', 2500],
  ['2026/03/05', 'الدمام', 'طابعة', 1800],
  ['2026/03/05', 'جدة', 'هاتف', 1500],
  ['2026/03/06', 'Makkah', 'سماعات', 1200],
  ['2026/03/07', 'مكة المكرمة', 'شاشة', 2200],
  ['2026/03/08', 'الرياض', 'طابعة', 900],
  ['2026/03/09', 'Dammam', 'هاتف', 1300],
  ['2026/03/09', 'المدينة المنورة', 'حاسب محمول', 2700],
];

export interface StoryModel {
  /** City as shown after the approved merges, per row. */
  merged: string[];
  /** Rows whose city changes when merged, in order (drives the staggered highlight). */
  changedOrder: Map<number, number>;
  changedCount: number;
  suggestion: { variants: string[]; target: string } | undefined;
  rawCities: number;
  mergedCities: number;
  recordCount: number;
  totalSales: number;
  /** Merged totals per city, largest first. */
  bars: { label: string; value: number }[];
  /** Total sales per day, in date order. */
  daily: { label: string; value: number }[];
}

/**
 * Everything the story shows is computed here by the application's own engine
 * (suggestForColumn + the display layer), so the animation is a true picture of the product.
 */
export function buildStory(): StoryModel {
  const counts = new Map<string, number>();
  for (const [, city] of STORY_ROWS) counts.set(city, (counts.get(city) ?? 0) + 1);

  const suggestions = suggestForColumn('c1', counts);
  const decisions = suggestions.map((s) => ({ columnId: 'c1', from: s.variants.map((v) => v.value), to: s.suggestedDisplay }));
  const map = buildDisplayMap(decisions);

  const merged = STORY_ROWS.map(([, city]) => String(displayCell('c1', city, map)));
  const changedOrder = new Map<number, number>();
  merged.forEach((city, i) => {
    if (city !== STORY_ROWS[i]![1]) changedOrder.set(i, changedOrder.size);
  });

  const byCity = new Map<string, number>();
  const byDay = new Map<string, number>();
  STORY_ROWS.forEach(([date, , , value], i) => {
    byCity.set(merged[i]!, (byCity.get(merged[i]!) ?? 0) + value);
    byDay.set(date, (byDay.get(date) ?? 0) + value);
  });

  const biggest = suggestions[0];
  return {
    merged,
    changedOrder,
    changedCount: changedOrder.size,
    suggestion: biggest ? { variants: biggest.variants.map((v) => v.value), target: biggest.suggestedDisplay } : undefined,
    rawCities: counts.size,
    mergedCities: byCity.size,
    recordCount: STORY_ROWS.length,
    totalSales: STORY_ROWS.reduce((s, r) => s + r[3], 0),
    bars: [...byCity.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    daily: [...byDay.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
