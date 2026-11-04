import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mark } from './components/brand/Mark';
import { Landing } from './components/landing/Landing';
import { demoFile } from './demo/sales';
import { useDataset } from './store/dataset';

// The workspace carries ECharts and the dashboard code. The landing page does not need them,
// so they load in the background while the visitor reads, and are ready by the time a file is chosen.
const loadWorkspace = () => import('./components/workspace/Workspace');
const Workspace = lazy(loadWorkspace);

function Preparing() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted" role="status">
        <Mark size={36} />
        <p className="text-sm">{t('upload.loading')}</p>
      </div>
    </div>
  );
}

export default function App() {
  const { status, summary, errorCode, load } = useDataset();

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    idle(() => void loadWorkspace());
  }, []);

  if (status === 'ready' && summary) {
    return (
      <Suspense fallback={<Preparing />}>
        <Workspace />
      </Suspense>
    );
  }

  return (
    <Landing
      onFile={(file) => void load(file)}
      onDemo={() => void load(demoFile())}
      loading={status === 'loading'}
      errorKey={status === 'error' ? (errorCode ?? 'unknown') : null}
    />
  );
}
