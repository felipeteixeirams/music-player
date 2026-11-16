import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startAppearance } from './utils/appearance';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorReporter } from './utils/errorReporter';
import { hideSplash } from './utils/splash';

startAppearance();
installErrorReporter();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
// The app is on its way to the screen: the opening animation can go (INV-UI-14)
hideSplash();
