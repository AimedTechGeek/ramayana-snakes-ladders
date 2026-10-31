"""Motion for the shared hero rig: analytic forward kinematics, IK helpers, foot lock, the generic locomotion clips
(idle, walk, run, leap) and the baker. A hero supplies a `Style` for what is hero specific (arms/props/tail) and
writes its own emotion clips with the same helpers.

Angle conventions (T43 3.2, degrees): hip/shoulder + = forward, knee/elbow + = flexion, ankle + = toes up (the WORLD
pitch of the foot, so a planted foot stays flat), lean + = torso pitched forward.
Poses are armature-space rotations (rest-orientation independent, see rig.Pose); every solve (ground height, foot
lock, IK, prop planting) runs on our own FK, so a clip is computed, not eyeballed, then verified against Blender.
"""
import math

import bpy
from mathutils import Quaternion, Vector

import anim as _anim
import common
from common import FPS, HERO_BONES, SCALE
from rig import Pose, rot_x, rot_y, rot_z

V = Vector
Q0 = Quaternion()


# ---------------------------------------------------------------- pose + blending

class HPose(Pose):
    """rig.Pose plus: `shift` (armature-space displacement per bone, design units), `hop` (height above the
    solved ground, du) and `free` (skip the ground solve: somersault)."""

    def __init__(self):
        super().__init__()
        self.shift = {}
        self.hop = 0.0
        self.free = False

    def rot(self, bone, q):
        self.add_rel(bone, q)


def blend(a, b, t):
    out = HPose()
    for k in set(a.rel) | set(b.rel):
        out.rel[k] = a.rel.get(k, Q0).slerp(b.rel.get(k, Q0), t)
    for k in set(a.world) | set(b.world):
        out.world[k] = a.world.get(k, Q0).slerp(b.world.get(k, Q0), t)
    for k in set(a.shift) | set(b.shift):
        out.shift[k] = a.shift.get(k, V()).lerp(b.shift.get(k, V()), t)
    for k in set(a.scale) | set(b.scale):
        out.scale[k] = a.scale.get(k, V((1, 1, 1))).lerp(b.scale.get(k, V((1, 1, 1))), t)
    out.hop = a.hop + (b.hop - a.hop) * t
    out.free = a.free and b.free
    return out


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def hermite_periodic(times, values, f, period):
    """Cubic Hermite through (times, values), periodic, tangents from neighbours (non-uniform keys allowed)."""
    n = len(times)
    f = f % period
    i = max(k for k in range(n) if times[k] <= f)
    t0 = times[i]
    t1 = times[(i + 1) % n] + (period if i == n - 1 else 0)
    ip, inx = (i - 1) % n, (i + 2) % n
    tp = times[ip] - (period if i == 0 else 0)
    tn = times[inx] + (period if i + 2 >= n else 0)
    v0, v1 = values[i], values[(i + 1) % n]
    h = t1 - t0
    m0 = (v1 - values[ip]) / (t1 - tp) * h
    m1 = (values[inx] - v0) / (tn - t0) * h
    s = (f - t0) / h
    return ((2 * s ** 3 - 3 * s ** 2 + 1) * v0 + (s ** 3 - 2 * s ** 2 + s) * m0
            + (-2 * s ** 3 + 3 * s ** 2) * v1 + (s ** 3 - s ** 2) * m1)


# ---------------------------------------------------------------- skeleton (FK)

class Kin:
    def __init__(self, skel, D, Q, heads):
        self.skel, self.D, self.Q, self.heads = skel, D, Q, heads

    def head(self, bone):
        return self.heads[bone]

    def point(self, bone, rest_point):
        """Posed position of a point attached to `bone`, given in rest (design-unit) coordinates."""
        return self.heads[bone] + self.D[bone] @ (V(rest_point) - self.skel.head[bone])

    def dir(self, bone):
        return self.D[bone] @ self.skel.rest_dir[bone]


