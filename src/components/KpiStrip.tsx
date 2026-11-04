import { useTranslation } from 'react-i18next';
import { formatNumber } from '../core/format';
import type { ColumnProfile } from '../core/types';
import { specTitle } from '../dashboard/titles';
import type { ChartResult, KpiSpec } from '../dashboard/types';
import { useUi } from '../store/ui';

interface Props {
  kpis: KpiSpec[];
  results: Record<string, ChartResult>;
  columns: ColumnProfile[];
}

/** The headline figures as one ruled strip of large numerals (a ledger header, not a row of cards). */
export function KpiStrip({ kpis, results, columns }: Props) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  return (
    <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4" data-testid="kpi-strip">
      {kpis.map((spec, i) => {
        const result = results[spec.id];
        const value = result?.kind === 'kpi' ? result.value : null;
        return (
          <div key={spec.id} className={`px-4 py-5 ${i > 0 ? 'sm:border-s sm:border-line' : ''}`}>
            <dt className="text-sm text-muted">{specTitle(t, columns, spec)}</dt>
            <dd className="tabular mt-1 text-3xl font-semibold" data-testid={`kpi-${spec.id}`}>
              {value === null ? '—' : formatNumber(value, lang)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
