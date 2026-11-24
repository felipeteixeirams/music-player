import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startAppearance } from './utils/appearance';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorReporter } from './utils/errorReporter';
import { hideSplash } from './utils/splash';
import { sendCacheLimitToWorker } from './utils/cacheLimit';
import { startStandalone } from './utils/standalone';

// The installed iPhone app drops viewport-fit=cover before the first paint (INV-UI-15); the browser is untouched
startStandalone();
startAppearance();
installErrorReporter();
// The cache limit chosen in Settings reaches the service worker on every start (INV-PERF-05)
sendCacheLimitToWorker();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
// The app is on its way to the screen: the opening animation can go (INV-UI-14)
hideSplash();
