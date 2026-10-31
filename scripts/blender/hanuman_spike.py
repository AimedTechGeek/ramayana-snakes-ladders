"""Hanuman spike: procedural clay-toy Hanuman, rigged, idle + walk, exported as a meshopt GLB.

Run (headless):
  blender --background --factory-startup --python scripts/blender/hanuman_spike.py -- <out.glb> [--no-meshopt] [--metrics <file.json>]

Adding a character: copy this file, keep the bone names from rig.HUMANOID (or pass your own bone dict),
build parts with MeshKit (`kit.sphere/lathe/tube/capsule/ring` then `kit.bind(bone, material[, weights])`),
call rig.skin, anim.humanoid_idle / humanoid_walk, then export.export_glb.
"""
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import anim  # noqa: E402
import export  # noqa: E402
import lib  # noqa: E402
import rig  # noqa: E402

# ---- palette (T43 1.2, softened toward pastel clay)
FUR = "#F4B068"
CREAM = "#F7E6C4"
SAFFRON = "#F08A2C"
GOLD = "#EBC23A"
SEAT = "#E4572E"
WOOD = "#7A4E2A"
INK = "#3A2418"
WHITE = "#FFF8EA"

SCALE = 1.0 / 80.0
V = Vector


def smooth_weights(centres, bones):
    """Hat-function skin blend along a value axis. centres ascending; returns callable(value)->{bone: w}."""
    def f(value):
        if value <= centres[0]:
            return {bones[0]: 1.0}
        if value >= centres[-1]:
            return {bones[-1]: 1.0}
        for i in range(len(centres) - 1):
            if centres[i] <= value <= centres[i + 1]:
                t = (value - centres[i]) / (centres[i + 1] - centres[i])
                t = t * t * (3 - 2 * t)
                return {bones[i]: 1 - t, bones[i + 1]: t}
        return {bones[-1]: 1.0}
    return f


