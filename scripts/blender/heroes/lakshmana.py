"""Lakshmana, complete: clay-toy mesh on the shared hero rig (no tail bones, plus quiver.strap: 28 bones), nine clips, meshopt GLB.

Run:  node scripts/blender/run.mjs scripts/blender/heroes/lakshmana.py public/models/heroes/lakshmana.glb
Built the same way as hanuman.py (ClayKit + HERO_BONES + motion.py). What is his own: golden-fair skin, dark top-knot
under a saffron headband, emerald knee-length dhoti with a gold hem, saffron sash across the chest, leather quiver on
`back` (strap over the LEFT shoulder, five arrows), a SHORTER bow in the right hand (`prop.R`, 0.90 u, gold limbs,
leather bracer), one armlet (left), plain anklets. Bow and quiver are rigid to `prop.R` / `back`, so they are in every
clip and from every angle.
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
from common import (GOLD, HERO_BONES, INK, PARCH, SAFFRON, SCALE, WOOD, ClayKit,  # noqa: E402
                    limb_weights, smooth_weights)
from motion import (SKEL, HPose, Style, blend, reach, rot_x, rot_y, rot_z, set_arm, set_legs,  # noqa: E402
                    smooth)

V = Vector
Q0 = Quaternion()

# ---------------------------------------------------------------- palette (T44 4.3: golden fair skin, emerald dhoti)
SKIN = "#F0B57C"
EMERALD = "#2E9E6B"
LEATHER = "#7A5A3A"
HAIR = INK

# ---------------------------------------------------------------- rig: the shared rig without Hanuman's tail
BONES = {k: v for k, v in HERO_BONES.items() if not k.startswith("tail.")}
BONES["quiver.strap"] = ("chest", (4.8, 0.5, 50.5), (5.4, 6.0, 50.5))   # T44 4.1 hero extra: the strap over the left shoulder (28 bones)

# ---------------------------------------------------------------- the bow (prop.R, rest pose in design units)
GRIP = V(HERO_BONES["prop.R"][1])          # fist centre; the bow stands along +Z through it
BOW_HALF = 25.0                            # 50 du = 0.89 u: shorter than Rama's 1.10 u
BOW_BELLY = 8.0                            # how far behind the grip the tips (and the string) sit
BOW_YAW = -50.0                            # belly turned forward and outward so every camera sees the curve

# ---------------------------------------------------------------- the quiver (on `back`)
QUIVER_BASE = V((-3.6, 7.4, 31.0))
QUIVER_TOP = V((5.4, 7.0, 52.9))           # 23.4 du = 0.42 u long, leaning so the arrows rise behind the LEFT shoulder

TORSO = [(32.4, 4.3), (36, 4.9), (44, 5.2), (49, 4.5), (51, 3.4)]


def torso_radius(z):
    for (z0, r0), (z1, r1) in zip(TORSO, TORSO[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return TORSO[0][1] if z < TORSO[0][0] else TORSO[-1][1]


def on_torso(x, z, out, back=False):
    """A point `out` above the torso surface at lateral x and height z (front, or back)."""
    r = torso_radius(z)
    x = max(-0.92 * r, min(0.92 * r, x))
    y = (0.88 if back else -0.88) * r * math.sqrt(1 - (x / r) ** 2)
    n = V((x / r, y / (0.88 * r) / 0.88, 0)).normalized()
    return V((x, y, z)) + n * out


def _foot_w(co, foot, toe):
    t = smooth((-co.y - 3.2) / 2.2)
    return {foot: 1 - t, toe: t} if 0 < t < 1 else ({foot: 1.0} if t == 0 else {toe: 1.0})


def band(kit, centre, axis, radius, half=0.6, sides=8):
    """A thin open cuff (armlet, anklet, rim): far cheaper than a torus and reads the same at this size."""
    kit.lathe([(-half, radius * 0.95), (0.0, radius), (half, radius * 0.95)], origin=V(centre), axis=V(axis).normalized(),
              sides=sides, cap=False)


def _bow_curve(t):
    """Local (y, radius) of the bow limb at t in -1..1 (t = height / half length): a D with the string behind."""
    a = abs(t)
    return BOW_BELLY * a ** 1.6, 1.8 - 1.05 * a ** 1.2


def _build_bow(kit):
    gx, gy, gz = GRIP
    pts, radii = [], []
    for i in range(11):
        t = -1 + 2 * i / 10
        y, r = _bow_curve(t)
        pts.append(V((gx, gy + y, gz + t * BOW_HALF)))
        radii.append(r)
    kit.tube(pts, radii, sides=6, round_caps=False)
    kit.paint("prop.R", GOLD)
    # grip wrap and the two collars that keep it under the fist
    kit.lathe([(gz - 4.2, 1.35), (gz + 4.2, 1.35)], origin=(gx, gy, 0), sides=7)
    kit.paint("prop.R", INK)
    for dz in (4.4, -4.4):
        band(kit, (gx, gy, gz + dz), (0, 0, 1), 1.5, 0.6, sides=7)
        kit.paint("prop.R", GOLD)
    # tip knobs (nocks) and the string between them
    tip_y = BOW_BELLY
    for sign in (1, -1):
        kit.sphere((gx, gy + tip_y, gz + sign * (BOW_HALF + 0.3)), 0.95, u=6, v=4)
        kit.paint("prop.R", GOLD)
    kit.tube([V((gx, gy + tip_y, gz + BOW_HALF)), V((gx, gy + tip_y, gz - BOW_HALF))], 0.33, sides=4, round_caps=False)
    kit.paint("prop.R", PARCH)


def _build_quiver(kit, torso_w):
    axis = (QUIVER_TOP - QUIVER_BASE)
    length = axis.length
    a = axis.normalized()
    u = a.cross(V((0, 1, 0))).normalized()
    v = a.cross(u).normalized()
    kit.lathe([(0.0, 1.6), (0.7, 2.3), (6, 2.5), (length - 1.2, 2.75), (length, 2.85)],
              origin=QUIVER_BASE, axis=a, sides=9)
    kit.paint("back", LEATHER)
    band(kit, QUIVER_TOP, a, 3.0, 0.7, sides=9)
    kit.paint("back", GOLD)
    band(kit, QUIVER_BASE + a * 1.4, a, 2.4, 0.6, sides=9)
    kit.paint("back", GOLD)
    band(kit, QUIVER_BASE + a * (length * 0.5), a, 2.78, 0.5, sides=9)
    kit.paint("back", GOLD)
    # five arrows: dark shafts, parchment fletching, a gold nock bead; they stay in the quiver in every clip (R5)
    for k, (phi, splay, out) in enumerate([(0.3, 0.12, 10.0), (1.55, 0.20, 7.4), (2.8, 0.16, 9.0), (4.0, 0.22, 6.4),
                                           (5.2, 0.14, 8.2)]):
        radial = u * math.cos(phi) + v * math.sin(phi)
        base = QUIVER_TOP + radial * 1.25
        d = (a + radial * splay).normalized()
        bottom = base - d * 3.0
        top = base + d * out
        kit.tube([bottom, top], 0.4, sides=4, round_caps=False)
        kit.paint("back", WOOD)
        rot = V((0, 0, 1)).rotation_difference(d)
        for roll in (0.0, math.pi / 2):
            vane = rot @ Quaternion((0, 0, 1), roll)
            kit.ellipsoid(top - d * 1.9, (1.25, 0.12, 2.3), vane, u=4, v=3)
            kit.paint("back", PARCH)
        kit.sphere(top + d * 0.2, 0.5, u=4, v=3)
        kit.paint("back", GOLD)
    # strap: over the LEFT shoulder, diagonal across the chest to the right hip (X with the sash), and behind
    t_cross = 0.5
    front = []
    for i in range(7):
        t = i / 6
        bump = 1.6 * math.exp(-(((t - t_cross) / 0.16) ** 2))
        front.append(on_torso(4.8 - 9.6 * t, 49.6 - 16.6 * t, 1.15 + bump))
    kit.tube(front, 0.85, sides=4)
    kit.paint("spine", LEATHER, torso_w)
    over = [on_torso(4.8, 49.6, 1.15), V((5.6, 0.6, 50.6)), V((5.6, 4.6, 51.0)), V((5.2, 7.0, 49.6))]
    kit.tube(over, 0.85, sides=4)
    kit.paint("quiver.strap", LEATHER)
    behind = [on_torso(-4.6, 33.0, 1.15), on_torso(-4.9, 33.5, 1.2, back=True), V((-3.6, 7.4, 34.0))]
    kit.tube(behind, 0.85, sides=4)
    kit.paint("spine", LEATHER, torso_w)


def build_mesh():
    kit = ClayKit("Lakshmana")
    torso_w = lambda co: smooth_weights([30, 36, 44], ["hips", "spine", "chest"])(co.z)

    # ---- torso (bare, golden fair), chest, belly
    kit.lathe(TORSO, sides=10, squash=(1.0, 0.88))
    kit.paint("spine", SKIN, torso_w)
    for sx in (-1, 1):
        kit.sphere((sx * 2.7, -3.4, 44.2), (3.0, 2.0, 2.5), u=7, v=5)
        kit.paint("chest", SKIN)
    # ---- emerald dhoti: hip wrap, gold waist belt, knotted front, knee-length leg wraps with a gold hem
    kit.lathe([(22.4, 6.2), (23.4, 6.55), (27.0, 5.5), (31.2, 4.6)], sides=10, squash=(1.0, 0.92))
    kit.paint("hips", EMERALD)
    kit.lathe([(30.7, 5.0), (31.1, 5.25), (32.4, 5.25), (32.8, 4.7)], sides=10, squash=(1.0, 0.9))
    kit.paint("spine", GOLD, torso_w)
    kit.sphere((0, -5.1, 31.8), 1.35, u=7, v=5)                                    # belt clasp
    kit.paint("spine", GOLD, torso_w)
    panel_w = limb_weights(26.5, 2.2, "cloth.01", "cloth.02")
    kit.lathe([(31.6, 2.6), (27.0, 3.2), (21.0, 3.3)], origin=(0, -5.5, 0), sides=8, squash=(1.0, 0.28))
    kit.paint("cloth.01", EMERALD, panel_w)
    kit.lathe([(20.4, 3.35), (20.0, 3.3), (19.4, 3.05)], origin=(0, -5.5, 0), sides=8, squash=(1.0, 0.3))
    kit.paint("cloth.02", GOLD)
    kit.capsule((0, -6.9, 30.0), (0, -7.0, 21.5), 0.5, 0.5, sides=4)                  # centre pleat in gold
    kit.paint("cloth.01", GOLD, panel_w)
    for sx in (-1, 1):                                                                  # saffron sash ends hanging at the hip knot
        kit.ellipsoid((sx * 1.6, -5.9, 28.6), (1.0, 0.55, 3.2), Quaternion((0, 1, 0), math.radians(sx * 10)), u=6, v=5)
        kit.paint("cloth.01", SAFFRON)

    # ---- saffron sash: right shoulder to left hip, front and back (visible from behind too)
    sash = [on_torso(-5.0 + 9.6 * i / 6, 49.6 - 17.0 * i / 6, 0.8) for i in range(7)]
    kit.tube(sash, 1.5, sides=5)
    kit.paint("spine", SAFFRON, torso_w)
    sash_back = [on_torso(-5.0 + 9.6 * i / 4, 49.6 - 17.0 * i / 4, 0.8, back=True) for i in range(5)]
    kit.tube(sash_back, 1.4, sides=5)
    kit.paint("spine", SAFFRON, torso_w)
    kit.sphere(on_torso(4.6, 32.6, 1.0), (1.8, 1.5, 1.5), u=6, v=5)                  # the knot at the left hip
    kit.paint("spine", SAFFRON, torso_w)

    # ---- quiver and strap on the back
    _build_quiver(kit, torso_w)

    # ---- neck and head
    kit.lathe([(49.5, 2.8), (53, 2.7), (56.5, 2.5)], sides=8)
    kit.paint("neck", SKIN)
    HC = (0, 0, 61.5)
    kit.sphere(HC, 7.2, u=12, v=8)
    kit.paint("head", SKIN)
    surfaces = [(HC, (7.2, 7.2, 7.2))]
    for sx in (-1, 1):
        cheek = ((sx * 3.3, -4.3, 59.3), (3.0, 2.6, 2.8))
        surfaces.append(cheek)
        kit.sphere(cheek[0], cheek[1], u=7, v=5)
        kit.paint("head", SKIN)
        kit.sphere((sx * 7.5, 0.3, 61.0), (1.1, 1.7, 2.3), u=7, v=5)                 # ear
        kit.paint("head", SKIN)
    chin = ((0, -4.2, 56.4), (3.2, 2.6, 2.3))
    surfaces.append(chin)
    kit.sphere(chin[0], chin[1], u=8, v=6)
    kit.paint("head", SKIN)
    kit.sphere((0, -7.6, 59.9), (1.1, 1.2, 1.4), u=7, v=5)                         # nose
    kit.paint("head", SKIN)
    # hair: a cap that shows over the back and top, sideburn edge, and the top-knot
    kit.sphere((0, 1.4, 63.0), (7.45, 7.5, 7.5), u=10, v=7)
    kit.paint("head", HAIR)
    kit.sphere((0, 0.9, 73.0), (4.1, 4.0, 4.4), u=8, v=6)                            # the top-knot: a round bun and a flick of hair
    kit.paint("head", HAIR)
    kit.sphere((0, 0.9, 77.0), (2.0, 1.9, 2.95), u=6, v=4)
    kit.paint("head", HAIR)
    band(kit, (0, 0.9, 70.3), (0, 0, 1), 3.5, 0.7, sides=8)                  # saffron tie round the top-knot
    kit.paint("head", SAFFRON)
    # saffron headband: level at the brow, a touch lower behind, knotted at the back with two short ends
    headband = []
    for i in range(14):
        a = 2 * math.pi * i / 14
        z = 66.0 + 0.7 * math.cos(a)
        r = math.sqrt(7.2 ** 2 - (z - 61.5) ** 2) + 0.55
        headband.append(V((r * math.sin(a), 0.4 - r * math.cos(a) * 1.0, z)))
    kit.tube(headband, 1.05, sides=5, round_caps=False, closed=True)
    kit.paint("head", SAFFRON)
    kit.sphere((0, 8.3, 65.0), (1.5, 1.2, 1.4), u=7, v=5)
    kit.paint("head", SAFFRON)
    for sx in (-1, 1):
        kit.capsule((sx * 0.8, 8.6, 64.6), (sx * 2.6, 9.4, 58.4), 0.8, 0.65, sides=5)
        kit.paint("head", SAFFRON)
    face = common.face_material()
    common.face_patch(kit, surfaces, (-6.2, 6.2), (55.2, 67.4), nx=9, nz=10)
    kit.bind("head", face)

    # ---- arms (L +X): tube blended at the elbow, shoulder, armlet (left only), bracer (right), fists
    for side, sx in (("L", 1), ("R", -1)):
        ua, fa = f"upperArm.{side}", f"foreArm.{side}"
        kit.sphere((sx * 6.2, 0, 49.0), 3.1, u=8, v=6)
        kit.paint(f"shoulder.{side}", SKIN)
        pts = [V((sx * 6.2, 0, 48.6)), V((sx * 6.55, 0, 44.2)), V((sx * 6.9, 0, 40.0)),
               V((sx * 7.15, 0, 35.8)), V((sx * 7.4, 0, 31.8))]
        kit.tube(pts, [2.7, 2.55, 2.3, 2.15, 1.95], sides=7, round_caps=False)
        kit.paint(ua, SKIN, limb_weights(40.0, 2.4, ua, fa))
        if side == "L":
            band(kit, (6.6, 0, 44.4), (0, 0, 1), 2.85, 0.95, sides=8)             # the one armlet
            kit.paint(ua, GOLD)
        else:
            kit.lathe([(31.6, 2.3), (32.0, 2.65), (36.4, 2.5), (36.9, 2.15)], origin=(-7.2, 0, 0), sides=8)
            kit.paint(fa, LEATHER)                                                      # archer's bracer on the bow arm
            for z in (32.0, 36.6):
                band(kit, (-7.2, 0, z), (0, 0, 1), 2.6, 0.5, sides=8)
                kit.paint(fa, GOLD)
        kit.sphere((sx * 7.6, 0, 29.8), (2.5, 2.4, 2.7), u=7, v=5)
        kit.paint(f"hand.{side}", SKIN)
        if side == "L":
            kit.sphere((6.0, -2.2, 30.6), 1.2, u=6, v=4)                                # thumb
            kit.paint("hand.L", SKIN)
            for dz in (1.6, 0.0, -1.6):                                           # fingers
                kit.sphere((7.9, -2.5, 29.9 + dz), (1.1, 1.0, 0.72), u=5, v=3)
                kit.paint("hand.L", SKIN)
        else:
            kit.sphere((-6.5, -2.4, 31.4), 1.15, u=6, v=4)                              # thumb over the grip
            kit.paint("hand.R", SKIN)
            for dz in (1.8, 0.2, -1.4):
                kit.sphere((-7.7, -2.5, GRIP.z + dz), (1.15, 1.0, 0.72), u=5, v=3)
                kit.paint("hand.R", SKIN)

    _build_bow(kit)

    # ---- legs and feet: skin tube blended at the knee, emerald knee-length wrap, gold hem, plain anklet, bare foot
    for side, sx in (("L", 1), ("R", -1)):
        th, sn, ft, toe = f"thigh.{side}", f"shin.{side}", f"foot.{side}", f"toe.{side}"
        pts = [V((sx * 3, 0, 25.0)), V((sx * 3, 0, 19.0)), V((sx * 3, 0, 13.5)), V((sx * 3, 0, 8.6)), V((sx * 3, 0, 4.0))]
        kit.tube(pts, [3.2, 3.0, 2.75, 2.45, 2.2], sides=7, round_caps=False)
        kit.paint(th, SKIN, limb_weights(13.5, 2.4, th, sn))
        kit.tube([V((sx * 3, 0, 25.2)), V((sx * 3, 0, 20.5)), V((sx * 3, 0, 16.4))], [3.8, 3.65, 3.5], sides=8, round_caps=False)
        kit.paint(th, EMERALD)
        band(kit, (sx * 3, 0, 16.2), (0, 0, 1), 3.6, 0.8, sides=8)
        kit.paint(th, GOLD)
        band(kit, (sx * 3, 0, 5.6), (0, 0, 1), 2.65, 0.8, sides=8)
        kit.paint(sn, GOLD)
        kit.sphere((sx * 3, -2.2, 2.3), (3.1, 5.0, 2.3), u=7, v=5)
        kit.paint(ft, SKIN, lambda co, ft=ft, toe=toe: _foot_w(co, ft, toe))
        for dx in (-1.5, 0.0, 1.5):
            kit.sphere((sx * 3 + dx, -7.3, 1.3), (1.05, 1.1, 1.0), u=5, v=3)
            kit.paint(toe, SKIN)
    return kit


# ---------------------------------------------------------------- style: the bow in the right hand

def bow_axis_tilt(pose):
    """Angle (deg) of the bow's long axis from vertical in a pose (R5: upright or forward-low, never aimed)."""
    d = SKEL.kin(pose).dir("prop.R")
    return math.degrees(math.acos(max(-1.0, min(1.0, abs(d.z)))))


