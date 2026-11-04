import { z } from 'zod';
import { summarizeChanges } from '../normalize/layer';
import type { ColumnStore } from '../worker/columnStore';
import { toCsv } from './csv';
import { buildDictionary, toJsonRows } from './dictionary';
import { buildPowerQuery } from './powerQuery';
import { metabaseReadme, powerBiReadme } from './readme';
import { buildTidyTable } from './tidy';
import { toXlsx } from './xlsx';
import { createZip } from './zip';

export const exportRequestSchema = z.object({
  kind: z.enum(['csv', 'xlsx', 'json', 'powerbi', 'metabase', 'spec']),
  fileName: z.string().min(1).max(300),
  lang: z.enum(['ar', 'en']),
  /** DataCanvas-native dashboard description, produced on the main thread. Written as-is. */
  dashboardSpecJson: z.string().max(500_000),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;

export interface ExportResult {
  fileName: string;
  mime: string;
  bytes: Uint8Array;
}

/** Base file name from the uploaded name: no extension, no path or reserved characters. */
export function safeBaseName(name: string): string {
  const withoutExt = name.replace(/\.[^./\\]+$/, '');
  // eslint-disable-next-line no-control-regex
  const cleaned = withoutExt.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
  return cleaned === '' ? 'dataset' : cleaned;
}

const enc = (s: string) => new TextEncoder().encode(s);

export function runExport(store: ColumnStore, request: ExportRequest, now: Date = new Date()): ExportResult {
  const base = safeBaseName(request.fileName);
  const specBytes = enc(request.dashboardSpecJson);

  if (request.kind === 'spec') {
    return { fileName: `${base}.datacanvas.json`, mime: 'application/json', bytes: specBytes };
  }

  const table = buildTidyTable(store);
  const changes = summarizeChanges(store.table.rows, store.columns.map((c) => c.id), store.displayMap);
  const dictionary = buildDictionary(table, { name: request.fileName, exportedAt: now.toISOString() }, changes);

  switch (request.kind) {
    case 'csv':
      return { fileName: `${base}-cleaned.csv`, mime: 'text/csv;charset=utf-8', bytes: toCsv(table) };
    case 'xlsx':
      return {
        fileName: `${base}-cleaned.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        bytes: toXlsx(table, { sheet: request.lang === 'ar' ? 'البيانات' : 'Data', rtl: request.lang === 'ar' }),
      };
    case 'json':
      return {
        fileName: `${base}-cleaned.json`,
        mime: 'application/json',
        bytes: enc(JSON.stringify({ dictionary, rows: toJsonRows(table) }, null, 2)),
      };
    case 'powerbi': {
      const dir = 'datacanvas-powerbi/';
      return {
        fileName: `${base}-powerbi.zip`,
        mime: 'application/zip',
        bytes: createZip(
          [
            { name: `${dir}dataset.csv`, data: toCsv(table) },
            { name: `${dir}transformations.pq`, data: enc(buildPowerQuery(table)) },
            { name: `${dir}data-dictionary.json`, data: enc(JSON.stringify(dictionary, null, 2)) },
            { name: `${dir}dashboard-spec.json`, data: specBytes },
            { name: `${dir}README.md`, data: enc(powerBiReadme(table, request.fileName)) },
          ],
          now,
        ),
      };
    }
    case 'metabase': {
      const dir = 'datacanvas-metabase/';
      return {
        fileName: `${base}-metabase.zip`,
        mime: 'application/zip',
        bytes: createZip(
          [
            { name: `${dir}dataset.csv`, data: toCsv(table) },
            { name: `${dir}data-dictionary.json`, data: enc(JSON.stringify(dictionary, null, 2)) },
            { name: `${dir}dashboard-spec.json`, data: specBytes },
            { name: `${dir}README.md`, data: enc(metabaseReadme(table, request.fileName)) },
          ],
          now,
        ),
      };
    }
  }
}
