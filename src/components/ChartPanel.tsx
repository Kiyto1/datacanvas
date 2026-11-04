import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../core/format';
import type { ColumnProfile } from '../core/types';
import type { ChartOverride } from '../dashboard/overrides';
import { specTitle } from '../dashboard/titles';
import type { ChartResult, ChartSpec } from '../dashboard/types';
import { useUi } from '../store/ui';
import { EChart } from './charts/EChart';
import { buildOption } from './charts/options';
import { useScheme } from './charts/theme';
import { ChartEditor } from './ChartEditor';
import { IconButton } from './ui/Button';
import { Popover } from './ui/Popover';

interface Props {
  spec: ChartSpec;
  result: ChartResult | undefined;
  columns: ColumnProfile[];
  /** Labels selected by a cross-filter on this chart's dimension. */
  selected: readonly string[];
  changed: boolean;
  onSelect?: (columnId: string, label: string) => void;
  onChange: (patch: ChartOverride) => void;
  onReset: () => void;
  onHide: () => void;
  /** Stagger index for the entrance animation. */
  index: number;
}

function dimensionOf(spec: ChartSpec): string | null {
  return spec.kind === 'bar' || spec.kind === 'distribution' ? spec.dimension : null;
}

export function ChartPanel({ spec, result, columns, selected, changed, onSelect, onChange, onReset, onHide, index }: Props) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const scheme = useScheme();
  const [asTable, setAsTable] = useState(false);
  const [editing, setEditing] = useState(false);
  const title = specTitle(t, columns, spec);
  const dimension = dimensionOf(spec);
  const otherLabel = t('dash.other');
  const editable = spec.kind === 'bar' || spec.kind === 'line' || spec.kind === 'distribution';

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
    <section
      className="rise rounded-xl border border-line bg-surface p-4 shadow-card"
      style={{ ['--i' as string]: Math.min(index, 6) }}
      aria-label={title}
      data-testid={`panel-${spec.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{title}</h3>
        <div className="flex shrink-0 items-center gap-0.5">
          {hasTable && (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-brand-strong transition-colors hover:bg-brand-wash"
              aria-pressed={asTable}
              onClick={() => setAsTable((v) => !v)}
              data-testid={`table-toggle-${spec.id}`}
            >
              {asTable ? t('dash.viewChart') : t('dash.viewTable')}
            </button>
          )}
          {editable && (
            <Popover
              open={editing}
              onClose={() => setEditing(false)}
              label={t('ws.edit')}
              width="w-72"
              trigger={
                <IconButton
                  icon="sliders"
                  label={t('ws.edit')}
                  onClick={() => setEditing((v) => !v)}
                  aria-expanded={editing}
                  className={changed ? 'text-brand-strong' : ''}
                  data-testid={`edit-${spec.id}`}
                />
              }
            >
              <ChartEditor spec={spec} columns={columns} changed={changed} onChange={onChange} onReset={onReset} onHide={() => { setEditing(false); onHide(); }} />
            </Popover>
          )}
        </div>
      </div>

      {result?.kind === 'bar' && result.omitted > 0 && <p className="mt-1 text-xs text-faint">{t('dash.omitted', { count: result.omitted })}</p>}
      {result?.kind === 'line' && result.calendar === 'hijri' && <p className="mt-1 text-xs text-faint">{t('dash.hijriNote')}</p>}

      <div className="mt-3">
        {empty ? (
          <p className="py-10 text-center text-sm text-muted">{t('dash.noData')}</p>
        ) : asTable && hasTable ? (
          <table className="tabular w-full text-start text-sm">
            <tbody>
              {rows.map((row) => {
                const isSelected = selected.includes(row.label);
                return (
                  <tr key={row.label} className="border-b border-line/70">
                    <td className="py-1.5 pe-3">
                      {dimension && onSelect ? (
                        <button
                          type="button"
                          className={`text-start hover:underline ${isSelected ? 'font-semibold text-brand-strong' : ''}`}
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
          <EChart option={option} ariaLabel={title} {...(dimension && onSelect ? { onSelect: (label: string) => onSelect(dimension, label) } : {})} />
        ) : (
          <div className="dc-chart" aria-hidden />
        )}
      </div>
      {dimension && onSelect && !asTable && hasTable && <p className="mt-1 text-xs text-faint">{t('dash.clickToFilter')}</p>}
    </section>
  );
}
