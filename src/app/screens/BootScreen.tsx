import type { ReactNode } from 'react';
import type { LoadedGame } from '../../game/save';
import { getLocale, t } from '../../i18n/i18n';
import { Divider, LangSwitch, Pill, Sparkle, Toggle } from '../ui/Controls';
import { Icon, type IconName } from '../ui/Icon';

interface BootScreenProps {
  saved: LoadedGame | null;
  muted: boolean;
  onPlay: () => void;
  onResume: (saved: LoadedGame) => void;
  onToggleLanguage: () => void;
  onMute: () => void;
  onGallery: () => void;
  /** The hero object (the turning 3D board): the integrator passes the canvas; a drawn board stands in. */
  art?: ReactNode;
}

/** A stand-in for the 3D board: a soft clay-toy isometric slab drawn in SVG, so the title screen has its hero. */
export function BoardArtPlaceholder() {
  const tiles: ReactNode[] = [];
  const palette = ['#9CC46B', '#E3C98D', '#4F7F3C', '#CF975B', '#3F8FB5', '#4D528F'];
  const N = 6;
  const W = 52;
  const H = 30;
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const x = 300 + (col - row) * W * 0.5;
      const y = 120 + (col + row) * H * 0.5;
      const fill = palette[Math.floor(row * 0.99)] ?? '#9CC46B';
      const shade = (col + row) % 2 === 0 ? 1 : 0.92;
      tiles.push(
        <g key={`${row}-${col}`} opacity={shade}>
          <path d={`M${x} ${y} l${W / 2} ${H / 2} l${-W / 2} ${H / 2} l${-W / 2} ${-H / 2}z`} fill={fill} />
          <path
            d={`M${x - W / 2} ${y + H / 2} l${W / 2} ${H / 2} v10 l${-W / 2} ${-H / 2}z`}
            fill="#000"
            opacity="0.14"
          />
          <path
            d={`M${x + W / 2} ${y + H / 2} l${-W / 2} ${H / 2} v10 l${W / 2} ${-H / 2}z`}
            fill="#000"
            opacity="0.24"
          />
        </g>,
      );
    }
  }
  return (
    <svg className="board-art" viewBox="110 90 380 260" aria-hidden="true">
      <ellipse cx="300" cy="326" rx="190" ry="34" fill="#262C66" opacity="0.18" />
      <path d="M138 206 L300 300 L300 334 L138 240z" fill="#8D6C47" />
      <path d="M462 206 L300 300 L300 334 L462 240z" fill="#B08A5E" />
      <path d="M300 112 L462 206 L300 300 L138 206z" fill="#C9A77E" />
      {tiles}
      <g>
        <circle cx="262" cy="170" r="11" fill="#3F6FC2" />
        <circle cx="322" cy="208" r="11" fill="#D15587" />
        <circle cx="352" cy="256" r="11" fill="#2E9E6B" />
        <circle cx="236" cy="236" r="11" fill="#E4572E" />
      </g>
    </svg>
  );
}

const FEATURES: readonly { icon: IconName; label: () => string; caption: () => string }[] = [
  { icon: 'person', label: () => t('ui.players'), caption: () => `${t('ui.human')} · ${t('ui.bot')}` },
  { icon: 'globe', label: () => t('ui.language'), caption: () => 'English · हिंदी' },
  {
    icon: 'bolt',
    label: () => t('ui.difficulty'),
    caption: () => [t('ui.easy'), t('ui.medium'), t('ui.hard')].join(' · '),
  },
];

/** Title screen: text and pills sit directly on the gradient; Play (or Resume and New Game when a save exists). */
export function BootScreen({
  saved,
  muted,
  onPlay,
  onResume,
  onToggleLanguage,
  onMute,
  onGallery,
  art,
}: BootScreenProps) {
  return (
    <main className="screen boot" data-testid="boot">
      <header className="screen-top">
        <div className="brand" aria-hidden="true">
          <Sparkle />
          {t('ui.brand')}
          <Sparkle />
        </div>
        <div className="top-actions">
          <LangSwitch locale={getLocale()} onToggle={onToggleLanguage} />
          <Toggle
            checked={muted}
            onChange={onMute}
            label={t('ui.mute')}
            onIcon="speaker-off"
            offIcon="speaker"
            testId="boot-mute"
          />
        </div>
      </header>

      <div className="boot-art">{art ?? <BoardArtPlaceholder />}</div>

      <section className="boot-copy">
        <p className="eyebrow">{t('ui.subtitle')}</p>
        <h1 className="display" aria-label={t('ui.title')}>
          {t('ui.brand')}
        </h1>
        <Divider />
        <p className="tagline">{t('ui.tagline')}</p>
        <div className="boot-actions">
          {saved ? (
            <>
              <Pill variant="primary" arrow data-testid="resume" onClick={() => onResume(saved)}>
                {t('ui.resume')}
              </Pill>
              <Pill variant="outline" data-testid="new-game" onClick={onPlay}>
                {t('ui.newGame')}
              </Pill>
            </>
          ) : (
            <>
              <Pill variant="primary" arrow data-testid="play" onClick={onPlay}>
                {t('ui.play')}
              </Pill>
              <Pill variant="outline" icon="gallery" data-testid="gallery" onClick={onGallery}>
                {t('ui.gallery')}
              </Pill>
            </>
          )}
        </div>
      </section>

      <ul className="features">
        {FEATURES.map((feature) => (
          <li key={feature.icon}>
            <div className="feature-row">
              <span className="feature-disc">
                <Icon name={feature.icon} />
              </span>
              <span className="feature-text">
                <b>{feature.label()}</b>
                <small>{feature.caption()}</small>
              </span>
            </div>
            <Divider />
          </li>
        ))}
      </ul>

      {saved && (
        <button type="button" className="text-link" data-testid="gallery" onClick={onGallery}>
          <Icon name="gallery" size={16} />
          {t('ui.gallery')}
        </button>
      )}
    </main>
  );
}
