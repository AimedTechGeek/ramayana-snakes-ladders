"""Rama, complete: clay-toy mesh on the shared 31-bone rig, nine clips, meshopt GLB (T44.9).

Run:  node scripts/blender/run.mjs scripts/blender/heroes/rama.py public/models/heroes/rama.glb
      (or `npm run blender:heroes -- rama`)

Design (T44 4.3): natural wheat skin, dark hair under a kirita-mukuta, blue uttariya over the left shoulder knotted at
the right hip, yellow pitambara dhoti with saffron border and a pleated front panel on cloth.01/02, gold jewellery,
saffron tilak, the Kodanda bow in the left hand (prop.L) and a quiver with five arrows on the back (strap over the
right shoulder). He is calm and dignified in every clip (R1-R3): upright, a swift stride and a small bound, never a
tuck, crouch, somersault or violent swing. Hanuman's tail bones stay in the shared rig (31 bones, unused here).

The module is a script (it builds on import, like hanuman.py); do not import it from another hero.
"""
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402,F401
from mathutils import Quaternion, Vector  # noqa: E402

import common  # noqa: E402
import export  # noqa: E402
import lib  # noqa: E402
import motion  # noqa: E402
import rig  # noqa: E402
from common import (GOLD, HERO_BONES, INK, PARCH, SAFFRON, SCALE, ClayKit,  # noqa: E402
                    limb_weights, smooth_weights)
from motion import (SKEL, HPose, Style, blend, reach, rot_x, rot_y, rot_z,  # noqa: E402
                    set_arm, set_legs, smooth)

V = Vector
Q0 = Quaternion()

# ---------------------------------------------------------------- Rama-only palette (T44 4.3; R10 colour restraint)
SKIN = "#E8B58C"        # natural warm wheat: no blue skin (owner decision)
BLUE = "#3F6FC2"        # uttariya, `ramaAccent`
LEATHER = "#7A5A3A"     # quiver, strap
SHAFT = "#B98A55"       # arrow shafts
HAIR = "#2F2118"
DHOTI = "#E9C12F"       # pitambara (same hex as the gold, as specified)

# ---------------------------------------------------------------- the Kodanda bow (prop.L, rest pose, design units)
GRIP = V(HERO_BONES["prop.L"][1])          # the left fist; the bow is vertical through it
BOW_LOW, BOW_UP = 25.5, 36.1               # 61.6 du = 1.10 u; the lower tip stays above 2.5 du (feet are y < 0.045 u)
BOW_BELLY = 6.2                            # the tips curve back toward the string side (+y)
BOW_FORWARD_WALK = 20.0                    # T44 4.3: angled 20 degrees forward when walking
BOW_LOWER_TIP = V((GRIP.x, GRIP.y + BOW_BELLY, GRIP.z - BOW_LOW))
BOW_UPPER_TIP = V((GRIP.x, GRIP.y + BOW_BELLY, GRIP.z + BOW_UP))

# ---------------------------------------------------------------- the quiver (bone `back`, rest pose)
Q_BASE = V((3.0, 6.7, 33.6))
Q_AXIS = V((-6.2, 2.4, 23.3)).normalized()
Q_LEN = 23.5
Q_TOP = Q_BASE + Q_AXIS * Q_LEN

TORSO = [(32.4, 4.2), (36, 4.7), (44, 5.0), (49, 4.3), (51, 3.3)]


