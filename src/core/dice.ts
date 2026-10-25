export interface Dice {
  roll(): number;
}

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededDice(seed: number): Dice {
  const next = mulberry32(seed);
  return {
    roll: () => Math.floor(next() * 6) + 1,
  };
}

const UINT32_RANGE = 4294967296;
const UNBIASED_LIMIT = UINT32_RANGE - (UINT32_RANGE % 6);

export function createRandomDice(): Dice {
  const buffer = new Uint32Array(1);
  return {
    roll: () => {
      let value: number;
      do {
        globalThis.crypto.getRandomValues(buffer);
        value = buffer[0] ?? 0;
      } while (value >= UNBIASED_LIMIT);
      return (value % 6) + 1;
    },
  };
}
