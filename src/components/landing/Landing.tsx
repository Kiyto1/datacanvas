import { useEffect } from 'react';
import { Bento } from './Bento';
import { FinalCta } from './FinalCta';
import { Hero } from './Hero';
import { Nav } from './Nav';
import { LiveDemoSection } from './LiveDemoSection';
import { PrivacyProof } from './PrivacyProof';
import { Story } from './Story';

interface Props {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
  errorKey: string | null;
}

/**
 * The launch page. Rhythm: dark hero, dark scroll story, light figures and live preview,
 * light bento, dark privacy proof, dark closing call to action.
 */
export function Landing({ onFile, onDemo, loading, errorKey }: Props) {
  // Warm the preview's chunk on idle so scrolling to it feels instant.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => void import('./LiveDemo'));
  }, []);

  return (
    <div className="min-h-screen">
      <Nav onDemo={onDemo} loading={loading} />
      <main>
        <Hero onFile={onFile} onDemo={onDemo} loading={loading} errorKey={errorKey} />
        <Story />
        <LiveDemoSection />
        <Bento />
        <PrivacyProof />
      </main>
      <FinalCta onFile={onFile} onDemo={onDemo} loading={loading} />
    </div>
  );
}