class Skeleton:
    def __init__(self, bones=HERO_BONES):
        self.bones = bones
        self.order = list(bones)
        self.parent = {b: v[0] for b, v in bones.items()}
        self.head = {b: V(v[1]) for b, v in bones.items()}
        self.tail = {b: V(v[2]) for b, v in bones.items()}
        self.rest_dir = {b: (self.tail[b] - self.head[b]).normalized() for b in bones}
        self.length = {b: (self.tail[b] - self.head[b]).length for b in bones}
        self.rest_min_sole = None
        self.rest_min_sole = self.min_sole(self.kin(HPose()))

    def kin(self, pose):
        D, Qs, heads = {}, {}, {}
        for b in self.order:
            p = self.parent[b]
            dp = D[p] if p else Q0
            if b in pose.world:
                q = dp.inverted() @ pose.world[b]
            else:
                q = pose.rel.get(b, Q0)
            Qs[b] = q
            D[b] = dp @ q
            base = heads[p] + D[p] @ (self.head[b] - self.head[p]) if p else self.head[b].copy()
            heads[b] = base + pose.shift.get(b, V())
        return Kin(self, D, Qs, heads)

    def sole_points(self, kin):
        pts = []
        for s, x in (("L", 3.0), ("R", -3.0)):
            pts.append(kin.point(f"foot.{s}", (x, -0.2, 0.2)))
            pts.append(kin.point(f"toe.{s}", (x, -5.2, 0.2)))
            pts.append(kin.point(f"toe.{s}", (x, -7.2, 0.5)))
        return pts

    def min_sole(self, kin):
        return min(p.z for p in self.sole_points(kin))

    def ground_z(self, pose):
        """Root height (du) that puts the lowest sole point on the ground."""
        return -(self.min_sole(self.kin(pose)) - self.rest_min_sole)


SKEL = Skeleton()


# ---------------------------------------------------------------- IK and chains

def reach(pose, side, target, pole):
    """Two-bone arm IK to the wrist target (armature space, du). `pole` = direction the elbow bends toward."""
    ua, fa = f"upperArm.{side}", f"foreArm.{side}"
    kin = SKEL.kin(pose)
    s0 = kin.head(ua)
    l1, l2 = SKEL.length[ua], SKEL.length[fa]
    d = V(target) - s0
    dist = max(abs(l1 - l2) + 1e-3, min(d.length, l1 + l2 - 1e-3))
    u = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    pp = V(pole) - u * V(pole).dot(u)
    pp = pp.normalized() if pp.length > 1e-6 else V((0, 0, 1))
    elbow = s0 + u * a + pp * h
    wrist = s0 + u * dist
    d_ua = SKEL.rest_dir[ua].rotation_difference((elbow - s0).normalized())
    d_fa = SKEL.rest_dir[fa].rotation_difference((wrist - elbow).normalized())
    pose.rel[ua] = kin.D[SKEL.parent[ua]].inverted() @ d_ua
    pose.rel[fa] = d_ua.inverted() @ d_fa
    return wrist


def aim_chain(pose, bones, dirs):
    """Point each bone of a chain along an armature-space direction (tail shapes)."""
    kin = SKEL.kin(pose)
    d_prev = kin.D[SKEL.parent[bones[0]]]
    for b, d in zip(bones, dirs):
        d_b = SKEL.rest_dir[b].rotation_difference(V(d).normalized())
        pose.rel[b] = d_prev.inverted() @ d_b
        d_prev = d_b


def set_arm(pose, side, shoulder, elbow, abduct=0.0):
    """Angle-driven arm: shoulder + = forward (180 up), elbow + = flexion, abduct + = out to the side."""
    s = 1 if side == "L" else -1
    pose.rel[f"upperArm.{side}"] = rot_y(-s * abduct) @ rot_x(-shoulder)
    pose.rel[f"foreArm.{side}"] = rot_x(-elbow)


def set_legs(pose, hl, kl, al, hr, kr, ar):
    for s, h, k, a in (("L", hl, kl, al), ("R", hr, kr, ar)):
        pose.rel[f"thigh.{s}"] = rot_x(-h)
        pose.rel[f"shin.{s}"] = rot_x(+k)
        pose.world[f"foot.{s}"] = rot_x(-a)
        pose.rel[f"toe.{s}"] = rot_x(-max(0.0, min(28.0, -a * 0.9)))   # toes bend up as the heel lifts


