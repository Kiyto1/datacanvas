import { useTranslation } from 'react-i18next';
import { useUi } from '../../store/ui';
import { Wordmark } from '../brand/Mark';
import { ThemeSwitch } from '../ThemeSwitch';
import { Button } from '../ui/Button';

interface Props {
  onDemo: () => void;
  loading: boolean;
}

/** Slim sticky bar: wordmark and anchors at the start, theme, language and the demo at the end. */
export function Nav({ onDemo, loading }: Props) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const setLang = useUi((s) => s.setLang);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Wordmark name={t('app.name')} />
          <nav className="hidden items-center gap-1 whitespace-nowrap text-sm lg:flex" aria-label={t('nav.label')}>
            {(['story', 'live', 'how', 'privacy'] as const).map((id) => (
              <a key={id} href={`#${id}`} className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-ink">
                {t(`nav.${id}`)}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <ThemeSwitch />
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} data-testid="lang-switch">
            {t('lang.switch')}
          </Button>
          <Button variant="dark" size="sm" className="max-sm:hidden" disabled={loading} onClick={onDemo} data-testid="nav-demo">
            {t('nav.demo')}
          </Button>
        </div>
      </div>
    </header>
  );
}
