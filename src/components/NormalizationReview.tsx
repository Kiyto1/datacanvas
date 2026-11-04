import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnProfile } from '../core/types';
import type { ChangeLogEntry, NormalizationDecision, NormalizationSuggestion, SuggestionKind } from '../normalize/types';
import { Button } from './ui/Button';

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

const KIND_TONE: Record<SuggestionKind, string> = {
  exact: 'bg-sunken text-ink',
  'known-alias': 'bg-brand-wash text-brand-strong',
  'possible-match': 'bg-saffron-wash text-saffron-ink',
};

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
    <section aria-label={t('normalize.title')} data-testid="normalization">
      <h3 className="text-sm font-semibold">{t('normalize.title')}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t('normalize.intro')}</p>

      <ul className="mt-3 flex flex-col gap-2.5">
        {suggestions.map((s, index) => {
          const choice = choiceFor(s);
          const column = columns.find((c) => c.id === s.columnId);
          return (
            <li
              key={s.id}
              className={`rounded-lg border bg-surface p-3 transition-colors ${choice.checked ? 'border-brand' : 'border-line'}`}
              data-testid={`suggestion-${index}`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--color-brand)]"
                  checked={choice.checked}
                  onChange={(e) => patch(s, { checked: e.target.checked })}
                  data-testid={`suggestion-check-${index}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{column?.displayName}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs ${KIND_TONE[s.kind]}`}>{t(`normalize.kind.${s.kind}`)}</span>
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {s.variants.map((v) => (
                      <span key={v.value} className="tabular inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-1 text-sm">
                        {v.value}
                        <span className="text-xs text-faint">{v.count}</span>
                      </span>
                    ))}
                  </span>
                </span>
              </label>
              {s.kind === 'possible-match' && <p className="mt-2 text-xs text-saffron-ink">{t('normalize.possibleWarning')}</p>}
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-muted">{t('normalize.into')}</span>
                <select
                  className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm"
                  aria-label={`${t('normalize.into')} ${column?.displayName ?? ''}`}
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" icon="check" onClick={apply} data-testid="normalize-apply">
          {t('normalize.apply')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="reset"
          disabled={applied.length === 0}
          onClick={() => {
            setChoices({});
            onApply([]);
          }}
          data-testid="normalize-undo"
        >
          {t('normalize.undo')}
        </Button>
      </div>
      {applied.length > 0 && (
        <p role="status" className="mt-2 text-sm text-ok-text" data-testid="normalize-status">
          {t('normalize.applied', { count: totalChanged })}
        </p>
      )}
    </section>
  );
}
