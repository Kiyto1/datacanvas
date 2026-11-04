import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../store/dashboard';
import { useDataset } from '../../store/dataset';
import { useUi } from '../../store/ui';
import { Wordmark } from '../brand/Mark';
import { Dashboard } from '../Dashboard';
import { DatasetPreview } from '../DatasetPreview';
import { DateConfirmation, pendingDateColumns } from '../DateConfirmation';
import { ExportMenu } from '../ExportPanel';
import { NormalizationReview } from '../NormalizationReview';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { ThemeSwitch } from '../ThemeSwitch';

type Tab = 'dashboard' | 'data';

function LanguageSwitch() {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const setLang = useUi((s) => s.setLang);
  return (
    <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} data-testid="lang-switch">
      {t('lang.switch')}
    </Button>
  );
}

/** The product after a file is loaded: slim top bar, a cleanup tray at the start edge, the dashboard. */
export default function Workspace() {
  const { t } = useTranslation();
  const { summary, preview, applied, changes, applyNormalization, reset } = useDataset();
  const dateChoices = useDashboard((s) => s.dateChoices);
  const chooseDate = useDashboard((s) => s.chooseDate);
  const [tab, setTab] = useState<Tab>('dashboard');

  const pendingDates = summary ? pendingDateColumns(summary.columns, dateChoices).length : 0;
  const needsReview = (summary?.suggestions.length ?? 0) + pendingDates;
  const [trayOpen, setTrayOpen] = useState(needsReview > 0);

  if (!summary) return null;

  return (
    <div className="min-h-screen bg-sunken">
      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <button type="button" onClick={reset} className="rounded-md" aria-label={`${t('app.name')}: ${t('ws.newFile')}`}>
            <Wordmark name={t('app.name')} />
          </button>
          <span className="hidden min-w-0 items-center gap-2 rounded-md bg-sunken px-2.5 py-1 text-sm sm:inline-flex" data-testid="file-pill">
            <Icon name="file" size={15} className="shrink-0 text-faint" />
            <span className="max-w-[16rem] truncate">{summary.name}</span>
            <span className="tabular shrink-0 text-xs text-faint">{t('ws.meta', { rows: summary.rowCount, columns: summary.columnCount })}</span>
          </span>

          <div role="tablist" aria-label={t('ws.tabs.dashboard')} className="ms-auto inline-flex rounded-lg border border-line-strong p-0.5 text-sm">
            {(['dashboard', 'data'] as const).map((id) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors ${tab === id ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
                data-testid={`tab-${id}`}
              >
                <Icon name={id === 'dashboard' ? 'chart' : 'table'} size={15} />
                {t(`ws.tabs.${id}`)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="secondary" size="sm" icon="wand" aria-pressed={trayOpen} onClick={() => setTrayOpen((v) => !v)} data-testid="tray-toggle">
              {t('ws.clean')}
              {needsReview > 0 && (
                <span className="tabular grid min-w-5 place-items-center rounded-full bg-saffron px-1.5 text-xs font-semibold text-on-warning" data-testid="review-count">
                  {needsReview}
                </span>
              )}
            </Button>
            <ExportMenu datasetName={summary.name} columns={summary.columns} />
            <Button variant="ghost" size="sm" icon="plus" onClick={reset} data-testid="new-file">
              {t('ws.newFile')}
            </Button>
            <ThemeSwitch />
            <LanguageSwitch />
          </div>
        </div>
      </header>

      <div className={`mx-auto grid max-w-[88rem] gap-6 px-4 py-6 sm:px-6 ${trayOpen ? 'lg:grid-cols-[21rem_minmax(0,1fr)]' : ''}`}>
        {trayOpen && (
          <aside
            className="fade h-fit rounded-xl border border-line bg-surface p-4 shadow-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
            aria-label={t('ws.cleanTitle')}
            data-testid="tray"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{t('ws.cleanTitle')}</h2>
              <IconButton icon="close" label={t('ws.cleanClose')} onClick={() => setTrayOpen(false)} data-testid="tray-close" />
            </div>
            <div className="flex flex-col gap-5">
              <DateConfirmation columns={summary.columns} previewRows={summary.preview} dateChoices={dateChoices} onChoose={(id, cand) => void chooseDate(id, cand)} />
              <NormalizationReview
                key={summary.id}
                suggestions={summary.suggestions}
                columns={summary.columns}
                applied={applied}
                changes={changes}
                onApply={(d) => void applyNormalization(d)}
              />
              {needsReview === 0 && applied.length === 0 && <p className="text-sm text-muted">{t('ws.cleanNothing')}</p>}
            </div>
          </aside>
        )}

        <main className="min-w-0" data-testid="workspace-main">
          {tab === 'dashboard' ? <Dashboard key={summary.id} columns={summary.columns} dataVersion={applied} /> : <DatasetPreview summary={summary} rows={preview} />}
          <p className="mt-8 flex items-center gap-2 text-xs text-ok-text" data-testid="privacy-badge">
            <Icon name="shield" size={14} />
            {t('privacy.badge')}
          </p>
        </main>
      </div>
    </div>
  );
}