def build_hanuman_mesh():
    M = {name: lib.clay_material(name, hexv, rough, metal) for name, hexv, rough, metal in (
        ("fur", FUR, 0.78, 0.0), ("cream", CREAM, 0.8, 0.0), ("saffron", SAFFRON, 0.72, 0.0),
        ("gold", GOLD, 0.34, 0.0), ("seat", SEAT, 0.6, 0.0), ("wood", WOOD, 0.7, 0.0),
        ("ink", INK, 0.35, 0.0), ("white", WHITE, 0.3, 0.0))}
    kit = lib.MeshKit("Hanuman", scale=SCALE)

    torso_w = lambda co: smooth_weights([22, 28, 34], ["hips", "spine", "chest"])(co.z)

    # ---------------------------------------------------------------- torso, belly, skirt, belt, sash
    torso_profile = [(21.0, 5.0), (22.0, 7.0), (26.0, 8.5), (31.0, 8.0), (35.0, 7.6), (37.6, 5.6), (38.4, 3.0)]
    kit.lathe(torso_profile, sides=16, squash=(1.0, 0.86))
    kit.bind("spine", M["fur"], torso_w)
    kit.sphere((0, -5.2, 29.0), (5.6, 3.6, 6.8), u=10, v=7)
    kit.bind("spine", M["cream"], torso_w)

    kit.lathe([(17.2, 7.0), (17.6, 8.0), (19.0, 8.4), (23.0, 8.8), (29.0, 8.0), (29.6, 7.0)], sides=16, squash=(1.0, 0.92))
    kit.bind("hips", M["saffron"])
    kit.lathe([(16.9, 7.2), (17.3, 8.1), (18.6, 8.5), (19.2, 8.6)], sides=16, squash=(1.0, 0.92))
    kit.bind("hips", M["gold"])
    kit.lathe([(28.8, 7.6), (29.3, 8.3), (30.9, 8.3), (31.4, 7.6)], sides=16, squash=(1.0, 0.9))
    kit.bind("spine", M["seat"], torso_w)
    kit.sphere((0, -7.9, 30.1), 1.9, u=10, v=7)
    kit.bind("spine", M["gold"], torso_w)

    # sash: right shoulder -> left hip, riding on the torso surface
    sash = []
    for i in range(7):
        t = i / 6.0
        x = -5.4 + 10.8 * t
        z = 37.2 - 9.6 * t
        rx = 8.0 + 0.0
        ry = rx * 0.86
        y = -ry * math.sqrt(max(0.05, 1 - (x / rx) ** 2))
        out = V((x / rx, y / ry, 0)).normalized()
        sash.append(V((x, y, z)) + out * 1.0)
    kit.tube(sash, 1.5, sides=8)
    kit.bind("spine", M["seat"], torso_w)

    # ---------------------------------------------------------------- head
    HC = (0, 0, 50.0)
    kit.sphere(HC, (12.5, 12.0, 12.0), u=16, v=11)
    kit.bind("head", M["fur"])
    for sx in (-1, 1):
        kit.sphere((sx * 4.6, -9.0, 49.2), (5.0, 3.3, 5.0), u=10, v=7)               # cheek / face mask
        kit.bind("head", M["cream"])
        kit.sphere((sx * 12.7, -0.6, 50.5), (2.0, 3.4, 3.8), u=10, v=8)               # ear
        kit.bind("head", M["fur"])
        kit.sphere((sx * 13.5, -1.0, 50.5), (0.9, 2.3, 2.7), u=7, v=5)                # inner ear
        kit.bind("head", M["cream"])
        kit.sphere((sx * 4.7, -11.5, 50.9), (1.5, 1.0, 2.0), u=10, v=7)               # eye
        kit.bind("head", M["ink"])
        kit.sphere((sx * 4.3, -12.4, 51.9), 0.55, u=6, v=5)                           # eye highlight
        kit.bind("head", M["white"])
        kit.tube([(sx * 2.3, -11.3, 54.7), (sx * 4.7, -11.2, 55.4), (sx * 7.0, -10.4, 54.9)], 0.55, sides=6)  # brow
        kit.bind("head", M["ink"])
    kit.sphere((0, -10.4, 46.0), (4.7, 3.5, 3.8), u=10, v=7)                           # muzzle
    kit.bind("head", M["cream"])
    kit.sphere((0, -13.4, 47.6), (1.5, 0.9, 1.0), u=7, v=5)                            # nose
    kit.bind("head", M["ink"])
    kit.tube([(-2.9, -13.0, 45.0), (-1.2, -13.4, 43.9), (1.2, -13.4, 43.9), (2.9, -13.0, 45.0)], 0.38, sides=6)
    kit.bind("head", M["ink"])                                                          # smile
    kit.sphere((0, -10.6, 56.2), (1.0, 0.7, 2.0), u=7, v=5)                            # sindoor
    kit.bind("head", M["seat"])
    # ruff under the chin
    kit.lathe([(36.8, 5.0), (37.8, 6.8), (39.2, 6.6), (40.4, 4.0)], sides=16, squash=(1.0, 0.9))
    kit.bind("neck", M["cream"])

    # crown (kiritamukuta): stacked gold tiers
    crown = [(58.4, 9.8), (58.8, 10.4), (60.6, 10.4), (61.0, 9.4),
             (61.4, 8.4), (63.0, 8.9), (65.2, 7.6), (65.6, 6.6),
             (66.0, 6.6), (67.5, 6.9), (69.5, 5.6), (70.0, 4.8),
             (70.3, 4.8), (71.5, 4.9), (73.5, 3.2), (74.2, 2.4),
             (74.6, 2.2), (75.6, 2.2), (77.0, 0.9)]
    kit.lathe(crown, sides=14, squash=(1.0, 0.96))
    kit.bind("head", M["gold"])
    kit.sphere((0, 0, 77.6), 1.5, u=7, v=5)
    kit.bind("head", M["seat"])

    # ---------------------------------------------------------------- arms (L +X, R -X)
    for side, sx in (("L", 1), ("R", -1)):
        bones = rig.HUMANOID
        sh = V(bones[f"upper_arm.{side}"][1])
        el = V(bones[f"lower_arm.{side}"][1])
        wr = V(bones[f"hand.{side}"][1])
        hd = V(bones[f"hand.{side}"][2])
        ua, la = f"upper_arm.{side}", f"lower_arm.{side}"
        kit.sphere(sh + V((sx * 0.3, 0, 0)), 3.7, u=10, v=7)
        kit.bind(ua, M["fur"])
        kit.capsule(sh, el, 3.0, 2.8, sides=8)
        kit.bind(ua, M["fur"])
        kit.sphere(el, 3.0, u=10, v=8)
        kit.bind(ua, M["fur"])
        axis = (el - sh).normalized()
        kit.ring(sh + (el - sh) * 0.5, axis, 3.1, 1.0, sides=6, segs=5)               # armlet
        kit.bind(ua, M["gold"])
        kit.capsule(el, wr, 2.8, 2.6, sides=8)
        kit.bind(la, M["fur"])
        hand_c = wr + (hd - wr) * 0.45
        kit.sphere(hand_c, 3.5, u=10, v=7)
        kit.bind(f"hand.{side}", M["fur"])
        kit.ring(wr + (el - wr).normalized() * 0.2, (wr - el).normalized(), 2.8, 0.7, sides=6, segs=6)   # wristband
        kit.bind(la, M["gold"])
        if side == "L":
            kit.sphere(hand_c + V((0.6, -2.6, 1.0)), 1.5, u=7, v=5)                   # thumb
            kit.bind("hand.L", M["fur"])

    # gada: shaft through the right fist, knurled gold head, bone `prop`
    px, pz = rig.HUMANOID["prop"][1][0], rig.HUMANOID["prop"][1][2]
    kit.capsule((px, 0, pz - 6.0), (px, 0, pz + 20.0), 0.95, 0.95, sides=8)
    kit.bind("prop", M["wood"])
    kit.lathe([(pz + 19.0, 1.4), (pz + 20.5, 3.2), (pz + 23.0, 4.6), (pz + 26.0, 4.7), (pz + 28.5, 3.5), (pz + 30.0, 1.3)],
              origin=(px, 0, 0), sides=14)
    kit.bind("prop", M["gold"])
    for k in range(6):                                                                  # knurl studs
        a = 2 * math.pi * k / 6
        kit.sphere((px + math.cos(a) * 4.5, math.sin(a) * 4.5, pz + 24.5), 0.9, u=6, v=4)
    kit.bind("prop", M["gold"])
    kit.sphere((px, 0, pz + 30.9), 1.2, u=7, v=5)
    kit.bind("prop", M["gold"])
    kit.sphere((px, 0, pz - 6.4), 1.5, u=7, v=5)
    kit.bind("prop", M["gold"])
    kit.ring((px, 0, pz + 3.8), (0, 0, 1), 1.0, 0.45, sides=6, segs=5)
    kit.bind("prop", M["gold"])

    # ---------------------------------------------------------------- legs and feet
    for side, sx in (("L", 1), ("R", -1)):
        bones = rig.HUMANOID
        hip = V(bones[f"thigh.{side}"][1]) + V((0, 0, 0.8))
        kn = V(bones[f"shin.{side}"][1])
        an = V(bones[f"foot.{side}"][1])
        th, sn, ft = f"thigh.{side}", f"shin.{side}", f"foot.{side}"
        kit.capsule(hip, kn, 3.9, 3.4, sides=8)
        kit.bind(th, M["fur"])
        kit.sphere(kn, 3.5, u=10, v=8)
        kit.bind(th, M["fur"])
        kit.capsule(kn, an, 3.2, 2.7, sides=8)
        kit.bind(sn, M["fur"])
        kit.ring(an + V((0, 0, 1.2)), (0, 0, 1), 2.9, 0.9, sides=6, segs=5)              # anklet
        kit.bind(sn, M["gold"])
        kit.sphere((sx * 4.2, -2.0, 2.8), (3.7, 6.2, 2.9), u=10, v=7)                    # foot
        kit.bind(ft, M["fur"])
        for tx in (-1.9, 0, 1.9):                                                         # toe bumps
            kit.sphere((sx * 4.2 + tx, -7.6, 1.7), 1.45, u=7, v=5)
            kit.bind(ft, M["cream"])

    # ---------------------------------------------------------------- tail (blended along the 4 bones)
    chain = [V(rig.HUMANOID["tail1"][1])] + [V(rig.HUMANOID[f"tail{i}"][2]) for i in range(1, 5)]
    chain.append(V((0, 12.5, 63.0)))
    pts = catmull_chain(chain, per=2)
    radii = [2.5 - 1.2 * i / (len(pts) - 1) for i in range(len(pts))]
    kit.tube(pts, radii, sides=8)
    arc, joints = arclength_param(pts, chain)

    def tail_w(co, _pts=pts, _arc=arc, _joints=joints):
        s = nearest_arclength(co, _pts, _arc)
        return tail_weights(s, _joints)
    kit.bind("tail1", M["fur"], tail_w)
    kit.sphere(chain[-1] + V((0, -0.2, 0.8)), 2.7, u=10, v=8)
    kit.bind("tail4", M["seat"])

    return kit


