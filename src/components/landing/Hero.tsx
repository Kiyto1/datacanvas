import { useTranslation } from 'react-i18next';
import { UploadDropzone } from '../UploadDropzone';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';
import { HeroDemo } from './HeroDemo';

interface Props {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
  errorKey: string | null;
}

const FACTS: { icon: IconName; key: string }[] = [
  { icon: 'shield', key: 'privacy' },
  { icon: 'file', key: 'formats' },
  { icon: 'wand', key: 'digits' },
];

/** Centered headline, the upload, then one large product window on a quiet stage (the Attio structure). */
export function Hero({ onFile, onDemo, loading, errorKey }: Props) {
  const { t } = useTranslation();
  return (
    <section className="stage relative overflow-hidden pb-20 sm:pb-28" aria-labelledby="hero-title">
      <div className="mx-auto max-w-6xl px-5 pt-14 text-center sm:px-8 sm:pt-20">
        <h1 id="hero-title" className="display rise mx-auto max-w-4xl text-[2.9rem] leading-[1.18] sm:text-7xl sm:leading-[1.14]" style={{ ['--i' as string]: 0 }}>
          {t('hero.title.lead')} <span className="tone-rest">{t('hero.title.rest')}</span>
        </h1>
        <p className="rise mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl sm:leading-relaxed" style={{ ['--i' as string]: 1 }}>
          {t('hero.sub')}
        </p>
        <div className="rise mx-auto mt-9 max-w-2xl text-start" style={{ ['--i' as string]: 2 }}>
          <UploadDropzone
            onFile={onFile}
            disabled={loading}
            extra={
              <Button variant="secondary" icon="spark" disabled={loading} onClick={onDemo} data-testid="try-demo">
                {t('hero.demoCta')}
              </Button>
            }
          />
          {loading && (
            <p role="status" className="mt-3 text-sm text-muted">
              {t('upload.loading')}
            </p>
          )}
          {errorKey && (
            <p role="alert" className="mt-3 text-sm text-danger" data-testid="upload-error">
              {t(`errors.${errorKey}`, { defaultValue: t('errors.unknown') })}
            </p>
          )}
        </div>
        <ul className="rise mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted" style={{ ['--i' as string]: 3 }}>
          {FACTS.map((f) => (
            <li key={f.key} className="inline-flex items-center gap-2">
              <Icon name={f.icon} size={15} className="text-brand-strong" />
              {t(`hero.fact.${f.key}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="rise mx-auto mt-14 max-w-5xl px-5 sm:mt-16 sm:px-8" style={{ ['--i' as string]: 4 }}>
        <HeroDemo />
      </div>
    </section>
  );
}
