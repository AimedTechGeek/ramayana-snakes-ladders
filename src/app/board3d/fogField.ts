// Per-square fog of war state (T44 spec 3): 1 = hidden, 0 = revealed, eased with Quad.easeOut when a square is
// revealed. Pure (time is passed in) so the 420 ms / 120 ms reveal is unit-tested; the renderer copies `values` into the
// per-instance `aFog` / `aReveal` attributes.

import { SQUARES } from './boardLayout';

export const REVEAL_MS = 420;
export const REVEAL_MS_FAST = 120;

export function easeOutQuad(u: number): number {
  const c = Math.min(1, Math.max(0, u));
  return 1 - (1 - c) * (1 - c);
}

export class FogField {
  /** Fog per square, index = square (index 0 unused). */
  readonly values = new Float32Array(SQUARES + 1).fill(1);
  private readonly target = new Float32Array(SQUARES + 1).fill(1);
  private readonly from = new Float32Array(SQUARES + 1).fill(1);
  private readonly start = new Float64Array(SQUARES + 1);
  private readonly duration = new Float64Array(SQUARES + 1);
  private primed = false;

  /** Applies a revealed set at once (resume, new game): no animation. */
  snap(revealed: ReadonlySet<number>): void {
    for (let square = 1; square <= SQUARES; square++) {
      const value = revealed.has(square) ? 0 : 1;
      this.values[square] = this.target[square] = this.from[square] = value;
      this.duration[square] = 0;
    }
    this.primed = true;
  }

  /**
   * Moves toward `revealed` as of `now` (ms). A square that just became revealed starts a `durationMs` ease from
   * its current value. The first call snaps. Returns true when any value changed.
   */
  update(revealed: ReadonlySet<number>, now: number, durationMs: number): boolean {
    if (!this.primed) {
      this.snap(revealed);
      return true;
    }
    let changed = false;
    for (let square = 1; square <= SQUARES; square++) {
      const goal = revealed.has(square) ? 0 : 1;
      if (goal !== this.target[square]) {
        this.target[square] = goal;
        this.from[square] = this.values[square]!;
        this.start[square] = now;
        this.duration[square] = durationMs;
      }
      const current = this.values[square]!;
      if (current === goal) continue;
      const span = this.duration[square]!;
      const u = span <= 0 ? 1 : (now - this.start[square]!) / span;
      const next = u >= 1 ? goal : this.from[square]! + (goal - this.from[square]!) * easeOutQuad(u);
      if (next !== current) {
        this.values[square] = next;
        changed = true;
      }
    }
    return changed;
  }
}
