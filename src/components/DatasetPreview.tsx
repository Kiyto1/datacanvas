import { useTranslation } from 'react-i18next';
import type { DatasetSummary, RawCell } from '../core/types';

function formatCell(cell: RawCell): string {
  if (cell === null) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell);
}

export function DatasetPreview({ summary }: { summary: DatasetSummary }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label={t('preview.title')}>
      <h2 className="font-semibold" data-testid="dataset-title">
        {summary.name}
      </h2>
      <p className="mt-1 text-sm text-muted" data-testid="dataset-counts">
        {t('preview.counts', { rows: summary.rowCount, columns: summary.columnCount })}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr>
              {summary.headers.map((h) => (
                <th key={h} className="border-b border-line px-2 py-1 text-start font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.preview.map((row, r) => (
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
