// The bite choreography of T44 5.4 on the real DioramaView: step lengths (+-20 ms of the spec table, normal and Fast),
// the token hidden from the end of the swallow to its reappearance at the tail, Fast and reduced motion, every hero.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boardFor } from '../src/core/boards';
import { Game } from '../src/core/game';
import { createSeededDice } from '../src/core/dice';
import type { Hero } from '../src/core/types';
import { newGameReveal } from '../src/game/reveal';
import { DioramaView } from '../src/app/board3d/DioramaView';
import { biteTimeline } from '../src/app/board3d/snakeChoreo';

const HEROES: Hero[] = ['rama', 'sita', 'lakshmana', 'hanuman'];
const board = boardFor('hard');
const SNAKE = board.snakes.find((s) => s.id === 'manthara')!; // 37 -> 19

function makeView(hero: Hero): DioramaView {
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
}

/** Plays reveal + bite with fake time, polling every 4 ms. */
async function run(view: DioramaView, motion: { fast: boolean; reducedMotion: boolean }): Promise<Trace> {
  const trace: Trace = {
    starts: [],
    cues: [],
    hiddenFrom: -1,
    hiddenTo: -1,
    arrivedAt: -1,
    doneAt: -1,
    scaleAtHide: -1,
    squareWhileHidden: -1,
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

describe('Snake bite (T44 5.4)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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
    const view = makeView(hero);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.starts.map((s) => s.clip)).toEqual(['rise', 'hold', 'strike', 'swallow', 'settle']);
    expect(Math.abs(startOf(trace, 'hold') - startOf(trace, 'rise') - 380)).toBeLessThanOrEqual(20);
    expect(Math.abs(startOf(trace, 'strike') - startOf(trace, 'hold') - 260)).toBeLessThanOrEqual(20);
    expect(Math.abs(startOf(trace, 'swallow') - startOf(trace, 'strike') - 180)).toBeLessThanOrEqual(20);
    expect(Math.abs(startOf(trace, 'settle') - startOf(trace, 'swallow') - 320)).toBeLessThanOrEqual(20);
    expect(Math.abs(trace.arrivedAt - startOf(trace, 'settle') - 220)).toBeLessThanOrEqual(20);
    expect(Math.abs(trace.doneAt - trace.arrivedAt - 260)).toBeLessThanOrEqual(20);
  });

  it.each(HEROES)('Bite_(%s)_ShouldHideTheTokenFromTheSwallowsEndUntilItReappearsAtTheTail', async (hero) => {
    const view = makeView(hero);
    const token = view.tokens[0]!;
    expect(token.hidden).toBe(false);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(Math.abs(trace.hiddenFrom - (startOf(trace, 'swallow') + 320))).toBeLessThanOrEqual(20);
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
    const view = makeView('hanuman');
    view.jumpRise.set(SNAKE.from, 1); // revealed on an earlier turn
    const trace = await run(view, { fast: true, reducedMotion: false });
    expect(trace.starts.map((s) => s.clip)).toEqual(['strike', 'swallow']);
    expect(Math.abs(startOf(trace, 'swallow') - startOf(trace, 'strike') - 50)).toBeLessThanOrEqual(20);
    expect(Math.abs(trace.arrivedAt - startOf(trace, 'swallow') - 80)).toBeLessThanOrEqual(20);
    expect(trace.doneAt).toBeLessThan(300);
  });

  it('Bite_(FirstTime)_ShouldCueHissStrikeGulpAndPopOnTheirBeats', async () => {
    const view = makeView('rama');
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.cues.map((c) => c.sound)).toEqual(['hiss', 'strike', 'gulp', 'pop']);
    const at = (sound: string): number => trace.cues.find((c) => c.sound === sound)!.at;
    expect(Math.abs(at('strike') - startOf(trace, 'strike'))).toBeLessThanOrEqual(20);
    expect(Math.abs(at('gulp') - startOf(trace, 'swallow'))).toBeLessThanOrEqual(20);
    expect(Math.abs(at('pop') - trace.arrivedAt)).toBeLessThanOrEqual(20);
  });

  it('Bite_(ReducedMotion)_ShouldPlaceTheTokenAtTheTailWithoutFlourish', async () => {
    const view = makeView('sita');
    const trace = await run(view, { fast: false, reducedMotion: true });
    expect(trace.doneAt).toBeLessThan(80);
    const token = view.tokens[0]!;
    expect(token.hidden).toBe(false);
    expect(token.square).toBe(SNAKE.to);
    expect(token.scale).toBe(1);
    expect(view.snakePending.has(SNAKE.from)).toBe(false);
  });

  it('Bite_(SnakeNeverLoads)_ShouldStillHideAndReappearTheToken', async () => {
    const view = makeView('rama');
    view.snakeLoaded.delete(SNAKE.from);
    const trace = await run(view, { fast: false, reducedMotion: false });
    expect(trace.hiddenFrom).toBeGreaterThan(1400); // waited for the GLB, then gave up
    expect(view.tokens[0]!.square).toBe(SNAKE.to);
    expect(view.tokens[0]!.hidden).toBe(false);
  });
});
