"""T44.7 dice: boxwood die with brass pips (saffron six), teak tray with brass rim and indigo felt, 3 tumble clips.

Run: node scripts/blender/run.mjs scripts/blender/die.py public/models/dice/die.glb
Blender axes (+Z up). Origin = the middle of the felt floor; the die's centre rests at z = 0.21.
Pips: 1 on +Z, 2 on -Y, 3 on +X, 4 on -X, 5 on +Y, 6 on -Z (opposite faces sum to 7). glTF turns these into
1 +Y, 2 +Z, 3 +X, 4 -X, 5 -Z, 6 -Y, which is the table in src/app/board3d/dieRoll.ts.
Clips tumble_0..2 (24 fps, 24 frames): drop from 0.5 u, floor contacts at frames 6, 12, 18 (the die is axis-aligned
to the floor on each contact), slide 0.3 u to rest. The mesh node is "die", the tray node is "tray".
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import export  # noqa: E402
import lib  # noqa: E402
from anim import iter_fcurves, new_action, park_on_nla  # noqa: E402

FPS = 24
FRAMES = 24
EDGE = 0.42
HALF = EDGE / 2
CONTACTS = (6, 12, 18)

BOXWOOD = "#E3CDA4"
BRASS = "#C9A24A"
SAFFRON = "#F39C2B"
TEAK = "#B08A5E"
FELT = "#4A4F8C"

PIP_R = 0.045
PIP_STEP = 0.1
# (u, v) offsets on a face, v up; the classic layouts
PIP_LAYOUT = {
    1: [(0, 0)],
    2: [(-1, 1), (1, -1)],
    3: [(-1, 1), (0, 0), (1, -1)],
    4: [(-1, 1), (1, 1), (-1, -1), (1, -1)],
    5: [(-1, 1), (1, 1), (0, 0), (-1, -1), (1, -1)],
    6: [(-1, 1), (1, 1), (-1, 0), (1, 0), (-1, -1), (1, -1)],
}
FACE_NORMAL = {1: (0, 0, 1), 2: (0, -1, 0), 3: (1, 0, 0), 4: (-1, 0, 0), 5: (0, 1, 0), 6: (0, 0, -1)}


def box(kit, centre, size, bevel, segments=2):
    """A bevelled box added to the kit's bmesh (call kit.bind afterwards)."""
    m = Matrix.Translation(Vector(centre)) @ Matrix.Diagonal(Vector((*size, 1.0)))
    res = bmesh.ops.create_cube(kit.bm, size=1.0, matrix=m)
    edges = {e for v in res["verts"] for e in v.link_edges}
    bmesh.ops.bevel(kit.bm, geom=list(edges), offset=bevel, segments=segments, affect="EDGES", profile=0.5)
    kit._fix_normals()


def build_die(mats):
    kit = lib.MeshKit("die", scale=1.0)
    box(kit, (0, 0, 0), (EDGE, EDGE, EDGE), bevel=0.06)
    kit.bind("die", mats["boxwood"])
    for value in range(1, 7):
        n = Vector(FACE_NORMAL[value])
        rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix()
        tu, tv = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0))
        for (iu, iv) in PIP_LAYOUT[value]:
            origin = n * HALF + tu * (iu * PIP_STEP) + tv * (iv * PIP_STEP)
            # inlaid dome: sunk 0.008 below the face, 0.012 proud (a cone-like cap, 8 sides)
            kit.lathe([(-0.008, PIP_R), (0.012, PIP_R * 0.6)], origin=origin, axis=n, sides=8)
        kit.bind("die", mats["saffron"] if value == 6 else mats["brass"])
    obj = kit.build_object()
    obj.name = "die"
    obj.location = (0, 0, HALF)
    return obj


def build_tray(mats):
    kit = lib.MeshKit("tray", scale=1.0)
    L, W = 1.6, 1.2
    wall = 0.07
    box(kit, (0, 0, -0.065), (L, W, 0.11), 0.012)
    kit.bind("tray", mats["teak"])
    for sx in (-1, 1):
        box(kit, (sx * (L / 2 - wall / 2), 0, -0.035), (wall, W, 0.17), 0.012)
    for sy in (-1, 1):
        box(kit, (0, sy * (W / 2 - wall / 2), -0.035), (L - 2 * wall, wall, 0.17), 0.012)
    kit.bind("tray", mats["teak"])
    # brass rim cap, slightly wider than the wall
    cap = wall + 0.012
    for sx in (-1, 1):
        box(kit, (sx * (L / 2 - wall / 2), 0, 0.056), (cap, W + 0.012, 0.014), 0.004, 1)
    for sy in (-1, 1):
        box(kit, (0, sy * (W / 2 - wall / 2), 0.056), (L - 2 * wall, cap, 0.014), 0.004, 1)
    kit.bind("tray", mats["brass"])
    box(kit, (0, 0, -0.01), (L - 2 * wall, W - 2 * wall, 0.02), 0.004, 1)
    kit.bind("tray", mats["felt"])
    obj = kit.build_object()
    obj.name = "tray"
    return obj


