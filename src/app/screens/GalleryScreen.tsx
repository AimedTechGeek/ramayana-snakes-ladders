import type { Emotion } from '../../characters/reactions';
import { HERO_ORDER, HEROES, heroName } from '../../game/heroes';
import { getLocale, t } from '../../i18n/i18n';
import { LangSwitch, Pill } from '../ui/Controls';
import { Portrait } from '../ui/Portrait';

const EMOTIONS: readonly Emotion[] = ['idle', 'happy', 'excited', 'scared', 'sad'];

interface GalleryScreenProps {
  onBack: () => void;
  onToggleLanguage: () => void;
}

/** Every hero in every emotion (placeholder portraits until the 3D figures exist). Opens from Boot or #gallery. */
export function GalleryScreen({ onBack, onToggleLanguage }: GalleryScreenProps) {
  return (
    <main className="screen gallery" data-testid="gallery-screen">
      <header className="screen-top">
        <Pill variant="outline" icon="arrow-left" data-testid="gallery-back" onClick={onBack}>
          {t('ui.back')}
        </Pill>
        <h1 className="h1 screen-title">{t('ui.gallery')}</h1>
        <div className="top-actions">
          <LangSwitch locale={getLocale()} onToggle={onToggleLanguage} />
        </div>
      </header>
      <div className="gallery-grid">
        {HERO_ORDER.map((hero) => (
          <section key={hero} className="gallery-row" style={{ ['--hero' as string]: HEROES[hero].cssColor }}>
            <h2 className="gallery-hero">{heroName(hero)}</h2>
            {EMOTIONS.map((emotion) => (
              <figure key={emotion} className="gallery-cell glass">
                <Portrait hero={hero} emotion={emotion} className="gallery-portrait" />
                <figcaption>{t(`ui.emotion.${emotion}`)}</figcaption>
              </figure>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
