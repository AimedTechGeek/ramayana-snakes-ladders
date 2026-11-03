// The HUD overlay over the 3D canvas: brand, seat cards, turn banner and hint, speech bubbles, the toolbar (camera,
// Fast, Mute, language, Menu) and the Roll pill. The overlay root lets pointer events through to the canvas; only
// its controls take them.

import { useSyncExternalStore } from 'react';
import type { Level } from '../../core/types';
import { HEROES } from '../../game/heroes';
import { t } from '../../i18n/i18n';
import type { DioramaView } from '../board3d/DioramaView';
import { IconButton, Pill, Sparkle } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import type { ScreenPoint } from './bubbleLayout';
import { ChapterCard } from './ChapterCard';
import type { HudState } from './HudStore';
import { SeatCard } from './SeatCard';
import { SpeechBubbles } from './SpeechBubbles';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** The CSS die face: the fallback while the 3D die is not in the scene (the Roll pill shows the last value). */
export function Die({ value }: { value: number }) {
  const on = PIPS[value] ?? [];
  return (
    <span className="die-face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.includes(i) ? 'pip on' : 'pip'} />
      ))}
    </span>
  );
}

/**
 * Bubbles float over their token's head (the canvas projects the anchors ~10 times a second while one shows); a seat
 * whose token is off screen or still waiting falls back to its card. Only this subtree re-renders with the anchors.
 */
function AnchoredBubbles({
  view,
  anchors,
}: {
  view: DioramaView;
  anchors?: readonly (ScreenPoint | null | undefined)[];
}) {
  const projected = useSyncExternalStore(view.subscribeAnchors, () => view.anchors);
  return <SpeechBubbles bubbles={view.bubbles} anchors={anchors ?? projected} />;
}

export interface HudProps {
  hud: HudState;
  view: DioramaView;
  /** Bot difficulty for the seat cards' controller tag. */
  level?: Level;
  /**
   * Speech-bubble anchors, one per seat: the token's head projected to viewport pixels. Without them bubbles open
   * beside the seat cards. Re-render with fresh points to follow a moving token.
   */
  bubbleAnchors?: readonly (ScreenPoint | null | undefined)[];
  onRoll: () => void;
  onFast: () => void;
  onMute: () => void;
  onMenu: () => void;
  onFit: () => void;
  onFocus: () => void;
  onLanguage: () => void;
}

export function Hud({
  hud,
  view,
  level,
  bubbleAnchors,
  onRoll,
  onFast,
  onMute,
  onMenu,
  onFit,
  onFocus,
  onLanguage,
}: HudProps) {
  const { dice } = hud;
  const speaker = hud.seats[hud.current];
  // The triple-six notice is a toast; the hint line does not repeat it.
  const hint = hud.hint === t('ui.tripleSix') ? '' : hud.hint;
  const six = !dice.rolling && dice.value === 6 && dice.roll > 0;
  return (
    <div className="hud" data-testid="hud">
      <div className="brand" aria-hidden="true">
        <Sparkle />
        {t('ui.brand')}
        <Sparkle />
      </div>

      <ol className="seat-cards" data-fit-reserve>
        {hud.seats.map((seat, i) => (
          <SeatCard
            key={i}
            seat={seat}
            index={i}
            active={hud.current === i}
            mood={view.moods[i]?.emotion ?? null}
            level={level}
          />
        ))}
      </ol>

      <div className="turn-panel" data-fit-reserve>
        <div className="banner glass" data-testid="banner">
          {speaker && <span className="banner-dot" style={{ background: HEROES[speaker.hero].cssColor }} />}
          {hud.banner}
        </div>
        {hint && <div className="hint">{hint}</div>}
      </div>

      <AnchoredBubbles view={view} anchors={bubbleAnchors} />

      <ChapterCard chapter={hud.chapter} />

      <div className="toolbar" data-fit-reserve>
        <IconButton icon="fit" label={t('ui.fit')} caption data-testid="fit" onClick={onFit} />
        <IconButton icon="focus" label={t('ui.focus')} caption data-testid="focus" onClick={onFocus} />
        <IconButton
          icon={hud.fast ? 'fast' : 'normal'}
          label={t('ui.fast')}
          caption
          pressed={hud.fast}
          data-testid="fast"
          onClick={onFast}
        />
        <IconButton
          icon={hud.muted ? 'speaker-off' : 'speaker'}
          label={t('ui.mute')}
          caption
          pressed={hud.muted}
          data-testid="mute"
          onClick={onMute}
        />
        <IconButton
          icon="globe"
          label={t('ui.language')}
          caption
          data-testid="hud-language"
          onClick={onLanguage}
        />
        <IconButton icon="menu" label={t('ui.menu')} caption data-testid="menu" onClick={onMenu} />
      </div>

      <Pill
        key={dice.roll}
        variant="primary"
        className={`roll${hud.diceEnabled ? ' ready' : ''}${dice.rolling ? ' rolling' : ''}${six ? ' six' : ''}`}
        data-testid="dice"
        data-fit-reserve
        aria-label={`${t('ui.roll')}. ${t('ui.rollHint')}`}
        disabled={!hud.diceEnabled}
        onClick={onRoll}
      >
        {dice.roll > 0 && !dice.rolling ? (
          <span className="roll-die">
            <Die value={dice.value} />
          </span>
        ) : (
          <Icon name="roll" size={22} className="roll-icon" />
        )}
        {t('ui.roll')}
      </Pill>
    </div>
  );
}