def plant_prop(pose, bone, rest_point, target, axes=(True, True, True)):
    """Shift a prop bone (after the ground solve) so a point of it lands on `target` (armature space, du)."""
    kin = SKEL.kin(pose)
    now = kin.point(bone, rest_point)
    delta = V(target) - now
    mask = V((delta.x if axes[0] else 0.0, delta.y if axes[1] else 0.0, delta.z if axes[2] else 0.0))
    pose.shift[bone] = pose.shift.get(bone, V()) + mask


def tail_wave(pose, phase, amp_yaw, amp_pitch, lag=0.7, bones=("tail.01", "tail.02", "tail.03", "tail.04")):
    for i, b in enumerate(bones):
        a = phase - i * lag
        pose.add_rel(b, rot_z(amp_yaw * (0.6 + 0.25 * i) * math.sin(a)))
        pose.add_rel(b, rot_x(amp_pitch * math.sin(a - 0.8)))


def finish(pose):
    """Make every pose carry its feet (absolute pitch) so blends between poses never mix frames of reference."""
    for s in "LR":
        pose.world.setdefault(f"foot.{s}", Q0.copy())
    return pose


# ---------------------------------------------------------------- hero style hooks

class Style:
    """Hero specific carry. Override in the hero script. `p` = the locomotion parameter dict of the frame."""

    def arms(self, pose, kind, p, ph):
        raise NotImplementedError

    def tail(self, pose, kind, p, ph):
        pass


# ---------------------------------------------------------------- locomotion tables (T43 3.2)

_FIELDS = ("hipL", "kneeL", "ankL", "hipR", "kneeR", "ankR", "shL", "shR", "elL", "elR", "lean")
_WALK_HALF = [
    (+25, 5, +8, -20, 14, -12, -20, +20, 15, 30, 4),   # contact
    (+18, 16, 0, -12, 34, -22, -12, +12, 18, 28, 4),   # down (trailing heel lifts: the toe must not drag)
    (+4, 10, 0, +6, 60, -10, 0, 0, 20, 20, 3),         # pass (swing knee a touch higher so the step reads)
    (-10, 4, -18, +22, 28, +2, +12, -12, 28, 15, 4),   # up
]
_RUN_HALF = [
    (+40, 18, +5, -30, 70, -10, -35, +35, 85, 85, 12),  # contact
    (+12, 35, -5, +15, 95, -20, -10, +10, 90, 90, 12),  # down
    (-35, 25, -25, +45, 60, 0, +30, -30, 90, 90, 14),   # air
]
WALK_FRAMES = 24
RUN_FRAMES = 16
WALK_STEP = 16.0   # du per step: cycle = 2 steps = 32 du = 0.571 u (T44 4.5)
RUN_CYCLE = 56.0   # du = 1.0 u
LEG_GAIN = {"walk": 1.0, "run": 1.0}   # calibrated per build (calibrate_walk): leg swing scale of the T43 table


def _mirror(row):
    d = dict(zip(_FIELDS, row))
    return (d["hipR"], d["kneeR"], d["ankR"], d["hipL"], d["kneeL"], d["ankL"],
            d["shR"], d["shL"], d["elR"], d["elL"], d["lean"])


def _table(half, times, period):
    rows = list(half) + [_mirror(r) for r in half]
    ts = list(times) + [t + period / 2 for t in times]
    return ts, [dict(zip(_FIELDS, r)) for r in rows]


_WALK_T, _WALK_ROWS = _table(_WALK_HALF, [0, 3, 6, 9], WALK_FRAMES)
_RUN_T, _RUN_ROWS = _table(_RUN_HALF, [0, 3, 6], RUN_FRAMES)


def gait_params(kind, f):
    ts, rows, period = (_WALK_T, _WALK_ROWS, WALK_FRAMES) if kind == "walk" else (_RUN_T, _RUN_ROWS, RUN_FRAMES)
    out = {}
    for k in _FIELDS:
        values = [r[k] for r in rows]
        # the spline must not overshoot the table (T43 7 item 15: shoulders within +-35, elbows <= 90)
        out[k] = max(min(values), min(max(values), hermite_periodic(ts, values, f, period)))
    return out


