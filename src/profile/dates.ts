import { toWesternDigits } from '../core/arabic';

export type DateOrder = 'ymd' | 'dmy' | 'mdy';
export type Calendar = 'gregorian' | 'hijri';

export interface DateCandidate {
  order: DateOrder;
  calendar: Calendar;
}

export interface DateInference {
  /** confirmed: data proves one reading. ambiguous/needs-confirmation: the user must choose. */
  status: 'confirmed' | 'ambiguous' | 'needs-confirmation';
  candidates: DateCandidate[];
  chosen: DateCandidate | null;
}

export interface DateParts {
  y: number;
  m: number;
  d: number;
}

const YMD = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[T ].*)?$/;
const DM_Y = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[T ].*)?$/;
const MATCH_SHARE = 0.95;

function validParts(y: number, m: number, d: number, calendar: Calendar): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  if (calendar === 'hijri') return d <= 30;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

function isHijriYear(y: number): boolean {
  return y >= 1300 && y <= 1499;
}

/** Parses one text value under a given reading. Returns null if it doesn't fit. No calendar conversion. */
export function parseDateWith(input: string, candidate: DateCandidate): DateParts | null {
  const text = toWesternDigits(input).trim();
  if (candidate.order === 'ymd') {
    const m = YMD.exec(text);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validParts(y, mo, d, candidate.calendar) ? { y, m: mo, d } : null;
  }
  const m = DM_Y.exec(text);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = Number(m[3]);
  const [day, month] = candidate.order === 'dmy' ? [a, b] : [b, a];
  return validParts(y, month, day, candidate.calendar) ? { y, m: month, d: day } : null;
}

/**
 * Infers how a column of date strings should be read, using only evidence in the data:
 * - yyyy/mm/dd is unambiguous (Hijri years 13xx-14xx require user confirmation);
 * - dd/mm/yyyy vs mm/dd/yyyy is decided only if some value has a part > 12, else it is ambiguous.
 * Returns null when the column doesn't look like dates.
 */
export function inferDateColumn(values: readonly string[]): DateInference | null {
  const texts = values.map((v) => toWesternDigits(v).trim()).filter((v) => v !== '');
  if (texts.length === 0) return null;
  const need = Math.ceil(texts.length * MATCH_SHARE);

  const ymdYears: number[] = [];
  for (const t of texts) {
    const m = YMD.exec(t);
    if (m && validParts(Number(m[1]), Number(m[2]), Number(m[3]), 'gregorian')) ymdYears.push(Number(m[1]));
    else if (m && validParts(Number(m[1]), Number(m[2]), Number(m[3]), 'hijri') && isHijriYear(Number(m[1]))) ymdYears.push(Number(m[1]));
  }
  if (ymdYears.length >= need) {
    const hijriShare = ymdYears.filter(isHijriYear).length / ymdYears.length;
    if (hijriShare >= MATCH_SHARE) {
      const c: DateCandidate = { order: 'ymd', calendar: 'hijri' };
      return { status: 'needs-confirmation', candidates: [c, { order: 'ymd', calendar: 'gregorian' }], chosen: null };
    }
    const c: DateCandidate = { order: 'ymd', calendar: 'gregorian' };
    return { status: 'confirmed', candidates: [c], chosen: c };
  }

  const dmy: DateCandidate = { order: 'dmy', calendar: 'gregorian' };
  const mdy: DateCandidate = { order: 'mdy', calendar: 'gregorian' };
  const dmyOk = texts.filter((t) => parseDateWith(t, dmy) !== null).length >= need;
  const mdyOk = texts.filter((t) => parseDateWith(t, mdy) !== null).length >= need;
  if (dmyOk && mdyOk) return { status: 'ambiguous', candidates: [dmy, mdy], chosen: null };
  if (dmyOk) return { status: 'confirmed', candidates: [dmy], chosen: dmy };
  if (mdyOk) return { status: 'confirmed', candidates: [mdy], chosen: mdy };
  return null;
}
