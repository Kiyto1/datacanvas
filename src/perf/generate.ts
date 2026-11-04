export interface GenerateOptions {
  rows: number;
  /** Total columns: 1 date + dimensions + measures. */
  columns: number;
  seed?: number;
}

const DIMENSIONS: { name: string; values: string[] }[] = [
  { name: 'المدينة', values: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'تبوك', 'أبها', 'بريدة', 'حائل', 'جازان', 'نجران', 'ينبع', 'القطيف', 'الجبيل', 'الأحساء', 'خميس مشيط', 'الباحة', 'سكاكا', 'عرعر', 'الظهران', 'الهفوف', 'المجمعة', 'الخرج', 'الدوادمي', 'عنيزة', 'رابغ', 'بيشة', 'الرس'] },
  { name: 'المنتج', values: Array.from({ length: 50 }, (_, i) => `منتج ${i + 1}`) },
  { name: 'المنطقة', values: ['الوسطى', 'الغربية', 'الشرقية', 'الشمالية', 'الجنوبية'] },
  { name: 'الحالة', values: ['مكتمل', 'قيد التنفيذ', 'ملغي', 'مرتجع'] },
  { name: 'القناة', values: ['متجر', 'موقع', 'تطبيق', 'هاتف', 'موزع'] },
  { name: 'الفئة', values: Array.from({ length: 12 }, (_, i) => `فئة ${i + 1}`) },
  { name: 'الفرع', values: Array.from({ length: 20 }, (_, i) => `فرع ${i + 1}`) },
  { name: 'البائع', values: Array.from({ length: 200 }, (_, i) => `بائع ${i + 1}`) },
  { name: 'النوع', values: ['أ', 'ب', 'ج', 'د'] },
];

const MEASURES = ['المبيعات', 'الكمية', 'السعر', 'الخصم', 'التكلفة', 'الربح'];

/** mulberry32: small deterministic PRNG so every run benchmarks identical data. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function group(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Arabic business-style CSV: a date column, category columns, and numeric measures with grouping separators. */
export function generateCsv({ rows, columns, seed = 42 }: GenerateOptions): string {
  const rand = rng(seed);
  const dimCount = Math.min(DIMENSIONS.length, Math.max(2, Math.round((columns - 1) * 0.45)));
  const dims = DIMENSIONS.slice(0, dimCount);
  const measureCount = columns - 1 - dims.length;
  const measureNames = Array.from({ length: measureCount }, (_, i) => MEASURES[i] ?? `قياس ${i + 1}`);

  const header = ['التاريخ', ...dims.map((d) => d.name), ...measureNames].join(',');
  const lines: string[] = [header];
  const start = Date.UTC(2024, 0, 1);
  for (let r = 0; r < rows; r++) {
    const d = new Date(start + Math.floor(rand() * 1095) * 86_400_000);
    const date = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    const cells: string[] = [date];
    for (const dim of dims) cells.push(dim.values[Math.floor(rand() * dim.values.length)]!);
    for (let m = 0; m < measureCount; m++) {
      const value = Math.floor(rand() * 90_000) + 100;
      cells.push(value >= 1000 && m % 2 === 0 ? `"${group(value)}"` : String(value));
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}
