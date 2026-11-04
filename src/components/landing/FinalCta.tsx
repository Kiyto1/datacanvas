import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Wordmark } from '../brand/Mark';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Reveal } from './motion';

interface Props {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
}

export function FinalCta({ onFile, onDemo, loading }: Props) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="stage relative isolate overflow-hidden" aria-labelledby="cta-title">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-24 sm:px-8">
        <Reveal>
          <h2 id="cta-title" className="display mx-auto max-w-4xl text-center text-5xl leading-[1.15] sm:text-7xl">
            {t('cta.title.lead')} <span className="tone-rest">{t('cta.title.rest')}</span>
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <input
              ref={input}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls"
              className="sr-only"
              aria-label={t('upload.cta')}
              data-testid="cta-file-input"
              disabled={loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = '';
              }}
            />
            <Button variant="primary" size="md" icon="upload" disabled={loading} onClick={() => input.current?.click()} data-testid="cta-pick">
              {t('upload.pick')}
            </Button>
            <Button variant="secondary" size="md" icon="spark" disabled={loading} onClick={onDemo} data-testid="cta-demo">
              {t('hero.demoCta')}
            </Button>
          </div>
        </Reveal>

        <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-line py-8 text-sm text-muted">
          <Wordmark name={t('app.name')} />
          <p data-testid="privacy-badge" className="inline-flex items-center gap-2 text-ok-text">
            <Icon name="shield" size={15} />
            {t('privacy.badge')}
          </p>
        </footer>
      </div>
    </section>
  );
}
