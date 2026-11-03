// The named stages (T46.5): the stage table against the board's regions, the chapter-card timings and the i18n.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAPTER_FAST_MS, CHAPTER_MS, HudStore } from '../src/app/hud/HudStore';
import { plaqueSpots } from '../src/app/board3d/plaqueLayout';
import { PLINTH_HALF, RIM_HALF, SLAB_HALF, blockTopY } from '../src/app/board3d/boardLayout';
import type { GameState } from '../src/core/types';
import { FINAL_SQUARE, regionOf } from '../src/game/board/blockRules';
import { STAGES, STAGE_IDS, seedStages, stageKey, stageOf } from '../src/game/stages';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import { setLocale, t } from '../src/i18n/i18n';

const enTable: Record<string, unknown> = en;
const hiTable: Record<string, unknown> = hi;

function stateAt(positions: number[], won = false): GameState {
  return {
    level: 'easy',
    playOn: false,
    players: positions.map((position, i) => ({
      hero: 'rama',
      controller: 'human',
      name: `P${i}`,
      position,
      rank: won && i === 0 ? 1 : null,
    })),
    current: 0,
    sixesThisTurn: 0,
    turnStartPosition: 0,
    over: false,
  };
}

describe('stage table', () => {
  it('Stages_Should_CoverSquares1To144ExactlyOnceInBoardOrder', () => {
    const covered: number[] = [];
    for (const stage of STAGES) for (let s = stage.from; s <= stage.to; s++) covered.push(s);
    expect(covered).toEqual(Array.from({ length: FINAL_SQUARE }, (_, i) => i + 1));
  });

  it('EverySquaresStage_Should_SpanTheRegionRegionOfGivesIt', () => {
    for (let square = 1; square <= FINAL_SQUARE; square++) {
      const stage = STAGES.find((candidate) => candidate.id === stageOf(square))!;
      expect(stage.regions, `square ${square}`).toContain(regionOf(square));
    }
  });

  it('EachRegionStage_Should_StartWhereItsRegionStarts', () => {
    // Mithila 2 (1 is the gate), Ayodhya 37, Dandaka 49 (the Ganga crossing inside it), Kishkindha 85, sea 109, Lanka 121
    expect(STAGES.map((stage) => [stage.id, stage.from])).toEqual([
      ['start', 1],
      ['mithila', 2],
      ['ayodhya', 37],
      ['dandaka', 49],
      ['kishkindha', 85],
      ['sea', 109],
      ['lanka', 121],
      ['throne', 144],
    ]);
    for (const stage of STAGES.slice(2, 7)) expect(regionOf(stage.from - 1)).not.toBe(regionOf(stage.to));
  });

  it('SeedStages_Should_NameTheStagesUpToTheFurthestToken_AndTheThroneOnlyOnceWon', () => {
    expect(seedStages(stateAt([0, 0]))).toEqual(['start']);
    expect(seedStages(stateAt([40, 12]))).toEqual(['start', 'mithila', 'ayodhya']);
    expect(seedStages(stateAt([144, 12]))).not.toContain('throne');
    expect(seedStages(stateAt([144, 12], true))).toContain('throne');
  });
});

describe('stage strings', () => {
  beforeEach(() => setLocale('en'));

  it('EveryStage_Should_HaveNameKandaAndLineInEnglishAndHindi', () => {
    for (const id of STAGE_IDS)
      for (const part of ['name', 'kanda', 'line'] as const) {
        expect(typeof enTable[stageKey(id, part)], `${id}.${part}`).toBe('string');
        expect(typeof hiTable[stageKey(id, part)], `${id}.${part}`).toBe('string');
      }
  });

  it('TheGate_Should_ReadAyodhyaGateTheJourneyBegins', () => {
    expect(`${t(stageKey('start', 'name'))} — ${t(stageKey('start', 'line')).toLowerCase()}`).toBe(
      'Ayodhya gate — the journey begins',
    );
  });

  it('EveryStageButTheGate_Should_NameItsKanda', () => {
    for (const id of STAGE_IDS.filter((stage) => stage !== 'start')) {
      expect(t(stageKey(id, 'kanda')), id).not.toBe('');
      setLocale('hi');
      expect(t(stageKey(id, 'kanda')), id).not.toBe('');
      setLocale('en');
    }
  });
});

describe('plaques', () => {
  it('EveryStage_Should_HaveOnePlaqueOnTheBoardsEdge_AtItsFirstRowsHeight', () => {
    const spots = plaqueSpots();
    expect(spots.map((spot) => spot.id)).toEqual([...STAGE_IDS]);
    for (const spot of spots) {
      const [x, y, z] = spot.position;
      // a row's plate on the left or right rim, the throne's on the back rim, the gate's on the plinth ledge before the slab
      const onEdge =
        Math.abs(Math.abs(x) - RIM_HALF) < 1e-6 ||
        Math.abs(z) === RIM_HALF ||
        (z > SLAB_HALF && z < PLINTH_HALF && spot.id === 'start');
      expect(onEdge, spot.id).toBe(true);
      const stage = STAGES.find((candidate) => candidate.id === spot.id)!;
      if (spot.id !== 'start') expect(y, spot.id).toBeGreaterThanOrEqual(blockTopY(stage.from));
    }
  });
});

describe('chapter card timing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ACard_Should_StayAbout2Point5Seconds_ThenLeave', () => {
    const hud = new HudStore();
    hud.chapter('mithila');
    expect(hud.getSnapshot().chapter?.stage).toBe('mithila');
    vi.advanceTimersByTime(CHAPTER_MS - 1);
    expect(hud.getSnapshot().chapter?.stage).toBe('mithila');
    vi.advanceTimersByTime(1);
    expect(hud.getSnapshot().chapter).toBeNull();
    expect(CHAPTER_MS).toBe(2500);
  });

  it('ACard_OnFast_Should_StayOneSecond', () => {
    const hud = new HudStore();
    hud.settings({ fast: true, muted: false });
    hud.chapter('ayodhya');
    vi.advanceTimersByTime(CHAPTER_FAST_MS - 1);
    expect(hud.getSnapshot().chapter?.stage).toBe('ayodhya');
    vi.advanceTimersByTime(1);
    expect(hud.getSnapshot().chapter).toBeNull();
    expect(CHAPTER_FAST_MS).toBe(1000);
  });

  it('TheFirstCard_WhileTheBoardLoads_Should_WaitUntilItStands', () => {
    const hud = new HudStore();
    hud.holdChapters(true);
    hud.chapter('start');
    vi.advanceTimersByTime(5000);
    expect(hud.getSnapshot().chapter).toBeNull();
    hud.holdChapters(false);
    expect(hud.getSnapshot().chapter?.stage).toBe('start');
  });

  it('TwoCards_Should_ShowOneAfterTheOther_NeverTogether', () => {
    const hud = new HudStore();
    hud.chapter('start');
    hud.chapter('mithila');
    expect(hud.getSnapshot().chapter?.stage).toBe('start');
    vi.advanceTimersByTime(CHAPTER_MS);
    expect(hud.getSnapshot().chapter).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(hud.getSnapshot().chapter?.stage).toBe('mithila');
    vi.advanceTimersByTime(CHAPTER_MS);
    expect(hud.getSnapshot().chapter).toBeNull();
  });

  it('ReducedMotion_Should_FadeTheCardInsteadOfSliding', () => {
    const css = new TextDecoder().decode(readFileSync('src/app/app.css'));
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.chapter-card \{\s*animation: fade-in/);
    expect(reduced).toMatch(/\.chapter-card\.leaving \{\s*animation: fade-out/);
  });
});
