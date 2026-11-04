/**
 * exact:          same text after cleanup (spacing, diacritics, alef/yaa forms, Latin case)
 * known-alias:    different spellings that the built-in alias table says are one place/name
 * possible-match: similar only if ة/ه are treated alike; may change meaning, so never pre-selected
 */
export type SuggestionKind = 'exact' | 'known-alias' | 'possible-match';

export interface ValueVariant {
  value: string; // exactly as in the file
  count: number;
}

export interface NormalizationSuggestion {
  id: string;
  columnId: string;
  kind: SuggestionKind;
  variants: ValueVariant[];
  suggestedDisplay: string;
  totalCount: number;
}

/** A user-confirmed merge. Applied as a reversible layer; original rows are never edited. */
export interface NormalizationDecision {
  columnId: string;
  from: string[];
  to: string;
}

export interface ChangeLogEntry {
  columnId: string;
  from: string;
  to: string;
  count: number;
}
