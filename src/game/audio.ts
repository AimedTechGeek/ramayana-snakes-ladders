/**
 * Synthesized sound effects and a tanpura-like drone (T27).
 * Web Audio API only: every sound is generated from oscillators, noise and envelopes.
 * Every method is a silent no-op where AudioContext is unavailable (for example in tests).
 */

const MASTER_GAIN = 0.6;
const DRONE_GAIN = 0.05;
const DRONE_CYCLE_S = 4;
const DRONE_LOOKAHEAD_S = 6;
const DRONE_REFILL_MS = 2000;
const DRONE_SA_HZ = 130.81; // C3
const DRONE_PA_HZ = 196.0; // G3, a just fifth above Sa
const DRONE_PATTERN = [DRONE_PA_HZ, DRONE_SA_HZ, DRONE_SA_HZ, DRONE_SA_HZ];
/** Bansuri phrase on a pentatonic scale: Sa Re Ga Pa Dha Sa' above 440 Hz. */
const BANSURI_NOTES = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2].map((ratio) => 440 * ratio);
const BELL_HZ = 392;
const REVEAL_GAIN = 0.25;
const HISS_GAIN = 0.2;
/** Inharmonic temple-bell partials as [ratio, relative level]. */
const BELL_PARTIALS: readonly (readonly [number, number])[] = [
  [1, 0.5],
  [2.76, 0.25],
  [5.4, 0.12],
];

interface Output {
  ctx: AudioContext;
  out: GainNode;
}

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  /** Pitch glide target, reached over the tone's duration. */
  to?: number;
  at: number;
  duration: number;
  peak: number;
  attack?: number;
  /** Vibrato depth in Hz, at a fixed 5.5 Hz rate. */
  vibrato?: number;
}