def torso_and_legs(pose, p, ph, kind):
    lean = p["lean"]
    g = LEG_GAIN[kind]
    set_legs(pose, p["hipL"] * g, p["kneeL"] * g, p["ankL"], p["hipR"] * g, p["kneeR"] * g, p["ankR"])
    pose.rot("spine", rot_x(+lean))
    pose.rot("head", rot_x(-lean * 0.8))
    yaw = (5 if kind == "walk" else 7) * math.sin(ph)
    pose.rot("hips", rot_z(yaw))                       # pelvis yaw
    pose.rot("spine", rot_z(-1.6 * yaw))               # counter-twist
    pose.rot("chest", rot_z(-0.8 * yaw))
    pose.rot("head", rot_z(1.4 * yaw))                 # keep the face looking ahead
    pose.rot("head", rot_x(1.5 * math.sin(2 * ph + 0.5)))
    swing = (p["hipL"] - p["hipR"]) / 50.0
    base = 4 if kind == "walk" else 18
    pose.rot("cloth.01", rot_x(base + 3 * math.sin(2 * ph) + 4 * swing))
    pose.rot("cloth.02", rot_x(0.8 * base + 5 * math.sin(2 * ph - 0.8)))


def locomotion_pose(style, kind, f):
    period = WALK_FRAMES if kind == "walk" else RUN_FRAMES
    ph = 2 * math.pi * (f % period) / period
    p = gait_params(kind, f)
    pose = HPose()
    torso_and_legs(pose, p, ph, kind)
    style.arms(pose, kind, p, ph)
    style.tail(pose, kind, p, ph)
    return finish(pose)


def idle_pose(style, f, frames=48):
    ph = 2 * math.pi * f / frames
    breath = math.sin(ph)
    pose = HPose()
    pose.rot("chest", rot_x(-1.6 * breath))
    pose.rot("spine", rot_x(0.6 * breath))
    pose.rot("head", rot_x(1.2 * breath - 0.4))
    pose.rot("head", rot_z(2.5 * math.sin(ph + 0.7)))
    pose.rot("hips", rot_y(0.8 * math.sin(ph)))                       # weight shift
    pose.rot("spine", rot_y(-0.8 * math.sin(ph)))
    pose.shift["hips"] = V((0.35 * math.sin(ph), 0, 0))               # <= 0.01 u
    pose.scale["chest"] = V((1 + 0.012 * breath, 1 + 0.012 * breath, 1 + 0.02 * breath))
    pose.rot("cloth.01", rot_x(2 + 1.2 * math.sin(ph - 0.6)))
    pose.rot("cloth.02", rot_x(3 + 2.0 * math.sin(ph - 1.2)))
    style.arms(pose, "idle", {"shL": 3 + 1.5 * breath, "elL": 10 + 2 * breath}, ph)
    style.tail(pose, "idle", {}, ph)
    return finish(pose)


# ---------------------------------------------------------------- leap (22 f: 4 anticipation / 2 takeoff / 10 air / 6 land)

LEAP_FRAMES = 22
LEAP_BANDS = (0, 4, 6, 16, 22)    # frame where each beat starts; the last number is the clip length
_LEAP_FIELDS = ("hipL", "kneeL", "ankL", "hipR", "kneeR", "ankR", "lean", "shL", "elL", "shR", "elR", "mace", "head")
_LEAP_KEYS = {
    #  f:   hipL kneeL ankL hipR kneeR ankR lean shL elL shR  elR mace head
    0:  (0, 0, 0, 0, 0, 0, 0, 3, 10, 25, 95, 24, 0),                       # idle
    4:  (50, 68, 14, 50, 68, 14, 16, -35, 20, -30, 25, 78, 4),             # anticipation: crouch, gada low behind
    6:  (-8, 6, -32, -8, 6, -32, 10, 70, 25, 70, 30, -10, -4),             # takeoff: extension on the toes
    11: (80, 74, -10, -42, 30, -38, 16, 112, 10, 172, 14, 6, -8),          # air, rising: lead knee up, gada high
    16: (56, 44, -6, -26, 22, -28, 14, 100, 10, 155, 18, 10, -4),          # touchdown begins: knees <= 45 from here
    18: (42, 44, 10, 36, 40, 8, 14, 38, 50, 60, 40, 0, 2),                 # land: knees <= 45
    22: (6, 8, 0, 6, 8, 0, 2, 5, 12, 28, 92, 20, 0),                       # recover toward the idle ready pose
}


