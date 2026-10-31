import { getLocale, t } from '../../i18n/i18n';
import type { LoadedGame } from '../../game/save';

interface BootScreenProps {
  saved: LoadedGame | null;
  onPlay: () => void;
  onResume: (saved: LoadedGame) => void;
  onToggleLanguage: () => void;
  onGallery: () => void;
}

/** Title screen: Play (or Resume and New Game when a save exists), the language chip and the Gallery. */
export function BootScreen({ saved, onPlay, onResume, onToggleLanguage, onGallery }: BootScreenProps) {
  // The chip names the language it switches to, in that language.
  const other = getLocale() === 'en' ? 'हिंदी' : 'English';
  return (
    <main className="screen boot" data-testid="boot">
      <h1 className="title">{t('ui.title')}</h1>
      <div className="boot-actions">
        {saved ? (
          <>
            <button className="btn primary big" data-testid="resume" onClick={() => onResume(saved)}>
              {t('ui.resume')}
            </button>
            <button className="btn" data-testid="new-game" onClick={onPlay}>
              {t('ui.newGame')}
            </button>
          </>
        ) : (
          <button className="btn primary big" data-testid="play" onClick={onPlay}>
            {t('ui.play')}
          </button>
        )}
      </div>
      <div className="corner-actions">
        <button className="btn chip" data-testid="gallery" onClick={onGallery}>
          {t('ui.gallery')}
        </button>
        <button className="btn chip" data-testid="language" onClick={onToggleLanguage}>
          {other}
        </button>
      </div>
    </main>
  );
}