class LakshmanaStyle(Style):
    def hold_bow(self, pose, fwd=3.0, out=4.0, yaw=BOW_YAW):
        """Bow orientation attached to the chest: top tipped `fwd` deg forward and `out` deg outward, belly turned `yaw`."""
        kin = SKEL.kin(pose)
        pose.world["prop.R"] = kin.D["chest"] @ rot_y(-out) @ rot_x(fwd) @ rot_z(yaw)

    def arms(self, pose, kind, p, ph):
        if kind == "idle":
            set_arm(pose, "L", p["shL"], p["elL"])
            set_arm(pose, "R", 2.0 + 0.4 * math.sin(ph), 11)
            self.hold_bow(pose, 3.0, 9.0)
        elif kind == "walk":
            set_arm(pose, "L", p["shL"], p["elL"])
            set_arm(pose, "R", p["shR"] * 0.7, max(14.0, p["elR"]))
            self.hold_bow(pose, 12.0 + 5.0 * math.sin(ph), 9.0)
        elif kind == "run":
            set_arm(pose, "L", p["shL"], p["elL"])
            set_arm(pose, "R", p["shR"] * 0.8, p["elR"])
            self.hold_bow(pose, 12.0 + 4.0 * math.sin(2 * ph), 10.0, -40.0)
        else:                                           # angle keyed (leap, cheer)
            set_arm(pose, "L", p["shL"], p["elL"], abduct=10)
            set_arm(pose, "R", p["shR"], p["elR"], abduct=8)
            self.hold_bow(pose, 6.0 - 0.15 * (p["mace"] - 24), 8.0)


