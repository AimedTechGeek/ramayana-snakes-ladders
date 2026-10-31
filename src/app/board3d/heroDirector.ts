// Turns what DioramaView already exposes per token (spot, scale, bridge override, mood) into what a Hero needs each
// frame: which clip, the distance walked for the phase, the move direction. Pure state machine, no three.js;
// useHeroActor (Hero.tsx) feeds it from useFrame.
//
// BoardView call -> clip (the integrator wires `useHeroActor(hero, view, player)` into the token; DioramaView stays as is).
// What the adapter can see today is only `token.spot`, `lift`, `scale`, `override` and `view.moods[seat].emotion`:
//   enter()      the 360 ms arc from the rim: `lift` > 0.1 (walk bob <= 0.08, arc 0.6) or `options.glide`   -> idle, no steps
//   walk()       speed 20..160 world u/s the whole move (walk up to 2 squares: 80 u/s)                    -> `walk`, by distance
//                a move that exceeds 160 u/s (run 280, Fast 560) becomes `run` on its first fast frame    -> `run`, by distance
//                (the ease-in starts at 0: the first ~3 frames are below 160; that hard cut is allowed,
//                walk <-> run never crossfade, and happens within a few world units of the start)
//   cross()      `override` on a bridge arch: run along the deck                                          -> `run`
//   bite()       scale < 1 while the seat mood is scared                                                  -> `scared`, then scale
//   react()      the mood's emotion only: the clip is `emotionClip(emotion)`. DioramaView.moods does not
//                carry the tween: put it on SeatMood and pass `reaction` for `clipForReaction` to apply   -> happy / excited / ...
//   voidTriple() and re-fan: straight slides, no steps: pass `options.glide` (the triple six is a penalty) -> idle
//   leap on and off a bridge abutment, `hanuman-leap`: NOT detected here. Integrator work: DioramaView
//                reports the beats and the Hero shows them with `Hero.leap(ms, beats)`                   -> `leap`
//   win          the board winner plays `excited`; `cheer` (the somersault, R4) is for the Win screen only, via
//                `hero.play('cheer')` or `TokenSample.won`, never from the board adapter

import type { Emotion, Reaction } from '../../characters/reactions';
import type { Vec2 } from '../../game/iso/boardIso';
import { clipForTween, type HeroClip } from './heroClips';

/** World units per second that separate "standing", "walking" and "running" (walk 80, run 280, Fast 560). */
export const STILL_SPEED = 20;
export const RUN_SPEED = 160;
/** A gait ends when the token has been below STILL_SPEED this long (the 60 ms arrival squash is not a stop). */
export const STOP_HOLD_MS = 90;

export function clipForReaction(reaction: Pick<Reaction, 'tween' | 'emotion'>): HeroClip {
  return clipForTween(reaction.tween, reaction.emotion);
}

/** Emotion without a tween (the mood alone): the matching rest-pose clip. */
export function emotionClip(emotion: Emotion): HeroClip {
  return emotion === 'idle' ? 'idle' : emotion;
}

export interface TokenSample {
  /** World (x, y) of the feet, as DioramaView's `TokenState.spot`. */
  spot: Vec2;
  /** DioramaView `TokenState.scale` (the bite shrinks it). */
  scale: number;
  /** DioramaView `TokenState.override !== null`: on a bridge arch. */
  onBridge: boolean;
  /** The seat's current mood (`DioramaView.moods[seat]`), or null. */
  emotion: Emotion | null;
  /** The reaction behind the mood, when known: its tween picks the clip. */
  reaction?: Pick<Reaction, 'tween' | 'emotion'> | null;
  /** Straight slide or arc (triple six, re-fan, entry): no steps. */
  glide?: boolean;
  /** The Win screen only (cheer is the somersault: R4 keeps it off the board). */
  won?: boolean;
}

export interface Directive {
  clip: HeroClip;
  /** Distance walked (world units) since the gait began; the Hero divides by the gait's cycle. */
  distance: number;
  moving: boolean;
  /** Emotion for the face (idle when none). */
  emotion: Emotion;
  /** Last move direction (world), unit length, zero before the first move. */
  dir: Vec2;
}

export class HeroDirector {
  private last: Vec2 | null = null;
  private distance = 0;
  private gait: 'walk' | 'run' | null = null;
  private stillMs = 0;
  private dir: Vec2 = [0, 0];

  update(dtMs: number, s: TokenSample): Directive {
    let speed = 0;
    if (this.last && dtMs > 0) {
      const dx = s.spot[0] - this.last[0];
      const dy = s.spot[1] - this.last[1];
      const step = Math.hypot(dx, dy);
      speed = (step / dtMs) * 1000;
      if (step > 0) this.dir = [dx / step, dy / step];
      if (!s.glide && speed >= STILL_SPEED) this.distance += step;
    }
    this.last = s.spot;
    if (s.glide) {
      this.gait = null; // a slide or an arc has no steps: never freeze a gait pose on it
      this.distance = 0;
    }
    const stepping = !s.glide && (speed >= STILL_SPEED || s.onBridge);
    if (stepping) {
      this.stillMs = 0;
      // a walk never cruises above 80 u/s: the first time a move passes RUN_SPEED it is a run (hard cut, on a contact)
      if (this.gait === null) this.gait = s.onBridge || speed > RUN_SPEED ? 'run' : 'walk';
      else if (this.gait === 'walk' && speed > RUN_SPEED) this.gait = 'run';
    } else if (this.gait) {
      this.stillMs += dtMs;
      if (this.stillMs >= STOP_HOLD_MS) {
        this.gait = null;
        this.distance = 0;
      }
    }
    const emotion = s.emotion ?? 'idle';
    let clip: HeroClip;
    if (s.won) clip = 'cheer';
    else if (this.gait) clip = this.gait;
    else if (s.scale < 0.999 && emotion === 'scared') clip = 'scared';
    else if (s.reaction) clip = clipForReaction(s.reaction);
    else clip = emotionClip(emotion);
    return { clip, distance: this.distance, moving: this.gait !== null, emotion, dir: this.dir };
  }
}
