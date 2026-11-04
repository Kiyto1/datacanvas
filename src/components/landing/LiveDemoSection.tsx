import { lazy, Suspense, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Reveal, useInView } from './motion';

// ECharts and the dashboard components load only when the visitor scrolls near the preview.
const LiveDemo = lazy(() => import('./LiveDemo'));

export function LiveDemoSection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, '0px 0px 600px 0px'); // start loading well before it is on screen

  return (
    <section id="live" className="mx-auto max-w-6xl px-5 py-24 sm:px-8" aria-labelledby="live-title">
      <Reveal>
        <h2 id="live-title" className="display max-w-3xl text-4xl leading-[1.2] sm:text-5xl">
          {t('live.title.lead')} <span className="tone-rest">{t('live.title.rest')}</span>
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{t('live.hint')}</p>
      </Reveal>
      <div ref={ref} className="mt-10 min-h-[44rem]">
        {near && (
          <Suspense
            fallback={
              <div className="grid min-h-[44rem] place-items-center rounded-2xl border border-line bg-surface text-sm text-muted" role="status">
                {t('live.loading')}
              </div>
            }
          >
            <LiveDemo />
          </Suspense>
        )}
      </div>
    </section>
  );
}
