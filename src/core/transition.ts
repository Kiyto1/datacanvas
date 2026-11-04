import { flushSync } from 'react-dom';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Runs a state update inside a View Transition so the landing page and the workspace cross-fade.
 * Progressive: browsers without the API (or with reduced motion) just apply the update.
 *
 * The update must be committed synchronously inside the callback (flushSync). Rendering is
 * suppressed while the callback runs, so waiting for a frame or a timer in here would deadlock the
 * transition and freeze every animation until the browser gives up.
 */
export function withViewTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
  if (!doc.startViewTransition || reducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => {
    flushSync(update);
  });
}
