import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../core/format';
import { useUi } from '../../store/ui';
import { Icon } from '../ui/Icon';
import { easeOut, lerp, prefersReducedMotion, span, useScrollProgress } from './motion';
import { buildStory, STORY_HEADERS, STORY_ROWS, type StoryModel } from './storyData';

/** Where each chapter begins on the 0..1 scroll range, and where the stepper parks for each. */
const CHAPTER_START = [0, 0.22, 0.5, 0.74] as const;
const STEP_P = [0.12, 0.4, 0.62, 0.97] as const;

function useWide(): boolean {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function Stage({ p, model }: { p: number; model: StoryModel }) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const rows = STORY_ROWS.length;

  const scan = span(p, 0.02, 0.2);
  const scanRow = p < 0.22 ? Math.min(rows - 1, Math.floor(scan * rows)) : -1;
  const flagT = span(p, 0.24, 0.46) * model.changedCount;
  const mergeT = span(p, 0.52, 0.68) * model.changedCount;
  const collapse = easeOut(span(p, 0.74, 0.9));
  const sheetOpacity = 1 - span(p, 0.78, 0.9);
  const dashOpacity = span(p, 0.78, 0.9);
  const grow = easeOut(span(p, 0.82, 0.97));
  const maxBar = Math.max(...model.bars.map((b) => b.value));

  // Annotation: the suggestion while reviewing, the result once merged.
  const noteOpacity = Math.min(span(p, 0.3, 0.38), 1 - span(p, 0.72, 0.78));
  const merged = mergeT >= model.changedCount - 0.01;
  const noteText = merged
    ? t('story.noteDone', { raw: model.rawCities, groups: model.mergedCities })
    : t('story.noteReview', { values: model.suggestion?.variants.map((v) => `«${v}»`).join(t('demo.joiner')) ?? '', target: model.suggestion?.target ?? '' });

  // Line chart geometry for the daily totals.
  const vals = model.daily.map((d) => d.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const points = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - ((v - lo) / (hi - lo || 1)) * 80 - 10}`);

  const kpiCities = Math.round(lerp(model.rawCities, model.mergedCities, easeOut(span(p, 0.8, 0.92))));
  const kpiSales = Math.round(model.totalSales * easeOut(span(p, 0.78, 0.9)));

  return (
    <div
      className="window relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line-strong bg-surface sm:aspect-[16/10]"
      role="img"
      aria-label={t('story.stageLabel')}
      data-testid="story-stage"
      data-progress={p}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm">
        <span className="inline-flex items-center gap-2 rounded-md bg-sunken px-2.5 py-1">
          <Icon name="file" size={15} className="text-faint" />
          {t('demo.file')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-ok-text">
          <Icon name="shield" size={14} />
          {t('demo.local')}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 top-[49px]">
        {/* The spreadsheet */}
        <div
          className="absolute inset-x-0 bottom-[3.75rem] top-0 grid px-4 pt-4"
          style={{
            gridTemplateRows: `repeat(${rows + 1}, minmax(0, 1fr))`,
            opacity: sheetOpacity,
            transform: `translateY(${-6 * collapse}%) scale(${lerp(1, 0.62, collapse)})`,
            transformOrigin: '50% 0%',
          }}
        >
          <div className="tabular grid grid-cols-[1.1fr_1.5fr_1.3fr_0.9fr] items-center border-b border-line text-xs text-faint">
            {STORY_HEADERS.map((h, i) => (
              <span key={h} className={i === 3 ? 'text-end' : ''}>
                {h}
              </span>
            ))}
          </div>
          {STORY_ROWS.map(([date, city, product, sales], i) => {
            const order = model.changedOrder.get(i);
            const isChanged = order !== undefined;
            const flagged = isChanged && flagT > order;
            const isMerged = isChanged && mergeT > order;
            const scanned = i === scanRow;
            return (
              <div
                key={i}
                className={`tabular grid grid-cols-[1.1fr_1.5fr_1.3fr_0.9fr] items-center border-b border-line/60 text-xs transition-colors duration-300 sm:text-sm ${scanned ? 'bg-brand-wash' : ''}`}
              >
                <span className="text-muted" dir="ltr" style={{ textAlign: 'start' }}>
                  {date}
                </span>
                <span
                  className={`me-2 truncate rounded px-1.5 py-0.5 transition-colors duration-300 ${isMerged ? 'bg-brand-wash text-brand-strong' : flagged ? 'bg-saffron-wash text-saffron-ink' : ''}`}
                >
                  {isMerged ? model.merged[i] : city}
                </span>
                <span className="truncate text-muted">{product}</span>
                <span className="text-end">{formatNumber(sales, lang)}</span>
              </div>
            );
          })}
        </div>

        {/* Annotation chip */}
        <div
          className="pointer-events-none absolute inset-x-4 bottom-3 flex justify-center"
          style={{ opacity: noteOpacity, transform: `translateY(${(1 - noteOpacity) * 10}px)` }}
        >
          <p
            className={`max-w-[34rem] rounded-xl border px-4 py-2.5 text-sm shadow-pop ${merged ? 'border-brand/60 bg-brand-wash text-brand-strong' : 'border-saffron/60 bg-saffron-wash text-saffron-ink'}`}
            data-testid="story-note"
          >
            {noteText}
          </p>
        </div>

        {/* The dashboard the sheet becomes */}
        <div
          className="absolute inset-0 flex flex-col gap-4 p-4"
          style={{ opacity: dashOpacity, transform: `translateY(${(1 - dashOpacity) * 18}px)`, pointerEvents: dashOpacity > 0.5 ? 'auto' : 'none' }}
          aria-hidden={dashOpacity < 0.5}
        >
          <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line rtl:divide-x-reverse">
            {[
              { label: t('story.kpiRecords'), value: formatNumber(model.recordCount, lang) },
              { label: t('story.kpiSales'), value: formatNumber(kpiSales, lang) },
              { label: t('story.kpiCities'), value: formatNumber(kpiCities, lang) },
            ].map((k) => (
              <div key={k.label} className="px-4 py-3">
                <p className="text-xs text-muted">{k.label}</p>
                <p className="tabular mt-1 text-2xl font-semibold leading-none" data-testid="story-kpi">
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex min-h-0 flex-col rounded-xl border border-line p-3">
              <p className="text-xs font-medium">{t('demo.chart')}</p>
              <ul className="mt-3 flex flex-1 flex-col justify-around">
                {model.bars.map((b, i) => (
                  <li key={b.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.7rem]">
                      <span className="truncate">{b.label}</span>
                      <span className="tabular text-muted">{formatNumber(b.value, lang)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-sunken">
                      <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(b.value / maxBar) * 100 * easeOut(span(grow, i * 0.08, 0.6 + i * 0.08))}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex min-h-0 flex-col rounded-xl border border-line p-3">
              <p className="text-xs font-medium">{t('story.trend')}</p>
              {/* Revealed with a clip, not a dash: dashes break under non-scaling strokes. */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="mt-3 w-full flex-1"
                style={{ clipPath: `inset(0 ${(1 - grow) * 100}% 0 0)` }}
                aria-hidden="true"
              >
                {[25, 50, 75].map((y) => (
                  <line key={y} x1="0" x2="100" y1={y} y2={y} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                <polyline
                  points={points.join(' ')}
                  fill="none"
                  className="stroke-brand"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="tabular mt-1 flex justify-between text-[0.65rem] text-faint" dir="ltr">
                <span>{model.daily[0]?.label.slice(5)}</span>
                <span>{model.daily[model.daily.length - 1]?.label.slice(5)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Story() {
  const { t } = useTranslation();
  const model = useMemo(() => buildStory(), []);
  const wide = useWide();
  const reduced = prefersReducedMotion();
  const sticky = wide && !reduced;
  const outer = useRef<HTMLDivElement>(null);
  const scrollP = useScrollProgress(outer, sticky);
  const [step, setStep] = useState(0);
  const p = sticky ? scrollP : STEP_P[step]!;

  const active = CHAPTER_START.reduce<number>((acc, start, i) => (p >= start ? i : acc), 0);
  const chapters = [1, 2, 3, 4].map((n) => ({
    title: t(`story.ch${n}.title`),
    text: t(`story.ch${n}.text`, { raw: model.rawCities, groups: model.mergedCities }),
  }));

  const jump = (i: number) => {
    if (!sticky) return setStep(i);
    const el = outer.current;
    if (!el) return;
    const scrollable = el.offsetHeight - window.innerHeight;
    const target = el.offsetTop + scrollable * (STEP_P[i]! > 0.95 ? 0.99 : CHAPTER_START[i]! + 0.02);
    window.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <section id="story" className="" aria-labelledby="story-title" data-testid="story">
      <div className="mx-auto max-w-6xl px-5 pb-6 pt-24 sm:px-8">
        <h2 id="story-title" className="display max-w-3xl text-4xl leading-[1.2] sm:text-5xl">
          {t('story.title.lead')} <span className="tone-rest">{t('story.title.rest')}</span>
        </h2>
      </div>

      <div ref={outer} style={sticky ? { height: '460vh' } : undefined}>
        <div className={sticky ? 'sticky top-0 flex h-screen items-center' : 'py-8'}>
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-12">
            <ol className="relative flex flex-col gap-2 lg:col-span-3" aria-label={t('story.chapters')}>
              {chapters.map((c, i) => {
                const isActive = i === active;
                return (
                  <li key={c.title}>
                    <button
                      type="button"
                      onClick={() => jump(i)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`w-full border-s-2 py-2.5 ps-5 text-start transition-colors duration-300 ${isActive ? 'border-brand text-ink' : 'border-line text-muted hover:border-line-strong hover:text-ink'}`}
                      data-testid={`story-chapter-${i}`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`tabular grid size-6 shrink-0 place-items-center rounded-full text-xs ${isActive ? 'bg-brand text-brand-ink' : 'bg-sunken text-muted'}`}>{i + 1}</span>
                        <span className="text-lg font-medium">{c.title}</span>
                      </span>
                      <span
                        className="grid transition-[grid-template-rows] duration-300"
                        style={{ gridTemplateRows: isActive ? '1fr' : '0fr' }}
                      >
                        <span className="overflow-hidden">
                          <span className="block pb-1 pt-2 ps-9 leading-relaxed text-muted">{c.text}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {/* On phones the stage comes first, so tapping a step shows its effect right away. */}
            <div className="order-first lg:order-none lg:col-span-9">
              <div className="mx-auto" style={{ maxWidth: 'min(100%, calc((100vh - 9rem) * 1.6))' }}>
                <Stage p={p} model={model} />
              </div>
              {sticky && (
                <div className="mx-auto mt-4 h-0.5 overflow-hidden rounded-full bg-line" aria-hidden="true" style={{ maxWidth: 'min(100%, calc((100vh - 9rem) * 1.6))' }}>
                  <div className="h-full bg-brand" style={{ width: `${p * 100}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="h-16" />
    </section>
  );
}
