import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnProfile } from '../core/types';
import { buildDashboardSpec } from '../dashboard/exportSpec';
import { recommend, resolveReadings } from '../dashboard/recommend';
import { downloadBytes } from '../export/download';
import type { ExportRequest } from '../export/run';
import { useDashboard } from '../store/dashboard';
import { useUi } from '../store/ui';
import { exportInWorker } from '../worker/client';
import { Button } from './ui/Button';
import { Popover } from './ui/Popover';

interface Props {
  datasetName: string;
  columns: ColumnProfile[];
}

type Kind = ExportRequest['kind'];
const GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: 'export.files', kinds: ['csv', 'xlsx', 'json'] },
  { title: 'export.bi', kinds: ['powerbi', 'metabase', 'spec'] },
];

/** Export as a popover from the top bar: a short command list, each row says what you get. */
export function ExportMenu({ datasetName, columns }: Props) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const dateChoices = useDashboard((s) => s.dateChoices);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function run(kind: Kind) {
    setBusy(kind);
    setDone(null);
    setFailed(false);
    try {
      const readings = resolveReadings(columns, dateChoices);
      const dashboardSpecJson = buildDashboardSpec(columns, recommend(columns, readings), readings, datasetName);
      const result = await exportInWorker({ kind, fileName: datasetName, lang, dashboardSpecJson });
      downloadBytes(result.fileName, result.mime, result.bytes);
      setDone(result.fileName);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label={t('export.title')}
      width="w-[22rem]"
      trigger={
        <Button variant="secondary" size="sm" icon="download" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="export-open">
          {t('ws.export')}
        </Button>
      }
    >
      <div data-testid="export-panel" className="flex flex-col gap-3">
        <p className="px-1 text-xs leading-relaxed text-muted">{t('export.intro')}</p>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-1 pb-1 text-xs font-medium text-faint">{t(group.title)}</p>
            <ul className="flex flex-col">
              {group.kinds.map((kind) => (
                <li key={kind}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void run(kind)}
                    className="flex w-full flex-col rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-sunken disabled:opacity-50"
                    data-testid={`export-${kind}`}
                  >
                    <span className="text-sm font-medium">{t(`export.kind.${kind}.title`)}</span>
                    <span className="text-xs text-muted">{t(`export.kind.${kind}.hint`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="min-h-5 px-1 text-xs" aria-live="polite">
          {busy && (
            <p className="text-muted" data-testid="export-working">
              {t('export.working')}
            </p>
          )}
          {done && !busy && (
            <p className="text-ok-text" data-testid="export-done">
              {t('export.done', { file: done })}
            </p>
          )}
          {failed && <p className="text-danger">{t('export.failed')}</p>}
        </div>
      </div>
    </Popover>
  );
}
