import type { ExportType, TidyTable } from './tidy';

/** Escapes a string for an M text literal: " -> "", # -> #(#), control characters -> #(lf) etc. */
export function mText(value: string): string {
  const escaped = value
    .replace(/#/g, '#(#)')
    .replace(/"/g, '""')
    .replace(/\r/g, '#(cr)')
    .replace(/\n/g, '#(lf)')
    .replace(/\t/g, '#(tab)');
  return `"${escaped}"`;
}

const M_TYPE: Record<ExportType, string> = {
  number: 'type number',
  date: 'type date',
  boolean: 'type logical',
  text: 'type text',
};

export const DATA_FOLDER_PLACEHOLDER = 'REPLACE_WITH_THE_FOLDER_YOU_EXTRACTED';

/**
 * Power Query (M) script that loads dataset.csv and assigns types.
 * - No machine-specific path: the user sets the DataFolder parameter on the first line.
 * - Csv.Document options are explicit: UTF-8 (65001), comma, RFC 4180 quoting, column count.
 * - Empty fields become null; types are applied with the en-US culture so '.' is the decimal separator
 *   and yyyy-mm-dd parses as a date regardless of the user's regional settings.
 */
export function buildPowerQuery(table: TidyTable): string {
  const names = table.columns.map((c) => mText(c.name));
  const typePairs = table.columns.map((c) => `{${mText(c.name)}, ${M_TYPE[c.type]}}`);
  return [
    '// DataCanvas: Power Query script for dataset.csv',
    '//',
    '// 1. Extract the whole package folder anywhere on your computer.',
    '// 2. Power BI Desktop: Home > Transform data > New source > Blank query > Advanced editor.',
    '// 3. Paste this script and set DataFolder (first step below) to the folder you extracted.',
    '// 4. Click Done, then Close & apply.',
    'let',
    `    DataFolder = ${mText(DATA_FOLDER_PLACEHOLDER)},`,
    `    CheckedFolder = if Text.StartsWith(DataFolder, "REPLACE_") then error "Set DataFolder to the folder where you extracted this package." else DataFolder,`,
    '    FilePath = Text.TrimEnd(CheckedFolder, {"\\", "/"}) & "\\dataset.csv",',
    `    Source = Csv.Document(File.Contents(FilePath), [Delimiter = ",", Columns = ${table.columns.length}, Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),`,
    '    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),',
    `    EmptyToNull = Table.ReplaceValue(Headers, "", null, Replacer.ReplaceValue, {${names.join(', ')}}),`,
    `    Typed = Table.TransformColumnTypes(EmptyToNull, {${typePairs.join(', ')}}, "en-US")`,
    'in',
    '    Typed',
    '',
  ].join('\r\n');
}
