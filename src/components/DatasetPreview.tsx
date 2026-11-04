import { useTranslation } from 'react-i18next';
import type { DatasetSummary, RawCell } from '../core/types';

function formatCell(cell: RawCell): string {
  if (cell === null) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
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
    <section className="rounded-card border border-line bg-surface p-4" aria-label={t('preview.title')}>
      <h2 className="font-semibold" data-testid="dataset-title">
        {summary.name}
      </h2>
      <p className="mt-1 text-sm text-muted" data-testid="dataset-counts">
        {t('preview.counts', { rows: summary.rowCount, columns: summary.columnCount })}
      </p>
      {summary.columns.some((c) => c.dateInference && c.dateInference.status !== 'confirmed') && (
        <p role="note" className="mt-2 text-sm text-danger" data-testid="date-warning">
          {t('profile.dateNeedsConfirmation')}
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr>
              {summary.columns.map((col) => (
                <th key={col.id} className="border-b border-line px-2 py-1 text-start font-semibold" data-testid={`col-${col.id}`}>
                  <div>{col.displayName}</div>
                  <div className="text-xs font-normal text-muted">
                    {t(`profile.type.${col.type}`)} · {t(`profile.role.${col.role}`)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border-b border-line/60 px-2 py-1">
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
