// The hero portrait: an initial monogram in the seat colour (the 3D / Blender portraits replace it later).

import type { Emotion } from '../../characters/reactions';
import type { Hero } from '../../core/types';
import { HEROES, heroName } from '../../game/heroes';

/** Placeholder marks for a seat's current emotion. */
export const EMOTION_MARK: Record<Emotion, string> = {
  idle: '·',
  happy: '☺',
  excited: '✦',
  scared: '!',
  sad: '…',
};

interface PortraitProps {
  hero: Hero;
  /** Disc diameter in px; omit it to size the disc from CSS. */
  size?: number;
  /** Greyed out (an empty seat). */
  empty?: boolean;
  emotion?: Emotion | null;
  className?: string;
}

export function Portrait({ hero, size, empty = false, emotion = null, className }: PortraitProps) {
  const initial = Array.from(heroName(hero))[0] ?? '';
  const mark = emotion && emotion !== 'idle' ? EMOTION_MARK[emotion] : '';
  return (
    <span
      className={`portrait${empty ? ' empty' : ''}${className ? ` ${className}` : ''}`}
      style={{
        ...(size === undefined ? {} : { width: size, height: size, fontSize: size * 0.46 }),
        backgroundColor: empty ? undefined : HEROES[hero].cssColor,
      }}
      aria-hidden="true"
    >
      {!empty && initial}
      {mark && <span className="portrait-mood">{mark}</span>}
    </span>
  );
}