# ---- tail helpers (arclength blend)
def catmull_chain(points, per=2):
    out = []
    n = len(points)
    for i in range(n - 1):
        p0 = points[max(i - 1, 0)]
        p1, p2 = points[i], points[i + 1]
        p3 = points[min(i + 2, n - 1)]
        for k in range(per):
            t = k / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(points[-1].copy())
    return out


def arclength_param(pts, chain):
    arc = [0.0]
    for a, b in zip(pts, pts[1:]):
        arc.append(arc[-1] + (b - a).length)
    joint_s = []
    for j in chain:
        best = min(range(len(pts)), key=lambda i: (pts[i] - j).length)
        joint_s.append(arc[best])
    return arc, joint_s


def nearest_arclength(co, pts, arc):
    best, best_d = 0.0, 1e9
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        ab = b - a
        t = max(0.0, min(1.0, (co - a).dot(ab) / max(1e-9, ab.length_squared)))
        d = (a + ab * t - co).length
        if d < best_d:
            best_d, best = d, arc[i] + t * (arc[i + 1] - arc[i])
    return best


def tail_weights(s, joint_s):
    mids = [(joint_s[i] + joint_s[i + 1]) / 2 for i in range(4)]
    names = ["tail1", "tail2", "tail3", "tail4"]
    if s <= mids[0]:
        return {names[0]: 1.0}
    if s >= mids[-1]:
        return {names[-1]: 1.0}
    for i in range(3):
        if mids[i] <= s <= mids[i + 1]:
            t = (s - mids[i]) / (mids[i + 1] - mids[i])
            t = t * t * (3 - 2 * t)
            return {names[i]: 1 - t, names[i + 1]: t}
    return {names[-1]: 1.0}