def _leap_params(f):
    ks = sorted(_LEAP_KEYS)
    for a, b in zip(ks, ks[1:]):
        if a <= f <= b:
            t = smooth((f - a) / (b - a))
            return {name: _LEAP_KEYS[a][i] + (_LEAP_KEYS[b][i] - _LEAP_KEYS[a][i]) * t
                    for i, name in enumerate(_LEAP_FIELDS)}
    return dict(zip(_LEAP_FIELDS, _LEAP_KEYS[ks[-1]]))


def angle_pose(style, p, tail_phase):
    """Angle-keyed whole-body pose (leap, cheer): legs, lean, head, cloth from `p`; arms/prop/tail from the style."""
    pose = HPose()
    set_legs(pose, p["hipL"], p["kneeL"], p["ankL"], p["hipR"], p["kneeR"], p["ankR"])
    pose.rot("spine", rot_x(+p["lean"]))
    pose.rot("head", rot_x(-p["lean"] * 0.6 + p["head"]))
    pose.rot("cloth.01", rot_x(10 + 0.3 * (p["hipL"] + p["hipR"])))
    pose.rot("cloth.02", rot_x(14))
    style.arms(pose, "leap", p, 0.0)
    style.tail(pose, "leap", p, tail_phase)
    return finish(pose)


def leap_pose(style, f):
    return angle_pose(style, _leap_params(f), f / LEAP_FRAMES * 2 * math.pi)


# ---------------------------------------------------------------- solves over a clip

def solve_ground(poses, air=None, air_hop=0.0, hold=None):
    """Root height per frame. air = set of frames with no foot contact: lowest sole + a hop arc instead."""
    air = air or set()
    n = len(poses)
    z = [None] * n
    for f, pose in enumerate(poses):
        if pose.free:
            continue
        z[f] = SKEL.ground_z(pose)
    if hold:                                  # frames that keep the take-off height (leap flight)
        for f in hold:
            z[f] = z[min(hold) - 1]
    if air:
        runs, cur = [], []
        for f in sorted(air):
            if cur and f != cur[-1] + 1:
                runs.append(cur)
                cur = []
            cur.append(f)
        runs.append(cur)
        for run in runs:
            for k, f in enumerate(run):
                z[f] += air_hop * math.sin(math.pi * (k + 1) / (len(run) + 1))
    for f, pose in enumerate(poses):
        zz = z[f] if z[f] is not None else 0.0
        sh = pose.shift.get("root", V())
        pose.shift["root"] = V((sh.x, sh.y, sh.z + zz + pose.hop))
    return z


def lock_feet(poses, windows, speed, pad, period):
    """Planted ankles move back at `speed` du/frame (treadmill); the game moves the figure forward at the same speed.
    Solves root forward shift (y). Returns the residual planted-ankle drift in du over the cycle."""
    n = period
    raw = {s: [-SKEL.kin(poses[f]).head(f"foot.{s}").y for f in range(n)] for s in "LR"}
    acc = []
    for s in "LR":
        start, length = windows[s]
        for k in range(length):
            acc.append(raw[s][(start + k) % n] + speed * k)
    c = sum(acc) / len(acc)
    fwd = []
    for f in range(n):
        shifts, weights = [], []
        for s in "LR":
            start, length = windows[s]
            k = ((f - start + length / 2) % n) - length / 2
            shifts.append(c - speed * k - raw[s][f])
            centre = start + (length - 1) / 2
            d = abs(((f - centre + n / 2) % n) - n / 2)
            weights.append(max(0.0, min(1.0, (length / 2 + pad - d) / 2.0)))
        total = sum(weights)
        fwd.append(sum(a * b for a, b in zip(shifts, weights)) / total if total > 1e-6 else 0.0)
    for f in range(n):
        sh = poses[f].shift.get("root", V())
        poses[f].shift["root"] = V((sh.x, -fwd[f], sh.z))
    # residual: ankle world position along travel (+ treadmill) within each stance window
    worst = 0.0
    for s in "LR":
        start, length = windows[s]
        vals = []
        for k in range(1, length - 1):
            f = (start + k) % n
            vals.append(raw[s][f] + fwd[f] + speed * k)
        worst = max(worst, max(vals) - min(vals))
    return worst


