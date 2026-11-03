// The bite choreography on the real DioramaView: the classic bite of T44 5.4 (step lengths +-20 ms of the spec table,
// normal and Fast, the token hidden from the end of the swallow to its reappearance at the tail, reduced motion, every
// hero) and the cinematic close-up of T45.4 (beats +-20 ms, the camera's glides and restore, cancel on a drag, the
// growth scoped to the bite, Fast and reduced motion, the toggle off = the classic bite).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { boardFor } from '../src/core/boards';
import { Game } from '../src/core/game';
import { createSeededDice } from '../src/core/dice';
import type { Hero } from '../src/core/types';
import { newGameReveal } from '../src/game/reveal';
import { DioramaView, type CameraPose } from '../src/app/board3d/DioramaView';
import { squareCentre } from '../src/app/board3d/boardLayout';
import { BITE_DISTANCE, BITE_LIFT, BITE_POLAR, clampTarget } from '../src/app/board3d/cameraConfig';
import { BITE_GROW, CINEMA_FADE_MS, biteTimeline } from '../src/app/board3d/snakeChoreo';

const HEROES: Hero[] = ['rama', 'sita', 'lakshmana', 'hanuman'];
const board = boardFor('hard');
const SNAKE = board.snakes.find((s) => s.id === 'manthara')!; // 37 -> 19

/** The pose the player had before the bite: what the restore must bring back. */
const HOME: CameraPose = { azimuth: 0.4, polar: 0.9, distance: 12, target: [1, 0.2, 2] };

interface FakeCamera {
  glides: { pose: CameraPose; ms: number; at: number }[];
  calls: string[];
}

function fakeCamera(view: DioramaView, t0: () => number): FakeCamera {
  const fake: FakeCamera = { glides: [], calls: [] };
  view.camera = {
    fit: () => fake.calls.push('fit'),
    focus: () => fake.calls.push('focus'),
    set: () => fake.calls.push('set'),
    get: () => ({ ...HOME, target: [...HOME.target!] as [number, number, number] }),
    glide: (pose, ms) => {
      fake.glides.push({ pose, ms, at: performance.now() - t0() });
    },
  };
  return fake;
}

function makeView(hero: Hero, closeUps: boolean): DioramaView {
  const game = Game.create(
    {
      level: 'hard',
      playOn: false,
      players: [
        { hero, controller: 'human', name: 'A' },
        { hero: 'rama', controller: 'human', name: 'B' },
      ],
    },
    board,
    createSeededDice(1),
  );
  const view = new DioramaView();
  const state = game.snapshot();
  state.players[0]!.position = SNAKE.from;
  view.init({ board, state, reveal: newGameReveal() });
  view.snakeLoaded.add(SNAKE.from); // the GLB has mounted
  view.setBiteCloseUps(closeUps);
  return view;
}

interface Trace {
  starts: { clip: string; at: number }[];
  hiddenFrom: number;
  hiddenTo: number;
  arrivedAt: number;
  doneAt: number;
  scaleAtHide: number;
  squareWhileHidden: number;
  /** Sound cues in order, with the clip that was playing when each was cued. */
  cues: { sound: string; at: number }[];
  /** The coil's growth multiplier sampled every poll: [at, grow] (absent growth is 1). */
  grow: [number, number][];
  /** The bitten seat's mood sampled every poll: [at, emotion]. */
  moods: [number, string][];
  /** The board's dim (view.cinema) sampled every poll: [at, on]. */
  cinema: [number, boolean][];
}