interface Drone {
  osc: OscillatorNode;
  gain: GainNode;
  timer: ReturnType<typeof setInterval>;
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted: boolean;
  private droneWanted = false;
  private droneVoice: Drone | null = null;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.02);
    }
  }

  /** Call from the first user gesture. Creates the AudioContext and starts a pending drone. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      // A blocked resume leaves the game silent; nothing else depends on it.
      void ctx.resume().catch(() => undefined);
    }
    if (this.droneWanted) this.startDrone(ctx);
  }

  /** Wooden clatter: four quick filtered noise ticks over about 350 ms. */
  dice(): void {
    const play = this.playable();
    if (!play) return;
    const start = play.ctx.currentTime;
    for (const offset of [0, 0.09, 0.19, 0.3]) {
      this.clatter(play, start + offset, 1400 + Math.random() * 900, 0.5, 0.04);
    }
  }

  /** A very soft tick for each square hop. */
  step(): void {
    const play = this.playable();
    if (!play) return;
    this.tone(play, { from: 1200, at: play.ctx.currentTime, duration: 0.03, peak: 0.04, attack: 0.002 });
  }

  /** Fog lifts: two sines a fifth apart (440 / 660 Hz) under a low-pass sweeping 2 kHz to 400 Hz, 300 ms (150 ms in Fast). */
  reveal(fast = false): void {
    const play = this.playable();
    if (!play) return;
    const { ctx, out } = play;
    const start = ctx.currentTime;
    const duration = fast ? 0.15 : 0.3;
    const end = start + duration;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(2000, start);
    lowpass.frequency.exponentialRampToValueAtTime(400, end);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(REVEAL_GAIN, start + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    lowpass.connect(env).connect(out);
    for (const hz of [440, 660]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      osc.connect(lowpass);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  /** Rising bansuri-like phrase on a pentatonic scale, about 700 ms. */
  ladder(): void {
    const play = this.playable();
    if (!play) return;
    const start = play.ctx.currentTime;
    BANSURI_NOTES.forEach((hz, i) =>
      this.tone(play, {
        from: hz,
        at: start + i * 0.1,
        duration: 0.18,
        peak: 0.18,
        attack: 0.03,
        vibrato: 6,
      }),
    );
  }

  /** Strike of a snake: a low thud with a short descending glide, 180 ms (90 ms in Fast). */
  snake(fast = false): void {
    const play = this.playable();
    if (!play) return;
    const start = play.ctx.currentTime;
    const k = fast ? 0.5 : 1;
    this.thud(play, start, 160, 60, 0.5);
    this.tone(play, {
      from: 660,
      to: 330,
      at: start + 0.06 * k,
      duration: 0.12 * k,
      peak: 0.1,
      attack: 0.01 * k,
    });
  }

  /** A snake rises: band-passed noise at 1.8 kHz with a 6 Hz tremolo, 420 ms (210 ms in Fast). */
  hiss(fast = false): void {
    const play = this.playable();
    if (!play || !this.noise) return;
    const { ctx, out } = play;
    const start = ctx.currentTime;
    const duration = fast ? 0.21 : 0.42;
    const end = start + duration;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 2;
    const swell = ctx.createGain();
    swell.gain.setValueAtTime(0.0001, start);
    swell.gain.exponentialRampToValueAtTime(HISS_GAIN, start + duration * 0.25);
    swell.gain.exponentialRampToValueAtTime(0.0001, end);
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(tremolo.gain);
    src.connect(band).connect(tremolo).connect(swell).connect(out);
    src.start(start);
    lfo.start(start);
    src.stop(end + 0.02);
    lfo.stop(end + 0.02);
  }

  /** A snake swallows: a sine gliding 300 to 110 Hz over 220 ms (110 ms in Fast) with a 20 ms click. */
  gulp(fast = false): void {
    const play = this.playable();
    if (!play) return;
    const start = play.ctx.currentTime;
    const k = fast ? 0.5 : 1;
    this.clatter(play, start, 2500, 0.15, 0.02);
    this.tone(play, { from: 300, to: 110, at: start, duration: 0.22 * k, peak: 0.3, attack: 0.005 });
  }

  /** The bitten token reappears: a 600 Hz sine, 80 ms (40 ms in Fast), fast decay. */
  pop(fast = false): void {
    const play = this.playable();
    if (!play) return;
    this.tone(play, {
      from: 600,
      at: play.ctx.currentTime,
      duration: fast ? 0.04 : 0.08,
      peak: 0.25,
      attack: 0.003,
    });
  }

  /** A soft "boing": a quick upward swoop that falls back. */
  bounce(): void {
    const play = this.playable();
    if (!play) return;
    const start = play.ctx.currentTime;
    this.tone(play, {
      type: 'triangle',
      from: 220,
      to: 620,
      at: start,
      duration: 0.14,
      peak: 0.25,
      attack: 0.005,
    });
    this.tone(play, {
      type: 'triangle',
      from: 620,
      to: 260,
      at: start + 0.14,
      duration: 0.25,
      peak: 0.12,
      attack: 0.005,
    });
  }

  /** Two low muted thuds. */
  tripleSix(): void {
    const play = this.playable();
    if (!play) return;
    const start = play.ctx.currentTime;
    this.thud(play, start, 110, 55, 0.4);
    this.thud(play, start + 0.2, 110, 55, 0.35);
  }

  /** Temple bell: inharmonic partials with a long exponential decay, about 2.5 s. */
  win(): void {
    const play = this.playable();
    if (!play) return;
    const start = play.ctx.currentTime;
    this.clatter(play, start, 2000, 0.2, 0.03);
    for (const [ratio, level] of BELL_PARTIALS) {
      this.tone(play, { from: BELL_HZ * ratio, at: start, duration: 2.5, peak: 0.4 * level, attack: 0.003 });
    }
  }

  /** Starts or stops the tanpura-like drone. A drone requested before unlock() starts with it. */
  drone(on: boolean): void {
    this.droneWanted = on;
    const ctx = this.ctx;
    if (!ctx) return;
    if (on) this.startDrone(ctx);
    else this.stopDrone(ctx);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof AudioContext === 'undefined') return null;
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : MASTER_GAIN;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.noise = createNoiseBuffer(ctx);
      return ctx;
    } catch {
      // No audio device or the browser refused: stay silent.
      return null;
    }
  }

  /** The live output for a one-shot sound, or null when silent (muted, or not unlocked yet). */
  private playable(): Output | null {
    if (this.muted || !this.ctx || !this.master) return null;
    return { ctx: this.ctx, out: this.master };
  }

  private tone(play: Output, o: ToneOptions): void {
    const { ctx, out } = play;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.from, o.at);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, o.at + o.duration);
    const end = o.at + o.duration;
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.value = o.vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(o.at);
      lfo.stop(end + 0.02);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, o.at);
    env.gain.exponentialRampToValueAtTime(o.peak, o.at + (o.attack ?? 0.005));
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(env).connect(out);
    osc.start(o.at);
    osc.stop(end + 0.02);
  }

  /** Short band-passed noise burst, used for clatter, clicks and strikes. */
  private clatter(play: Output, at: number, centre: number, peak: number, decay: number): void {
    if (!this.noise) return;
    const { ctx, out } = play;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centre;
    filter.Q.value = 6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(filter).connect(env).connect(out);
    src.start(at);
    src.stop(at + decay + 0.02);
  }

  /** Mridangam-style thud: a pitch-dropping sine with a noise click on top. */
  private thud(play: Output, at: number, fromHz: number, toHz: number, peak: number): void {
    this.tone(play, { from: fromHz, to: toHz, at, duration: 0.2, peak, attack: 0.002 });
    this.clatter(play, at, 3000, peak * 0.6, 0.02);
  }

  private startDrone(ctx: AudioContext): void {
    if (this.droneVoice || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(DRONE_SA_HZ, now);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(DRONE_GAIN, now + 1.5);
    osc.connect(lowpass).connect(gain).connect(this.master);

    // Pa-Sa-Sa-Sa, one note per second, scheduled a few cycles ahead and topped up on a timer.
    let nextCycle = now + 0.05;
    const scheduleAhead = (): void => {
      while (nextCycle < ctx.currentTime + DRONE_LOOKAHEAD_S) {
        DRONE_PATTERN.forEach((hz, beat) => osc.frequency.setValueAtTime(hz, nextCycle + beat));
        nextCycle += DRONE_CYCLE_S;
      }
    };
    scheduleAhead();
    osc.start(now);
    const timer = setInterval(scheduleAhead, DRONE_REFILL_MS);
    this.droneVoice = { osc, gain, timer };
  }

  private stopDrone(ctx: AudioContext): void {
    const drone = this.droneVoice;
    if (!drone) return;
    this.droneVoice = null;
    clearInterval(drone.timer);
    const now = ctx.currentTime;
    drone.gain.gain.cancelScheduledValues(now);
    drone.gain.gain.setTargetAtTime(0, now, 0.15);
    drone.osc.stop(now + 1);
  }
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

let instance: Audio | null = null;

/** The shared audio manager. `initialMuted` is applied only when the instance is first created. */
export function getAudio(initialMuted = false): Audio {
  instance ??= new Audio(initialMuted);
  return instance;
}
