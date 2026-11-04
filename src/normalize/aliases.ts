import { comparisonKey } from '../core/arabic';

interface AliasEntry {
  canonical: string; // Arabic display value
  aliases: readonly string[]; // other spellings, Arabic and Latin
}

// Conservative on purpose: only unambiguous names. Generic words like "المدينة" (the city) are excluded.
const ENTRIES: readonly AliasEntry[] = [
  { canonical: 'الرياض', aliases: ['Riyadh', 'Riyad', 'Ar Riyadh', 'Al Riyadh'] },
  { canonical: 'جدة', aliases: ['Jeddah', 'Jiddah', 'Jidda', 'Jedda', 'Jeddha'] },
  { canonical: 'مكة المكرمة', aliases: ['مكة', 'Makkah', 'Mecca', 'Makka', 'Makkah Al Mukarramah'] },
  { canonical: 'المدينة المنورة', aliases: ['Madinah', 'Medina', 'Madina', 'Al Madinah', 'Al-Madinah', 'Madinah Al Munawwarah'] },
  { canonical: 'الدمام', aliases: ['Dammam', 'Ad Dammam', 'Al Dammam'] },
  { canonical: 'الخبر', aliases: ['Khobar', 'Al Khobar', 'Alkhobar', 'Al-Khobar', 'Khubar'] },
  { canonical: 'الظهران', aliases: ['Dhahran', 'Zahran'] },
  { canonical: 'الطائف', aliases: ['Taif', 'At Taif', 'Al Taif', 'Ta’if'] },
  { canonical: 'تبوك', aliases: ['Tabuk', 'Tabouk'] },
  { canonical: 'أبها', aliases: ['Abha'] },
  { canonical: 'بريدة', aliases: ['Buraidah', 'Buraydah', 'Buraida'] },
  { canonical: 'حائل', aliases: ['Hail', 'Hayil', "Ha'il"] },
  { canonical: 'جازان', aliases: ['Jazan', 'Jizan', 'Gizan'] },
  { canonical: 'نجران', aliases: ['Najran'] },
  { canonical: 'ينبع', aliases: ['Yanbu', "Yanbu'", 'Yanbu Al Bahr'] },
  { canonical: 'القطيف', aliases: ['Qatif', 'Al Qatif'] },
  { canonical: 'الجبيل', aliases: ['Jubail', 'Al Jubail', 'Jubail Industrial City'] },
  { canonical: 'الأحساء', aliases: ['Al Ahsa', 'Al-Ahsa', 'Alahsa', 'Ahsa', 'Al Hasa', 'Al-Hasa'] },
  { canonical: 'خميس مشيط', aliases: ['Khamis Mushait', 'Khamis Mushayt', 'Khamis Mushait City'] },
  { canonical: 'الباحة', aliases: ['Al Baha', 'Al-Baha', 'Albaha', 'Baha'] },
  { canonical: 'سكاكا', aliases: ['Sakaka'] },
  { canonical: 'عرعر', aliases: ['Arar'] },
  { canonical: 'السعودية', aliases: ['المملكة العربية السعودية', 'Saudi Arabia', 'KSA', 'Saudi', 'KSA.'] },
  { canonical: 'مصر', aliases: ['Egypt', 'جمهورية مصر العربية'] },
  { canonical: 'الإمارات', aliases: ['الامارات العربية المتحدة', 'UAE', 'United Arab Emirates', 'Emirates'] },
  { canonical: 'الكويت', aliases: ['Kuwait'] },
  { canonical: 'قطر', aliases: ['Qatar'] },
  { canonical: 'البحرين', aliases: ['Bahrain'] },
  { canonical: 'عُمان', aliases: ['Oman', 'سلطنة عمان'] },
  { canonical: 'الأردن', aliases: ['Jordan'] },
];

const INDEX: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  ENTRIES.forEach((entry, i) => {
    for (const name of [entry.canonical, ...entry.aliases]) map.set(comparisonKey(name), i);
  });
  return map;
})();

/** Returns the alias-table entry index for a value, or null. Matching uses comparisonKey. */
export function aliasEntryFor(value: string): number | null {
  return INDEX.get(comparisonKey(value)) ?? null;
}

export function canonicalFor(entryIndex: number): string {
  return ENTRIES[entryIndex]!.canonical;
}
