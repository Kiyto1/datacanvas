import { toWesternDigits } from '../core/arabic';

const PLAIN = /^[-+]?\d+(\.\d+)?$/;
const GROUPED_COMMA = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/;
const GROUPED_SPACE = /^[-+]?\d{1,3}( \d{3})+(\.\d+)?$/;
const EUROPEAN = /^[-+]?\d{1,3}(\.\d{3})+,\d+$/;

/**
 * Parses a number from text, understanding Arabic-Indic digits and common grouping.
 * Returns null (not NaN) for anything that is not unambiguously a plain number.
 * Leading-zero integers ("007") and very long digit strings are treated as text/IDs.
 * Convention: "1.234" is read as 1.234 (decimal); "1.234,5" is read as European grouping.
 */
export function parseNumber(input: string | number): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  const text = toWesternDigits(input).trim();
  if (text === '') return null;

  let normalized: string;
  if (PLAIN.test(text)) {
    const digits = text.replace(/^[-+]/, '').split('.')[0]!;
    if (digits.length > 1 && digits.startsWith('0')) return null; // 007 is an identifier, not 7
    if (digits.length > 15) return null; // beyond safe precision: keep as text
    normalized = text;
  } else if (GROUPED_COMMA.test(text)) {
    normalized = text.replace(/,/g, '');
  } else if (GROUPED_SPACE.test(text)) {
    normalized = text.replace(/ /g, '');
  } else if (EUROPEAN.test(text)) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