def torso_radius(z):
    for (z0, r0), (z1, r1) in zip(TORSO, TORSO[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return TORSO[0][1] if z < TORSO[0][0] else TORSO[-1][1]


def on_torso(x, z, out, back=False):
    """A point `out` du off the torso surface at (x, z), front or back."""
    r = torso_radius(z)
    x = max(-0.92 * r, min(0.92 * r, x))
    y = (0.88 if back else -0.88) * r * math.sqrt(1 - (x / r) ** 2)
    n = V((x / r, y / (0.88 * r) / 0.88, 0)).normalized()
    return V((x, y, z)) + n * out


def _foot_w(co, foot, toe):
    t = smooth((-co.y - 3.2) / 2.2)
    return {foot: 1 - t, toe: t} if 0 < t < 1 else ({foot: 1.0} if t == 0 else {toe: 1.0})


def dhoti_w(co):
    """The dhoti follows the hips above the waist and, lower down, the thigh on its side of the body (a sarong that
    moves with the legs); a vertex near the centre line follows both thighs half each."""
    t = 0.72 * smooth((29.0 - co.z) / 14.0)
    left = max(0.0, min(1.0, 0.5 + co.x / 4.0))
    w = {"hips": 1.0 - t}
    if t > 0:
        w["thigh.L"] = t * left
        w["thigh.R"] = t * (1.0 - left)
    return {k: v for k, v in w.items() if v > 1e-4}


def axis_rot(direction):
    return V(direction).normalized().to_track_quat("Z", "Y")


# ---------------------------------------------------------------- mesh

def build_mesh():
    kit = ClayKit("Rama")
    torso_w = lambda co: smooth_weights([30, 36, 44], ["hips", "spine", "chest"])(co.z)

    # ---- torso (natural skin), neck
    kit.lathe(TORSO, sides=10, squash=(1.0, 0.88))
    kit.paint("spine", SKIN, torso_w)
    kit.lathe([(49.5, 2.8), (53, 2.7), (56, 2.4)], sides=8)
    kit.paint("neck", SKIN)

    # ---- dhoti (pitambara): sarong that follows the legs, saffron hem border, waist belt with a gold buckle
    kit.lathe([(14.6, 6.5), (15.4, 6.85), (19.0, 6.7), (24.0, 6.25), (28.0, 5.65), (32.6, 4.55)],
              sides=10, squash=(1.0, 0.92), cap=False)
    kit.paint("hips", DHOTI, dhoti_w)
    kit.lathe([(14.2, 6.62), (14.6, 7.0), (16.4, 6.95), (16.8, 6.7)], sides=10, squash=(1.0, 0.92), cap=False)
    kit.paint("hips", SAFFRON, dhoti_w)
    kit.lathe([(30.6, 5.05), (31.0, 5.25), (32.2, 5.25), (32.6, 4.75)], sides=10, squash=(1.0, 0.9), cap=False)
    kit.paint("hips", SAFFRON)
    kit.sphere((0, -5.0, 31.6), (1.5, 0.9, 1.3), u=5, v=3)
    kit.paint("hips", GOLD)
    # pleated front panel: five fanned folds hanging from the waist on cloth.01/02, saffron hem
    panel_w = limb_weights(24.0, 3.5, "cloth.01", "cloth.02")
    for x in (-3.6, -1.8, 0.0, 1.8, 3.6):
        kit.ellipsoid((x, -6.7 + 0.1 * x * x, 23.5), (1.05, 0.85, 8.3), None, u=5, v=4)
        kit.paint("cloth.01", DHOTI, panel_w)
    kit.tube([V((-4.4, -5.6, 15.8)), V((-2.2, -6.6, 15.5)), V((0, -6.9, 15.4)), V((2.2, -6.6, 15.5)),
              V((4.4, -5.6, 15.8))], 0.55, sides=4, round_caps=False)
    kit.paint("cloth.02", SAFFRON)

    # ---- uttariya: blue shawl over the left shoulder, across the chest to a knot at the right hip, round the back
    kit.sphere((6.0, 0.2, 49.4), (3.9, 3.6, 3.3), u=8, v=6)
    kit.paint("chest", BLUE)
    front = [V((4.6, -1.2, 51.2))] + [on_torso(3.9 - 8.2 * i / 4, 49.0 - 16.2 * i / 4, 1.0) for i in range(5)]
    front.append(V((-5.4, -2.2, 32.4)))
    kit.tube(front, [1.35, 1.7, 1.75, 1.7, 1.6, 1.55, 1.5], sides=5)
    kit.paint("spine", BLUE, torso_w)
    back = [V((4.6, 1.4, 51.2))] + [on_torso(3.9 - 8.2 * i / 3, 49.0 - 16.0 * i / 3, 1.0, back=True) for i in range(4)]
    back.append(V((-5.6, 1.4, 32.6)))
    kit.tube(back, [1.35, 1.6, 1.6, 1.5, 1.4, 1.4], sides=4)
    kit.paint("spine", BLUE, torso_w)
    kit.sphere((-5.6, -0.4, 32.2), (2.3, 2.1, 2.0), u=7, v=5)                    # the knot
    kit.paint("hips", BLUE)
    kit.tube([V((-5.8, -1.2, 31.4)), V((-7.2, -1.6, 26.0)), V((-7.5, -1.0, 21.0))], [1.7, 1.45, 1.0], sides=4)
    kit.paint("hips", BLUE)
    kit.tube([V((-5.4, 0.6, 31.2)), V((-6.8, 1.2, 25.6)), V((-6.6, 0.8, 20.4))], [1.5, 1.25, 0.9], sides=4)
    kit.paint("hips", BLUE)

    # ---- jewellery on the chest: necklace with one saffron pendant
    neck_pts = [on_torso(-3.7 + 7.4 * i / 4, 49.4 - 5.2 * (1 - (-3.7 + 7.4 * i / 4) ** 2 / 3.7 ** 2), 0.5)
                for i in range(5)]
    kit.tube(neck_pts, 0.5, sides=4)
    kit.paint("chest", GOLD)
    kit.sphere(on_torso(0, 44.0, 1.1), (1.25, 0.9, 1.4), u=6, v=4)
    kit.paint("chest", SAFFRON)

    # ---- head: skin sphere, cheeks, nose, ears with earrings, hair, tilak
    HC = (0, 0, 61.5)
    kit.sphere(HC, 7.2, u=12, v=8)
    kit.paint("head", SKIN)
    surfaces = [(HC, (7.2, 7.2, 7.2))]
    for sx in (-1, 1):
        cheek = ((sx * 3.3, -4.7, 59.6), (3.1, 2.7, 2.8))
        surfaces.append(cheek)
        kit.sphere(cheek[0], cheek[1], u=6, v=4)
        kit.paint("head", SKIN)
        kit.ellipsoid((sx * 7.2, 0.8, 61.2), (0.9, 1.6, 2.3), None, u=5, v=4)
        kit.paint("head", SKIN)
        kit.sphere((sx * 7.7, 0.9, 58.3), (0.75, 0.75, 1.0), u=5, v=3)             # earring
        kit.paint("head", GOLD)
        kit.sphere((sx * 7.7, 0.9, 56.8), (0.55, 0.55, 0.8), u=4, v=3)
        kit.paint("head", SAFFRON)
    kit.sphere((0, -7.45, 60.2), (1.15, 1.0, 1.2), u=6, v=4)
    kit.paint("head", SKIN)
    kit.sphere((0, 1.3, 63.4), (7.45, 7.4, 6.2), u=9, v=5)                         # hair: shows at back and temples
    kit.paint("head", HAIR)
    kit.sphere((0, -5.55, 65.6), (0.65, 0.45, 1.35), u=5, v=4)                      # saffron tilak (vertical)
    kit.paint("head", SAFFRON)
    face = common.face_material()
    common.face_patch(kit, surfaces, (-6.2, 6.2), (55.2, 67.4), nx=9, nz=10)
    kit.bind("head", face)

    # ---- kirita-mukuta: gold band with jewels, three tiers, finial (top at 80.2 du = 1.43 u)
    kit.lathe([(66.9, 4.85), (67.3, 5.2), (68.8, 5.1), (69.2, 4.7), (72.3, 3.9), (72.6, 4.2), (73.1, 3.4),
               (75.5, 2.7), (75.8, 3.0), (76.2, 2.2), (78.4, 1.3), (79.5, 0.4)], sides=9)
    kit.paint("head", GOLD)
    kit.sphere((0, 0, 79.5), 0.8, u=5, v=3)
    kit.paint("head", GOLD)
    kit.sphere((0, -5.25, 68.0), (1.25, 0.8, 1.15), u=6, v=4)                      # saffron jewel on the band
    kit.paint("head", SAFFRON)
    for k in (0, 1, 2, 4, 5, 6):
        ang = math.radians(-72 + 144 * k / 6)
        kit.sphere((math.sin(ang) * 5.25, -math.cos(ang) * 5.0, 67.95), 0.55, u=4, v=3)
        kit.paint("head", GOLD)

    # ---- arms: skin, armlet with a saffron stud, wristband; right hand open (blessing), left hand a fist on the bow
    for side, sx in (("L", 1), ("R", -1)):
        ua, fa = f"upperArm.{side}", f"foreArm.{side}"
        kit.sphere((sx * 6.2, 0, 48.9), 2.7, u=6, v=4)
        kit.paint(f"shoulder.{side}", SKIN)
        pts = [V((sx * 6.2, 0, 48.6)), V((sx * 6.7, 0, 42.0)), V((sx * 7.15, 0, 35.8)), V((sx * 7.4, 0, 31.8))]
        kit.tube(pts, [2.55, 2.3, 2.0, 1.85], sides=6)
        kit.paint(ua, SKIN, limb_weights(40.0, 2.4, ua, fa))
        kit.ring((sx * 6.6, 0, 44.4), (0, 0, 1), 2.75, 0.7, sides=4, segs=3)
        kit.paint(ua, GOLD)
        kit.sphere((sx * 6.6, -2.7, 44.4), (0.9, 0.7, 1.0), u=4, v=3)
        kit.paint(ua, SAFFRON)
        kit.ring((sx * 7.3, 0, 33.4), (0, 0, 1), 2.1, 0.55, sides=4, segs=3)
        kit.paint(fa, GOLD)
        if side == "R":
            kit.sphere((sx * 7.6, 0, 29.4), (2.3, 1.7, 2.3), u=6, v=4)               # palm
            kit.paint("hand.R", SKIN)
            for dx, ln in ((-1.4, 1.9), (-0.47, 2.15), (0.47, 2.15), (1.4, 1.85)):     # fingers
                kit.ellipsoid((sx * 7.6 + dx, -0.15, 27.6 - ln + 1.2), (0.66, 0.6, ln), None, u=5, v=3)
                kit.paint("hand.R", SKIN)
            kit.ellipsoid((sx * 7.6 - sx * 2.0, -0.9, 28.9), (0.75, 0.7, 1.9), None, u=5, v=3)   # thumb
            kit.paint("hand.R", SKIN)
        else:
            kit.sphere((7.6, 0, 29.8), (2.5, 2.3, 2.7), u=7, v=5)                       # fist round the bow grip
            kit.paint("hand.L", SKIN)
            kit.sphere((6.0, -2.2, 30.4), 1.2, u=5, v=3)
            kit.paint("hand.L", SKIN)

    # ---- the Kodanda bow (prop.L): gold limbs with a recurve, ink grip wrap, nocks, string
    gx, gy, gz = GRIP

    def limb(length, sign):
        pts, radii = [], []
        for i in range(4):
            s = i / 3.0
            pts.append(V((gx, gy + BOW_BELLY * s ** 1.8, gz + sign * (3.0 + (length - 3.0) * s))))
            radii.append(1.55 - 0.65 * s)
        return pts, radii

    for length, sign in ((BOW_UP, 1), (BOW_LOW, -1)):
        pts, radii = limb(length, sign)
        kit.tube(pts, radii, sides=5)
        kit.paint("prop.L", GOLD)
        kit.sphere(pts[-1], 1.05, u=5, v=3)
        kit.paint("prop.L", SAFFRON)
        for frac in (0.42, 0.75):                                                     # saffron wraps on the limbs
            s = frac
            kit.sphere((gx, gy + BOW_BELLY * s ** 1.8, gz + sign * (3.0 + (length - 3.0) * s)),
                       (1.7 - 0.65 * s, 1.7 - 0.65 * s, 0.55), u=5, v=3)
            kit.paint("prop.L", SAFFRON)
    kit.capsule((gx, gy, gz - 4.6), (gx, gy, gz + 4.8), 1.75, sides=5)
    kit.paint("prop.L", INK)
    for dz in (-4.8, 5.0):
        kit.sphere((gx, gy, gz + dz), (2.0, 2.0, 0.65), u=5, v=3)
        kit.paint("prop.L", GOLD)
    kit.capsule(BOW_LOWER_TIP, BOW_UPPER_TIP, 0.32, sides=3)
    kit.paint("prop.L", PARCH)

    # ---- quiver on the back: leather tube, gold rim and foot, strap over the right shoulder, five arrows
    qrot = axis_rot(Q_AXIS)
    kit.lathe([(0.0, 1.9), (1.2, 2.4), (20.5, 2.65), (22.0, 2.7)], origin=Q_BASE, axis=Q_AXIS, sides=8)
    kit.paint("back", LEATHER)
    for lo, hi, r in ((21.4, 23.6, 3.1), (-0.3, 2.3, 2.6), (10.8, 12.8, 2.9)):          # rim, foot and mid bands
        kit.lathe([(lo, r - 0.3), ((lo + hi) / 2, r), (hi, r - 0.3)], origin=Q_BASE, axis=Q_AXIS, sides=8, cap=False)
        kit.paint("back", GOLD)
    strap_back = [Q_BASE + Q_AXIS * 21.0 + V((0, -1.5, 0.5))]
    strap_back += [on_torso(-4.2 + 7.6 * i / 2, 52.0 - 17.0 * i / 2, 0.55, back=True) for i in range(3)]
    kit.tube(strap_back, 0.85, sides=4)
    kit.paint("back", LEATHER)
    strap_front = [V((-4.4, -0.8, 52.2))] + [on_torso(-3.9 + 7.4 * i / 3, 50.5 - 18.0 * i / 3, 0.45) for i in range(4)]
    strap_front.append(V((4.6, -1.6, 32.2)))
    kit.tube(strap_front, 0.8, sides=4)
    kit.paint("chest", LEATHER, torso_w)
    kit.capsule(V((-4.4, -0.8, 52.2)), strap_back[0], 0.85, sides=4)
    kit.paint("chest", LEATHER)
    for k, (ang, fan, ext) in enumerate(((0, 0.0, 13.0), (72, 0.10, 11.0), (144, 0.13, 12.0),
                                         (216, 0.13, 10.5), (288, 0.10, 11.5))):
        ar = math.radians(ang)
        side_vec = qrot @ V((math.cos(ar), math.sin(ar), 0.0))
        base = Q_BASE + Q_AXIS * (Q_LEN - 4.0) + side_vec * (0.0 if k == 0 else 1.25)
        direction = (Q_AXIS + side_vec * fan + V((-0.05, 0, 0))).normalized()
        top = base + direction * (4.0 + ext)
        kit.tube([base, top], 0.62, sides=5, round_caps=False)
        kit.paint("back", SHAFT)
        head_rot = axis_rot(direction)
        kit.lathe([(0, 0.4), (0.7, 1.45), (3.8, 0.05)], origin=top - direction * 0.3, axis=direction, sides=5)
        kit.paint("back", GOLD)
        for sgn in (-1, 1):
            c = base + direction * (4.0 + ext * 0.38) + (head_rot @ V((sgn * 0.7, 0, 0)))
            kit.ellipsoid(c, (0.28, 0.95, 2.6), head_rot, u=4, v=3)
            kit.paint("back", PARCH)

    # ---- legs and feet: skin tube blended at the knee, gold anklet, foot blended into the toe bone
    for side, sx in (("L", 1), ("R", -1)):
        th, sn, ft, toe = f"thigh.{side}", f"shin.{side}", f"foot.{side}", f"toe.{side}"
        pts = [V((sx * 3, 0, 25.0)), V((sx * 3, 0, 15.0)), V((sx * 3, 0, 8.0)), V((sx * 3, 0, 4.0))]
        kit.tube(pts, [3.0, 2.7, 2.3, 2.1], sides=6)
        kit.paint(th, SKIN, limb_weights(13.5, 2.4, th, sn))
        kit.ring((sx * 3, 0, 5.8), (0, 0, 1), 2.55, 0.7, sides=4, segs=3)
        kit.paint(sn, GOLD)
        kit.sphere((sx * 3, -2.2, 2.3), (3.0, 5.0, 2.3), u=7, v=5)
        kit.paint(ft, SKIN, lambda co, ft=ft, toe=toe: _foot_w(co, ft, toe))
        for dx in (-1.4, 0.0, 1.4):
            kit.sphere((sx * 3 + dx, -7.2, 1.3), (1.0, 1.1, 0.95), u=4, v=3)
            kit.paint(toe, SKIN)
    return kit


# ---------------------------------------------------------------- style: the bow in the left hand, the free right arm

class RamaStyle(Style):
    @staticmethod
    def bow_pose(pose, tilt, roll=6.0):
        """The bow, held by the left fist: `tilt` degrees forward from upright, leaning `roll` outward."""
        pose.world["prop.L"] = rot_y(roll) @ rot_x(tilt)

    def arms(self, pose, kind, p, ph):
        if kind == "idle":
            b = math.sin(ph)
            set_arm(pose, "L", 9 + 1.0 * b, 28 + 2 * b, abduct=7)
            self.bow_pose(pose, 0.0)
            set_arm(pose, "R", 3 + 1.5 * b, 10 + 2 * b, abduct=4)
        elif kind == "walk":
            set_arm(pose, "L", 9 + 0.15 * p["shL"], 30 + 0.1 * p["elL"], abduct=7)
            self.bow_pose(pose, BOW_FORWARD_WALK)
            set_arm(pose, "R", p["shR"], p["elR"], abduct=3)
        elif kind == "run":                      # the "swift stride" (R3): free arm <= 25 deg, elbows <= 55
            set_arm(pose, "L", 11 + 0.2 * p["shL"], 42, abduct=6)
            self.bow_pose(pose, BOW_FORWARD_WALK)
            set_arm(pose, "R", 0.55 * p["shR"], min(55.0, 0.6 * p["elR"]), abduct=2)
        else:                                    # angle keyed (leap, cheer): mace = bow tilt
            set_arm(pose, "L", p["shL"], p["elL"], abduct=8)
            self.bow_pose(pose, p["mace"])
            set_arm(pose, "R", p["shR"], p["elR"], abduct=6)


STYLE = RamaStyle()

# The swift stride (R3): lean <= 8, no knee bend past 60, calm swing. Same table layout as motion._RUN_HALF.
RAMA_RUN_HALF = [
    #  hipL kneeL ankL hipR kneeR ankR  shL  shR  elL  elR lean
    (+36, 14, +5, -26, 52, -10, -26, +26, 50, 55, 6),    # contact
    (+12, 28, -4, +12, 58, -16, -8, +8, 55, 55, 6),      # down
    (-30, 22, -22, +40, 46, 0, +26, -26, 55, 55, 7),     # air
]
motion._RUN_T, motion._RUN_ROWS = motion._table(RAMA_RUN_HALF, [0, 3, 6], motion.RUN_FRAMES)


# ---------------------------------------------------------------- emotion poses (T43 3.3, T44 4.5, restrained: R1, R2)

def _legs_straight(pose, hl=0, kl=2, hr=0, kr=2):
    set_legs(pose, hl, kl, 0, hr, kr, 0)


def _free_hand(pose, point, pole=V((-0.3, 0.3, -1.0))):
    kin = SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", V(point)), pole)


def happy_pose(f):
    """Rama blesses: right hand raised, palm out (abhaya), a gentle head dip, the bow held steady."""
    pose = HPose()
    _legs_straight(pose)
    pose.rot("head", rot_x(3))
    pose.rot("head", rot_y(-4))
    pose.rot("chest", rot_x(-1.0))
    _free_hand(pose, (-10.0, -7.5, 52.0))
    set_arm(pose, "L", 9, 28, abduct=7)
    STYLE.bow_pose(pose, 0.0)
    pose.rot("chest", rot_x(0.6 * math.sin(2 * math.pi * f / 36)))
    return pose


def excited_pose(f):
    """A raised-hand blessing with a small bound (hop <= 1.6 du, knees <= 20): never a jump-and-tuck."""
    pose = HPose()
    s = math.sin(2 * math.pi * (f - 8) / 18) if f >= 8 else 0.0
    air = max(0.0, s)
    crouch = max(0.0, -s)
    knee = 3 + 10 * crouch + 8 * air
    set_legs(pose, knee * 0.5, knee, 0, knee * 0.5, knee, 0)
    pose.hop = 1.6 * air
    pose.rot("head", rot_x(-2))
    _free_hand(pose, (-10.4, -5.5, 59.5), V((-0.6, 0.2, -1.0)))
    set_arm(pose, "L", 14, 34, abduct=8)
    STYLE.bow_pose(pose, 6.0)
    return pose


def scared_pose(f):
    """Concern, not fright (R2): the right foot steps back, the right hand rests on the chest, he stays tall."""
    pose = HPose()
    set_legs(pose, 5, 6, 0, -16, 14, 6)
    pose.rot("spine", rot_x(-2))
    pose.rot("head", rot_x(1))
    kin = SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", V((-2.6, -7.0, 43.5))), V((-1.0, 0.3, -0.5)))
    set_arm(pose, "L", 9, 30, abduct=7)
    STYLE.bow_pose(pose, 0.0)
    return pose


def sad_pose(f):
    """A slow sigh: head dips 6 degrees, shoulders soften, arms hang, the bow lowered forward. No slump."""
    pose = HPose()
    _legs_straight(pose, 2, 4, 2, 4)
    pose.rot("spine", rot_x(2))
    pose.rot("head", rot_x(6))
    pose.rot("shoulder.L", rot_y(4))
    pose.rot("shoulder.R", rot_y(-4))
    sigh = math.sin(2 * math.pi * f / 36)
    pose.rot("chest", rot_x(-1.2 * sigh))
    set_arm(pose, "L", 8, 22, abduct=6)
    STYLE.bow_pose(pose, 30.0, roll=4.0)
    set_arm(pose, "R", 4, 12, abduct=3)
    return pose


# ---------------------------------------------------------------- leap: a bound (22 f: 4 anticipation / 2 takeoff / 10 air / 6 land)

_BOUND_KEYS = {
    #  f:   hipL kneeL ankL hipR kneeR ankR lean shL elL shR elR bow head
    0:  (0, 2, 0, 0, 2, 0, 0, 9, 28, 3, 10, 0, 0),
    4:  (20, 30, 8, 20, 30, 8, 5, 6, 30, 8, 18, 4, 2),          # a small dip, not a crouch
    6:  (-6, 4, -30, -6, 4, -30, 3, 14, 28, 16, 20, 8, 0),      # takeoff on the toes, arms low
    11: (46, 40, -8, -26, 26, -34, 4, 14, 28, 18, 20, 14, -2),  # air: a long stride, no tuck
    16: (36, 34, -4, -18, 22, -24, 4, 12, 28, 14, 20, 10, 0),
    18: (28, 38, 6, 22, 36, 4, 4, 10, 30, 10, 18, 6, 1),        # land, knees <= 45
    22: (3, 6, 0, 3, 6, 0, 1, 9, 28, 3, 12, 2, 0),
}


def _bound_params(f):
    ks = sorted(_BOUND_KEYS)
    for a, b in zip(ks, ks[1:]):
        if a <= f <= b:
            t = smooth((f - a) / (b - a))
            return {n: _BOUND_KEYS[a][i] + (_BOUND_KEYS[b][i] - _BOUND_KEYS[a][i]) * t
                    for i, n in enumerate(motion._LEAP_FIELDS)}
    return dict(zip(motion._LEAP_FIELDS, _BOUND_KEYS[ks[-1]]))


def leap_clip():
    poses = [motion.angle_pose(STYLE, _bound_params(f), 0.0) for f in range(motion.LEAP_FRAMES + 1)]
    motion.solve_ground(poses, hold=set(range(7, 16)))
    return poses


# ---------------------------------------------------------------- cheer: a blessing loop (Win screen), no spin, no flip

def cheer_clip():
    n = 60
    poses = []
    for f in range(n):
        ph = 2 * math.pi * f / n
        pose = HPose()
        bound = max(0.0, math.sin(ph * 2 - 0.3)) ** 2                    # two small bounds per loop
        knee = 3 + 9 * (1 - bound)
        set_legs(pose, knee * 0.4, knee, 0, knee * 0.4, knee, 0)
        pose.hop = 1.3 * bound
        pose.rot("head", rot_x(-1.5))
        pose.rot("head", rot_y(5 * math.sin(ph)))
        pose.rot("chest", rot_x(0.8 * math.sin(2 * ph)))
        wave = 1.2 * math.sin(2 * ph)
        _free_hand(pose, (-10.2 + 0.6 * math.sin(ph), -6.0, 56.5 + wave), V((-0.5, 0.25, -1.0)))
        set_arm(pose, "L", 12, 32, abduct=8)
        STYLE.bow_pose(pose, 4.0)
        poses.append(motion.finish(pose))
    motion.solve_ground(poses)
    return motion.loop_close(poses)


# ---------------------------------------------------------------- checks computed from FK (asserted in tests/ramaGlb.test.ts)

BOW_TIP_REST = {"low": BOW_LOWER_TIP, "up": BOW_UPPER_TIP}


def rama_report(poses):
    """motion.clip_report (free arm = R) plus Rama's own R1/R5/R7 numbers (design units, degrees)."""
    out = motion.clip_report(poses, free="R")
    low = up_tilt_fwd = 1e9
    worst_back = 0.0
    min_knee_z = 1e9
    max_left_cross = max_right_cross = -1e9
    min_hand_face = 1e9
    min_bow_tilt = 1e9
    max_bow_tilt = -1e9
    for pose in poses:
        k = SKEL.kin(pose)
        low = min(low, k.point("prop.L", BOW_LOWER_TIP).z)
        axis = (k.point("prop.L", BOW_UPPER_TIP) - k.point("prop.L", BOW_LOWER_TIP)).normalized()
        tilt = math.degrees(math.atan2(-axis.y, axis.z))                 # + = top forward (toward -y)
        min_bow_tilt, max_bow_tilt = min(min_bow_tilt, tilt), max(max_bow_tilt, tilt)
        min_knee_z = min(min_knee_z, k.head("shin.L").z, k.head("shin.R").z) - 0.0
        max_right_cross = max(max_right_cross, k.head("hand.R").x)
        max_left_cross = max(max_left_cross, -k.head("hand.L").x)
        face = k.head("head") + V((0, -7.0, 6.5))
        min_hand_face = min(min_hand_face, (k.head("hand.R") - face).length, (k.head("hand.L") - face).length)
    out["bow_min_z"] = round(low, 2)
    out["bow_min_tilt_fwd"] = round(min_bow_tilt, 2)
    out["bow_max_tilt_fwd"] = round(max_bow_tilt, 2)
    out["min_knee_z"] = round(min_knee_z, 2)
    out["right_hand_over_midline"] = round(max_right_cross, 2)          # < 0: never crosses to the left
    out["left_hand_over_midline"] = round(max_left_cross, 2)            # < 0: never crosses to the right
    out["min_hand_to_face"] = round(min_hand_face, 2)
    return out


# ---------------------------------------------------------------- bake check: our FK vs Blender for the bow axis

_verify_fk = motion.verify_fk


def verify_with_bow(arm, poses, frames=(0,)):
    """motion.verify_fk plus the bow axis (prop.L direction): returns the larger of the position error (du) and the
    axis error (degrees / 10), so a wrong bow orientation in the baked clip fails the build loudly."""
    worst = _verify_fk(arm, poses, frames)
    scene = bpy.context.scene
    tracks = list(arm.animation_data.nla_tracks)
    muted = [t.mute for t in tracks]
    for t in tracks:
        t.mute = True
    for f in frames:
        scene.frame_set(f)
        bpy.context.view_layer.update()
        pb = arm.pose.bones["prop.L"]
        blender_axis = (pb.tail - pb.head).normalized()
        ours = SKEL.kin(poses[f]).dir("prop.L")
        err = math.degrees(blender_axis.angle(ours))
        if err > 1.0:
            print(f"BOW AXIS mismatch frame {f}: {err:.1f} deg")
        worst = max(worst, err / 10.0)
    for t, m in zip(tracks, muted):
        t.mute = m
    return worst


motion.verify_fk = verify_with_bow

# ---------------------------------------------------------------- main

CLIPS = ("idle", "walk", "run", "leap", "happy", "excited", "scared", "sad", "cheer")


def emotion_clip(builder, frames, rise):
    idle0 = motion.idle_pose(STYLE, 0)
    return motion.clip_from_blend(idle0, builder, frames, rise)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "rama.glb"
    metrics_path = argv[argv.index("--metrics") + 1] if "--metrics" in argv else None
    t0 = time.time()
    lib.reset_scene()
    kit = build_mesh()
    obj = kit.build_object()
    common.bake_ao_and_jitter(obj)
    arm = rig.build_armature(scale=SCALE, bones=HERO_BONES)
    rig.skin(obj, arm)

    clips = {"idle": motion.clip_idle(STYLE)}
    clips["walk"], _ = motion.clip_walk(STYLE)
    clips["run"], _ = motion.clip_run(STYLE)
    clips["leap"] = leap_clip()
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
        report[name] = rama_report(poses)
        if name == "leap":
            report[name]["land_max_knee"] = motion.clip_report(poses[motion.LEAP_BANDS[3]:], free="R")["max_knee"]
        err = motion.bake(arm, name, poses, verify=(0, 4, 9, 12) if name in ("walk", "run", "leap", "scared") else ())
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
    arm["bow_height_u"] = (BOW_LOW + BOW_UP) * SCALE
    arm["quiver_arrows"] = 5
    arm["report"] = json.dumps(report)
    t1 = time.time()
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    export.export_glb(out, [arm, obj], meshopt=True, image_format="AUTO", keep_static_channels=True)
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
    print("TOP " + json.dumps(sorted(kit.tri_log, reverse=True)[:200]))
    print("METRICS " + json.dumps(metrics))
    print("REPORT " + json.dumps(report))
    if metrics_path:
        with open(metrics_path, "w") as fh:
            json.dump({"metrics": metrics, "report": report}, fh, indent=1)


main()
