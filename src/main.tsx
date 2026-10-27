import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startAppearance } from './utils/appearance';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorReporter } from './utils/errorReporter';

startAppearance();
installErrorReporter();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