/** Plays reveal + bite with fake time, polling every 4 ms; `during(nowMs)` runs on every poll (to drag mid-scene). */
async function run(
  view: DioramaView,
  motion: { fast: boolean; reducedMotion: boolean },
  during?: (now: number) => void,
): Promise<Trace> {
  const trace: Trace = {
    starts: [],
    cues: [],
    hiddenFrom: -1,
    hiddenTo: -1,
    arrivedAt: -1,
    doneAt: -1,
    scaleAtHide: -1,
    squareWhileHidden: -1,
    grow: [],
    moods: [],
    cinema: [],
  };
  const t0 = performance.now();
  const token = view.tokens[0]!;
  let lastStart = -1;
  const poll = (): void => {
    const now = performance.now() - t0;
    const act = view.snakeAct.get(SNAKE.from);
    if (act && act.start !== lastStart) {
      lastStart = act.start;
      trace.starts.push({ clip: act.clip, at: act.start - t0 });
    }
    if (token.hidden && trace.hiddenFrom < 0) {
      trace.hiddenFrom = now;
      trace.scaleAtHide = token.scale;
    }
    if (token.hidden) trace.squareWhileHidden = token.square;
    if (!token.hidden && trace.hiddenFrom >= 0 && trace.hiddenTo < 0) trace.hiddenTo = now;
    trace.grow.push([now, view.snakeGrow.get(SNAKE.from) ?? 1]);
    trace.moods.push([now, view.moods[0]?.emotion ?? 'none']);
    trace.cinema.push([now, view.cinema]);
    during?.(now);
  };
  const arrive = (square: number): void => {
    if (square === SNAKE.to) trace.arrivedAt = performance.now() - t0;
  };
  const cue = (sound: string): void => {
    trace.cues.push({ sound, at: performance.now() - t0 });
  };
  await view.reveal([{ kind: 'jump', jumpId: SNAKE.from, jumpType: 'snake' }], motion, cue);
  const done = view.bite(0, SNAKE, motion, arrive, cue).then(() => {
    trace.doneAt = performance.now() - t0;
  });
  for (let i = 0; i < 3000 && trace.doneAt < 0; i++) {
    await vi.advanceTimersByTimeAsync(4);
    poll();
  }
  await done;
  return trace;
}

