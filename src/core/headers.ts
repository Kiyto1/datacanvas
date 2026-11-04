/**
 * Makes headers safe and unique without losing the originals:
 * empty -> column_N (1-based position), duplicates -> name_2, name_3, ...
 */
export function sanitizeHeaders(original: readonly unknown[]): string[] {
  const seen = new Set<string>();
  return original.map((raw, index) => {
    const base = String(raw ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    let name = base === '' ? `column_${index + 1}` : base;
    if (seen.has(name)) {
      let n = 2;
      while (seen.has(`${name}_${n}`)) n++;
      name = `${name}_${n}`;
    }
    seen.add(name);
    return name;
  });
}
