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
export function reactionsFor(
  event: GameEvent,
  players: readonly SeatedPlayer[],
  random: () => number = Math.random,
): Cue[] {
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
          // A bystander either cheers the mover or comforts whoever was passed.
          return { role: 'other', event: random() < 0.5 ? 'overtake' : 'overtaken' };
        }),
        event.player,
      );
    case 'GameOver': {
      // Losers react to losing; the winner, as the bystander, consoles them.
      const winner = event.ranking[0];
      return cuesForSeats(players, (seat) =>
        seat === winner ? { role: 'other', event: 'lose' } : { role: 'self', event: 'lose' },
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
 * cue is a loser (GameOver) one random loser speaks, and the winner answers as the bystander.
 */
export function pickSpeakers(cues: readonly Cue[], random: () => number = Math.random): Cue[] {
  const selves = cues.filter((c) => c.role === 'self');
  const bystanders = cues.filter((c) => c.role === 'other');
  const speakers =
    selves.length > 0 && selves.every((c) => c.event === 'lose')
      ? [pickOne(selves, random)].filter((c) => c !== undefined)
      : selves.slice(0, 1);
  const bystander = pickOne(bystanders, random);
  return bystander ? [...speakers, bystander] : speakers;
}

/**
 * Delay before a seat starts a reaction scheduled at `now`: the random stagger, but never before the
 * seat's previously scheduled reaction, so back-to-back events play (and speak) in order. Updates
 * `seatStartAt` with the chosen start time.
 */
export function orderedDelay(seatStartAt: number[], seat: number, stagger: number, now: number): number {
  const delay = Math.max(stagger, (seatStartAt[seat] ?? 0) - now + 1);
  seatStartAt[seat] = now + delay;
  return delay;
}
