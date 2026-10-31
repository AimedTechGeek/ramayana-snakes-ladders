"""Hanuman, complete: clay-toy mesh on the shared 31-bone rig, nine clips, meshopt GLB.

Run:  node scripts/blender/run.mjs scripts/blender/heroes/hanuman.py public/models/heroes/hanuman.glb
Pipeline for the next hero: copy this file, keep common.HERO_BONES, rebuild `build_mesh` with ClayKit
(`kit.paint(bone, colour, weights)`), write a `Style` (arms/prop/tail) and the five emotion poses, call `main`.
"""
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

import common  # noqa: E402
import export  # noqa: E402
import lib  # noqa: E402
import motion  # noqa: E402
import rig  # noqa: E402
from common import (FUR, GOLD, HERO_BONES, INK, PARCH, SAFFRON, SCALE, SEAT, WOOD, ClayKit,  # noqa: E402
                    catmull_chain, chain_weights, limb_weights, smooth_weights)
from motion import (SKEL, HPose, Style, aim_chain, blend, plant_prop, reach, rot_x, rot_y, rot_z,  # noqa: E402
                    set_arm, set_legs, smooth, tail_wave)

V = Vector
Q0 = Quaternion()

# ---------------------------------------------------------------- the gada (prop.R, rest pose in design units)
GRIP = V(HERO_BONES["prop.R"][1])              # fist centre; shaft along +Z through it
GADA_TOP = 24.6                                # finial height above the grip
GADA_BUTT = -6.3
CARRY_WRIST = V((-8.4, -4.4, 43.6))            # chest-attached wrist target: gada shouldered
CARRY_POLE = V((-0.25, 0.25, -1.0))
CARRY_TILT = rot_y(-16) @ rot_x(-20)   # shaft pitched back over the right shoulder


# ---------------------------------------------------------------- mesh

TORSO = [(32.4, 4.3), (36, 5.0), (44, 5.2), (49, 4.3), (51, 3.4)]


