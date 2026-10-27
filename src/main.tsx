import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startAppearance } from './utils/appearance';

startAppearance();

createRoot(document.getElementById('root')!).render(<App />);
