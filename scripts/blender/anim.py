"""Keyframed clips for the humanoid rig (Blender 5.x layered actions).

A clip = name + frame count + pose function. `bake_clip` keys EVERY frame (linear interpolation, so the
glTF sampler reproduces it exactly) and parks the action on its own NLA track so the exporter emits one
animation per clip, named after the action.
Loop convention: frames 0..N inclusive, frame N == frame 0 (clip duration N / fps, no duplicated pose on loop).
"""
import math

import bpy
from mathutils import Vector

from rig import Pose, key_pose, rot_x, rot_y, rot_z

FPS = 30
SCALE = 1.0 / 80.0   # design units -> metres


# ---------------------------------------------------------------- generic

def periodic_catmull(values, t):
    """Catmull-Rom through `values` (periodic), t in [0, len)."""
    n = len(values)
    i = int(math.floor(t)) % n
    f = t - math.floor(t)
    p0, p1, p2, p3 = values[(i - 1) % n], values[i], values[(i + 1) % n], values[(i + 2) % n]
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)


def new_action(arm, name):
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    return act


def park_on_nla(arm, act):
    """Move the finished action to its own NLA track (keeps it alive and exportable by name)."""
    ad = arm.animation_data
    track = ad.nla_tracks.new()
    track.name = act.name
    strip = track.strips.new(act.name, int(act.frame_range[0]), act)
    strip.name = act.name
    ad.action = None
    return track


def iter_fcurves(act):
    """Blender 5.x: fcurves live in channelbags of layered actions (action.fcurves was removed)."""
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves


def bake_clip(arm, name, frames, pose_fn, post=None):
    """Key pose_fn(f) for f in 0..frames inclusive. `post(arm, frames)` may add root keys afterwards."""
    act = new_action(arm, name)
    scene = bpy.context.scene
    scene.render.fps = FPS   # the exporter converts frames to seconds with the scene fps (default 24!)
    scene.frame_start, scene.frame_end = 0, frames
    for f in range(frames + 1):
        key_pose(arm, pose_fn(f), f)
    if post:
        post(arm, frames)
    for fc in iter_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    park_on_nla(arm, act)
    return act


# ---------------------------------------------------------------- walk (8-beat contact / down / pass / up)

# Spec T43 3.2 joint-angle table. keys 0..3 = left foot forward half; 4..7 mirror with L/R swapped.
# Conventions: hip/shoulder + = forward, knee/elbow + = flexion, ankle + = toes up (WORLD pitch of the foot,
# so a stance foot stays flat), lean + = torso pitched forward.
_FIELDS = ("hipL", "kneeL", "ankL", "hipR", "kneeR", "ankR", "shL", "shR", "elL", "elR", "lean")
_WALK_HALF = [
    (+25, 5, +8, -20, 8, -12, -20, +20, 15, 30, 4),    # contact
    (+18, 16, 0, -12, 10, -22, -12, +12, 18, 28, 4),   # down
    (+4, 10, 0, +6, 48, -10, 0, 0, 20, 20, 3),         # pass
    (-10, 4, -18, +22, 22, +2, +12, -12, 28, 15, 4),   # up
]
WALK_FRAMES_PER_KEY = 3
WALK_FRAMES = 8 * WALK_FRAMES_PER_KEY       # 24 frames = 0.8 s
WALK_STEP = 16.0                            # design units per step (spec); stride = 2 steps
STRIDE_UNITS = 2 * WALK_STEP


def _walk_table():
    keys = [dict(zip(_FIELDS, row)) for row in _WALK_HALF]
    mirrored = [{
        "hipL": k["hipR"], "kneeL": k["kneeR"], "ankL": k["ankR"],
        "hipR": k["hipL"], "kneeR": k["kneeL"], "ankR": k["ankL"],
        "shL": k["shR"], "shR": k["shL"], "elL": k["elR"], "elR": k["elL"], "lean": k["lean"],
    } for k in keys]
    return keys + mirrored


_WALK = _walk_table()


def walk_params(f):
    t = (f % WALK_FRAMES) / WALK_FRAMES_PER_KEY
    return {name: periodic_catmull([k[name] for k in _WALK], t) for name in _FIELDS}


def tail_wave(pose, phase, amp_yaw, amp_pitch, lag=0.7):
    """Travelling wave down the 4-bone tail: yaw sway + a little pitch ripple (degrees)."""
    for i, b in enumerate(("tail1", "tail2", "tail3", "tail4")):
        a = phase - i * lag
        pose.add_rel(b, rot_z(amp_yaw * (0.6 + 0.25 * i) * math.sin(a)))
        pose.add_rel(b, rot_x(amp_pitch * math.sin(a - 0.8)))


