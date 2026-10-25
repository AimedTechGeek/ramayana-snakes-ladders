import { FINAL_SQUARE, type Board, type Jump, type Level } from './types';

export interface StoryJump extends Jump {
  /** Stable slug for i18n / art lookup. */
  id: string;
  /** Ramayana chronological order, 1-based. */
  seq: number;
  kind: 'ladder' | 'snake';
  levels: readonly Level[];
}

export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

const ALL: readonly Level[] = ['easy', 'medium', 'hard'];
const EASY: readonly Level[] = ['easy'];
const EASY_MEDIUM: readonly Level[] = ['easy', 'medium'];
const MEDIUM_HARD: readonly Level[] = ['medium', 'hard'];
const HARD: readonly Level[] = ['hard'];

export const STORY_JUMPS: readonly StoryJump[] = [
  { seq: 1, id: 'vishwamitra', from: 4, to: 25, name: "Vishwamitra's training", kind: 'ladder', levels: ALL },
  { seq: 2, id: 'tataka', from: 17, to: 6, name: 'Tataka the demoness', kind: 'snake', levels: MEDIUM_HARD },
  { seq: 3, id: 'shiva-bow', from: 20, to: 43, name: "Breaking Shiva's bow", kind: 'ladder', levels: EASY_MEDIUM },
  { seq: 4, id: 'wedding', from: 26, to: 52, name: 'Wedding of Rama and Sita', kind: 'ladder', levels: ALL },
  { seq: 5, id: 'manthara', from: 37, to: 19, name: "Manthara's whisper", kind: 'snake', levels: ALL },
  { seq: 6, id: 'kaikeyi', from: 46, to: 28, name: "Kaikeyi's two boons", kind: 'snake', levels: ALL },
  { seq: 7, id: 'guha', from: 49, to: 74, name: 'Guha ferries them across the Ganga', kind: 'ladder', levels: EASY },
  { seq: 8, id: 'viradha', from: 58, to: 40, name: 'Viradha seizes Sita', kind: 'snake', levels: HARD },
  { seq: 9, id: 'shurpanakha', from: 64, to: 47, name: "Shurpanakha's revenge", kind: 'snake', levels: ALL },
  { seq: 10, id: 'golden-deer', from: 70, to: 56, name: 'The golden deer', kind: 'snake', levels: ALL },
  { seq: 11, id: 'abduction', from: 76, to: 55, name: "Sita's abduction", kind: 'snake', levels: ALL },
  { seq: 12, id: 'kabandha', from: 82, to: 68, name: 'Kabandha the headless', kind: 'snake', levels: MEDIUM_HARD },
  { seq: 13, id: 'shabari', from: 85, to: 108, name: "Shabari's devotion", kind: 'ladder', levels: ALL },
  { seq: 14, id: 'hanuman-meeting', from: 88, to: 113, name: 'Meeting Hanuman', kind: 'ladder', levels: ALL },
  { seq: 15, id: 'sugriva', from: 92, to: 118, name: 'Alliance with Sugriva', kind: 'ladder', levels: EASY },
  { seq: 16, id: 'hanuman-leap', from: 95, to: 122, name: "Hanuman's leap to Lanka", kind: 'ladder', levels: ALL },
  { seq: 17, id: 'rama-setu', from: 101, to: 127, name: 'Building Rama Setu', kind: 'ladder', levels: ALL },
  { seq: 18, id: 'indrajit-arrows', from: 114, to: 96, name: "Indrajit's serpent arrows", kind: 'snake', levels: ALL },
  { seq: 19, id: 'prahasta', from: 120, to: 110, name: "Prahasta's charge", kind: 'snake', levels: HARD },
  { seq: 20, id: 'kumbhakarna', from: 124, to: 106, name: 'Kumbhakarna awakens', kind: 'snake', levels: MEDIUM_HARD },
  { seq: 21, id: 'brahmastra', from: 130, to: 119, name: "Indrajit's Brahmastra", kind: 'snake', levels: HARD },
  { seq: 22, id: 'ravana', from: 138, to: 78, name: "Ravana's pride", kind: 'snake', levels: HARD },
];

export interface StoryBoard extends Board {
  ladders: readonly StoryJump[];
  snakes: readonly StoryJump[];
}

function jumpsOnLevel(level: Level, table: readonly StoryJump[]): StoryJump[] {
  return table.filter((j) => j.levels.includes(level));
}

