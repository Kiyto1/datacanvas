const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_ZERO = 0x06f0;

/** Arabic-Indic and Persian digits -> 0-9; Arabic separators -> ASCII; exotic spaces -> ' '. */
export function toWesternDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) out += String(code - ARABIC_INDIC_ZERO);
    else if (code >= EASTERN_ARABIC_ZERO && code <= EASTERN_ARABIC_ZERO + 9) out += String(code - EASTERN_ARABIC_ZERO);
    else if (ch === '٫') out += '.'; // Arabic decimal separator
    else if (ch === '٬' || ch === '،') out += ','; // Arabic thousands separator / comma
    else if (ch === ' ' || ch === ' ' || ch === ' ') out += ' ';
    else out += ch;
  }
  return out;
}

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

/**
 * Key used ONLY for matching/lookup, never for display or stored values.
 * Strips diacritics and tatweel, folds alef/yaa variants, lowercases Latin, collapses spaces.
 * Deliberately does NOT fold taa marbuta (ة) with haa (ه); that stays a "possible match" concern.
 */
export function comparisonKey(input: string): string {
  return toWesternDigits(input)
    .normalize('NFKC')
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ى/g, 'ي') // ى -> ي
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