# ---------------------------------------------------------------- main

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "hanuman.glb"
    meshopt = "--no-meshopt" not in argv
    metrics_path = argv[argv.index("--metrics") + 1] if "--metrics" in argv else None
    t0 = time.time()
    lib.reset_scene()
    kit = build_hanuman_mesh()
    mesh_obj = kit.build_object()
    arm = rig.build_armature(scale=SCALE)
    rig.skin(mesh_obj, arm)
    arm["height_m"] = 1.0
    arm["walk_speed_mps"] = anim.STRIDE_UNITS * SCALE / (anim.WALK_FRAMES / anim.FPS)
    arm["stride_m"] = anim.STRIDE_UNITS * SCALE
    arm["fps"] = anim.FPS
    t_build = time.time() - t0
    anim.humanoid_idle(arm)
    anim.humanoid_walk(arm)
    t1 = time.time()
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    export.export_glb(out, [arm, mesh_obj], meshopt=meshopt)
    t_export = time.time() - t1
    metrics = {
        "triangles": lib.triangle_count(mesh_obj),
        "vertices": len(mesh_obj.data.vertices),
        "bones": len(arm.data.bones),
        "materials": len(mesh_obj.data.materials),
        "build_s": round(t_build, 2),
        "anim_s": round(t1 - t0 - t_build, 2),
        "export_s": round(t_export, 2),
        "glb_bytes": os.path.getsize(out),
        "meshopt": meshopt,
    }
    print("METRICS " + json.dumps(metrics))
    if metrics_path:
        with open(metrics_path, "w") as fh:
            json.dump(metrics, fh)


main()
