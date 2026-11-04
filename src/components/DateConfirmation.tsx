import { useTranslation } from 'react-i18next';
import type { ColumnProfile, RawCell } from '../core/types';
import { parseDateWith, type DateCandidate } from '../profile/dates';
import { useUi } from '../store/ui';

interface Props {
  columns: ColumnProfile[];
  previewRows: RawCell[][];
  dateChoices: Record<string, DateCandidate>;
  onChoose: (columnId: string, candidate: DateCandidate) => void;
}

function exampleFor(sample: string | undefined, candidate: DateCandidate, lang: string): string | null {
  if (!sample || candidate.calendar === 'hijri') return null;
  const parts = parseDateWith(sample, candidate);
  if (!parts) return null;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(parts.y, parts.m - 1, parts.d)),
  );
}

/** Asks the user to settle date columns the data could not settle (e.g. 03/04/2026). Nothing is guessed. */
export function DateConfirmation({ columns, previewRows, dateChoices, onChoose }: Props) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);

  const pending = columns
    .map((col, j) => ({ col, j }))
    .filter(({ col }) => col.type === 'date' && col.dateInference && col.dateInference.status !== 'confirmed' && !dateChoices[col.id]);
  if (pending.length === 0) return null;

  return (
    <section className="rounded-card border border-danger/40 bg-surface p-4" role="note" data-testid="date-warning" aria-label={t('dates.title')}>
      <h2 className="font-semibold">{t('dates.title')}</h2>
      <p className="mt-1 text-sm text-muted">{t('dates.intro')}</p>
      <div className="mt-3 flex flex-col gap-4">
        {pending.map(({ col, j }) => {
          const sample = previewRows.map((r) => r[j]).find((c): c is string => typeof c === 'string');
          return (
            <div key={col.id}>
              <p className="text-sm font-semibold">
                {col.displayName}
                {sample && <span className="ms-2 font-normal text-muted">({t('dates.sample')}: {sample})</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {col.dateInference!.candidates.map((cand) => {
                  const example = exampleFor(sample, cand, lang);
                  return (
                    <button
                      key={`${cand.order}-${cand.calendar}`}
                      type="button"
                      className="rounded-lg border border-line px-3 py-1.5 text-start text-sm hover:border-brand"
                      onClick={() => onChoose(col.id, cand)}
                      data-testid={`date-choice-${col.id}-${cand.order}-${cand.calendar}`}
                    >
                      <span className="block font-semibold">{t(`dates.reading.${cand.order}-${cand.calendar}`)}</span>
                      {example && <span className="block text-muted">{example}</span>}
                      {cand.calendar === 'hijri' && <span className="block text-muted">{t('dates.hijriNote')}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