function byFrom(a: StoryJump, b: StoryJump): number {
  return a.from - b.from;
}

export function boardFor(level: Level): StoryBoard {
  const jumps = jumpsOnLevel(level, STORY_JUMPS);
  return {
    level,
    ladders: jumps.filter((j) => j.kind === 'ladder').sort(byFrom),
    snakes: jumps.filter((j) => j.kind === 'snake').sort(byFrom),
  };
}

const EXPECTED_COUNTS: Record<Level, { ladders: number; snakes: number }> = {
  easy: { ladders: 9, snakes: 6 },
  medium: { ladders: 7, snakes: 9 },
  hard: { ladders: 6, snakes: 13 },
};

const MAX_SNAKE_HEADS_PER_WINDOW = 2;
const WINDOW_SIZE = 6;

function label(j: StoryJump): string {
  return `${j.id} (${j.from}->${j.to})`;
}

function checkLevel(level: Level, table: readonly StoryJump[]): string[] {
  const problems: string[] = [];
  const jumps = jumpsOnLevel(level, table);

  const starts = new Map<number, StoryJump>();
  for (const j of jumps) {
    const other = starts.get(j.from);
    if (other) problems.push(`${level}: ${label(j)} and ${label(other)} start on the same square`);
    starts.set(j.from, j);
  }

  for (const j of jumps) {
    const hit = starts.get(j.to);
    if (hit) problems.push(`${level}: ${label(j)} ends on the start of ${label(hit)}`);
    if (j.from === FINAL_SQUARE || j.to === FINAL_SQUARE || j.from === 0 || j.to === 0) {
      problems.push(`${level}: ${label(j)} touches square 0 or ${FINAL_SQUARE}`);
    }
    if (j.kind === 'ladder' && j.to <= j.from) problems.push(`${level}: ladder ${label(j)} does not go up`);
    if (j.kind === 'snake' && j.to >= j.from) problems.push(`${level}: snake ${label(j)} does not go down`);
  }

  const heads = jumps.filter((j) => j.kind === 'snake').map((j) => j.from);
  for (const start of heads) {
    const inWindow = heads.filter((h) => h >= start && h < start + WINDOW_SIZE);
    if (inWindow.length > MAX_SNAKE_HEADS_PER_WINDOW) {
      problems.push(`${level}: ${inWindow.length} snake heads within squares ${start}-${start + WINDOW_SIZE - 1}`);
    }
  }

  const ladders = jumps.length - heads.length;
  const expected = EXPECTED_COUNTS[level];
  if (ladders !== expected.ladders || heads.length !== expected.snakes) {
    problems.push(
      `${level}: expected ${expected.ladders} ladders/${expected.snakes} snakes, found ${ladders}/${heads.length}`,
    );
  }
  return problems;
}

function checkSeqOrder(table: readonly StoryJump[]): string[] {
  const problems: string[] = [];
  const bySeq = [...table].sort((a, b) => a.seq - b.seq);
  for (let i = 1; i < bySeq.length; i++) {
    const prev = bySeq[i - 1]!;
    const cur = bySeq[i]!;
    if (cur.from <= prev.from) {
      problems.push(
        `seq ${cur.seq} (${cur.id}, from ${cur.from}) does not start after seq ${prev.seq} (${prev.id}, from ${prev.from})`,
      );
    }
  }
  return problems;
}

function checkNesting(table: readonly StoryJump[]): string[] {
  const problems: string[] = [];
  for (const j of table) {
    const indexes = j.levels.map((l) => LEVELS.indexOf(l));
    // Snakes accumulate on harder levels, ladders on easier ones.
    const required =
      j.kind === 'snake' ? LEVELS.slice(Math.min(...indexes)) : LEVELS.slice(0, Math.max(...indexes) + 1);
    for (const level of required) {
      if (!j.levels.includes(level)) {
        problems.push(`${j.kind} ${j.id} is missing from ${level}, breaking level nesting`);
      }
    }
  }
  return problems;
}

/** Returns human-readable violations; an empty array means the layout is valid. */
export function validateLayout(table: readonly StoryJump[] = STORY_JUMPS): string[] {
  return [
    ...LEVELS.flatMap((level) => checkLevel(level, table)),
    ...checkSeqOrder(table),
    ...checkNesting(table),
  ];
}