# ---------------------------------------------------------------- clips

# Per clip: start/end of the travel (x, y), the roll about a horizontal world axis in each of the 3 airborne
# segments as (axis, quarter-turns), and the final yaw. Quarter-turn rolls keep the die axis-aligned at contacts.
CLIPS = [
    dict(start=(-0.40, 0.12), end=(0.40, -0.10), rolls=[("X", 3), ("Y", 2), ("X", 1)], yaw=25),
    dict(start=(0.40, -0.12), end=(-0.38, 0.10), rolls=[("Y", -3), ("X", 3), ("Y", -1)], yaw=-32),
    dict(start=(-0.34, -0.16), end=(0.36, 0.14), rolls=[("X", -2), ("Y", 2), ("X", -1)], yaw=52),
]
AIR_RISE = (0.5, 0.16, 0.06)       # drop height, then the two bounce heights
TRAVEL = (0.15, 0.15, 0.20, 0.30)  # distance per segment; the last is the 0.3 u slide (total 0.8)


def smooth(t):
    return t * t * (3 - 2 * t)


def clip_pose(spec, f):
    """(location, quaternion) of the die centre in Blender space at frame f."""
    seg = min(f // 6, 3)
    s = (f - seg * 6) / 6.0
    total = sum(TRAVEL)
    done = sum(TRAVEL[:seg]) + TRAVEL[seg] * (smooth(s) if seg == 3 else s)
    k = done / total
    x = spec["start"][0] + (spec["end"][0] - spec["start"][0]) * k
    y = spec["start"][1] + (spec["end"][1] - spec["start"][1]) * k
    if seg == 0:
        z = HALF + AIR_RISE[0] * (1 - s * s)
    elif seg < 3:
        z = HALF + AIR_RISE[seg] * 4 * s * (1 - s)
    else:
        z = HALF
    roll = Quaternion()
    for i, (axis, quarters) in enumerate(spec["rolls"]):
        frac = 1.0 if seg > i else (s if seg == i else 0.0)
        if frac:
            roll = Quaternion(Vector((1, 0, 0) if axis == "X" else (0, 1, 0)), math.radians(90 * quarters) * frac) @ roll
    yaw = Quaternion((0, 0, 1), math.radians(spec["yaw"]) * smooth(f / FRAMES))
    return Vector((x, y, z)), yaw @ roll


def bake_tumble(die, index, spec):
    act = new_action(die, f"tumble_{index}")
    die.rotation_mode = "QUATERNION"
    prev = None
    for f in range(FRAMES + 1):
        loc, q = clip_pose(spec, f)
        if prev is not None and q.dot(prev) < 0:
            q.negate()
        prev = q
        die.location = loc
        die.rotation_quaternion = q
        die.keyframe_insert("location", frame=f)
        die.keyframe_insert("rotation_quaternion", frame=f)
    for fc in iter_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    park_on_nla(die, act)


def main():
    out = sys.argv[sys.argv.index("--") + 1]
    lib.reset_scene()
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 0, FRAMES
    mats = {
        "boxwood": lib.clay_material("boxwood", BOXWOOD, 0.7),
        "brass": lib.clay_material("brass", BRASS, 0.35, 0.9),
        "saffron": lib.clay_material("saffron", SAFFRON, 0.55),
        "teak": lib.clay_material("teak", TEAK, 0.78),
        "felt": lib.clay_material("felt", FELT, 1.0),
    }
    tray = build_tray(mats)
    die = build_die(mats)
    for i, spec in enumerate(CLIPS):
        bake_tumble(die, i, spec)
    die.location = (0, 0, HALF)
    die.rotation_mode = "QUATERNION"
    die.rotation_quaternion = Quaternion()
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    export.export_glb(out, [die, tray])
    print("die tris", lib.triangle_count(die), "tray tris", lib.triangle_count(tray))


main()
