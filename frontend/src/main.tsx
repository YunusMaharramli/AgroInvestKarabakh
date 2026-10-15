import { createRoot } from 'react-dom/client';
// Self-hosted fonts (Latin Extended for Azerbaijani + Cyrillic for Russian), no external requests
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/400-italic.css';
import './styles/theme.css';
import './app/i18n';
import { AppRouter } from './app/AppRouter';

createRoot(document.getElementById('root')!).render(<AppRouter />);
