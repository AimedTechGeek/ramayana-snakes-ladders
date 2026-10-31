import type { Emotion } from '../../characters/reactions';
import { HERO_ORDER, HEROES, heroName } from '../../game/heroes';
import { t } from '../../i18n/i18n';
import { EMOTION_MARK } from '../hud/Hud';

const EMOTIONS: readonly Emotion[] = ['idle', 'happy', 'excited', 'scared', 'sad'];

/** Every hero in every emotion (placeholder swatches until the 3D figures exist). Opens from Boot or #gallery. */
export function GalleryScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen gallery" data-testid="gallery-screen">
      <header className="setup-header">
        <button className="btn chip" onClick={onBack}>
          {t('ui.back')}
        </button>
        <h1 className="title small">{t('ui.gallery')}</h1>
      </header>
      <table className="gallery-table">
        <thead>
          <tr>
            <th />
            {EMOTIONS.map((emotion) => (
              <th key={emotion}>{emotion}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HERO_ORDER.map((hero) => (
            <tr key={hero}>
              <th style={{ color: HEROES[hero].cssColor }}>{heroName(hero)}</th>
              {EMOTIONS.map((emotion) => (
                <td key={emotion}>
                  <span className="swatch" style={{ background: HEROES[hero].cssColor }}>
                    {EMOTION_MARK[emotion]}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
