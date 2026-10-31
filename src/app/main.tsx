import { createRoot } from 'react-dom/client';
import { initLocale } from '../i18n/i18n';
import { App } from './App';
import { installAppHooks } from './appHooks';
import './app.css';

const FONT_FACES = ['40px "Yatra One"', '700 40px "Noto Sans"'];
const FONT_WAIT_MS = 2000;

/** Waits for the webfonts so the board numerals are drawn in them; offline or slow fonts never block the game. */
async function waitForFonts(): Promise<void> {
  const loads = FONT_FACES.map((face) => document.fonts.load(face).catch(() => []));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  await Promise.race([Promise.all(loads), timeout]);
}

async function boot(): Promise<void> {
  await waitForFonts();
  initLocale();
  installAppHooks();
  const root = document.getElementById('app');
  if (!root) throw new Error('#app is missing from index.html');
  createRoot(root).render(<App />);
}

void boot();
