import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../core/format';
import { buildDisplayMap, displayCell } from '../../normalize/layer';
import { suggestForColumn } from '../../normalize/suggest';
import { useUi } from '../../store/ui';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

type Phase = 'before' | 'review' | 'after';

// The rows a visitor would recognise. The grouping below is produced by the app's real engine.
const ROWS: [string, number][] = [
  ['الرياض', 5000],
  ['Riyadh', 3000],
  ['جدة', 4000],
  ['الرّياض', 2000],
  ['Jeddah', 2500],
  ['الدمام', 1800],
];

const DURATIONS: Record<Phase, number> = { before: 2400, review: 4200, after: 5200 };
const NEXT: Record<Phase, Phase> = { before: 'review', review: 'after', after: 'before' };
const STEP_OF: Record<Phase, number> = { before: 0, review: 1, after: 2 };
const PACKAGE = ['dataset.csv', 'transformations.pq', 'data-dictionary.json'];

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * One product window that plays the whole journey: a sheet with inconsistent spellings, the engine's
 * suggestion, the visitor's approval, then the dashboard and the export it feeds. It calls the same
 * `suggestForColumn` and display layer the application uses, so what it shows is what a real file gets.
 */
export function HeroDemo() {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const [phase, setPhase] = useState<Phase>(() => (reducedMotion() ? 'after' : 'before'));
  const [manual, setManual] = useState(reducedMotion());

  const model = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [city] of ROWS) counts.set(city, (counts.get(city) ?? 0) + 1);
    const suggestions = suggestForColumn('c0', counts);
    const decisions = suggestions.map((s) => ({ columnId: 'c0', from: s.variants.map((v) => v.value), to: s.suggestedDisplay }));
    const map = buildDisplayMap(decisions);
    const changed = new Set(decisions.flatMap((d) => d.from.filter((f) => f !== d.to)));
    const sum = (label: (city: string) => string) => {
      const totals = new Map<string, number>();
      for (const [city, value] of ROWS) totals.set(label(city), (totals.get(label(city)) ?? 0) + value);
      return [...totals.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      suggestion: suggestions[0],
      map,
      changed,
      before: sum((c) => c),
      after: sum((c) => String(displayCell('c0', c, map))),
      total: ROWS.reduce((a, [, v]) => a + v, 0),
    };
  }, []);

  useEffect(() => {
    if (manual) return;
    const id = window.setTimeout(() => setPhase((p) => NEXT[p]), DURATIONS[phase]);
    return () => window.clearTimeout(id);
  }, [phase, manual]);

  const show = (next: Phase) => {
    setManual(true);
    setPhase(next);
  };

  const merged = phase === 'after';
  const bars = merged ? model.after : model.before;
  const max = Math.max(...bars.map(([, v]) => v));
  const variantValues = model.suggestion?.variants.map((v) => `«${v.value}»`).join(t('demo.joiner')) ?? '';
  const message =
    phase === 'before'
      ? t('demo.before', { raw: model.before.length })
      : phase === 'review'
        ? t('demo.review', { values: variantValues, target: model.suggestion?.suggestedDisplay ?? '' })
        : t('demo.after', { groups: model.after.length, raw: model.before.length });
  const steps = [t('demo.steps.file'), t('demo.steps.review'), t('demo.steps.dash')];
  const kpis: [string, string][] = [
    [t('demo.kpiSales'), formatNumber(model.total, lang)],
    [t('demo.kpiRows'), formatNumber(ROWS.length, lang)],
    [t('demo.kpiCities'), formatNumber(bars.length, lang)],
  ];

  return (
    <figure className="window overflow-hidden rounded-2xl border border-line bg-surface" aria-label={t('demo.label')} data-testid="hero-demo" data-phase={phase}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-sm text-ink">
          <Icon name="file" size={15} className="text-faint" />
          {t('demo.file')}
        </span>
        <ol className="order-last flex w-full items-center justify-center gap-1.5 text-xs sm:order-none sm:w-auto" aria-label={t('demo.steps.label')}>
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-1.5" aria-current={STEP_OF[phase] === i ? 'step' : undefined}>
              {i > 0 && <span className="h-px w-5 bg-line-strong" aria-hidden="true" />}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-300 ${
                  STEP_OF[phase] === i ? 'bg-brand-wash font-medium text-brand-strong' : STEP_OF[phase] > i ? 'text-ink' : 'text-muted'
                }`}
              >
                {STEP_OF[phase] > i ? <Icon name="check" size={12} /> : <span className="tabular">{i + 1}</span>}
                {label}
              </span>
            </li>
          ))}
        </ol>
        <div role="group" aria-label={t('demo.toggle')} className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
          {(['before', 'after'] as const).map((p) => {
            const active = p === 'after' ? phase === 'after' : phase !== 'after';
            return (
              <button
                key={p}
                type="button"
                aria-pressed={active}
                onClick={() => show(p)}
                className={`rounded-md px-3 py-0.5 transition-colors ${active ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
                data-testid={`hero-demo-${p}`}
              >
                {t(`demo.${p === 'before' ? 'toggleBefore' : 'toggleAfter'}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-[5fr_7fr]">
        <div className="p-4 sm:border-e sm:border-line sm:p-5">
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="text-faint">
                <th className="pb-2 text-start font-normal">{t('demo.city')}</th>
                <th className="pb-2 text-end font-normal">{t('demo.sales')}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([city, value], i) => {
                const isVariant = model.changed.has(city);
                const shown = merged ? String(displayCell('c0', city, model.map)) : city;
                const flagged = phase === 'review' && isVariant;
                const justMerged = merged && isVariant;
                return (
                  <tr key={i} className="border-t border-line">
                    <td className={`py-2 ps-2 transition-colors duration-500 ${flagged ? 'bg-saffron-wash text-saffron-ink' : ''} ${justMerged ? 'bg-brand-wash text-brand-strong' : ''}`}>{shown}</td>
                    <td className="py-2 pe-2 text-end text-muted">{formatNumber(value, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-line bg-sunken/60 p-4 sm:border-t-0 sm:p-5">
          <ul className="grid grid-cols-3 gap-2">
            {kpis.map(([label, value]) => (
              <li key={label} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <p className="truncate text-xs text-muted">{label}</p>
                <p className="tabular mt-1 text-xl font-semibold leading-none">{value}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-lg border border-line bg-surface p-4">
            <p className="mb-3 text-sm font-medium">{t('demo.chart')}</p>
            <ul className="flex flex-col gap-2.5">
              {bars.map(([label, value]) => (
                <li key={`${merged}-${label}`} className="fade">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-ink">{label}</span>
                    <span className="tabular text-muted">{formatNumber(value, lang)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-sunken">
                    <div className="h-2 rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line px-4 py-3 sm:px-5">
        <p className="min-h-10 min-w-0 flex-1 basis-64 text-sm leading-relaxed text-muted" data-testid="hero-demo-message">
          {message}
        </p>
        {phase === 'review' && (
          <Button variant="primary" size="sm" icon="check" onClick={() => show('after')} data-testid="hero-demo-approve">
            {t('demo.approve')}
          </Button>
        )}
        {merged && (
          <ul className="flex flex-wrap gap-1.5 text-xs" dir="ltr" aria-label={t('demo.exportLabel')}>
            {PACKAGE.map((f) => (
              <li key={f} className="fade tabular inline-flex items-center gap-1.5 rounded-md border border-line bg-sunken px-2 py-1 text-muted">
                <Icon name="download" size={12} />
                {f}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}