def torso_radius(z):
    for (z0, r0), (z1, r1) in zip(TORSO, TORSO[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return TORSO[0][1] if z < TORSO[0][0] else TORSO[-1][1]


def build_mesh():
    kit = ClayKit("Hanuman")
    torso_w = lambda co: smooth_weights([30, 36, 44], ["hips", "spine", "chest"])(co.z)

    # ---- torso, belly, loincloth, belt, sash (+ sacred thread), cloth panel
    kit.lathe(TORSO, sides=10, squash=(1.0, 0.88))
    kit.paint("spine", FUR, torso_w)
    kit.sphere((0, -3.3, 39.0), (3.8, 2.6, 5.2), u=8, v=6)
    kit.paint("spine", PARCH, torso_w)
    kit.lathe([(22.0, 5.9), (23.0, 6.4), (27.0, 5.4), (31.2, 4.5)], sides=10, squash=(1.0, 0.92))
    kit.paint("hips", SAFFRON)
    kit.lathe([(21.7, 6.0), (22.2, 6.6), (23.6, 6.55), (24.0, 6.1)], sides=10, squash=(1.0, 0.92))
    kit.paint("hips", GOLD)
    kit.lathe([(30.8, 5.0), (31.2, 5.2), (32.2, 5.2), (32.6, 4.7)], sides=10, squash=(1.0, 0.9))
    kit.paint("spine", SEAT, torso_w)
    kit.sphere((0, -5.0, 31.8), 1.3, u=7, v=5)
    kit.paint("spine", SEAT, torso_w)
    panel_w = limb_weights(26.5, 2.2, "cloth.01", "cloth.02")
    kit.lathe([(31.6, 2.5), (27.0, 3.0), (21.6, 3.1)], origin=(0, -5.5, 0), sides=8, squash=(1.0, 0.28))
    kit.paint("cloth.01", SAFFRON, panel_w)
    kit.lathe([(20.9, 3.15), (20.5, 3.1), (19.9, 2.9)], origin=(0, -5.5, 0), sides=8, squash=(1.0, 0.3))
    kit.paint("cloth.02", GOLD)

    def on_torso(x, z, out, back=False):
        r = torso_radius(z)
        x = max(-0.92 * r, min(0.92 * r, x))
        y = (0.88 if back else -0.88) * r * math.sqrt(1 - (x / r) ** 2)
        n = V((x / r, y / (0.88 * r) / 0.88, 0)).normalized()
        return V((x, y, z)) + n * out

    sash_pts = [on_torso(-4.0 + 8.0 * i / 6, 49.0 - 16.0 * i / 6, 0.8) for i in range(7)]
    kit.tube(sash_pts, 1.1, sides=5)
    kit.paint("spine", SEAT, torso_w)
    thread = [on_torso(-4.0 + 8.0 * i / 6 - 0.9, 49.0 - 16.0 * i / 6 + 1.0, 1.4) for i in range(7)]
    kit.tube(thread, 0.38, sides=4)
    kit.paint("spine", GOLD, torso_w)
    back_pts = [on_torso(-4.0 + 8.0 * i / 4, 49.0 - 16.0 * i / 4, 0.8, back=True) for i in range(5)]
    kit.tube(back_pts, 1.1, sides=4)                                                 # the sash shows from behind too (T43 7 item 17)
    kit.paint("spine", SEAT, torso_w)

    # ---- neck, ruff (mane), head
    kit.lathe([(49.5, 2.8), (53, 2.7), (56, 2.4)], sides=8)
    kit.paint("neck", FUR)
    kit.lathe([(50.6, 4.0), (51.4, 5.6), (52.8, 5.3), (53.8, 3.4)], sides=10, squash=(1.0, 0.9))
    kit.paint("neck", PARCH)
    HC = (0, 0, 61.5)
    kit.sphere(HC, 7.2, u=14, v=9)
    kit.paint("head", FUR)
    surfaces = [(HC, (7.2, 7.2, 7.2))]
    for sx in (-1, 1):
        cheek = ((sx * 3.0, -4.6, 61.3), (3.6, 3.0, 3.5))
        surfaces.append(cheek)
        kit.sphere(cheek[0], cheek[1], u=8, v=6)
        kit.paint("head", PARCH)
        kit.ellipsoid((sx * 6.0, -1.6, 57.6), (2.6, 2.6, 2.3), None, u=7, v=5)   # cheek fur tuft
        kit.paint("head", FUR)
        ear_rot = Quaternion((0, 0, 1), math.radians(35 * sx))
        kit.ellipsoid((sx * 8.0, 0.6, 62.0), (1.0, 3.0, 3.3), ear_rot, u=8, v=6)
        kit.paint("head", FUR)
        kit.ellipsoid((sx * 8.65, -0.3, 62.0), (0.5, 1.9, 2.2), ear_rot, u=7, v=5)
        kit.paint("head", PARCH)
    muzzle = ((0, -5.8, 58.6), (3.5, 3.2, 2.9))
    surfaces.append(muzzle)
    kit.sphere(muzzle[0], muzzle[1], u=9, v=6)
    kit.paint("head", PARCH)
    kit.sphere((0, -8.75, 59.9), (1.3, 0.9, 0.9), u=7, v=5)
    kit.paint("head", INK)
    kit.sphere((0, -6.3, 65.0), (0.75, 0.45, 1.5), u=7, v=5)                       # sindoor
    kit.paint("head", SEAT)
    face = common.face_material()
    common.face_patch(kit, surfaces, (-6.2, 6.2), (55.2, 67.4), nx=11, nz=12)
    kit.bind("head", face)

    # ---- crown (kiritamukuta): gold band + three tiers + finial; top near z 79
    kit.lathe([(66.4, 3.9), (66.9, 4.2), (67.9, 4.2), (68.3, 3.7), (69.8, 3.9), (71.7, 3.0), (71.8, 3.4),
               (72.6, 3.4), (72.8, 2.8), (74.0, 3.0), (75.8, 2.0), (75.9, 2.4), (76.6, 2.4), (76.8, 1.8),
               (78.4, 1.5), (79.6, 0.2)], sides=10)
    kit.paint("head", GOLD)
    kit.sphere((0, 0, 79.4), 0.8, u=6, v=4)
    kit.paint("head", GOLD)

    # ---- arms (L +X): one smooth tube per arm (blended at the elbow), armlet, wristband, fist
    for side, sx in (("L", 1), ("R", -1)):
        ua, fa = f"upperArm.{side}", f"foreArm.{side}"
        kit.sphere((sx * 6.2, 0, 49.0), 2.9, u=8, v=6)
        kit.paint(f"shoulder.{side}", FUR)
        pts = [V((sx * 6.2, 0, 48.6)), V((sx * 6.55, 0, 44.2)), V((sx * 6.9, 0, 40.0)),
               V((sx * 7.15, 0, 35.8)), V((sx * 7.4, 0, 31.8))]
        kit.tube(pts, [2.7, 2.55, 2.3, 2.15, 1.95], sides=7)
        kit.paint(ua, FUR, limb_weights(40.0, 2.4, ua, fa))
        kit.ring((sx * 6.6, 0, 44.4), (0, 0, 1), 2.8, 0.7, sides=5, segs=4)
        kit.paint(ua, GOLD)
        kit.ring((sx * 7.3, 0, 33.2), (0, 0, 1), 2.25, 0.55, sides=5, segs=4)
        kit.paint(fa, GOLD)
        kit.sphere((sx * 7.6, 0, 29.8), (2.5, 2.4, 2.7), u=8, v=6)
        kit.paint(f"hand.{side}", FUR)
        if side == "L":
            kit.sphere((6.0, -2.2, 30.4), 1.2, u=6, v=4)                            # thumb
            kit.paint("hand.L", FUR)

    # ---- gada (prop.R): dark-wood shaft through the right fist, knurled gold head, collars, finial, butt
    gx, gy, gz = GRIP
    kit.capsule((gx, gy, gz + GADA_BUTT), (gx, gy, gz + 16.0), 0.85, 0.85, sides=6)
    kit.paint("prop.R", WOOD)
    kit.lathe([(gz + 14.6, 1.0), (gz + 15.4, 2.4), (gz + 17.6, 3.5), (gz + 21.0, 3.5), (gz + 23.0, 2.4), (gz + 24.0, 1.0)],
              origin=(gx, gy, 0), sides=10)
    kit.paint("prop.R", GOLD)
    for k in range(5):
        a = 2 * math.pi * k / 5
        kit.sphere((gx + math.cos(a) * 3.55, gy + math.sin(a) * 3.55, gz + 19.2), 0.85, u=5, v=4)
        kit.paint("prop.R", GOLD)
    kit.sphere((gx, gy, gz + GADA_TOP), 0.9, u=6, v=4)
    kit.paint("prop.R", GOLD)
    kit.sphere((gx, gy, gz + GADA_BUTT), 0.9, u=6, v=4)
    kit.paint("prop.R", GOLD)
    for dz in (2.7, -2.7):
        kit.ring((gx, gy, gz + dz), (0, 0, 1), 1.3, 0.55, sides=5, segs=4)
        kit.paint("prop.R", GOLD)

    # ---- legs and feet: smooth tube blended at the knee, anklet, foot blended into the toe bone
    for side, sx in (("L", 1), ("R", -1)):
        th, sn, ft, toe = f"thigh.{side}", f"shin.{side}", f"foot.{side}", f"toe.{side}"
        pts = [V((sx * 3, 0, 25.0)), V((sx * 3, 0, 19.0)), V((sx * 3, 0, 13.5)), V((sx * 3, 0, 8.6)), V((sx * 3, 0, 4.0))]
        kit.tube(pts, [3.2, 3.0, 2.75, 2.45, 2.2], sides=7)
        kit.paint(th, FUR, limb_weights(13.5, 2.4, th, sn))
        kit.ring((sx * 3, 0, 5.6), (0, 0, 1), 2.7, 0.7, sides=5, segs=4)
        kit.paint(sn, GOLD)
        kit.sphere((sx * 3, -2.2, 2.3), (3.1, 5.0, 2.3), u=8, v=6)
        kit.paint(ft, FUR, lambda co, ft=ft, toe=toe: _foot_w(co, ft, toe))
        for dx in (-1.5, 0.0, 1.5):
            kit.sphere((sx * 3 + dx, -7.3, 1.3), (1.05, 1.1, 1.0), u=5, v=3)
            kit.paint(toe, PARCH)

    # ---- tail: S-curl swept tube blended down the four tail bones, tuft on the tip
    chain = [V(HERO_BONES["tail.01"][1]), V(HERO_BONES["tail.02"][1]), V(HERO_BONES["tail.03"][1]),
             V(HERO_BONES["tail.04"][1]), V((9.6, 7.2, 54.0)), V((7.0, 7.0, 62.5))]
    pts = catmull_chain(chain, per=2)
    radii = [2.7 - 1.0 * i / (len(pts) - 1) for i in range(len(pts))]
    kit.tube(pts, radii, sides=6)
    bones = ["tail.01", "tail.02", "tail.03", "tail.04"]
    joints = [chain[0], chain[1], chain[2], chain[3], chain[5]]
    kit.paint("tail.01", FUR, chain_weights(pts, joints, bones))
    kit.sphere(chain[-1] + V((0, 0, 1.0)), (2.6, 2.6, 3.0), u=8, v=6)
    kit.paint("tail.04", SEAT)
    return kit


def _foot_w(co, foot, toe):
    t = smooth((-co.y - 3.2) / 2.2)
    return {foot: 1 - t, toe: t} if 0 < t < 1 else ({foot: 1.0} if t == 0 else {toe: 1.0})


# ---------------------------------------------------------------- style: the gada in the right hand, the tail

TAIL_BONES = ("tail.01", "tail.02", "tail.03", "tail.04")


class HanumanStyle(Style):
    def shoulder_gada(self, pose, bob=V(), sway=0.0):
        """Right fist at the shoulder, gada shouldered. Attached to the chest so it follows every lean."""
        kin = SKEL.kin(pose)
        target = kin.point("chest", CARRY_WRIST) + bob
        reach(pose, "R", target, CARRY_POLE)
        kin = SKEL.kin(pose)
        pose.world["prop.R"] = kin.D["chest"] @ CARRY_TILT @ rot_z(sway)

    def arms(self, pose, kind, p, ph):
        if kind in ("idle", "walk", "run"):
            set_arm(pose, "L", p["shL"], p["elL"])
            bob = V((0, 0, 0.5 * math.sin(2 * ph))) if kind != "idle" else V((0, 0, 0.25 * math.sin(ph)))
            self.shoulder_gada(pose, bob)
        else:                                   # angle keyed (leap, cheer)
            set_arm(pose, "L", p["shL"], p["elL"], abduct=10)
            set_arm(pose, "R", p["shR"], p["elR"], abduct=8)
            kin = SKEL.kin(pose)
            pose.world["prop.R"] = rot_y(-14) @ rot_x(-p["mace"])

    def tail(self, pose, kind, p, ph):
        if kind == "idle":
            tail_wave(pose, ph, 7.0, 3.0, lag=0.9)
        elif kind == "walk":
            tail_wave(pose, ph, 5.6, 2.5)
        elif kind == "run":      # streaming back, a ripple on top
            aim_chain(pose, TAIL_BONES, [(0.25, 1.0, 0.45), (0.2, 1.0, 0.3), (0.1, 1.0, 0.2), (0.0, 1.0, 0.25)])
            tail_wave(pose, ph, 4.0, 2.0, lag=0.8)
        else:                    # leap / cheer: streaming back and up
            aim_chain(pose, TAIL_BONES, [(0.3, 1.0, 0.5), (0.25, 1.0, 0.6), (0.1, 0.9, 0.7), (0.0, 0.8, 0.8)])
            tail_wave(pose, ph, 5.0, 3.0, lag=0.9)


STYLE = HanumanStyle()


# ---------------------------------------------------------------- emotion poses (T43 3.3, T44 4.5)

def _base():
    pose = HPose()
    return pose


def happy_pose(f):
    pose = _base()
    set_legs(pose, 0, 0, 0, 0, 0, 0)
    pose.rot("head", rot_y(6))
    pose.rot("head", rot_x(-3))
    pose.rot("spine", rot_x(-2))
    kin = SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", V((-9.0, -6.2, 54.0))), V((-0.3, 0.3, -1.0)))
    reach(pose, "L", kin.point("chest", V((2.6, -5.2, 41.5))), V((1.0, 0.3, -0.4)))
    kin = SKEL.kin(pose)
    pose.world["prop.R"] = kin.D["chest"] @ rot_y(-6) @ rot_x(-8)
    wag = 2 * math.pi * f / 36
    tail_wave(pose, wag * 3, 6.0, 3.0, lag=0.9)
    pose.hop = 0.5 * abs(math.sin(wag * 3))
    pose.rot("chest", rot_x(1.0 * math.sin(wag * 3)))
    return pose


def excited_pose(f):
    pose = _base()
    s = math.sin(2 * math.pi * (f - 8) / 12)
    air = max(0.0, s) if f >= 8 else 0.0
    crouch = max(0.0, -s) if f >= 8 else 0.0
    knee = 8 + 16 * crouch + 22 * air
    set_legs(pose, knee * 0.5, knee, 0, knee * 0.5, knee, 0)
    pose.hop = 3.6 * air
    pose.rot("head", rot_x(-4))
    pose.rot("spine", rot_x(-1))
    pump = 1.6 * math.sin(2 * math.pi * (f - 8) / 12 + 0.6) if f >= 8 else 0.0
    kin = SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", V((-6.4 + 1.2 * math.cos(f * 0.5), -2.5, 63.5 + pump))), V((-1.0, 0.4, -0.2)))
    reach(pose, "L", kin.point("chest", V((6.4, -3.0, 63.0 - pump))), V((1.0, 0.4, -0.2)))
    kin = SKEL.kin(pose)
    # twirl about the shaft axis while held vertical: never a baton spin (R5)
    pose.world["prop.R"] = kin.D["chest"] @ rot_y(-4) @ rot_z(f * 22)
    aim_chain(pose, TAIL_BONES, [(0.1, 0.5, 1.0), (0.1, 0.2, 1.0), (0.05, 0.1, 1.0), (0.0, 0.1, 1.0)])
    tail_wave(pose, f * 0.7, 4.0, 2.0, lag=0.8)
    return pose


def scared_pose(f):
    pose = _base()
    set_legs(pose, 25, 30, 0, 25, 30, 0)
    pose.rot("spine", rot_x(6))
    pose.rot("head", rot_x(-4))
    tremble = math.sin(f * 2.1) * (1.4 if f >= 10 else 0.0)
    pose.rot("chest", rot_z(tremble))
    kin = SKEL.kin(pose)
    reach(pose, "L", kin.point("head", V((3.4, -8.4, 62.6))), V((1.0, 0.2, -0.6)))
    reach(pose, "R", kin.point("head", V((-3.4, -8.4, 62.6))), V((-1.0, 0.2, -0.6)))
    aim_chain(pose, TAIL_BONES, [(0.5, 0.5, -0.7), (0.7, -0.5, -0.7), (-0.3, -0.9, -0.4), (-0.9, 0.1, -0.4)])
    pose.world["prop.R"] = Q0.copy()
    pose.shift["root"] = V((0, 0, SKEL.ground_z(pose)))
    plant_prop(pose, "prop.R", V((GRIP.x, GRIP.y, GRIP.z + GADA_BUTT)), V((-7.5, 2.0, 0.8)))
    pose.shift["root"] = V()
    return pose


def sad_pose(f):
    pose = _base()
    set_legs(pose, 4, 8, 0, 4, 8, 0)
    pose.rot("spine", rot_x(9))
    pose.rot("head", rot_x(10))
    pose.rot("shoulder.L", rot_y(9))
    pose.rot("shoulder.R", rot_y(-9))
    sigh = math.sin(2 * math.pi * f / 36)
    pose.rot("chest", rot_x(-1.5 * sigh))
    set_arm(pose, "L", 6, 14)
    set_arm(pose, "R", 12, 18)
    pose.world["prop.R"] = rot_x(180)
    aim_chain(pose, TAIL_BONES, [(0.15, 0.6, -0.8), (0.2, 0.3, -1.0), (0.3, 0.4, -1.0), (0.9, -0.6, -0.1)])
    pose.shift["root"] = V((0, 0, SKEL.ground_z(pose)))
    plant_prop(pose, "prop.R", V((GRIP.x, GRIP.y, GRIP.z + GADA_TOP)), V((0, 0, 0.8)), axes=(False, False, True))
    pose.shift["root"] = V()
    return pose


# ---------------------------------------------------------------- cheer: somersault + victory (Win screen only)

CHEER_KEYS = {
    #  f:   hipL kneeL ankL hipR kneeR ankR lean shL elL shR  elR mace head
    0:  (0, 0, 0, 0, 0, 0, 0, 3, 10, 25, 95, 24, 0),
    8:  (48, 66, 10, 48, 66, 10, 14, -30, 20, -30, 25, 70, 0),
    12: (-8, 6, -30, -8, 6, -30, 6, 80, 20, 80, 20, -4, -3),
    34: (-8, 6, -30, -8, 6, -30, 6, 80, 20, 80, 20, -4, -3),
    39: (45, 52, 6, 45, 52, 6, 12, 50, 40, 60, 40, 0, 0),
    48: (4, 8, 0, 4, 8, 0, 0, 120, 20, 168, 18, 4, -6),
    54: (2, 6, 0, 2, 6, 0, 0, 40, 30, 150, 20, 8, -2),
    60: (0, 0, 0, 0, 0, 0, 0, 3, 10, 25, 95, 24, 0),
}
FLIP = (12, 34)
FLIP_CENTRE = V((0, -1.0, 36.0))


def _cheer_params(f):
    ks = sorted(CHEER_KEYS)
    for a, b in zip(ks, ks[1:]):
        if a <= f <= b:
            t = smooth((f - a) / (b - a))
            return {n: CHEER_KEYS[a][i] + (CHEER_KEYS[b][i] - CHEER_KEYS[a][i]) * t
                    for i, n in enumerate(motion._LEAP_FIELDS)}
    return dict(zip(motion._LEAP_FIELDS, CHEER_KEYS[ks[-1]]))


def cheer_clip():
    poses = []
    for f in range(60):
        p = _cheer_params(f)
        if FLIP[0] <= f < FLIP[1]:
            u = (f - FLIP[0]) / (FLIP[1] - FLIP[0])
            tuck = math.sin(math.pi * u) ** 0.5
            p.update(hipL=-8 + 100 * tuck, hipR=-8 + 100 * tuck, kneeL=6 + 100 * tuck, kneeR=6 + 100 * tuck,
                     ankL=0, ankR=0, shL=80 - 20 * tuck, shR=80 - 20 * tuck, elL=20 + 80 * tuck, elR=20 + 80 * tuck,
                     lean=6 + 8 * tuck)
        pose = motion.angle_pose(STYLE, p, f / 60 * 2 * math.pi * 2)
        poses.append(pose)
    ground = motion.solve_ground([x for x in poses], hold=None)
    z0 = ground[FLIP[0] - 1]
    z1 = ground[FLIP[1]]
    for f in range(FLIP[0], FLIP[1]):
        pose = poses[f]
        u = (f - FLIP[0]) / (FLIP[1] - FLIP[0])
        theta = 360.0 * u
        r = rot_x(theta)
        pose.free = True
        pose.rel["root"] = r
        height = 16.0 * 4 * u * (1 - u)
        base = z0 + (z1 - z0) * u
        pose.shift["root"] = FLIP_CENTRE - r @ FLIP_CENTRE + V((0, 0, base + height))
    return motion.loop_close(poses)


# ---------------------------------------------------------------- main

CLIPS = ("idle", "walk", "run", "leap", "happy", "excited", "scared", "sad", "cheer")


def emotion_clip(builder, frames, rise):
    idle0 = motion.idle_pose(STYLE, 0)
    return motion.clip_from_blend(idle0, builder, frames, rise)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "hanuman.glb"
    metrics_path = argv[argv.index("--metrics") + 1] if "--metrics" in argv else None
    t0 = time.time()
    lib.reset_scene()
    kit = build_mesh()
    obj = kit.build_object()
    common.bake_ao_and_jitter(obj)
    arm = rig.build_armature(scale=SCALE, bones=HERO_BONES)
    rig.skin(obj, arm)

    clips = {"idle": motion.clip_idle(STYLE)}
    clips["walk"], _ = motion.clip_walk(STYLE)    # the lock residual is zero by construction; the real drift is measured on the skinned mesh (tests/heroGlb.test.ts)
    clips["run"], _ = motion.clip_run(STYLE)
    clips["leap"] = motion.clip_leap(STYLE)
    clips["happy"] = emotion_clip(happy_pose, 36, 12)
    clips["excited"] = emotion_clip(excited_pose, 36, 8)
    clips["scared"] = emotion_clip(scared_pose, 30, 8)
    clips["sad"] = emotion_clip(sad_pose, 36, 14)
    clips["cheer"] = cheer_clip()
    frames = {"idle": 48, "walk": 24, "run": 16, "leap": 22, "happy": 36, "excited": 36, "scared": 30, "sad": 36,
              "cheer": 60}
    report = {}
    fk_err = 0.0
    for name in CLIPS:
        poses = clips[name]
        expected = frames[name]
        got = len(poses) - 1
        assert got == expected, f"{name}: {got} frames, spec says {expected}"
        report[name] = motion.clip_report(poses)
        if name == "leap":
            report[name]["land_max_knee"] = motion.clip_report(poses[motion.LEAP_BANDS[3]:])["max_knee"]   # touchdown, R14
        err = motion.bake(arm, name, poses, verify=(0, 5, 12, 19) if name in ("walk", "leap", "scared") else ())
        fk_err = max(fk_err, err)
    arm["height_u"] = max(v.co.z for v in obj.data.vertices)
    arm["shoulder_top_u"] = report["idle"]["min_shoulder_top"] * SCALE
    arm["stride_m"] = motion.WALK_STEP * 2 * SCALE
    arm["walk_speed_mps"] = arm["stride_m"] / (motion.WALK_FRAMES / common.FPS)
    arm["run_stride_m"] = motion.RUN_CYCLE * SCALE
    arm["run_speed_mps"] = arm["run_stride_m"] / (motion.RUN_FRAMES / common.FPS)
    arm["walk_leg_gain"] = motion.LEG_GAIN["walk"]
    arm["fps"] = common.FPS
    arm["face_frames"] = "idle,blink,happy,excited,scared,sad"
    arm["report"] = json.dumps(report)
    t1 = time.time()
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    export.export_glb(out, [arm, obj], meshopt=True, image_format="AUTO", keep_static_channels=False)
    metrics = {
        "triangles": lib.triangle_count(obj),
        "vertices": len(obj.data.vertices),
        "bones": len(arm.data.bones),
        "parts": kit.parts,
        "height_u": round(arm["height_u"], 3),
        "fk_error_du": round(fk_err, 4),
        "build_s": round(t1 - t0, 2),
        "glb_bytes": os.path.getsize(out),
    }
    print("TOP " + json.dumps(sorted(kit.tri_log, reverse=True)[:14]))
    print("METRICS " + json.dumps(metrics))
    print("REPORT " + json.dumps(report))
    if metrics_path:
        with open(metrics_path, "w") as fh:
            json.dump({"metrics": metrics, "report": report}, fh, indent=1)


main()
