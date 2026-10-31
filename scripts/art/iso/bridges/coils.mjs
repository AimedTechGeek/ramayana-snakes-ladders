// Stand-in volumes of the standing snake coils (T42 spec 5.1 table, 5.2 placement) that the bridges must clear. The
// real coils are drawn by T42.5; the bridges only need their envelope: the coil cylinder and the raised head cylinder.
import { STORY_JUMPS } from '../../../../src/core/boards.ts';
import { squareWorld } from '../../iso-board.mjs';
import { TOP_Z } from '../world.mjs';

/** Body radius R per snake (T42 spec 5.1 size table). */
const SNAKE_RADIUS = {
  tataka: 2.8,
  manthara: 2.2,
  kaikeyi: 2.8,
  viradha: 3.0,
  shurpanakha: 2.8,
  'golden-deer': 2.8,
  abduction: 3.0,
  kabandha: 3.0,
  'indrajit-arrows': 2.6,
  prahasta: 3.0,
  kumbhakarna: 3.4,
  brahmastra: 2.2,
  ravana: 4.0,
};

/** Coil envelope of spec 5.1 for a body radius R: outer radius, stack height 5R and head top over TOP_Z. */
export function coilEnvelope(R) {
  const outer = R <= 2.2 ? 10.2 : R <= 3.0 ? 11.5 : R <= 3.4 ? 12.4 : 14.0;
  const head = R <= 2.2 ? 29 : R <= 3.0 ? 33.5 : R <= 3.4 ? 36 : 42;
  return { outer, head, stack: 5 * R };
}

/** The two volumes of the snake `id` standing on its head square: the coil and the raised head (spec 5.2: centre cy - 14). */
export function coilVolumes(id, square) {
  const R = SNAKE_RADIUS[id];
  const { outer, head, stack } = coilEnvelope(R);
  const [cx, cy] = squareWorld(square);
  const centre = [cx, cy - 14];
  return {
    id,
    R,
    square,
    centre,
    outer,
    top: TOP_Z + stack,
    volumes: [
      // A frustum: the stacked turns go from r_h to r_h - 2 at the top (spec 5.1 C3), so the top is 2 narrower.
      { name: `${id}.coil`, c: centre, r: outer, rTop: outer - 2, z0: TOP_Z, z1: TOP_Z + stack },
      {
        name: `${id}.head`,
        c: [centre[0] - 6, centre[1] - 6],
        r: 1.6 * R,
        z0: TOP_Z + stack,
        z1: TOP_Z + head,
      },
    ],
  };
}

/** Every snake of the board (all levels), so one bridge geometry serves every level. */
export const allCoils = () =>
  STORY_JUMPS.filter((j) => j.kind === 'snake').map((j) => coilVolumes(j.id, j.from));
