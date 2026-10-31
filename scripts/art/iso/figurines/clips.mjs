// The animation tables of Hanuman (T43 spec section 3) as data: the clip table 3.1, the key frames 3.2 and the emotion
// rest poses. Angles are degrees in the conventions of 3.0: hip + = thigh forward, knee + = flexion, ankle = the foot's
// pitch above the ground (+ toes up, clamped to the anatomical range by rig.mjs), shoulder + = arm forward (180 = up),
// elbow + = flexion, lean + = torso forward, tail = { pitch, curl, yaw }, mace = shaft pitch from vertical (+ = head
// back). A frame spec is what rig.mjs solves; `bob` here is only the spec's expectation, the rig solves the real one.

export const FACINGS = ['SE', 'SW', 'NW', 'NE'];
export const EMOTIONS = ['happy', 'excited', 'scared', 'sad'];

/** Spec 3.1. `cycle` and `speed` in world units (units per second), `fps` of the distance-driven clips at that speed. */
export const CLIPS = {
  idle: { frames: 3, facings: ['SW'], fps: 3, loop: true, pingPong: [0, 1, 2, 1] },
  walk: { frames: 8, facings: ['SE', 'NW', 'NE'], cycle: 32, speed: 80, fps: 20, loop: true },
  run: {
    frames: 6,
    facings: ['SE', 'NW', 'NE'],
    cycle: 56,
    speed: 280,
    fps: 30,
    fastSpeed: 560,
    fastFps: 60,
    loop: true,
  },
  leap: {
    frames: 4,
    facings: ['SE', 'NW', 'NE'],
    loop: false,
    ms: [160, 80, null, 120],
    fastMs: [60, 40, null, 60],
  },
};

const REST_LEGS = { hip: 0, knee: 0, ankle: 0 };
const STOOD = { L: REST_LEGS, R: REST_LEGS };

/** A leg row of the tables. */
const leg = (hip, knee, ankle) => ({ hip, knee, ankle });
/** An arm row: shoulder pitch, elbow flexion. */
const arm = (shoulder, elbow) => ({ shoulder, elbow });
const tail = (pitch, curl, yaw = 0) => ({ pitch, curl, yaw });
/** The mace in his right hand: shaft 20 above the grip and 4 below (pitch from vertical, + = head back). */
const held = (pitch, extra = {}) => ({ mode: 'held', above: 20, below: 4, pitch, ...extra });

const WALK = [
  {
    name: 'contact',
    L: leg(25, 5, 8),
    R: leg(-20, 8, -12),
    armL: arm(-20, 15),
    armR: arm(20, 30),
    lean: 4,
    tail: tail(15, 150, -8),
    mace: 20,
    bob: 0,
    planted: { foot: 'L', offset: 8 },
  },
  {
    name: 'down',
    L: leg(18, 16, 0),
    R: leg(-12, 10, -22),
    armL: arm(-12, 18),
    armR: arm(12, 28),
    lean: 4,
    tail: tail(12, 150, -4),
    mace: 22,
    bob: -1.5,
    planted: { foot: 'L', offset: 4 },
  },
  {
    name: 'pass',
    L: leg(4, 10, 0),
    R: leg(6, 48, -10),
    armL: arm(0, 20),
    armR: arm(0, 20),
    lean: 3,
    tail: tail(15, 150, 0),
    mace: 20,
    bob: 0,
    planted: { foot: 'L', offset: 0 },
  },
  {
    name: 'up',
    L: leg(-10, 4, -18),
    R: leg(22, 22, 2),
    armL: arm(12, 28),
    armR: arm(-12, 15),
    lean: 4,
    tail: tail(18, 150, 4),
    mace: 18,
    bob: 1.5,
    planted: { foot: 'L', offset: -4 },
  },
];

const RUN = [
  {
    name: 'contact',
    L: leg(40, 18, 5),
    R: leg(-30, 70, -10),
    armL: arm(-35, 85),
    armR: arm(35, 85),
    lean: 12,
    tail: tail(0, 150),
    mace: 35,
    bob: -0.5,
    planted: { foot: 'L', offset: 9.33 },
  },
  {
    name: 'down',
    L: leg(12, 35, -5),
    R: leg(15, 95, -20),
    armL: arm(-10, 90),
    armR: arm(10, 90),
    lean: 12,
    tail: tail(-3, 150),
    mace: 35,
    bob: -2.5,
    planted: { foot: 'L', offset: 0 },
  },
  {
    name: 'air',
    L: leg(-35, 25, -25),
    R: leg(45, 60, 0),
    armL: arm(30, 90),
    armR: arm(-30, 90),
    lean: 14,
    tail: tail(3, 150),
    mace: 35,
    bob: 3,
    planted: null,
    air: true,
  },
];

