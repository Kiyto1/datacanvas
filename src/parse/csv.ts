const QUOTE = 34; // "
const LF = 10;
const CR = 13;

/**
 * RFC 4180 CSV parser over a string: quoted fields, "" escapes, embedded delimiters and newlines,
 * CRLF / LF / CR line endings. Every field stays text; nothing is typed or guessed here.
 * Lenient on malformed input (unterminated quote takes the rest; junk after a closing quote is kept).
 */
export function parseCsv(text: string, delimiter: string, maxRecords = Number.POSITIVE_INFINITY): string[][] {
  const rows: string[][] = [];
  const n = text.length;
  const d = delimiter.charCodeAt(0);
  let row: string[] = [];
  let i = 0;

  while (i < n) {
    let field: string;
    if (text.charCodeAt(i) === QUOTE) {
      i++;
      let out = '';
      for (;;) {
        const q = text.indexOf('"', i);
        if (q === -1) {
          out += text.slice(i);
          i = n;
          break;
        }
        out += text.slice(i, q);
        if (text.charCodeAt(q + 1) === QUOTE) {
          out += '"';
          i = q + 2;
        } else {
          i = q + 1;
          break;
        }
      }
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === d || c === LF || c === CR) break;
        j++;
      }
      field = j > i ? out + text.slice(i, j) : out;
      i = j;
    } else {
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === d || c === LF || c === CR) break;
        j++;
      }
      field = text.slice(i, j);
      i = j;
    }
    row.push(field);

    if (i >= n) {
      rows.push(row);
      break;
    }
    const c = text.charCodeAt(i);
    if (c === d) {
      i++;
      if (i >= n) {
        row.push(''); // trailing delimiter at end of file means one more empty field
        rows.push(row);
        break;
      }
      continue;
    }
    i += c === CR && text.charCodeAt(i + 1) === LF ? 2 : 1;
    rows.push(row);
    row = [];
    if (rows.length >= maxRecords) return rows;
  }
  return rows;
}

const CANDIDATES = [',', ';', '\t', '|'] as const;

/**
 * Picks the field separator by trying each candidate on the first few records and preferring the one
 * that gives the same number of columns (> 1) on every record. Arabic/European Excel exports often
 * use ';'. Falls back to a comma.
 */
export function detectDelimiter(text: string): string {
  const head = text.length > 200_000 ? text.slice(0, 200_000) : text;
  let best: string = ',';
  let bestScore = 0;
  for (const candidate of CANDIDATES) {
    const records = parseCsv(head, candidate, 6).filter((r) => !(r.length === 1 && r[0] === ''));
    if (records.length === 0) continue;
    const widths = records.map((r) => r.length);
    const min = Math.min(...widths);
    if (min < 2) continue;
    const consistent = widths.every((w) => w === widths[0]);
    const score = (consistent ? 1000 : 0) + min;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}
