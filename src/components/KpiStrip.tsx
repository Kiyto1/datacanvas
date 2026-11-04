import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, formatPercent } from '../core/format';
import type { ColumnProfile } from '../core/types';
import { specTitle } from '../dashboard/titles';
import type { ChartResult, KpiSpec } from '../dashboard/types';
import { useUi } from '../store/ui';

interface Props {
  kpis: KpiSpec[];
  results: Record<string, ChartResult>;
  /** Same KPIs with no filters, shown as context while a filter is on. */
  baseline: Record<string, ChartResult>;
  columns: ColumnProfile[];
}

function reduced(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Eases a number toward its target so a filter change reads as the figure moving, not blinking. */
function useTween(target: number | null): number | null {
  const [shown, setShown] = useState<number | null>(target);
  const from = useRef<number | null>(target);
  useEffect(() => {
    if (target === null || from.current === null || reduced()) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 450);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = start + (target - start) * eased;
      from.current = value;
      setShown(p === 1 ? target : value);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

function Kpi({ spec, result, baseline, columns, first }: { spec: KpiSpec; result: ChartResult | undefined; baseline: ChartResult | undefined; columns: ColumnProfile[]; first: boolean }) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const value = result?.kind === 'kpi' ? result.value : null;
  const total = baseline?.kind === 'kpi' ? baseline.value : null;
  const shown = useTween(value);
  const filtered = total !== null && value !== null && total !== value;
  return (
    // Phones: a row per KPI (label and share on the start side, the value on the end). Wider: a column cell.
    <li
      className={`grid min-w-0 grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 sm:block sm:px-5 sm:py-5 ${first ? '' : 'border-t border-line sm:border-s sm:border-t-0'}`}
    >
      <p className="col-start-1 text-sm text-muted">{specTitle(t, columns, spec)}</p>
      <p
        className="tabular col-start-2 row-span-2 row-start-1 text-2xl font-semibold leading-none tracking-tight sm:mt-1.5 sm:text-[2rem]"
        data-testid={`kpi-${spec.id}`}
      >
        {shown === null ? '—' : formatNumber(Math.round(shown * 100) / 100, lang)}
      </p>
      <p className="col-start-1 min-h-4 text-xs text-faint sm:mt-2 sm:min-h-5" data-testid={`kpi-share-${spec.id}`}>
        {filtered ? t('dash.ofTotal', { total: formatNumber(total, lang), share: total !== 0 ? formatPercent(value / total, lang) : '' }) : ''}
      </p>
    </li>
  );
}

/** Headline figures in one ruled container. While a filter is on, each shows its share of the whole. */
export function KpiStrip({ kpis, results, baseline, columns }: Props) {
  return (
    // One column per KPI on wider screens (3 KPIs fill the strip; they do not leave an empty 4th cell).
    <ul
      className="rise grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:grid-cols-[repeat(var(--kpi-cols),minmax(0,1fr))]"
      style={{ ['--kpi-cols' as string]: kpis.length }}
      data-testid="kpi-strip"
    >
      {kpis.map((spec, i) => (
        <Kpi key={spec.id} spec={spec} result={results[spec.id]} baseline={baseline[spec.id]} columns={columns} first={i === 0} />
      ))}
    </ul>
  );
}