# ---------------------------------------------------------------- baking

def _rest_rotations(arm):
    return {b.name: b.matrix_local.to_quaternion() for b in arm.data.bones}


def key_pose(arm, rests, pose, frame, shift_bones, scale_bones):
    kin = SKEL.kin(pose)
    for b in SKEL.order:
        if b not in arm.pose.bones:     # a hero rig may drop the extras it does not use (Lakshmana has no tail)
            continue
        pb = arm.pose.bones[b]
        pb.rotation_quaternion = rests[b].inverted() @ kin.Q[b] @ rests[b]
        pb.keyframe_insert("rotation_quaternion", frame=frame, group=b)
    for b in shift_bones:
        p = SKEL.parent[b]
        dp = kin.D[p] if p else Q0
        v = pose.shift.get(b, V())
        pb = arm.pose.bones[b]
        pb.location = (rests[b].inverted() @ (dp.inverted() @ v)) * SCALE
        pb.keyframe_insert("location", frame=frame, group=b)
    for b in scale_bones:
        pb = arm.pose.bones[b]
        pb.scale = pose.scale.get(b, V((1, 1, 1)))
        pb.keyframe_insert("scale", frame=frame, group=b)


def bake(arm, name, poses, verify=()):
    """Key every frame of `poses` (frame i = index i), linear interpolation, park the action on its own NLA track."""
    act = _anim.new_action(arm, name)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 0, len(poses) - 1
    rests = _rest_rotations(arm)
    shift_bones = sorted({b for p in poses for b in p.shift})
    scale_bones = sorted({b for p in poses for b in p.scale})
    for f, pose in enumerate(poses):
        key_pose(arm, rests, pose, f, shift_bones, scale_bones)
    for fc in _anim.iter_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    err = verify_fk(arm, poses, verify) if verify else 0.0   # while the action is still the active one
    _anim.park_on_nla(arm, act)
    return err


def loop_close(poses):
    """Loop convention: frame N repeats frame 0 (duration N / fps, no duplicated pose on the wrap)."""
    poses.append(poses[0])
    return poses


# ---------------------------------------------------------------- clip assemblers (generic)

def clip_idle(style, frames=48):
    poses = [idle_pose(style, f, frames) for f in range(frames)]
    solve_ground(poses)
    return loop_close(poses)


def calibrate_walk(style):
    """Scale the table's leg swing so the feet at the contact pose are exactly one step apart: then the planted
    foot hands over to the next without sliding (a mismatch would show as skating at every step)."""
    lo, hi = 0.6, 1.6
    for _ in range(40):
        LEG_GAIN["walk"] = mid = (lo + hi) / 2
        k = SKEL.kin(locomotion_pose(style, "walk", 0))
        separation = k.head("foot.R").y - k.head("foot.L").y        # forward is -y: L ahead of R
        lo, hi = (mid, hi) if separation < WALK_STEP else (lo, mid)
    return LEG_GAIN["walk"]


def clip_walk(style):
    calibrate_walk(style)
    poses = [locomotion_pose(style, "walk", f) for f in range(WALK_FRAMES)]
    solve_ground(poses)
    drift = lock_feet(poses, {"L": (0, 12), "R": (12, 12)}, WALK_STEP / 12.0, 0.5, WALK_FRAMES)
    return loop_close(poses), drift


