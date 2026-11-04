import { describe, expect, it } from 'vitest';
import { applyDocumentLang, dirFor } from './index';

describe('i18n direction', () => {
  it('maps Arabic to rtl and English to ltr', () => {
    expect(dirFor('ar')).toBe('rtl');
    expect(dirFor('en')).toBe('ltr');
  });

  it('applies lang and dir to the document', () => {
    applyDocumentLang('en');
    expect(document.documentElement.dir).toBe('ltr');
    applyDocumentLang('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
