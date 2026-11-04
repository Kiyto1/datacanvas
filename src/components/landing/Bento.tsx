import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../core/format';
import { parseDateWith, type DateOrder } from '../../profile/dates';
import { inferColumns } from '../../profile/inferColumns';
import { parseNumber } from '../../profile/numbers';
import { useUi } from '../../store/ui';
import { Reveal } from './motion';

function Cell({ title, text, children, className = '', delay = 0 }: { title: string; text: string; children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={className}>
      <article className="grid gap-8 py-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <h3 className="display text-2xl leading-tight">{title}</h3>
          <p className="mt-3 max-w-md leading-relaxed text-muted">{text}</p>
        </div>
        <div className="lg:col-span-8">{children}</div>
      </article>
    </Reveal>
  );
}

function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'brand' | 'saffron' }) {
  const tones = { plain: 'bg-sunken text-ink', brand: 'bg-brand-wash text-brand-strong', saffron: 'bg-saffron-wash text-saffron-ink' };
  return <span className={`tabular inline-flex items-center rounded-md px-2.5 py-1 text-sm ${tones[tone]}`}>{children}</span>;
}

/** Real output of the application's own profiler, shown as a small sheet. */
function ColumnsCell() {
  const { t } = useTranslation();
  const columns = useMemo(() => {
    const headers = ['التاريخ', 'المدينة', 'المنتج', 'المبيعات'];
    const rows = [
      ['2026/01/01', 'الرياض', 'حاسب محمول', '5,000'],
      ['2026/01/02', 'جدة', 'هاتف', '3,500'],
      ['2026/01/03', 'الدمام', 'شاشة', '4,200'],
    ];
    return { profiles: inferColumns(headers, headers, rows), rows };
  }, []);
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-4 bg-sunken/60">
        {columns.profiles.map((c, i) => (
          <div key={c.id} className="reveal in border-line px-3 py-2.5 [&:not(:first-child)]:border-s" style={{ ['--d' as string]: i }}>
            <p className="text-sm font-medium">{c.displayName}</p>
            <p className="mt-1.5 flex flex-wrap gap-1">
              <Chip tone="brand">{t(`profile.type.${c.type}`)}</Chip>
            </p>
            <p className="mt-1 text-xs text-muted">{t(`profile.role.${c.role}`)}</p>
          </div>
        ))}
      </div>
      {columns.rows.map((row, r) => (
        <div key={r} className="tabular grid grid-cols-4 border-t border-line text-sm text-muted">
          {row.map((cell, i) => (
            <span key={i} className="truncate px-3 py-2" dir={i === 0 || i === 3 ? 'ltr' : undefined} style={{ textAlign: 'start' }}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function NumbersCell() {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const items = ['٣٬٥٠٠', '3,500', '3 500', '007'].map((raw) => ({ raw, value: parseNumber(raw) }));
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(({ raw, value }) => (
        <li key={raw} className="rounded-xl border border-line p-3">
          <p className="tabular text-lg" dir="ltr" style={{ textAlign: 'start' }}>
            {raw}
          </p>
          <p className={`mt-1 text-sm ${value === null ? 'text-saffron-ink' : 'text-muted'}`}>{value === null ? t('how.numbers.text2') : formatNumber(value, lang)}</p>
        </li>
      ))}
    </ul>
  );
}

/** An actual choice: the reading you pick decides what the date means. */
function DatesCell() {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const [picked, setPicked] = useState<DateOrder | null>(null);
  const locale = lang === 'ar' ? 'ar-u-nu-latn-ca-gregory' : 'en-US'; // explicit Gregorian: ar-SA defaults to Hijri
  const readings = (['dmy', 'mdy'] as const).map((order) => {
    const p = parseDateWith('03/04/2026', { order, calendar: 'gregorian' })!;
    return { order, text: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(p.y, p.m - 1, p.d))) };
  });
  return (
    <div className="rounded-xl border border-saffron/50 bg-saffron-wash p-4">
      <p className="tabular text-xl text-saffron-ink" dir="ltr" style={{ textAlign: 'start' }}>
        03/04/2026
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {readings.map((r) => (
          <button
            key={r.order}
            type="button"
            aria-pressed={picked === r.order}
            onClick={() => setPicked(r.order)}
            className={`rounded-lg border bg-surface px-3 py-2 text-start transition-all duration-200 ${picked === r.order ? 'border-brand ring-2 ring-brand/30' : 'border-line-strong hover:border-brand'}`}
            data-testid={`bento-date-${r.order}`}
          >
            <span className="block text-sm font-medium">{t(`dates.reading.${r.order}-gregorian`)}</span>
            <span className="block text-sm text-muted">{r.text}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-5 text-sm text-saffron-ink" role="status" data-testid="bento-date-status">
        {picked ? t('how.dates.picked', { date: readings.find((r) => r.order === picked)?.text ?? '' }) : t('how.dates.ask')}
      </p>
    </div>
  );
}

function ExportCell() {
  const files = ['dataset.csv', 'transformations.pq', 'data-dictionary.json', 'dashboard-spec.json', 'README.md'];
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-sm text-faint" dir="ltr" style={{ textAlign: 'start' }}>
        datacanvas-powerbi/
      </p>
      <ul className="mt-3 flex flex-col gap-1.5" dir="ltr">
        {files.map((f, i) => (
          <li key={f} className="reveal in flex items-center gap-2 rounded-md bg-sunken px-3 py-1.5 text-sm" style={{ ['--d' as string]: i }}>
            <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Bento() {
  const { t } = useTranslation();
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24 sm:px-8" aria-labelledby="how-title">
      <Reveal>
        <h2 id="how-title" className="display max-w-3xl text-4xl leading-[1.2] sm:text-5xl">
          {t('how.lead')} <span className="tone-rest">{t('how.rest')}</span>
        </h2>
      </Reveal>
      <div className="mt-10 divide-y divide-line border-y border-line">
        <Cell title={t('how.columns.title')} text={t('how.columns.text')}>
          <ColumnsCell />
        </Cell>
        <Cell title={t('how.numbers.title')} text={t('how.numbers.text')}>
          <NumbersCell />
        </Cell>
        <Cell title={t('how.dates.title')} text={t('how.dates.text')}>
          <DatesCell />
        </Cell>
        <Cell title={t('how.export.title')} text={t('how.export.text')}>
          <ExportCell />
        </Cell>
      </div>
    </section>
  );
}