const both = (hip, knee, ankle) => ({ L: leg(hip, knee, ankle), R: leg(hip, knee, ankle) });
const LEAP = [
  {
    name: 'anticipation',
    ...both(55, 70, 15),
    armL: arm(-40, 20),
    armR: arm(-40, 20),
    lean: 18,
    tail: tail(0, 160),
    mace: 55,
    bob: -7,
    planted: { foot: 'both', offset: 0 },
  },
  {
    name: 'takeoff',
    ...both(-10, 5, -30),
    armL: arm(60, 30),
    armR: arm(60, 30),
    lean: 10,
    tail: tail(5, 140),
    mace: -20,
    bob: 4,
    planted: { foot: 'both', offset: 0 },
  },
  {
    name: 'air',
    ...both(70, 95, 0),
    armL: arm(40, 40),
    armR: arm(150, 20),
    lean: 15,
    tail: tail(20, 150),
    mace: -10,
    bob: 6,
    planted: null,
    air: true,
  },
  {
    name: 'land',
    ...both(40, 45, 10),
    armL: arm(20, 60),
    armR: arm(60, 40),
    lean: 15,
    tail: tail(25, 110),
    mace: 0,
    bob: -4,
    planted: { foot: 'both', offset: 0 },
  },
];

/** Left/right swap of a key frame (never a reflection of geometry): legs, arms, tail yaw and the planted foot. */
function mirror(frame) {
  const swap = (foot) => (foot === 'L' ? 'R' : foot === 'R' ? 'L' : foot);
  return {
    ...frame,
    L: frame.R,
    R: frame.L,
    armL: frame.armR,
    armR: frame.armL,
    tail: { ...frame.tail, yaw: -frame.tail.yaw },
    planted: frame.planted && { ...frame.planted, foot: swap(frame.planted.foot) },
  };
}

const FACE_IDLE = 'idle';

/** Emotion rest poses, T40 4.6 remapped (spec 3.2). `hands` are IK targets in the face basis (scared). */
const REST = {
  idle: {
    ...STOOD,
    armL: arm(0, 10),
    armR: arm(25, 95),
    lean: 0,
    tail: tail(20, 160),
    mace: held(20),
    head: { nod: 0, tilt: 0 },
  },
  happy: {
    ...STOOD,
    armL: arm(30, 95),
    armR: arm(40, 70),
    lean: 0,
    tail: tail(20, 160, 0),
    tailLift: 8,
    mace: held(10),
    head: { nod: 0, tilt: 6 },
  },
  excited: {
    L: leg(0, 8, 0),
    R: leg(0, 8, 0),
    armL: arm(160, 10),
    armR: arm(160, 10),
    lean: 0,
    tail: tail(60, 0),
    tuft: 2.6,
    mace: held(0, { above: 6.3, below: 5 }),
    openHand: 'L',
    head: { nod: 0, tilt: 0 },
  },
  scared: {
    L: leg(25, 30, 0),
    R: leg(25, 30, 0),
    armL: arm(120, 110),
    armR: arm(120, 110),
    handsAtEyes: true,
    lean: -6,
    tail: { wrap: true },
    mace: { mode: 'standing', at: [11, -2] },
    head: { nod: 0, tilt: 0 },
  },
  sad: {
    L: leg(0, 5, 0),
    R: leg(0, 5, 0),
    armL: arm(0, 10),
    armR: arm(10, 20),
    lean: 0,
    tail: { droop: true },
    mace: { mode: 'headDown', at: [9, 3] },
    head: { nod: -8, tilt: 0 },
  },
};

const REST_BOTH = { planted: { foot: 'both', offset: 0 }, bob: 0, air: false };

/**
 * Every frame spec of the sheet, in spec order: idle 3, the four emotions, then per locomotion facing walk 8, run 6,
 * leap 4. A spec carries `clip`, `facing`, `index`, `face` (the expression drawn) and the key-frame fields.
 */
export function frameSpecs() {
  const specs = [];
  const add = (clip, facing, index, spec, face) =>
    specs.push({ air: false, ...spec, clip, facing, index, face, key: `${clip}.${facing}.${index}` });
  [-8, 0, 8].forEach((yaw, index) => {
    const base = REST.idle;
    add(
      'idle',
      'SW',
      index,
      { ...base, ...REST_BOTH, tail: { ...base.tail, yaw }, mace: base.mace },
      FACE_IDLE,
    );
  });
  for (const emotion of EMOTIONS) add(emotion, 'SW', 0, { ...REST[emotion], ...REST_BOTH }, emotion);
  for (const facing of CLIPS.walk.facings) {
    for (let index = 0; index < 8; index += 1) {
      const frame = index < 4 ? WALK[index] : mirror(WALK[index - 4]);
      add('walk', facing, index, { ...frame, mace: held(frame.mace, { roll: 15 }) }, FACE_IDLE);
    }
    for (let index = 0; index < 6; index += 1) {
      const frame = index < 3 ? RUN[index] : mirror(RUN[index - 3]);
      add('run', facing, index, { ...frame, mace: held(frame.mace, { roll: 15 }) }, FACE_IDLE);
    }
    for (let index = 0; index < 4; index += 1) {
      const frame = LEAP[index];
      add('leap', facing, index, { ...frame, mace: held(frame.mace, { roll: 15 }) }, FACE_IDLE);
    }
  }
  return specs;
}

/** Frame name of the atlas (spec 6.2): `walk.SE.3`; the four emotions are `SW.happy` and so on. */
export function frameName(spec) {
  return EMOTIONS.includes(spec.clip) ? `SW.${spec.clip}` : spec.key;
}