STYLE = LakshmanaStyle()


# ---------------------------------------------------------------- emotion poses (T43 3.3, T44 4.5)

def _base():
    return HPose()


def happy_pose(f):
    """Lakshmana raises the bow: right fist up and out, bow upright; left hand waves; little bounces."""
    pose = _base()
    set_legs(pose, 0, 0, 0, 0, 0, 0)
    pose.rot("head", rot_y(-5))
    pose.rot("spine", rot_x(-2))
    wag = 2 * math.pi * f / 36
    kin = SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", V((-10.8, -3.0, 59.5 + 1.2 * math.sin(wag * 3)))), V((-1.0, 0.4, -0.3)))
    reach(pose, "L", kin.point("chest", V((9.2 + 1.4 * math.sin(wag * 6), -4.0, 57.0))), V((1.0, 0.5, -0.2)))
    STYLE.hold_bow(pose, 2.0, 6.0, -30.0)
    pose.hop = 0.7 * abs(math.sin(wag * 3))
    pose.rot("chest", rot_x(1.0 * math.sin(wag * 3)))
    return pose


def excited_pose(f):
    """Bow thrust high, stomping foot to foot (the sole lifts, then slams down)."""
    pose = _base()
    k = max(0, (f - 8)) // 12
    u = ((f - 8) % 12) / 12.0 if f >= 8 else 1.0
    lift = math.sin(math.pi * u / 0.75) if u < 0.75 else 0.0
    dip = max(0.0, 1.0 - abs(u - 0.8) / 0.12) if f >= 8 else 0.0
    left = (k % 2 == 0)
    up = 48 * lift
    support_knee = 8 + 12 * dip
    if left:
        set_legs(pose, up, 6 + 74 * lift, -22 * lift, 0, support_knee, 0)
    else:
        set_legs(pose, 0, support_knee, 0, up, 6 + 74 * lift, -22 * lift)
    pose.rot("spine", rot_x(-1 + 2 * dip))
    pose.rot("head", rot_x(-4))
    pose.rot("chest", rot_z((2.5 if left else -2.5) * lift))
    pump = 1.8 * math.sin(2 * math.pi * (f - 8) / 12 + 0.6) if f >= 8 else 0.0
    kin = SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", V((-11.0, -1.0, 63.8 + pump))), V((-1.0, 0.4, -0.2)))
    reach(pose, "L", kin.point("chest", V((9.5, -3.0, 60.5 - pump))), V((1.0, 0.4, -0.2)))
    STYLE.hold_bow(pose, 3.0, 5.0, -28.0)
    return pose


