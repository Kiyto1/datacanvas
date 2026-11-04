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

interface Props {
  datasetName: string;
  columns: ColumnProfile[];
}

type Kind = ExportRequest['kind'];
const FILES: Kind[] = ['csv', 'xlsx', 'json'];
const PACKAGES: Kind[] = ['powerbi', 'metabase'];

export function ExportPanel({ datasetName, columns }: Props) {
  const { t } = useTranslation();
  const lang = useUi((s) => s.lang);
  const dateChoices = useDashboard((s) => s.dateChoices);
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

  const button = (kind: Kind) => (
    <button
      key={kind}
      type="button"
      disabled={busy !== null}
      onClick={() => void run(kind)}
      className="rounded-lg border border-line bg-surface px-3 py-2 text-start text-sm hover:border-brand disabled:opacity-50"
      data-testid={`export-${kind}`}
    >
      <span className="block font-semibold">{t(`export.kind.${kind}.title`)}</span>
      <span className="block text-muted">{t(`export.kind.${kind}.hint`)}</span>
    </button>
  );

  return (
    <section className="border-t border-line pt-4" aria-label={t('export.title')} data-testid="export-panel">
      <h2 className="text-xl font-semibold">{t('export.title')}</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">{t('export.intro')}</p>
      <div className="mt-3 flex flex-wrap gap-3">{FILES.map(button)}</div>
      <h3 className="mt-5 text-base font-semibold">{t('export.bi')}</h3>
      <p className="mt-1 max-w-prose text-sm text-muted">{t('export.biIntro')}</p>
      <div className="mt-3 flex flex-wrap gap-3">{PACKAGES.map(button)}</div>
      <div className="mt-3">{button('spec')}</div>
      {done && (
        <p role="status" className="mt-3 text-sm text-accent" data-testid="export-done">
          {t('export.done', { file: done })}
        </p>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {t('export.failed')}
        </p>
      )}
    </section>
  );
}