def clip_run(style):
    n = RUN_FRAMES
    poses = [locomotion_pose(style, "run", f) for f in range(n)]
    solve_ground(poses, air={6, 7, 14, 15}, air_hop=3.0)
    drift = lock_feet(poses, {"L": (0, 6), "R": (8, 6)}, RUN_CYCLE / n, 2.0, n)
    return loop_close(poses), drift


def clip_leap(style):
    poses = [leap_pose(style, f) for f in range(LEAP_FRAMES + 1)]
    solve_ground(poses, hold=set(range(7, 16)))
    return poses


def clip_from_blend(style_idle0, target_fn, frames, rise, wobble=None):
    """Emotion clip: idle -> target pose over `rise` frames, then hold (with optional small motion)."""
    poses = []
    for f in range(frames + 1):
        t = smooth(f / rise)
        pose = blend(style_idle0, target_fn(f), t)
        if wobble:
            wobble(pose, f, t)
        poses.append(finish(pose))
    solve_ground(poses)
    return poses


# ---------------------------------------------------------------- respect / sanity numbers from FK

def _angle(a, b):
    return math.degrees(a.angle(b))


def clip_report(poses):
    """Respect-checklist numbers for a clip (design units / degrees)."""
    lean = head_over_hips = shoulder_swing = elbow = knee = shoulder_top = None
    out = {"max_lean": 0.0, "min_head_over_hips": 1e9, "max_shoulder_swing": 0.0, "max_elbow": 0.0,
           "max_free_swing": 0.0, "max_free_elbow": 0.0, "max_knee": 0.0, "min_shoulder_top": 1e9, "max_z": 0.0}
    for pose in poses:
        k = SKEL.kin(pose)
        up = k.head("neck") - k.head("hips")
        out["max_lean"] = max(out["max_lean"], _angle(up, V((0, 0, 1))))
        out["min_head_over_hips"] = min(out["min_head_over_hips"], k.head("head").z - k.head("hips").z)
        out["min_shoulder_top"] = min(out["min_shoulder_top"], min(k.head("upperArm.L").z, k.head("upperArm.R").z) + 2.3)
        for s in "LR":
            out["max_shoulder_swing"] = max(out["max_shoulder_swing"], _angle(k.dir(f"upperArm.{s}"), V((0, 0, -1))))
            out["max_elbow"] = max(out["max_elbow"], _angle(k.dir(f"upperArm.{s}"), k.dir(f"foreArm.{s}")))
            out["max_knee"] = max(out["max_knee"], _angle(k.dir(f"thigh.{s}"), k.dir(f"shin.{s}")))
        out["max_free_swing"] = max(out["max_free_swing"], _angle(k.dir("upperArm.L"), -k.dir("chest")))   # the arm that is not carrying, measured from the torso
        out["max_free_elbow"] = max(out["max_free_elbow"], _angle(k.dir("upperArm.L"), k.dir("foreArm.L")))
        top = max(k.head("head").z + 7.2, k.head("prop.R").z)
        out["max_z"] = max(out["max_z"], top)
    return {k: round(v, 2) for k, v in out.items()}


def verify_fk(arm, poses, frames=(0,)):
    """Compare our FK with Blender's evaluated pose (armature space, metres -> du). Returns the max error in du."""
    worst = 0.0
    scene = bpy.context.scene
    tracks = list(arm.animation_data.nla_tracks)
    muted = [t.mute for t in tracks]
    for t in tracks:                                  # parked clips of earlier bakes must not blend in
        t.mute = True
    for f in frames:
        scene.frame_set(f)
        bpy.context.view_layer.update()
        kin = SKEL.kin(poses[f])
        for b in ("foot.L", "foot.R", "hand.R", "head", "tail.04", "prop.R"):
            if b not in arm.pose.bones:
                continue
            blender_head = arm.pose.bones[b].head / SCALE
            err = (blender_head - kin.head(b)).length
            if err > 0.05:
                print(f"FK mismatch frame {f} {b}: {err:.3f} du  blender {tuple(round(c, 2) for c in blender_head)} ours {tuple(round(c, 2) for c in kin.head(b))}")
            worst = max(worst, err)
    for t, m in zip(tracks, muted):
        t.mute = m
    return worst
