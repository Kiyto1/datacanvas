import { useTranslation } from 'react-i18next';
import { Dashboard } from './components/Dashboard';
import { DateConfirmation } from './components/DateConfirmation';
import { DatasetPreview } from './components/DatasetPreview';
import { ExportPanel } from './components/ExportPanel';
import { NormalizationReview } from './components/NormalizationReview';
import { UploadDropzone } from './components/UploadDropzone';
import { useDashboard } from './store/dashboard';
import { useDataset } from './store/dataset';
import { useUi } from './store/ui';

export default function App() {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const setLang = useUi((s) => s.setLang);
  const { status, summary, preview, applied, changes, errorCode, load, applyNormalization } = useDataset();
  const dateChoices = useDashboard((s) => s.dateChoices);
  const chooseDate = useDashboard((s) => s.chooseDate);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        >
          {t('lang.switch')}
        </button>
      </header>
      <p className="max-w-prose text-lg text-muted">{t('app.tagline')}</p>
      <UploadDropzone onFile={(f) => void load(f)} disabled={status === 'loading'} />
      {status === 'loading' && <p role="status">{t('upload.loading')}</p>}
      {status === 'error' && (
        <p role="alert" className="text-danger" data-testid="upload-error">
          {t(`errors.${errorCode ?? 'unknown'}`, { defaultValue: t('errors.unknown') })}
        </p>
      )}
      {status === 'ready' && summary && (
        <>
          <NormalizationReview
            key={summary.id}
            suggestions={summary.suggestions}
            columns={summary.columns}
            applied={applied}
            changes={changes}
            onApply={(d) => void applyNormalization(d)}
          />
          <DateConfirmation
            columns={summary.columns}
            previewRows={summary.preview}
            dateChoices={dateChoices}
            onChoose={(id, cand) => void chooseDate(id, cand)}
          />
          <Dashboard key={summary.id} columns={summary.columns} dataVersion={applied} />
          <ExportPanel datasetName={summary.name} columns={summary.columns} />
          <DatasetPreview summary={summary} rows={preview} />
        </>
      )}
      <p className="text-sm text-accent" data-testid="privacy-badge">
        {t('privacy.badge')}
      </p>
    </main>
  );
}