const startOf = (trace: Trace, clip: string): number => trace.starts.find((s) => s.clip === clip)!.at;
/** Every beat is within 20 ms; the whole scene may drift one 16 ms frame per beat (nine frame-quantised tweens). */
const WHOLE_SCENE_TOLERANCE = 60;
const near = (a: number, b: number, tolerance = 20): void => {
  expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tolerance);
};
/** The samples of a per-poll series between two times (ms since the bite began). */
const between = <T>(series: [number, T][], from: number, to: number): T[] =>
  series.filter(([at]) => at >= from && at < to).map(([, value]) => value);

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Snake bite (T44 5.4), close-ups off', () => {
  it('Timeline_(NormalAndFast)_ShouldBeTheSpecTable', () => {
    const steps = biteTimeline({ fast: false, reducedMotion: false, firstTime: true });
    expect(steps.map((s) => [s.name, s.ms])).toEqual([
      ['rise', 380],
      ['hold', 260],
      ['strike', 180],
      ['swallow', 320],
      ['settle', 220],
      ['reappear', 260],
    ]);
    const fast = biteTimeline({ fast: true, reducedMotion: false, firstTime: false });
    expect(fast.map((s) => [s.name, s.ms])).toEqual([
      ['hold', 0],
      ['strike', 50],
      ['swallow', 80],
      ['settle', 0],
      ['reappear', 60],
    ]); // T44.14: half of spec 5.4's Fast column
  });

  it.each(HEROES)('Bite_(%s,Normal)_ShouldRunEveryBeatWithin20msOfTheSpec', async (hero) => {
    const view = makeView(hero, false);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.starts.map((s) => s.clip)).toEqual(['rise', 'hold', 'strike', 'swallow', 'settle']);
    near(startOf(trace, 'hold') - startOf(trace, 'rise'), 380);
    near(startOf(trace, 'strike') - startOf(trace, 'hold'), 260);
    near(startOf(trace, 'swallow') - startOf(trace, 'strike'), 180);
    near(startOf(trace, 'settle') - startOf(trace, 'swallow'), 320);
    near(trace.arrivedAt - startOf(trace, 'settle'), 220);
    near(trace.doneAt - trace.arrivedAt, 260);
  });

  it.each(HEROES)('Bite_(%s)_ShouldHideTheTokenFromTheSwallowsEndUntilItReappearsAtTheTail', async (hero) => {
    const view = makeView(hero, false);
    const token = view.tokens[0]!;
    expect(token.hidden).toBe(false);
    const trace = await run(view, { fast: false, reducedMotion: false });
    near(trace.hiddenFrom, startOf(trace, 'swallow') + 320);
    expect(trace.scaleAtHide).toBeLessThanOrEqual(0.11); // shrunk to 0.1 as it entered the mouth
    // hidden for the whole settle (220 ms), visible again when the tail square receives it
    expect(Math.abs(trace.hiddenTo - trace.arrivedAt)).toBeLessThanOrEqual(8);
    expect(trace.hiddenTo - trace.hiddenFrom).toBeGreaterThanOrEqual(200);
    expect(trace.squareWhileHidden).toBe(SNAKE.from); // not yet on the tail
    expect(token.hidden).toBe(false);
    expect(token.square).toBe(SNAKE.to);
    expect(token.scale).toBe(1);
    expect(view.snakeAct.has(SNAKE.from)).toBe(false); // idle again
  });

  it('Bite_(FastAlreadyRevealed)_ShouldTakeUnderAThirdOfASecondWithNoHoldOrSettle', async () => {
    const view = makeView('hanuman', false);
    view.jumpRise.set(SNAKE.from, 1); // revealed on an earlier turn
    const trace = await run(view, { fast: true, reducedMotion: false });
    expect(trace.starts.map((s) => s.clip)).toEqual(['strike', 'swallow']);
    near(startOf(trace, 'swallow') - startOf(trace, 'strike'), 50);
    near(trace.arrivedAt - startOf(trace, 'swallow'), 80);
    expect(trace.doneAt).toBeLessThan(300);
  });

  it('Bite_(FirstTime)_ShouldCueHissStrikeGulpAndPopOnTheirBeats', async () => {
    const view = makeView('rama', false);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.cues.map((c) => c.sound)).toEqual(['hiss', 'strike', 'gulp', 'pop']);
    const at = (sound: string): number => trace.cues.find((c) => c.sound === sound)!.at;
    near(at('strike'), startOf(trace, 'strike'));
    near(at('gulp'), startOf(trace, 'swallow'));
    near(at('pop'), trace.arrivedAt);
  });

  it('Bite_(ReducedMotion)_ShouldPlaceTheTokenAtTheTailWithoutFlourish', async () => {
    const view = makeView('sita', false);
    const trace = await run(view, { fast: false, reducedMotion: true });
    expect(trace.doneAt).toBeLessThan(80);
    const token = view.tokens[0]!;
    expect(token.hidden).toBe(false);
    expect(token.square).toBe(SNAKE.to);
    expect(token.scale).toBe(1);
    expect(view.snakePending.has(SNAKE.from)).toBe(false);
  });

  it('Bite_(SnakeNeverLoads)_ShouldStillHideAndReappearTheToken', async () => {
    const view = makeView('rama', false);
    view.snakeLoaded.delete(SNAKE.from);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.hiddenFrom).toBeGreaterThan(1400); // waited for the GLB, then gave up
    expect(view.tokens[0]!.square).toBe(SNAKE.to);
    expect(view.tokens[0]!.hidden).toBe(false);
  });

  it('Bite_(CloseUpsOff)_ShouldNeverMoveTheCameraGrowTheCoilOrDimTheBoard', async () => {
    const view = makeView('hanuman', false);
    const camera = fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(camera.glides).toEqual([]);
    expect(camera.calls).toEqual([]);
    expect(trace.grow.every(([, g]) => g === 1)).toBe(true);
    expect(trace.cinema.every(([, on]) => !on)).toBe(true);
  });
});

