import { describe, expect, it } from 'vitest';
import { sanitizeHeaders } from './headers';

describe('sanitizeHeaders', () => {
  it('keeps Arabic names and trims/collapses whitespace', () => {
    expect(sanitizeHeaders(['  التاريخ ', 'المبيعات   الكلية'])).toEqual(['التاريخ', 'المبيعات الكلية']);
  });

  it('names empty headers column_N by position', () => {
    expect(sanitizeHeaders(['a', '', null, undefined])).toEqual(['a', 'column_2', 'column_3', 'column_4']);
  });

  it('suffixes duplicates with _2, _3 and avoids collisions', () => {
    expect(sanitizeHeaders(['x', 'x', 'x', 'x_2'])).toEqual(['x', 'x_2', 'x_3', 'x_2_2']);
  });
});
