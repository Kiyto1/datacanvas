import { useTranslation } from 'react-i18next';
import { DatasetPreview } from './components/DatasetPreview';
import { UploadDropzone } from './components/UploadDropzone';
import { useDataset } from './store/dataset';
import { useUi } from './store/ui';

export default function App() {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const setLang = useUi((s) => s.setLang);
  const { status, summary, errorCode, load } = useDataset();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        >
          {t('lang.switch')}
        </button>
      </header>
      <p className="text-lg text-muted">{t('app.tagline')}</p>
      <UploadDropzone onFile={(f) => void load(f)} disabled={status === 'loading'} />
      {status === 'loading' && <p role="status">{t('upload.loading')}</p>}
      {status === 'error' && (
        <p role="alert" className="text-danger" data-testid="upload-error">
          {t(`errors.${errorCode ?? 'unknown'}`, { defaultValue: t('errors.unknown') })}
        </p>
      )}
      {status === 'ready' && summary && <DatasetPreview summary={summary} />}
      <p className="text-sm text-accent" data-testid="privacy-badge">
        {t('privacy.badge')}
      </p>
    </main>
  );
}
