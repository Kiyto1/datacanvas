import { useTranslation } from 'react-i18next';
import { useUi } from './store/ui';

export default function App() {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const setLang = useUi((s) => s.setLang);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10">
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
      <div className="rounded-card border-2 border-dashed border-line bg-surface p-12 text-center">
        <p className="font-semibold">{t('upload.cta')}</p>
        <p className="mt-1 text-sm text-muted">{t('upload.hint')}</p>
      </div>
      <p className="text-sm text-accent" role="status">
        {t('privacy.badge')}
      </p>
    </main>
  );
}
