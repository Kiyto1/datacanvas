/**
 * Built-in sample file for "try it without a file". Deliberately messy in the ways real Arabic
 * sheets are: city names spelled several ways, thousands separators, a real six-month date range.
 * Deterministic, so the demo looks the same every time.
 */
const CITIES: { value: string; weight: number }[] = [
  { value: 'الرياض', weight: 5 },
  { value: 'Riyadh', weight: 2 },
  { value: 'الرّياض', weight: 1 },
  { value: 'جدة', weight: 4 },
  { value: 'Jeddah', weight: 2 },
  { value: 'الدمام', weight: 3 },
  { value: 'مكة المكرمة', weight: 2 },
  { value: 'Makkah', weight: 1 },
  { value: 'المدينة المنورة', weight: 2 },
];

const PRODUCTS = ['حاسب محمول', 'هاتف', 'شاشة', 'طابعة', 'سماعات'];

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

export function demoCsv(): string {
  const rand = rng(2026);
  const pool = CITIES.flatMap((c) => Array<string>(c.weight).fill(c.value));
  const lines = ['التاريخ,المدينة,المنتج,المبيعات,الكمية'];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 120; i++) {
    const d = new Date(start + Math.floor((i / 120) * 180) * 86_400_000 + Math.floor(rand() * 2) * 86_400_000);
    const date = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    const city = pool[Math.floor(rand() * pool.length)]!;
    const product = PRODUCTS[Math.floor(rand() * PRODUCTS.length)]!;
    const qty = 1 + Math.floor(rand() * 9);
    const sales = (900 + Math.floor(rand() * 4200)) * qty;
    lines.push(`${date},${city},${product},"${group(sales)}",${qty}`);
  }
  return lines.join('\n');
}

export function demoFile(): File {
  return new File([demoCsv()], 'مبيعات-تجريبية.csv', { type: 'text/csv' });
}
