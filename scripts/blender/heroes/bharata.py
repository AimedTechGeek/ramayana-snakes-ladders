"""Bharata, complete: clay-toy mesh on the shared 31-bone rig, nine clips, meshopt GLB (T46.2).

Run:  node scripts/blender/run.mjs scripts/blender/heroes/bharata.py public/models/heroes/bharata.glb
      (or `npm run blender:heroes -- bharata`)

Design (T46 brothers doc): natural wheat skin, dark hair in a tall jata top-knot under a low gold diadem with a violet
jewel and a fan of small gold points (not Rama's tiered mukuta, not Lakshmana's saffron headband), a violet dhoti with
gold hem and belt, a lighter violet uttariya from the RIGHT shoulder to the left hip (Rama's goes the other way), gold
jewellery with violet studs, and Rama's padukas: a pair of wooden sandals, one on each cupped palm on a small violet
cloth, carried in front of the upper chest in every clip.

The padukas are rigid on `hand.L` / `hand.R` (weight 1.0). The hand bone is oriented explicitly (pose.world) so the
sandals stay level, soles down toward the palms and the wooden tops (with the gold toe-knob) facing up; the arms are
solved by IK to wrist targets in the chest frame, so the pair travels with the body in every clip. Never on the ground,
never below 0.6 of the hero height, never swung. Only the calm, restrained gestures of Rama are used (R1-R3): the
free-arm numbers of the generic report do not apply (both arms carry); the build reports paduka numbers instead.

The module is a script (it builds on import, like rama.py); do not import it from another hero.
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
from common import (GOLD, HERO_BONES, SAFFRON, SCALE, ClayKit,  # noqa: E402
                    limb_weights, smooth_weights)
from motion import (SKEL, HPose, Style, reach, rot_x, rot_y, rot_z,  # noqa: E402
                    set_legs, smooth)

V = Vector
Q0 = Quaternion()

# ---------------------------------------------------------------- Bharata-only palette (R10 colour restraint)
SKIN = "#E4B38C"        # natural warm wheat: no blue skin (owner decision)
VIOLET = "#6E4BB5"      # dhoti, cushion: the seat colour (T46)
LILAC = "#8E70CF"       # uttariya: a lighter step of the same violet
HAIR = "#2F2118"
PADUKA_WOOD = "#9A6335"  # sandal wood, lighter than the hair so the pair reads from above

# ---------------------------------------------------------------- the padukas (rest pose, design units)
# The pair lives on the hand bones. In the rest pose the arm hangs, the palm faces OUTWARD (+x on the left hand) and the
# sandal lies outside the palm: toe toward -z (the fingers), wooden top and knob toward outward. Carried, the hand is
# turned (pose.world) so that "outward" becomes up and the toes point forward. Offsets along that outward axis from
# the hand axis (x = 7.6): palm 0..1.5, cloth 1.2..2.1, wood 2.0..3.4, knob top 5.1.
HAND_X = 7.6
PAD_CENTRE_Z = 26.6
KNOB_Z = 22.9
KNOB_TOP = 5.1

# ---------------------------------------------------------------- the carry (chest frame, design units)
# Wrist targets in the rest chest frame. The wood underside sits 2.0 du above the wrist axis; 0.6 of the 80.2 du
# figure is 48.1, the lowest allowed point of a paduka.
CARRY = V((3.6, -8.8, 47.6))
CARRY_TILT = -10.0       # degrees, + = toes up. Toes slightly down: the wooden tops turn toward the viewer, soles away.
ELBOW_POLE = V((0.30, 0.30, -1.0))

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


# ---------------------------------------------------------------- mesh

def build_mesh():
    kit = ClayKit("Bharata")
    torso_w = lambda co: smooth_weights([30, 36, 44], ["hips", "spine", "chest"])(co.z)
    m = -1.0     # the uttariya crosses from the right shoulder (-x) to the left hip (+x): the mirror of Rama's

    # ---- torso (natural skin), neck
    kit.lathe(TORSO, sides=10, squash=(1.0, 0.88))
    kit.paint("spine", SKIN, torso_w)
    kit.lathe([(49.5, 2.8), (53, 2.7), (56, 2.4)], sides=8)
    kit.paint("neck", SKIN)

    # ---- dhoti: violet sarong that follows the legs, gold hem border, gold belt with a lilac jewel, pleated panel
    kit.lathe([(14.6, 6.5), (15.4, 6.85), (19.0, 6.7), (24.0, 6.25), (28.0, 5.65), (32.6, 4.55)],
              sides=10, squash=(1.0, 0.92), cap=False)
    kit.paint("hips", VIOLET, dhoti_w)
    kit.lathe([(14.2, 6.62), (14.6, 7.0), (16.4, 6.95), (16.8, 6.7)], sides=10, squash=(1.0, 0.92), cap=False)
    kit.paint("hips", GOLD, dhoti_w)
    kit.lathe([(30.6, 5.05), (31.0, 5.25), (32.2, 5.25), (32.6, 4.75)], sides=10, squash=(1.0, 0.9), cap=False)
    kit.paint("hips", GOLD)
    kit.sphere((0, -5.0, 31.6), (1.5, 0.9, 1.3), u=5, v=3)
    kit.paint("hips", LILAC)
    panel_w = limb_weights(24.0, 3.5, "cloth.01", "cloth.02")
    for x in (-3.6, -1.8, 0.0, 1.8, 3.6):
        kit.ellipsoid((x, -6.7 + 0.1 * x * x, 23.5), (1.05, 0.85, 8.3), None, u=5, v=4)
        kit.paint("cloth.01", VIOLET, panel_w)
    kit.tube([V((-4.4, -5.6, 15.8)), V((-2.2, -6.6, 15.5)), V((0, -6.9, 15.4)), V((2.2, -6.6, 15.5)),
              V((4.4, -5.6, 15.8))], 0.55, sides=4, round_caps=False)
    kit.paint("cloth.02", GOLD)

    # ---- uttariya: lilac shawl over the right shoulder, across the chest to a knot at the left hip, round the back
    kit.sphere((m * 6.0, 0.2, 49.4), (3.9, 3.6, 3.3), u=8, v=6)
    kit.paint("chest", LILAC)
    front = [V((m * 4.6, -1.2, 51.2))] + [on_torso(m * (3.9 - 8.2 * i / 4), 49.0 - 16.2 * i / 4, 1.0) for i in range(5)]
    front.append(V((-m * 5.4, -2.2, 32.4)))
    kit.tube(front, [1.35, 1.7, 1.75, 1.7, 1.6, 1.55, 1.5], sides=5)
    kit.paint("spine", LILAC, torso_w)
    back = [V((m * 4.6, 1.4, 51.2))] + [on_torso(m * (3.9 - 8.2 * i / 3), 49.0 - 16.0 * i / 3, 1.0, back=True)
                                        for i in range(4)]
    back.append(V((-m * 5.6, 1.4, 32.6)))
    kit.tube(back, [1.35, 1.6, 1.6, 1.5, 1.4, 1.4], sides=4)
    kit.paint("spine", LILAC, torso_w)
    kit.sphere((-m * 5.6, -0.4, 32.2), (2.3, 2.1, 2.0), u=7, v=5)                 # the knot
    kit.paint("hips", LILAC)
    kit.tube([V((-m * 5.8, -1.2, 31.4)), V((-m * 7.2, -1.6, 26.0)), V((-m * 7.5, -1.0, 21.0))],
             [1.7, 1.45, 1.0], sides=4)
    kit.paint("hips", LILAC)
    kit.tube([V((-m * 5.4, 0.6, 31.2)), V((-m * 6.8, 1.2, 25.6)), V((-m * 6.6, 0.8, 20.4))],
             [1.5, 1.25, 0.9], sides=4)
    kit.paint("hips", LILAC)
    kit.sphere((-m * 5.6, -2.4, 32.4), (0.9, 0.7, 0.9), u=5, v=3)                  # gold stud on the knot
    kit.paint("hips", GOLD)

    # ---- jewellery on the chest: necklace with one violet pendant
    neck_pts = [on_torso(-3.7 + 7.4 * i / 4, 49.4 - 5.2 * (1 - (-3.7 + 7.4 * i / 4) ** 2 / 3.7 ** 2), 0.5)
                for i in range(5)]
    kit.tube(neck_pts, 0.5, sides=4)
    kit.paint("chest", GOLD)
    kit.sphere(on_torso(0, 44.0, 1.1), (1.25, 0.9, 1.4), u=6, v=4)
    kit.paint("chest", VIOLET)

    # ---- head: skin sphere, cheeks, nose, ears with earrings, hair, jata knot, diadem
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
        kit.paint("head", VIOLET)
    kit.sphere((0, -7.45, 60.2), (1.15, 1.0, 1.2), u=6, v=4)
    kit.paint("head", SKIN)
    kit.sphere((0, 1.3, 63.4), (7.45, 7.4, 6.2), u=9, v=5)                         # hair: shows at back and temples
    kit.paint("head", HAIR)
    face = common.face_material()
    common.face_patch(kit, surfaces, (-6.2, 6.2), (55.2, 67.4), nx=9, nz=10)
    kit.bind("head", face)

    # jata top-knot: a tall coiled bun with two gold wraps and a violet jewel (top at 80.2 du = 1.43 u)
    kit.sphere((0, 1.0, 73.2), (3.7, 3.5, 4.2), u=9, v=6)
    kit.paint("head", HAIR)
    for z, r in ((71.0, 3.5), (74.6, 3.2)):
        kit.ring((0, 1.0, z), (0, 0, 1), r, 0.55, sides=4, segs=8)
        kit.paint("head", GOLD)
    kit.sphere((0, 1.0, 78.9), 1.3, u=6, v=4)
    kit.paint("head", VIOLET)

    # diadem: a gold ring hugging the brow with a violet jewel and a fan of seven small gold points
    ring = []
    for k in range(14):
        a = 2 * math.pi * k / 14
        ring.append(V((7.1 * math.sin(a), 0.7 - 6.7 * math.cos(a), 66.2)))
    kit.tube(ring, 0.85, sides=5, closed=True)
    kit.paint("head", GOLD)
    kit.sphere((0, -7.3, 66.3), (1.35, 0.8, 1.3), u=6, v=4)
    kit.paint("head", VIOLET)
    for k in range(7):
        a = math.radians(-66 + 132 * k / 6)
        base = V((6.95 * math.sin(a), 0.7 - 6.55 * math.cos(a), 66.9))
        height = 3.0 if k == 3 else (2.6 if k in (2, 4) else 2.1)
        kit.lathe([(0, 0.85), (height * 0.7, 0.5), (height, 0.05)], origin=base, sides=4)
        kit.paint("head", GOLD)

    # ---- arms: skin, armlet with a violet stud, wristband; hands cupped under the padukas
    for side, sx in (("L", 1), ("R", -1)):
        ua, fa = f"upperArm.{side}", f"foreArm.{side}"
        hand = f"hand.{side}"
        kit.sphere((sx * 6.2, 0, 48.9), 2.7, u=6, v=4)
        kit.paint(f"shoulder.{side}", SKIN)
        pts = [V((sx * 6.2, 0, 48.6)), V((sx * 6.7, 0, 42.0)), V((sx * 7.15, 0, 35.8)), V((sx * 7.4, 0, 31.8))]
        kit.tube(pts, [2.55, 2.3, 2.0, 1.85], sides=6)
        kit.paint(ua, SKIN, limb_weights(40.0, 2.4, ua, fa))
        kit.ring((sx * 6.6, 0, 44.4), (0, 0, 1), 2.75, 0.7, sides=4, segs=3)
        kit.paint(ua, GOLD)
        kit.sphere((sx * 6.6, -2.7, 44.4), (0.9, 0.7, 1.0), u=4, v=3)
        kit.paint(ua, VIOLET)
        kit.ring((sx * 7.3, 0, 33.4), (0, 0, 1), 2.1, 0.55, sides=4, segs=3)
        kit.paint(fa, GOLD)

        # hand: flat palm facing outward, four fingers along the palm, thumb on the inner edge
        hx = HAND_X * sx
        kit.sphere((hx + sx * 0.5, 0, 29.8), (1.0, 2.4, 2.8), u=7, v=5)
        kit.paint(hand, SKIN)
        for dy, ln in ((-1.7, 2.6), (-0.57, 3.0), (0.57, 2.9), (1.7, 2.3)):
            kit.ellipsoid((hx + sx * 0.7, dy, 27.2 - ln * 0.35), (0.62, 0.6, ln), None, u=5, v=3)
            kit.paint(hand, SKIN)
        kit.ellipsoid((hx + sx * 1.4, -2.8, 29.4), (0.8, 0.75, 2.0), None, u=5, v=3)     # thumb
        kit.paint(hand, SKIN)

        # the paduka, on a small violet cloth: a toe lobe and a narrower heel lobe, gold inlay, toe-knob, heel jewel
        kit.sphere((hx + sx * 1.7, 0, PAD_CENTRE_Z - 0.2), (0.45, 3.0, 6.1), u=8, v=4)
        kit.paint(hand, VIOLET)
        for cz, ry, rz in ((23.9, 2.45, 3.3), (29.4, 2.05, 2.8)):
            kit.sphere((hx + sx * 2.7, 0, cz), (0.7, ry, rz), u=8, v=4)
            kit.paint(hand, PADUKA_WOOD)
        kit.sphere((hx + sx * 3.3, 0, 26.7), (0.3, 1.25, 3.8), u=6, v=3)                # gold inlay stripe
        kit.paint(hand, GOLD)
        kit.capsule((hx + sx * 3.2, 0, KNOB_Z), (hx + sx * 4.2, 0, KNOB_Z), 0.35, sides=5)   # toe-post
        kit.paint(hand, GOLD)
        kit.sphere((hx + sx * 4.5, 0, KNOB_Z), 0.62, u=6, v=4)                           # toe-knob
        kit.paint(hand, GOLD)
        kit.sphere((hx + sx * 3.45, 0, 30.2), (0.35, 0.65, 0.65), u=5, v=3)             # heel jewel
        kit.paint(hand, SAFFRON)

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


# ---------------------------------------------------------------- the carry: both arms solved to the chest frame

def pad_points(side):
    """Rest points (design units) on the extremes of one paduka: underside and top of the wood at nine spots, knob top."""
    sx = 1 if side == "L" else -1
    hx = HAND_X * sx
    pts = []
    for dy in (-2.5, 0.0, 2.5):
        for z in (21.0, 26.6, 32.0):
            pts.append(V((hx + sx * 2.0, dy, z)))          # underside of the wood (the lowest point when carried)
            pts.append(V((hx + sx * 3.4, dy, z)))          # top of the wood
    pts.append(V((hx + sx * KNOB_TOP, 0, KNOB_Z)))         # knob top
    return pts


PAD_FLOOR = 49.0     # du above the ground: the lowest point of either paduka in any pose (0.6 of 80.2 is 48.1)


def _pad_floor(pose, ground):
    """Lowest paduka point of the pose once the ground solve has set the root height to `ground`."""
    kin = SKEL.kin(pose)
    low = min(kin.point(f"hand.{s}", p).z for s in "LR" for p in pad_points(s))
    return low + ground


def carry(pose, lift=0.0, draw=0.0, spread=0.0, tilt=CARRY_TILT, ground=None):
    """Both hands under the padukas, in the chest frame. Call after the legs and the body rotations are set.
    lift (+ up) and draw (+ toward the body) are in design units; `spread` widens the hands. The wrists are solved
    to the chest, then raised just enough that the pair never sinks below PAD_FLOOR once the ground solve has
    lowered a crouching body: the padukas stay at chest height or above in every pose. `ground` = the root height
    the ground solve will give this frame (default: the solve of the pose itself; the leap passes its held height)."""
    if ground is None:
        ground = SKEL.ground_z(pose) + pose.hop
    for _ in range(3):
        kin = SKEL.kin(pose)
        for side, sx in (("L", 1), ("R", -1)):
            target = V((sx * (CARRY.x + spread), CARRY.y + draw, CARRY.z + lift))
            reach(pose, side, kin.point("chest", target), V((sx * ELBOW_POLE.x, ELBOW_POLE.y, ELBOW_POLE.z)))
            pose.world[f"hand.{side}"] = kin.D["chest"] @ rot_x(-(90.0 + tilt)) @ rot_z(-90.0 * sx)
        # the hand frame follows the (just solved) chest; measure with it in place
        short = PAD_FLOOR - _pad_floor(pose, ground)
        if short <= 0.01:
            break
        lift += short


class BharataStyle(Style):
    """Both arms always carry. `kind` only adds the small amounts below; nothing swings."""

    def arms(self, pose, kind, p, ph):
        if kind == "idle":
            carry(pose, lift=0.3 * math.sin(ph))
        elif kind == "walk":
            carry(pose, lift=0.25 * math.sin(2 * ph))
        elif kind == "run":
            f = round(ph * motion.RUN_FRAMES / (2 * math.pi)) % motion.RUN_FRAMES
            hop = 3.0 * math.sin(math.pi / 3) if f in RUN_AIR else 0.0       # clip_run: air frames, hop 3.0 du
            carry(pose, lift=0.35 * math.sin(2 * ph), draw=0.4, ground=SKEL.ground_z(pose) + hop)
        else:                                    # leap: the body keeps its take-off height in flight (frames 7..15)
            held = motion.LEAP_BANDS[2] + 1 <= p["f"] <= motion.LEAP_BANDS[3] - 1
            carry(pose, lift=0.3, ground=_takeoff_ground() if held else None)


STYLE = BharataStyle()
RUN_AIR = (6, 7, 14, 15)         # the frames motion.clip_run solves as airborne (must match its air={...})


def _takeoff_ground():
    """Root height of the take-off frame (leap frame 6), which solve_ground holds through the flight."""
    pose = HPose()
    p = _bound_params(motion.LEAP_BANDS[2])
    set_legs(pose, p["hipL"], p["kneeL"], p["ankL"], p["hipR"], p["kneeR"], p["ankR"])
    return SKEL.ground_z(pose)

# The swift stride (R3), exactly Rama's table. Same table layout as motion._RUN_HALF.
RUN_HALF = [
    #  hipL kneeL ankL hipR kneeR ankR  shL  shR  elL  elR lean   (the arm columns are unused: the arms carry)
    (+36, 14, +5, -26, 52, -10, -26, +26, 50, 55, 6),    # contact
    (+12, 28, -4, +12, 58, -16, -8, +8, 55, 55, 6),      # down
    (-30, 22, -22, +40, 46, 0, +26, -26, 55, 55, 7),     # air
]
motion._RUN_T, motion._RUN_ROWS = motion._table(RUN_HALF, [0, 3, 6], motion.RUN_FRAMES)


# ---------------------------------------------------------------- emotion poses (restrained: R1, R2)

def _legs_straight(pose, hl=0, kl=2, hr=0, kr=2):
    set_legs(pose, hl, kl, 0, hr, kr, 0)


def happy_pose(f):
    """Quiet joy: a gentle bow of the head over the padukas, the pair lifted a little toward the heart."""
    pose = HPose()
    _legs_straight(pose)
    pose.rot("head", rot_x(7))
    pose.rot("chest", rot_x(-1.0 + 0.6 * math.sin(2 * math.pi * f / 36)))
    carry(pose, lift=1.0, draw=0.4)
    return pose


def excited_pose(f):
    """A small bound (hop <= 1.6 du, knees <= 20) with the padukas held steady and a little higher."""
    pose = HPose()
    s = math.sin(2 * math.pi * (f - 8) / 18) if f >= 8 else 0.0
    air = max(0.0, s)
    crouch = max(0.0, -s)
    knee = 3 + 10 * crouch + 8 * air
    set_legs(pose, knee * 0.5, knee, 0, knee * 0.5, knee, 0)
    pose.hop = 1.6 * air
    pose.rot("head", rot_x(-1))
    carry(pose, lift=1.2, draw=0.3)
    return pose


def scared_pose(f):
    """Concern, not fright (R2): one foot steps back, the padukas are drawn in against the chest, he stays tall."""
    pose = HPose()
    set_legs(pose, 5, 6, 0, -16, 14, 6)
    pose.rot("spine", rot_x(-2))
    pose.rot("head", rot_x(1))
    carry(pose, lift=0.4, draw=2.2, spread=-0.2)
    return pose


def sad_pose(f):
    """A slow sigh: head dips 10 degrees over the padukas, shoulders soften. Held a touch closer, never lowered."""
    pose = HPose()
    _legs_straight(pose, 2, 4, 2, 4)
    pose.rot("spine", rot_x(2))
    pose.rot("head", rot_x(10))
    pose.rot("shoulder.L", rot_y(4))
    pose.rot("shoulder.R", rot_y(-4))
    sigh = math.sin(2 * math.pi * f / 36)
    pose.rot("chest", rot_x(-1.2 * sigh))
    carry(pose, lift=0.0, draw=1.0)
    return pose


# ---------------------------------------------------------------- leap: a bound (22 f: 4 anticipation / 2 takeoff / 10 air / 6 land)

_BOUND_KEYS = {
    #  f:   hipL kneeL ankL hipR kneeR ankR lean shL elL shR elR (unused) head
    0:  (0, 2, 0, 0, 2, 0, 0, 9, 28, 3, 10, 0, 0),
    4:  (20, 30, 8, 20, 30, 8, 5, 6, 30, 8, 18, 4, 2),          # a small dip, not a crouch
    6:  (-6, 4, -30, -6, 4, -30, 3, 14, 28, 16, 20, 8, 0),      # takeoff on the toes
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
            out = {n: _BOUND_KEYS[a][i] + (_BOUND_KEYS[b][i] - _BOUND_KEYS[a][i]) * t
                   for i, n in enumerate(motion._LEAP_FIELDS)}
            out["f"] = f
            return out
    out = dict(zip(motion._LEAP_FIELDS, _BOUND_KEYS[ks[-1]]))
    out["f"] = f
    return out


def leap_clip():
    poses = [motion.angle_pose(STYLE, _bound_params(f), 0.0) for f in range(motion.LEAP_FRAMES + 1)]
    motion.solve_ground(poses, hold=set(range(7, 16)))
    return poses


# ---------------------------------------------------------------- cheer: a quiet offering loop (Win screen), no spin, no flip

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
        pose.rot("head", rot_x(3))
        pose.rot("head", rot_y(5 * math.sin(ph)))
        pose.rot("chest", rot_x(0.8 * math.sin(2 * ph)))
        carry(pose, lift=0.9 + 0.5 * math.sin(2 * ph), draw=0.3)         # the pair rises a touch with each bound
        poses.append(motion.finish(pose))
    motion.solve_ground(poses)
    return motion.loop_close(poses)


# ---------------------------------------------------------------- checks computed from FK (asserted in tests/bharataGlb.test.ts)

FACE_REST = V((0, -7.0, 6.5))


def bharata_report(poses):
    """motion.clip_report plus Bharata's own R1 numbers and the paduka numbers (design units, degrees).
    Pad points are the underside/top corners of both sandals: lowest/highest over the clip, relative to the figure."""
    out = motion.clip_report(poses, free="R")
    pts = {"L": pad_points("L"), "R": pad_points("R")}
    min_z = min_above_hips = min_tilt = min_face = 1e9
    max_z = -1e9
    min_knee_z = 1e9
    max_right_cross = max_left_cross = -1e9
    min_hand_face = 1e9
    wrist_lo = {"L": V((1e9, 1e9, 1e9)), "R": V((1e9, 1e9, 1e9))}
    wrist_hi = {"L": V((-1e9, -1e9, -1e9)), "R": V((-1e9, -1e9, -1e9))}
    for pose in poses:
        k = SKEL.kin(pose)
        hips_z = k.head("hips").z
        face = k.head("head") + FACE_REST
        for side, sx in (("L", 1), ("R", -1)):
            hand = f"hand.{side}"
            for p in pts[side]:
                q = k.point(hand, p)
                min_z = min(min_z, q.z)
                max_z = max(max_z, q.z)
                min_above_hips = min(min_above_hips, q.z - hips_z)
                min_face = min(min_face, (q - face).length)
            top = k.D[hand] @ V((sx, 0, 0))                            # the wooden top's normal
            min_tilt = min(min_tilt, top.z)
            min_hand_face = min(min_hand_face, (k.head(hand) - face).length)
            rel = k.D["chest"].inverted() @ (k.head(hand) - k.head("chest"))
            lo, hi = wrist_lo[side], wrist_hi[side]
            wrist_lo[side] = V((min(lo.x, rel.x), min(lo.y, rel.y), min(lo.z, rel.z)))
            wrist_hi[side] = V((max(hi.x, rel.x), max(hi.y, rel.y), max(hi.z, rel.z)))
        min_knee_z = min(min_knee_z, k.head("shin.L").z, k.head("shin.R").z)
        max_right_cross = max(max_right_cross, k.head("hand.R").x)
        max_left_cross = max(max_left_cross, -k.head("hand.L").x)
    out["pad_min_z"] = round(min_z, 2)
    out["pad_max_z"] = round(max_z, 2)
    out["pad_min_above_hips"] = round(min_above_hips, 2)
    out["pad_min_top_normal_z"] = round(min_tilt, 3)                   # 1 = level, wooden tops up
    out["pad_min_to_face"] = round(min_face, 2)
    out["wrist_range_in_chest_frame"] = round(max((wrist_hi[k] - wrist_lo[k]).length for k in "LR"), 2)   # per hand
    out["min_knee_z"] = round(min_knee_z, 2)
    out["right_hand_over_midline"] = round(max_right_cross, 2)         # < 0: never crosses to the left
    out["left_hand_over_midline"] = round(max_left_cross, 2)           # < 0: never crosses to the right
    out["min_hand_to_face"] = round(min_hand_face, 2)
    return out


# ---------------------------------------------------------------- bake check: our FK vs Blender for the hand and the pad

_verify_fk = motion.verify_fk


def verify_with_pads(arm, poses, frames=(0,)):
    """motion.verify_fk plus the hand orientation: the knob top of each paduka, posed by Blender and by our FK, must
    agree (this catches a wrong twist of the hand, which no bone head can show). Returns the worst error in du."""
    worst = _verify_fk(arm, poses, frames)
    scene = bpy.context.scene
    tracks = list(arm.animation_data.nla_tracks)
    muted = [t.mute for t in tracks]
    for t in tracks:
        t.mute = True
    for f in frames:
        if f >= len(poses):
            continue
        scene.frame_set(f)
        bpy.context.view_layer.update()
        kin = SKEL.kin(poses[f])
        for side, sx in (("L", 1), ("R", -1)):
            bone = f"hand.{side}"
            pb = arm.pose.bones[bone]
            rest_pt = V((HAND_X * sx + sx * KNOB_TOP, 0, KNOB_Z))
            local = pb.bone.matrix_local.inverted() @ (rest_pt * SCALE)
            blender_pt = (pb.matrix @ local) / SCALE
            err = (blender_pt - kin.point(bone, rest_pt)).length
            if err > 0.1:
                print(f"PAD mismatch frame {f} {bone}: {err:.3f} du")
            worst = max(worst, err)
    for t, flag in zip(tracks, muted):
        t.mute = flag
    return worst


motion.verify_fk = verify_with_pads

# ---------------------------------------------------------------- main

CLIPS = ("idle", "walk", "run", "leap", "happy", "excited", "scared", "sad", "cheer")


def emotion_clip(builder, frames, rise):
    idle0 = motion.idle_pose(STYLE, 0)
    return motion.clip_from_blend(idle0, builder, frames, rise)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "bharata.glb"
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
        report[name] = bharata_report(poses)
        if name == "leap":
            report[name]["land_max_knee"] = motion.clip_report(poses[motion.LEAP_BANDS[3]:], free="R")["max_knee"]
        err = motion.bake(arm, name, poses, verify=(0, 4, 9, 12) if name != "idle" else ())
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
    print("TOP " + json.dumps(sorted(kit.tri_log, reverse=True)[:60]))
    print("METRICS " + json.dumps(metrics))
    print("REPORT " + json.dumps(report))
    if metrics_path:
        with open(metrics_path, "w") as fh:
            json.dump({"metrics": metrics, "report": report}, fh, indent=1)


main()
