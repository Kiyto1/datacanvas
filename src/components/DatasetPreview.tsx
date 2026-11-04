import { useTranslation } from 'react-i18next';
import { dateParts, formatDateParts } from '../core/dateParts';
import type { DatasetSummary, RawCell } from '../core/types';

function formatCell(cell: RawCell): string {
  if (cell === null) return '';
  if (cell instanceof Date) return formatDateParts(dateParts(cell));
  return String(cell);
}

interface Props {
  summary: DatasetSummary;
  /** Rows to show (original or with approved merges applied). */
  rows: RawCell[][];
}

export function DatasetPreview({ summary, rows }: Props) {
  const { t } = useTranslation();
  return (
    <section className="rise rounded-xl border border-line bg-surface shadow-card" aria-label={t('preview.title')} data-testid="data-view">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-semibold" data-testid="dataset-title">
          {summary.name}
        </h2>
        <p className="text-sm text-muted" data-testid="dataset-counts">
          {t('preview.counts', { rows: summary.rowCount, columns: summary.columnCount })}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-start text-sm">
          <thead>
            <tr className="bg-sunken/60">
              {summary.columns.map((col) => (
                <th key={col.id} className="border-b border-line px-3 py-2 text-start align-bottom font-medium" data-testid={`col-${col.id}`}>
                  <div>{col.displayName}</div>
                  <div className="mt-1 flex gap-1.5 text-xs font-normal">
                    <span className="rounded bg-brand-wash px-1.5 py-0.5 text-brand-strong">{t(`profile.type.${col.type}`)}</span>
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-muted">{t(`profile.role.${col.role}`)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-line/60 last:border-0 hover:bg-sunken/40">
                {row.map((cell, c) => (
                  <td key={c} className="tabular px-3 py-1.5">
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary.rowCount > rows.length && (
        <p className="border-t border-line px-4 py-2.5 text-xs text-faint">{t('preview.truncated', { shown: rows.length, total: summary.rowCount })}</p>
      )}
    </section>
  );
}
