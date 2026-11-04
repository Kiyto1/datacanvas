import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../core/format';
import type { ColumnProfile } from '../core/types';
import { specTitle } from '../dashboard/titles';
import type { ChartResult, ChartSpec } from '../dashboard/types';
import { useUi } from '../store/ui';
import { EChart } from './charts/EChart';
import { buildOption } from './charts/options';
import { useScheme } from './charts/theme';

interface Props {
  spec: ChartSpec;
  result: ChartResult | undefined;
  columns: ColumnProfile[];
  /** Labels selected by a cross-filter on this chart's dimension. */
  selected: readonly string[];
  onSelect?: (columnId: string, label: string) => void;
}

function dimensionOf(spec: ChartSpec): string | null {
  return spec.kind === 'bar' || spec.kind === 'distribution' ? spec.dimension : null;
}

export function ChartPanel({ spec, result, columns, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const scheme = useScheme();
  const [asTable, setAsTable] = useState(false);
  const title = specTitle(t, columns, spec);
  const dimension = dimensionOf(spec);
  const otherLabel = t('dash.other');

  const option = useMemo(() => {
    if (!result) return null;
    const names = (id: string) => columns.find((c) => c.id === id)?.displayName;
    return buildOption(result, {
      scheme,
      lang,
      selected,
      otherLabel,
      ...(spec.kind === 'scatter' ? { xName: names(spec.x) ?? '', yName: names(spec.y) ?? '' } : {}),
    });
  }, [result, scheme, lang, selected, otherLabel, spec, columns]);

  const rows: { label: string; value: number }[] =
    result && (result.kind === 'bar' || result.kind === 'distribution' || result.kind === 'line')
      ? result.labels.map((label, i) => ({ label, value: result.values[i] ?? 0 }))
      : [];
  const hasTable = rows.length > 0;
  const empty = result !== undefined && (rows.length === 0 && result.kind !== 'scatter' ? true : result.kind === 'scatter' && result.points.length === 0);

  return (
    <section className="border-t border-line pt-3" aria-label={title} data-testid={`panel-${spec.id}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {hasTable && (
          <button
            type="button"
            className="shrink-0 text-sm text-brand hover:underline"
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
            data-testid={`table-toggle-${spec.id}`}
          >
            {asTable ? t('dash.viewChart') : t('dash.viewTable')}
          </button>
        )}
      </div>

      {result?.kind === 'bar' && result.omitted > 0 && (
        <p className="mt-1 text-xs text-faint">{t('dash.omitted', { count: result.omitted })}</p>
      )}
      {result?.kind === 'line' && result.calendar === 'hijri' && <p className="mt-1 text-xs text-faint">{t('dash.hijriNote')}</p>}

      <div className="mt-2">
        {empty ? (
          <p className="py-10 text-center text-sm text-muted">{t('dash.noData')}</p>
        ) : asTable && hasTable ? (
          <table className="tabular w-full text-start text-sm">
            <tbody>
              {rows.map((row) => {
                const isSelected = selected.includes(row.label);
                return (
                  <tr key={row.label} className="border-b border-line/60">
                    <td className="py-1.5 pe-3">
                      {dimension && onSelect ? (
                        <button
                          type="button"
                          className={`text-start hover:underline ${isSelected ? 'font-semibold text-brand' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => onSelect(dimension, row.label)}
                          data-testid={`filter-${spec.id}-${row.label}`}
                        >
                          {row.label}
                        </button>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td className="py-1.5 text-end">{formatNumber(row.value, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : option ? (
          <EChart
            option={option}
            ariaLabel={title}
            {...(dimension && onSelect ? { onSelect: (label: string) => onSelect(dimension, label) } : {})}
          />
        ) : (
          <div className="dc-chart" aria-hidden />
        )}
      </div>
      {dimension && onSelect && !asTable && hasTable && <p className="mt-1 text-xs text-faint">{t('dash.clickToFilter')}</p>}
    </section>
  );
}