def humanoid_walk_pose(f):
    p = walk_params(f)
    ph = 2 * math.pi * (f % WALK_FRAMES) / WALK_FRAMES
    pose = Pose()
    for side in "LR":
        pose.add_rel(f"thigh.{side}", rot_x(-p["hip" + side]))
        pose.add_rel(f"shin.{side}", rot_x(+p["knee" + side]))
        pose.set_world(f"foot.{side}", rot_x(-p["ank" + side]))
    pose.add_rel("spine", rot_x(+p["lean"]))
    pose.add_rel("head", rot_x(-p["lean"] * 0.8))
    pose.add_rel("hips", rot_z(5 * math.sin(ph)))          # pelvis yaw
    pose.add_rel("spine", rot_z(-8 * math.sin(ph)))        # counter-twist
    pose.add_rel("chest", rot_z(-4 * math.sin(ph)))
    pose.add_rel("head", rot_z(7 * math.sin(ph)))          # keep the face looking ahead
    pose.add_rel("head", rot_x(1.5 * math.sin(2 * ph + 0.5)))
    # left arm swings per table; right arm carries the gada shouldered (damped swing, elbow held)
    pose.add_rel("upper_arm.L", rot_x(-p["shL"]))
    pose.add_rel("lower_arm.L", rot_x(-p["elL"]))
    pose.add_rel("upper_arm.R", rot_x(-(25 + 0.5 * p["shR"])))
    pose.add_rel("lower_arm.R", rot_x(-(90 + 0.3 * p["elR"])))
    pose.set_world("prop", rot_y(-22) @ rot_x(-24))
    tail_wave(pose, ph, 5.6, 2.5)
    return pose


def _sole_points(arm, side):
    """Heel and toe ground-contact points of a foot, in the foot bone's rest-local frame."""
    bone = arm.data.bones[f"foot.{side}"]
    x = bone.head_local.x
    inv = bone.matrix_local.inverted()
    return [inv @ Vector((x, 2.6 * SCALE, 0.0)), inv @ Vector((x, -6.4 * SCALE, 0.0))]


def foot_lock(arm, frames):
    """Solve the root so the stance foot is planted: constant ground speed, lowest sole on z = 0.
    The stance ankle is forced onto a straight line moving backwards at stride/duration (walk-in-place
    treadmill); the game then moves the character forward at that same speed. Handoff between feet is
    blended over ~2 frames. Root offsets are keyed on `root` (its axes equal armature axes)."""
    scene = bpy.context.scene
    soles = {s: _sole_points(arm, s) for s in "LR"}
    half = WALK_FRAMES // 2
    slope = (WALK_STEP * SCALE) / half                     # forward metres lost per frame while planted
    raw = {"L": [], "R": []}                               # forward ankle position (metres) per frame
    minz = []
    for f in range(frames + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        low = 1e9
        for s in "LR":
            pb = arm.pose.bones[f"foot.{s}"]
            raw[s].append(-pb.head.y)
            for lp in soles[s]:
                low = min(low, (pb.matrix @ lp).z)
        minz.append(low)
    acc = []
    for f in range(WALK_FRAMES):
        s, ph = ("L", f) if f < half else ("R", f - half)
        acc.append(raw[s][f] + slope * ph)
    c = sum(acc) / len(acc)                                # line offset that minimises root surge
    for f in range(frames + 1):
        fm = f % WALK_FRAMES
        shifts, weights = [], []
        for s, start in (("L", 0), ("R", half)):
            centre = start + half / 2
            d = abs(((fm - centre + WALK_FRAMES / 2) % WALK_FRAMES) - WALK_FRAMES / 2)
            weights.append(max(0.0, min(1.0, (half / 2 + 0.5 - d) / 2.0)))
            phase = ((fm - start + half / 2) % WALK_FRAMES) - half / 2   # [-6, 18): stance is [0, 12]
            shifts.append(c - slope * phase - raw[s][f])
        fwd = sum(a * b for a, b in zip(shifts, weights)) / max(1e-6, sum(weights))
        pb = arm.pose.bones["root"]
        pb.location = Vector((0.0, -fwd, -minz[f]))
        pb.keyframe_insert("location", frame=f, group="root")


def humanoid_walk(arm):
    return bake_clip(arm, "walk", WALK_FRAMES, humanoid_walk_pose, post=foot_lock)


# ---------------------------------------------------------------- idle (breathing + tail sway)

IDLE_FRAMES = 48     # 1.6 s


def humanoid_idle_pose(f):
    ph = 2 * math.pi * f / IDLE_FRAMES
    breath = math.sin(ph)
    pose = Pose()
    pose.add_rel("chest", rot_x(-1.6 * breath))
    pose.add_rel("spine", rot_x(0.6 * breath))
    pose.add_rel("head", rot_x(1.2 * breath - 0.4))
    pose.add_rel("head", rot_z(2.5 * math.sin(ph + 0.7)))
    pose.scale["chest"] = Vector((1 + 0.012 * breath, 1 + 0.012 * breath, 1 + 0.02 * breath))
    pose.add_rel("upper_arm.L", rot_x(-(3 + 1.5 * breath)))
    pose.add_rel("lower_arm.L", rot_x(-(10 + 2 * breath)))
    pose.add_rel("upper_arm.R", rot_x(-(25 + 1.0 * breath)))
    pose.add_rel("lower_arm.R", rot_x(-(95 - 1.5 * breath)))
    pose.set_world("prop", rot_y(-24) @ rot_x(-26))
    tail_wave(pose, ph, 7.0, 3.0, lag=0.9)
    return pose


def humanoid_idle(arm):
    return bake_clip(arm, "idle", IDLE_FRAMES, humanoid_idle_pose)
