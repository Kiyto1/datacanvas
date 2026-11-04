import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';
import { Reveal } from './motion';

interface Entry {
  path: string;
  kind: string;
  external: boolean;
}

function toEntry(r: PerformanceResourceTiming): Entry | null {
  try {
    const url = new URL(r.name);
    return { path: url.origin === location.origin ? url.pathname : url.host + url.pathname, kind: r.initiatorType || 'other', external: url.origin !== location.origin };
  } catch {
    return null;
  }
}

/** What this page has actually loaded since it opened, read from the browser's own performance log. */
function useLoadedResources(): Entry[] {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    const read = () => setEntries(performance.getEntriesByType('resource').map((e) => toEntry(e as PerformanceResourceTiming)).filter((e): e is Entry => e !== null));
    read();
    if (typeof PerformanceObserver === 'undefined') return;
    const observer = new PerformanceObserver(read);
    observer.observe({ type: 'resource', buffered: true });
    return () => observer.disconnect();
  }, []);
  return entries;
}

export function PrivacyProof() {
  const { t } = useTranslation();
  const entries = useLoadedResources();
  const external = entries.filter((e) => e.external).length;
  const shown = entries.slice(-7);

  return (
    <section id="privacy" className="relative isolate overflow-hidden" aria-labelledby="proof-title" data-testid="proof">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-28 sm:px-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <h2 id="proof-title" className="display text-4xl leading-[1.2] sm:text-5xl">
            {t('proof.title.lead')} <span className="tone-rest">{t('proof.title.rest')}</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">{t('proof.text')}</p>
          <ul className="mt-8 flex flex-col gap-4">
            {(['static', 'csp', 'none'] as const).map((k) => (
              <li key={k} className="flex gap-3 text-muted">
                <Icon name={k === 'static' ? 'shield' : k === 'csp' ? 'file' : 'check'} size={18} className="mt-1 shrink-0 text-brand-strong" />
                <span className="leading-relaxed">{t(`privacy.fact.${k}`)}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="lg:col-span-7" delay={1}>
          <div className="window overflow-hidden rounded-2xl border border-line bg-surface" data-testid="proof-panel">
            <div className="grid grid-cols-3 divide-x divide-line border-b border-line rtl:divide-x-reverse">
              <div className="px-5 py-4">
                <p className="text-xs text-muted">{t('proof.total')}</p>
                <p className="tabular mt-1 text-3xl font-semibold leading-none" data-testid="proof-total">
                  {entries.length}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-muted">{t('proof.same')}</p>
                <p className="tabular mt-1 text-3xl font-semibold leading-none">{entries.length - external}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-muted">{t('proof.external')}</p>
                <p className={`tabular mt-1 text-3xl font-semibold leading-none ${external === 0 ? 'text-ok-text' : 'text-danger'}`} data-testid="proof-external">
                  {external}
                </p>
              </div>
            </div>
            <ul className="tabular divide-y divide-line text-sm" dir="ltr" aria-label={t('proof.listLabel')}>
              {shown.length === 0 && <li className="px-5 py-3 text-muted">{t('proof.empty')}</li>}
              {shown.map((e, i) => (
                <li key={`${e.path}-${i}`} className="flex items-center justify-between gap-4 px-5 py-2.5">
                  <span className="truncate text-ink">{e.path}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-muted">{e.kind}</span>
                    <span className={e.external ? 'text-danger' : 'text-ok-text'}>{e.external ? t('proof.other') : t('proof.thisSite')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