def scared_pose(f):
    """Hunched and shaking, left hand over the eyes (cower), bow clutched upright in the right fist."""
    pose = _base()
    shake = math.sin(f * 2.6) * (1.0 if f >= 8 else 0.0)
    set_legs(pose, 24 + 2 * shake, 30 + 4 * shake, 0, 26 - 2 * shake, 32 - 4 * shake, 0)
    pose.rot("spine", rot_x(7))
    pose.rot("head", rot_x(-3))
    pose.rot("chest", rot_z(2.6 * shake))
    pose.rot("hips", rot_z(-1.8 * shake))
    kin = SKEL.kin(pose)
    reach(pose, "L", kin.point("head", V((2.6, -8.3, 62.4))), V((1.0, 0.1, -0.7)))
    reach(pose, "R", kin.point("chest", V((-8.2, -5.0, 37.5))), V((-1.0, 0.2, -0.5)))
    STYLE.hold_bow(pose, -4.0, 8.0, -20.0)
    return pose


def sad_pose(f):
    """A sulk: one stamp of the foot, then arms folded over the belly with the bow stood near-upright in the right fist (R5)."""
    pose = _base()
    stamp = math.sin(math.pi * (f - 4) / 8) if 4 <= f <= 12 else 0.0
    slam = max(0.0, 1 - abs(f - 12) / 2.0)
    set_legs(pose, 5 + 36 * max(stamp, 0), 8 + 50 * max(stamp, 0), -14 * max(stamp, 0), 5, 10 + 8 * slam, 0)
    pose.rot("spine", rot_x(8))
    pose.rot("head", rot_x(9))
    pose.rot("head", rot_z(-5))
    pose.rot("shoulder.L", rot_y(8))
    pose.rot("shoulder.R", rot_y(-8))
    sigh = math.sin(2 * math.pi * f / 36)
    pose.rot("chest", rot_x(-1.4 * sigh))
    kin = SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", V((-1.4, -8.8, 36.5))), V((-0.4, -0.5, -1.0)))
    reach(pose, "L", kin.point("chest", V((-5.6, -6.2, 39.6))), V((0.3, -0.4, -1.0)))
    STYLE.hold_bow(pose, 0.0, 16.0, -35.0)
    return pose


