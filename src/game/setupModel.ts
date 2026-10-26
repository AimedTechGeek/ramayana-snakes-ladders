import type { Controller, GameConfig, Hero, Level } from '../core/types';
import { HERO_ORDER, heroName } from './heroes';

export type SeatController = Controller | 'empty';

export interface SeatModel {
  controller: SeatController;
  hero: Hero;
  name: string;
}

export const MAX_NAME_LENGTH = 12;

function makeSeat(controller: SeatController, hero: Hero): SeatModel {
  return { controller, hero, name: heroName(hero) };
}

export function defaultSeats(): SeatModel[] {
  return [
    makeSeat('human', 'rama'),
    makeSeat('bot', 'hanuman'),
    makeSeat('empty', 'lakshmana'),
    makeSeat('empty', 'sita'),
  ];
}

/** A name still equal to the old hero's name is a default, so it follows the hero. */
function withHero(seat: SeatModel, hero: Hero): SeatModel {
  const name = seat.name === heroName(seat.hero) ? heroName(hero) : seat.name;
  return { ...seat, hero, name };
}

/** Moves one seat to the next/previous hero; if another seat holds it, the two seats swap heroes. */
export function cycleHero(seats: readonly SeatModel[], index: number, dir: 1 | -1): SeatModel[] {
  const current = seats[index];
  if (!current) throw new Error(`No seat at index ${index}`);
  const count = HERO_ORDER.length;
  const position = HERO_ORDER.indexOf(current.hero);
  const target = HERO_ORDER[(position + dir + count) % count];
  if (!target) throw new Error('HERO_ORDER is empty');
  return seats.map((seat, i) => {
    if (i === index) return withHero(seat, target);
    if (seat.hero === target) return withHero(seat, current.hero);
    return seat;
  });
}

export function setController(
  seats: readonly SeatModel[],
  index: number,
  controller: SeatController,
): SeatModel[] {
  return seats.map((seat, i) => (i === index ? { ...seat, controller } : seat));
}

export function setName(seats: readonly SeatModel[], index: number, name: string): SeatModel[] {
  return seats.map((seat, i) => (i === index ? { ...seat, name } : seat));
}

export function canStart(seats: readonly SeatModel[]): boolean {
  return seats.filter((seat) => seat.controller !== 'empty').length >= 2;
}

export function toGameConfig(seats: readonly SeatModel[], level: Level): GameConfig {
  const players = seats.flatMap((seat) =>
    seat.controller === 'empty'
      ? []
      : [
          {
            hero: seat.hero,
            controller: seat.controller,
            name: seat.name.trim() || heroName(seat.hero),
          },
        ],
  );
  return { level, playOn: false, players };
}
