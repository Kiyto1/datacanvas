import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource-variable/inter';
import './index.css';
import { applyTheme, readTheme } from './core/theme';
import { applyDocumentLang } from './i18n';
import App from './App';

applyDocumentLang('ar');
applyTheme(readTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
