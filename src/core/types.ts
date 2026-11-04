import type { DateInference } from '../profile/dates';

export type ColumnType = 'string' | 'number' | 'date' | 'boolean';
export type ColumnRole = 'dimension' | 'measure' | 'identifier' | 'unknown';

export interface DataColumn {
  id: string;
  originalName: string;
  displayName: string;
  type: ColumnType;
  role: ColumnRole;
  nullable: boolean;
}

export type Aggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinctCount';

/** Why a role was chosen, so the review screen can explain and the user can override. */
export type RoleSource = 'header' | 'data';

export interface ColumnProfile extends DataColumn {
  nonNullCount: number;
  distinctCount: number;
  nullRate: number;
  allowedAggregations: Aggregation[];
  defaultAggregation: Aggregation;
  roleSource: RoleSource;
  /** Present for date columns; `status !== 'confirmed'` means the user must choose a reading. */
  dateInference?: DateInference;
  /** Looks like a unit price/rate: averaging is meaningful, summing is not. */
  unitPrice?: boolean;
}

/** Cell values straight from the file. `null` means missing; never '' or NaN. */
export type RawCell = string | number | boolean | Date | null;

/** What the parser produces: unprofiled, untouched values. */
export interface RawTable {
  headers: string[]; // sanitized, unique, non-empty
  originalHeaders: string[]; // exactly as in the file
  rows: RawCell[][];
  sheetName?: string;
  encoding: string;
}

/** Lightweight description sent to the UI. Full rows stay in the worker. */
export interface DatasetSummary {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  originalHeaders: string[];
  columns: ColumnProfile[];
  preview: RawCell[][];
  encoding: string;
  sheetName?: string;
}

export const LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxRows: 1_000_000,
  maxColumns: 500,
  previewRows: 20,
} as const;

export type ParseErrorCode = 'file-too-large' | 'unsupported-type' | 'empty' | 'too-many-rows' | 'too-many-columns' | 'parse-failed';

export class ParseError extends Error {
  readonly code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
  }
}
