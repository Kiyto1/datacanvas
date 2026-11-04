import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnProfile } from '../core/types';
import { allowedAggregations, dimensionChoices, measureChoices, TOP_N_CHOICES, type ChartOverride } from '../dashboard/overrides';
import type { ChartSpec } from '../dashboard/types';
import { Button } from './ui/Button';

interface Props {
  spec: ChartSpec;
  columns: ColumnProfile[];
  changed: boolean;
  onChange: (patch: ChartOverride) => void;
  onReset: () => void;
  onHide: () => void;
}

function Field({ label, children, id }: { label: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-faint">
        {label}
      </label>
      {children}
    </div>
  );
}

const SELECT = 'h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink hover:border-ink/40';

/** Small contextual panel for one chart. Only offers choices that are valid for the data. */
export function ChartEditor({ spec, columns, changed, onChange, onReset, onHide }: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const dims = dimensionChoices(columns);
  const measures = measureChoices(columns);

  const measureValue = spec.kind === 'bar' || spec.kind === 'line' ? spec.measure : null;
  const aggs = spec.kind === 'bar' || spec.kind === 'line' ? allowedAggregations(columns, measureValue) : [];

  return (
    <div className="flex flex-col gap-3" data-testid={`editor-${spec.id}`}>
      {(spec.kind === 'bar' || spec.kind === 'distribution') && (
        <Field label={t('ws.groupBy')} id={`${uid}-dim`}>
          <select
            id={`${uid}-dim`}
            className={SELECT}
            value={spec.dimension}
            onChange={(e) => onChange({ dimension: e.target.value })}
            data-testid={`editor-dimension-${spec.id}`}
          >
            {dims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </Field>
      )}

      {(spec.kind === 'bar' || spec.kind === 'line') && (
        <>
          <Field label={t('ws.measure')} id={`${uid}-measure`}>
            <select
              id={`${uid}-measure`}
              className={SELECT}
              value={measureValue ?? ''}
              onChange={(e) => onChange({ measure: e.target.value === '' ? null : e.target.value })}
              data-testid={`editor-measure-${spec.id}`}
            >
              {spec.kind === 'bar' && <option value="">{t('dash.agg.records')}</option>}
              {measures.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </Field>
          {measureValue !== null && (
            <Field label={t('ws.agg')} id={`${uid}-agg`}>
              <select
                id={`${uid}-agg`}
                className={SELECT}
                value={spec.agg}
                onChange={(e) => onChange({ agg: e.target.value as ChartOverride['agg'] })}
                data-testid={`editor-agg-${spec.id}`}
              >
                {aggs.map((a) => (
                  <option key={a} value={a}>
                    {t(`dash.agg.${a}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}

      {spec.kind === 'bar' && (
        <Field label={t('ws.top')} id={`${uid}-top`}>
          <select
            id={`${uid}-top`}
            className={SELECT}
            value={spec.topN}
            onChange={(e) => onChange({ topN: Number(e.target.value) })}
            data-testid={`editor-top-${spec.id}`}
          >
            {TOP_N_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-line pt-3">
        <Button variant="ghost" size="sm" icon="reset" disabled={!changed} onClick={onReset} data-testid={`editor-reset-${spec.id}`}>
          {t('ws.reset')}
        </Button>
        <Button variant="ghost" size="sm" icon="close" onClick={onHide} data-testid={`editor-hide-${spec.id}`}>
          {t('ws.hide')}
        </Button>
      </div>
    </div>
  );
}