describe('Cinematic bite (T45.4), close-ups on', () => {
  // the look-at point is clamped to the pan box like every camera target (square 37 sits on the board's right edge)
  const headCentre = clampTarget(new Vector3(squareCentre(SNAKE.from)[0], 0, squareCentre(SNAKE.from)[1]));
  const tailCentre = clampTarget(new Vector3(squareCentre(SNAKE.to)[0], 0, squareCentre(SNAKE.to)[1]));

  it('Timeline_(CloseUps)_ShouldBeTheT45Table', () => {
    const revealed = biteTimeline({ fast: false, reducedMotion: false, firstTime: false, closeUps: true });
    expect(revealed.map((s) => [s.name, s.ms])).toEqual([
      ['focus', 700],
      ['grow', 700],
      ['strike', 300],
      ['swallow', 600],
      ['settle', 600],
      ['toTail', 400],
      ['reappear', 300],
      ['restore', 600],
    ]);
    expect(revealed.reduce((sum, s) => sum + s.ms, 0)).toBe(4200);
    // the first-time rise plays inside the focus glide: the scene keeps its length
    const first = biteTimeline({ fast: false, reducedMotion: false, firstTime: true, closeUps: true });
    expect(first.map((s) => [s.name, s.ms])).toEqual([
      ['focus', 320],
      ['rise', 380],
      ['grow', 700],
      ['strike', 300],
      ['swallow', 600],
      ['settle', 600],
      ['toTail', 400],
      ['reappear', 300],
      ['restore', 600],
    ]);
    expect(first.reduce((sum, s) => sum + s.ms, 0)).toBe(4200);
  });

  it('Timeline_(CloseUpsInFast)_ShouldBeTodaysFastBite', () => {
    const fast = biteTimeline({ fast: true, reducedMotion: false, firstTime: true, closeUps: true });
    expect(fast).toEqual(biteTimeline({ fast: true, reducedMotion: false, firstTime: true, closeUps: false }));
    expect(fast.map((s) => s.name)).not.toContain('focus');
  });

  it('Timeline_(CloseUpsUnderReducedMotion)_ShouldFadeTheDimAndKeepEveryOtherBeatInstant', () => {
    const steps = biteTimeline({ fast: false, reducedMotion: true, firstTime: true, closeUps: true });
    expect(steps.map((s) => [s.name, s.ms])).toEqual([
      ['focus', CINEMA_FADE_MS],
      ['rise', 0],
      ['grow', 0],
      ['strike', 0],
      ['swallow', 0],
      ['settle', 0],
      ['toTail', 0],
      ['reappear', 0],
      ['restore', CINEMA_FADE_MS],
    ]);
  });

  it.each(HEROES)('Bite_(%s,FirstTime)_ShouldPlayEveryBeatWithin20msOfTheTable', async (hero) => {
    const view = makeView(hero, true);
    fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.starts.map((s) => s.clip)).toEqual(['rise', 'hold', 'strike', 'swallow', 'settle']);
    near(startOf(trace, 'rise'), 320); // the focus glide runs on while the coil rises
    near(startOf(trace, 'hold') - startOf(trace, 'rise'), 380); // grow: the hold clip over 700 ms
    near(startOf(trace, 'strike') - startOf(trace, 'hold'), 700);
    near(startOf(trace, 'swallow') - startOf(trace, 'strike'), 300);
    near(startOf(trace, 'settle') - startOf(trace, 'swallow'), 600);
    near(trace.arrivedAt - startOf(trace, 'settle'), 600 + 400); // settle, then the glide to the tail
    near(trace.doneAt - trace.arrivedAt, 300 + 600); // reappear, then the restore glide
    near(trace.doneAt, 4200, WHOLE_SCENE_TOLERANCE);
  });

  it('Bite_(Revealed)_ShouldFocusForTheWholeBeatBeforeTheCoilGrows', async () => {
    const view = makeView('rama', true);
    view.jumpRise.set(SNAKE.from, 1);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.starts.map((s) => s.clip)).toEqual(['hold', 'strike', 'swallow', 'settle']);
    near(startOf(trace, 'hold'), 700);
    near(trace.doneAt, 4200, WHOLE_SCENE_TOLERANCE);
  });

  it.each(HEROES)('Bite_(%s)_ShouldHideTheTokenFromTheMouthUntilItReappearsAtTheTail', async (hero) => {
    const view = makeView(hero, true);
    fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: false });
    // into the mouth over the first 55 % of the swallow; the jaw closes and the bulge travels over the rest
    near(trace.hiddenFrom, startOf(trace, 'swallow') + 0.55 * 600, 24);
    expect(trace.scaleAtHide).toBeLessThanOrEqual(0.11);
    expect(Math.abs(trace.hiddenTo - trace.arrivedAt)).toBeLessThanOrEqual(8);
    expect(trace.squareWhileHidden).toBe(SNAKE.to); // the tail square is set as the camera leaves the head
    const token = view.tokens[0]!;
    expect(token.hidden).toBe(false);
    expect(token.square).toBe(SNAKE.to);
    expect(token.scale).toBe(1);
    expect(view.snakeAct.has(SNAKE.from)).toBe(false);
  });

  it('Bite_(CloseUps)_ShouldGlideToTheHeadThenTheTailThenRestoreThePlayersPose', async () => {
    const view = makeView('hanuman', true);
    const camera = fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(camera.calls).toEqual([]); // never Fit, Focus or set: only glides
    expect(camera.glides).toHaveLength(3);
    const [head, tail, home] = camera.glides as [FakeCamera['glides'][0], FakeCamera['glides'][0], FakeCamera['glides'][0]];
    // 1. to the head block, over the whole focus beat (rise included), the player's azimuth kept
    near(head.at, 0);
    expect(head.ms).toBe(700);
    expect(head.pose.azimuth).toBe(HOME.azimuth);
    expect(head.pose.polar).toBeCloseTo(BITE_POLAR, 6);
    expect(head.pose.distance).toBe(BITE_DISTANCE);
    expect(head.pose.target![0]).toBeCloseTo(headCentre.x, 6);
    expect(head.pose.target![2]).toBeCloseTo(headCentre.z, 6);
    expect(head.pose.target![1]).toBeGreaterThan(BITE_LIFT - 0.01); // above the block top
    // 2. to the tail square, after the settle
    near(tail.at, startOf(trace, 'settle') + 600);
    expect(tail.ms).toBe(400);
    expect(tail.pose.target![0]).toBeCloseTo(tailCentre.x, 6);
    expect(tail.pose.target![2]).toBeCloseTo(tailCentre.z, 6);
    expect(tail.pose.azimuth).toBe(HOME.azimuth);
    // 3. back to exactly the pose the player had, after the reappearance
    near(home.at, trace.arrivedAt + 300);
    expect(home.ms).toBe(600);
    expect(home.pose).toEqual(HOME);
  });

  it('Bite_(CloseUps)_ShouldDimTheBoardFromTheFocusUntilTheRestoreBegins', async () => {
    const view = makeView('sita', true);
    fakeCamera(view, () => 0);
    expect(view.cinema).toBe(false);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(between(trace.cinema, 0, trace.arrivedAt + 300).every((on) => on)).toBe(true);
    expect(between(trace.cinema, trace.arrivedAt + 320, trace.doneAt).every((on) => !on)).toBe(true);
    expect(view.cinema).toBe(false);
  });

  it('Bite_(CloseUps)_ShouldGrowTheCoilTo1p6OnlyFromTheGrowBeatToTheEndOfTheSettle_R9Exception', async () => {
    // Owner exception to R9 (2026-11-03): the grown head may rise above the hero while it bites, nowhere else.
    const view = makeView('rama', true);
    fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: false });
    const grow = startOf(trace, 'hold');
    const settleEnd = startOf(trace, 'settle') + 600;
    expect(between(trace.grow, 0, grow).every((g) => g === 1)).toBe(true); // nothing before the grow beat
    const during = between(trace.grow, grow, settleEnd);
    expect(Math.max(...during)).toBeCloseTo(BITE_GROW, 2);
    expect(Math.max(...during)).toBeLessThanOrEqual(BITE_GROW);
    // eased up through the grow beat, full size from the strike to the start of the settle, eased down to 1
    expect(between(trace.grow, grow + 100, grow + 600).every((g) => g > 1 && g < BITE_GROW)).toBe(true);
    expect(between(trace.grow, startOf(trace, 'strike'), startOf(trace, 'settle')).every((g) => g > BITE_GROW - 0.01)).toBe(true);
    expect(between(trace.grow, settleEnd + 8, trace.doneAt).every((g) => g === 1)).toBe(true);
    expect(view.snakeGrow.size).toBe(0);
  });

  it('Bite_(CloseUps)_ShouldKeepTheHeroScaredWhileTheCoilGrowsAndSadWhenItReappears', async () => {
    const view = makeView('lakshmana', true);
    fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: false });
    const grow = startOf(trace, 'hold');
    expect(between(trace.moods, grow + 8, startOf(trace, 'swallow')).every((m) => m === 'scared')).toBe(true);
    expect(between(trace.moods, trace.arrivedAt + 8, trace.doneAt).every((m) => m === 'sad')).toBe(true);
  });

  it('Bite_(CloseUps,FirstTime)_ShouldCueHissAsTheCoilRisesThenStrikeGulpAndPop', async () => {
    const view = makeView('rama', true);
    fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.cues.map((c) => c.sound)).toEqual(['hiss', 'strike', 'gulp', 'pop']);
    const at = (sound: string): number => trace.cues.find((c) => c.sound === sound)!.at;
    near(at('hiss'), startOf(trace, 'rise'));
    near(at('strike'), startOf(trace, 'strike'));
    near(at('gulp'), startOf(trace, 'swallow'));
    near(at('pop'), trace.arrivedAt);
  });

  it('Bite_(PlayerDragsDuringTheScene)_ShouldStopTheCameraAtOnceAndFinishTheBiteInPlace', async () => {
    const view = makeView('hanuman', true);
    const camera = fakeCamera(view, () => 0);
    let dragged = -1;
    const trace = await run(view, { fast: false, reducedMotion: false }, (now) => {
      if (now >= 1200 && dragged < 0) {
        dragged = now;
        view.cancelCamera(); // what the rig calls on controlstart, wheel, keys, Fit and Focus
      }
    });
    expect(camera.glides).toHaveLength(1); // the focus glide only: no glide to the tail, no restore
    expect(view.cinema).toBe(false);
    expect(between(trace.cinema, dragged + 8, trace.doneAt).every((on) => !on)).toBe(true); // the dim went at once
    // the animation itself finished in place, on its own beats
    expect(trace.starts.map((s) => s.clip)).toEqual(['rise', 'hold', 'strike', 'swallow', 'settle']);
    near(trace.doneAt, 4200, WHOLE_SCENE_TOLERANCE);
    expect(view.tokens[0]!.square).toBe(SNAKE.to);
    expect(view.tokens[0]!.hidden).toBe(false);
    expect(view.snakeGrow.size).toBe(0);
  });

  it('Bite_(PlayerDraggedBeforeTheScene)_ShouldStillGlideThisTime', async () => {
    const view = makeView('hanuman', true);
    const camera = fakeCamera(view, () => 0);
    view.cancelCamera(); // an earlier drag is not this bite's
    await run(view, { fast: false, reducedMotion: false });
    expect(camera.glides).toHaveLength(3);
  });

  it('Bite_(CloseUpsInFast)_ShouldBeTodaysShortBiteWithNoCameraGrowthOrDim', async () => {
    const view = makeView('hanuman', true);
    const camera = fakeCamera(view, () => 0);
    view.jumpRise.set(SNAKE.from, 1);
    const trace = await run(view, { fast: true, reducedMotion: false });
    expect(trace.starts.map((s) => s.clip)).toEqual(['strike', 'swallow']);
    expect(trace.doneAt).toBeLessThan(300);
    expect(camera.glides).toEqual([]);
    expect(trace.grow.every(([, g]) => g === 1)).toBe(true);
    expect(trace.cinema.every(([, on]) => !on)).toBe(true);
  });

  it('Bite_(CloseUpsUnderReducedMotion)_ShouldFadeTheDimInAndOutWithNoCameraOrGrowth', async () => {
    const view = makeView('sita', true);
    const camera = fakeCamera(view, () => 0);
    const trace = await run(view, { fast: false, reducedMotion: true });
    expect(camera.glides).toEqual([]);
    expect(trace.grow.every(([, g]) => g === 1)).toBe(true);
    near(trace.doneAt, 2 * CINEMA_FADE_MS);
    expect(between(trace.cinema, 0, CINEMA_FADE_MS - 8).every((on) => on)).toBe(true);
    expect(between(trace.cinema, CINEMA_FADE_MS + 8, trace.doneAt).every((on) => !on)).toBe(true);
    near(trace.arrivedAt, CINEMA_FADE_MS); // the beats themselves are instant
    const token = view.tokens[0]!;
    expect(token.hidden).toBe(false);
    expect(token.square).toBe(SNAKE.to);
    expect(token.scale).toBe(1);
  });

  it('Bite_(NoCameraRigMounted)_ShouldStillPlayTheSceneWithoutMoving', async () => {
    const view = makeView('rama', true);
    expect(view.camera).toBeNull();
    const trace = await run(view, { fast: false, reducedMotion: false });
    near(trace.doneAt, 4200, WHOLE_SCENE_TOLERANCE);
    expect(Math.max(...trace.grow.map(([, g]) => g))).toBeCloseTo(BITE_GROW, 2);
    expect(view.tokens[0]!.square).toBe(SNAKE.to);
  });
});
