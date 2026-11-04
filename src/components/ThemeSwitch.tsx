import { useTranslation } from 'react-i18next';
import type { ThemeChoice } from '../core/theme';
import { useUi } from '../store/ui';
import { Icon, type IconName } from './ui/Icon';

const CHOICES: { id: ThemeChoice; icon: IconName }[] = [
  { id: 'light', icon: 'sun' },
  { id: 'dark', icon: 'moon' },
  { id: 'system', icon: 'monitor' },
];

/** Light / Dark / System. Light is the default; System follows the device. */
export function ThemeSwitch() {
  const { t } = useTranslation();
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  return (
    <div role="group" aria-label={t('theme.label')} className="inline-flex rounded-lg border border-line bg-surface p-0.5" data-testid="theme-switch">
      {CHOICES.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={theme === c.id}
          aria-label={t(`theme.${c.id}`)}
          title={t(`theme.${c.id}`)}
          onClick={() => setTheme(c.id)}
          className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${theme === c.id ? 'bg-brand-wash text-brand-strong' : 'text-muted hover:text-ink'}`}
          data-testid={`theme-${c.id}`}
        >
          <Icon name={c.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
