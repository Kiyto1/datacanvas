import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnProfile } from '../core/types';
import type { ChangeLogEntry, NormalizationDecision, NormalizationSuggestion } from '../normalize/types';

interface Props {
  suggestions: NormalizationSuggestion[];
  columns: ColumnProfile[];
  applied: NormalizationDecision[];
  changes: ChangeLogEntry[];
  onApply: (decisions: NormalizationDecision[]) => void;
}

interface Choice {
  checked: boolean;
  target: string;
}

export function NormalizationReview({ suggestions, columns, applied, changes, onApply }: Props) {
  const { t } = useTranslation();
  // Nothing is pre-selected: the user must confirm every merge.
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  if (suggestions.length === 0) return null;

  const choiceFor = (s: NormalizationSuggestion): Choice => choices[s.id] ?? { checked: false, target: s.suggestedDisplay };
  const patch = (s: NormalizationSuggestion, next: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [s.id]: { ...choiceFor(s), ...next } }));

  function apply() {
    const decisions: NormalizationDecision[] = suggestions
      .filter((s) => choiceFor(s).checked)
      .map((s) => ({ columnId: s.columnId, from: s.variants.map((v) => v.value), to: choiceFor(s).target }));
    onApply(decisions);
  }

  const totalChanged = changes.reduce((sum, c) => sum + c.count, 0);

  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label={t('normalize.title')} data-testid="normalization">
      <h2 className="font-semibold">{t('normalize.title')}</h2>
      <p className="mt-1 text-sm text-muted">{t('normalize.intro')}</p>

      <ul className="mt-3 flex flex-col gap-3">
        {suggestions.map((s, index) => {
          const choice = choiceFor(s);
          const column = columns.find((c) => c.id === s.columnId);
          return (
            <li key={s.id} className="rounded-lg border border-line p-3" data-testid={`suggestion-${index}`}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={choice.checked}
                  onChange={(e) => patch(s, { checked: e.target.checked })}
                  data-testid={`suggestion-check-${index}`}
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">
                    {column?.displayName} · {t(`normalize.kind.${s.kind}`)}
                  </span>
                  <span className="mt-1 block text-sm">
                    {s.variants.map((v) => `${v.value} (${v.count})`).join(' + ')}
                  </span>
                </span>
              </label>
              {s.kind === 'possible-match' && <p className="mt-1 text-xs text-danger">{t('normalize.possibleWarning')}</p>}
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span>{t('normalize.into')}</span>
                <select
                  className="rounded border border-line bg-surface px-2 py-1"
                  value={choice.target}
                  onChange={(e) => patch(s, { target: e.target.value })}
                  data-testid={`suggestion-target-${index}`}
                >
                  {[...new Set([s.suggestedDisplay, ...s.variants.map((v) => v.value)])].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="rounded-lg bg-brand px-3 py-1.5 text-sm text-brand-ink" onClick={apply} data-testid="normalize-apply">
          {t('normalize.apply')}
        </button>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={applied.length === 0}
          onClick={() => {
            setChoices({});
            onApply([]);
          }}
          data-testid="normalize-undo"
        >
          {t('normalize.undo')}
        </button>
        {applied.length > 0 && (
          <span role="status" className="text-sm text-accent" data-testid="normalize-status">
            {t('normalize.applied', { count: totalChanged })}
          </span>
        )}
      </div>
    </section>
  );
}