# ---------------------------------------------------------------- cheer: two bounds, the first with a full turn (Win screen only)

CHEER_KEYS = {
    #  f:   hipL kneeL ankL hipR kneeR ankR lean shL elL shR  elR mace head
    0:  (0, 0, 0, 0, 0, 0, 0, 3, 10, 2, 11, 24, 0),
    6:  (48, 66, 10, 48, 66, 10, 12, -25, 20, -25, 20, 24, 2),
    9:  (-6, 6, -32, -6, 6, -32, 6, 90, 20, 150, 16, 24, -3),
    14: (60, 62, -10, -30, 40, -30, 8, 150, 10, 172, 10, 24, -4),
    22: (22, 40, 5, 22, 40, 5, 8, 100, 20, 120, 20, 24, 0),
    26: (44, 52, 8, 44, 52, 8, 10, 40, 35, 60, 30, 24, 0),
    32: (4, 8, 0, 4, 8, 0, 0, 40, 30, 160, 12, 24, -2),
    37: (44, 60, 8, 44, 60, 8, 10, -20, 25, -20, 25, 24, 2),
    40: (-6, 6, -32, -6, 6, -32, 6, 100, 15, 165, 12, 24, -3),
    46: (40, 50, -8, -10, 30, -25, 8, 170, 10, 172, 10, 24, -4),
    52: (30, 36, 4, 30, 36, 4, 8, 60, 30, 90, 25, 24, 0),
    56: (6, 10, 0, 6, 10, 0, 2, 12, 14, 40, 14, 24, 0),
    60: (0, 0, 0, 0, 0, 0, 0, 3, 10, 2, 11, 24, 0),
}
BOUNDS = ((8, 22, 18.0, True), (39, 52, 14.0, False))   # (take-off frame, landing frame, hop height du, full turn)


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
        pose = motion.angle_pose(STYLE, _cheer_params(f), f / 60 * 2 * math.pi * 2)
        for start, end, height, turn in BOUNDS:
            if start <= f <= end:
                u = (f - start) / (end - start)
                pose.hop = height * 4 * u * (1 - u)
                if turn:
                    theta = 360.0 * smooth(u)
                    spin = rot_z(theta)
                    pose.rel["root"] = spin
                    for s in "LR":
                        pose.world[f"foot.{s}"] = spin @ pose.world[f"foot.{s}"]
                    pose.world["prop.R"] = spin @ pose.world["prop.R"]
        poses.append(pose)
    motion.solve_ground(poses, hold=None)
    return motion.loop_close(poses)


# ---------------------------------------------------------------- main

CLIPS = ("idle", "walk", "run", "leap", "happy", "excited", "scared", "sad", "cheer")


def emotion_clip(builder, frames, rise):
    idle0 = motion.idle_pose(STYLE, 0)
    return motion.clip_from_blend(idle0, builder, frames, rise)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "lakshmana.glb"
    metrics_path = argv[argv.index("--metrics") + 1] if "--metrics" in argv else None
    t0 = time.time()
    lib.reset_scene()
    kit = build_mesh()
    obj = kit.build_object()
    common.bake_ao_and_jitter(obj)
    arm = rig.build_armature(scale=SCALE, bones=BONES)
    rig.skin(obj, arm)

    clips = {"idle": motion.clip_idle(STYLE)}
    clips["walk"], _ = motion.clip_walk(STYLE)
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
        got = len(poses) - 1
        assert got == frames[name], f"{name}: {got} frames, spec says {frames[name]}"
        report[name] = motion.clip_report(poses)
        report[name]["max_bow_tilt"] = round(max(bow_axis_tilt(p) for p in poses), 2)
        if name == "leap":
            report[name]["land_max_knee"] = motion.clip_report(poses[motion.LEAP_BANDS[3]:])["max_knee"]
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
