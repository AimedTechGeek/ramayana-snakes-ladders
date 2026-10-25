import type { GameEvent } from '../core/events';
import type { Hero } from '../core/types';
import type { ReactionEvent, Role } from './reactions';

export interface Cue {
  seat: number;
  role: Role;
  event: ReactionEvent;
}

export interface SeatedPlayer {
  hero: Hero;
  rank: number | null;
}

/** One cue per seated player, mover or winner first; retired players still react (T05 step 1). */
function cuesForSeats(
  players: readonly SeatedPlayer[],
  eventFor: (seat: number) => { role: Role; event: ReactionEvent },
): Cue[] {
  return players.map((_, seat) => ({ seat, ...eventFor(seat) }));
}

function putFirst(cues: Cue[], seat: number): Cue[] {
  return [...cues.filter((c) => c.seat === seat), ...cues.filter((c) => c.seat !== seat)];
}

/** Maps an engine event to the reaction every seated hero plays (T05 section 1, steps 1-2). */
export function reactionsFor(event: GameEvent, players: readonly SeatedPlayer[]): Cue[] {
  const everyoneSees = (name: ReactionEvent, mover: number): Cue[] =>
    putFirst(
      cuesForSeats(players, (seat) => ({ role: seat === mover ? 'self' : 'other', event: name })),
      mover,
    );

  switch (event.type) {
    case 'ExtraRoll':
      return everyoneSees('roll6', event.player);
    case 'Laddered':
      return everyoneSees(event.big ? 'ladderBig' : 'ladder', event.player);
    case 'Bitten':
      return everyoneSees(event.big ? 'snakeBig' : 'snake', event.player);
    case 'NearMiss':
      return everyoneSees('nearMiss', event.player);
    case 'NearEnd':
      return everyoneSees('waiting', event.player);
    case 'TripleSixVoid':
      return everyoneSees('tripleSix', event.player);
    case 'Won':
      return everyoneSees('win', event.player);
    case 'Overtook':
      return putFirst(
        cuesForSeats(players, (seat) => {
          if (seat === event.player) return { role: 'self', event: 'overtake' };
          if (event.overtaken.includes(seat)) return { role: 'self', event: 'overtaken' };
          return { role: 'other', event: 'overtake' };
        }),
        event.player,
      );
    case 'GameOver': {
      const winner = event.ranking[0];
      return cuesForSeats(players, () => ({ role: 'self', event: 'lose' })).filter(
        (cue) => cue.seat !== winner,
      );
    }
    default:
      return [];
  }
}

function pickOne<T>(items: readonly T[], random: () => number): T | undefined {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/**
 * Who shows a speech bubble: the mover (first self cue) plus one random bystander. When every self
 * cue is a loser (GameOver) one random loser speaks instead, and the winner stays silent.
 */
export function pickSpeakers(cues: readonly Cue[], random: () => number = Math.random): Cue[] {
  const selves = cues.filter((c) => c.role === 'self');
  const bystanders = cues.filter((c) => c.role === 'other');
  if (selves.length > 0 && selves.every((c) => c.event === 'lose')) {
    return [pickOne(selves, random)].filter((c) => c !== undefined);
  }
  const speakers = selves.slice(0, 1);
  const bystander = pickOne(bystanders, random);
  return bystander ? [...speakers, bystander] : speakers;
}
