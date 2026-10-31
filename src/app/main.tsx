import { createRoot } from 'react-dom/client';
import { initLocale } from '../i18n/i18n';
import { App } from './App';
import { installAppHooks } from './appHooks';
import { LoadingScreen } from './screens/LoadingScreen';
import './tokens.css';
import './app.css';

/** The faces the UI and the board numerals use; the Loading star travels as they arrive. */
const FONT_FACES = [
  '40px "Rozha One"',
  '500 16px Poppins',
  '600 16px Poppins',
  '400 16px Poppins',
  '500 20px Eczar',
  '600 24px Eczar',
];
const FONT_WAIT_MS = 2000;

/** Waits for the webfonts so the board numerals are drawn in them; slow fonts never block the game for long. */
async function waitForFonts(onProgress: (done: number) => void): Promise<void> {
  let done = 0;
  const loads = FONT_FACES.map((face) =>
    document.fonts
      .load(face)
      .catch(() => [])
      .then(() => onProgress(++done / FONT_FACES.length)),
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  await Promise.race([Promise.all(loads), timeout]);
}

async function boot(): Promise<void> {
  initLocale();
  const host = document.getElementById('app');
  if (!host) throw new Error('#app is missing from index.html');
  const root = createRoot(host);
  root.render(<LoadingScreen progress={0} />);
  await waitForFonts((done) => root.render(<LoadingScreen progress={done} />));
  installAppHooks();
  root.render(<App />);
}

void boot();
