import { comparisonKey } from '../core/arabic';

export type TermHint = 'date' | 'measure' | 'unit-price' | 'identifier' | 'dimension' | 'status';

// Header words (Arabic and English). Matched on whole words after comparisonKey().
const TERMS: Record<TermHint, readonly string[]> = {
  date: ['التاريخ', 'تاريخ', 'date', 'day', 'month', 'الشهر', 'السنة', 'اليوم', 'time', 'الوقت'],
  measure: [
    'المبيعات', 'مبيعات', 'الايرادات', 'ايرادات', 'الربح', 'الارباح', 'المبلغ', 'مبلغ', 'الاجمالي', 'اجمالي',
    'التكلفة', 'تكلفة', 'المصروفات', 'مصروفات', 'الراتب', 'الرواتب', 'الكمية', 'كمية', 'العدد', 'القيمة', 'قيمة',
    'sales', 'revenue', 'profit', 'amount', 'total', 'cost', 'expenses', 'salary', 'quantity', 'qty', 'count', 'value',
  ],
  'unit-price': ['السعر', 'سعر', 'سعر الوحدة', 'price', 'unit price', 'rate', 'سعر البيع'],
  identifier: ['رقم', 'الرقم', 'معرف', 'المعرف', 'كود', 'الكود', 'رمز', 'id', 'code', 'sku', 'number', 'no', 'الرقم الوظيفي', 'رقم الهوية', 'رقم الفاتورة'],
  dimension: [
    'المدينة', 'مدينة', 'المنطقة', 'منطقة', 'المنتج', 'منتج', 'الفئة', 'فئة', 'التصنيف', 'الدولة', 'القسم', 'الفرع',
    'العميل', 'البائع', 'الموظف', 'النوع',
    'city', 'region', 'product', 'category', 'country', 'department', 'branch', 'customer', 'type', 'seller', 'employee',
  ],
  status: ['الحالة', 'حالة', 'status', 'state', 'stage', 'المرحلة'],
};

const INDEX: ReadonlyMap<string, TermHint> = (() => {
  const map = new Map<string, TermHint>();
  // Earlier hints win on conflicts; unit-price is placed before measure at lookup time.
  for (const hint of Object.keys(TERMS) as TermHint[]) {
    for (const term of TERMS[hint]) {
      const key = comparisonKey(term);
      if (!map.has(key)) map.set(key, hint);
    }
  }
  return map;
})();

const PRICE_PHRASES = [...TERMS['unit-price']].map(comparisonKey);

/** Looks up a column header against the business-term dictionary. */
export function hintForHeader(header: string): TermHint | null {
  const key = comparisonKey(header).replace(/[_\-./]+/g, ' ').trim();
  if (key === '') return null;

  // Whole-header or phrase match first (e.g. "سعر الوحدة", "الرقم الوظيفي").
  if (PRICE_PHRASES.includes(key)) return 'unit-price';
  const whole = INDEX.get(key);
  if (whole) return whole;

  // Then word-level matches. Price and identifier words beat generic measure words
  // so "unit price" and "customer id" are not treated as plain sums or categories.
  const words = key.split(' ');
  const found = new Set<TermHint>();
  for (const w of words) {
    const hint = INDEX.get(w);
    if (hint) found.add(hint);
  }
  for (const priority of ['unit-price', 'identifier', 'status', 'date', 'measure', 'dimension'] as const) {
    if (found.has(priority)) return priority;
  }
  return null;
}
