"""Sita, complete: clay-toy mesh on the shared hero rig (braid bones instead of the tail), nine clips, meshopt GLB.

Run:  node scripts/blender/run.mjs scripts/blender/heroes/sita.py public/models/heroes/sita.glb
Same pipeline as hanuman.py (common.py and motion.py are shared, unchanged apart from motion.use_bones).
What is Sita's own:
  * SITA_BONES  the shared rig minus tail.01-04, plus braid.01-02 (29 bones); the cloth bones carry the pallu
  * the sari: a leg-skinned skirt (the cloth follows each stride, planted feet show under the hem), pleats, borders
  * respectful gait tables (T44 4.4 R1-R3): upright, lean <= 8, free arm <= 25 (run), elbows <= 60, knees <= 60
  * the lotus in the right hand, carried in every clip; the garland, braid and tiara are part of the one mesh
"""
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

import common  # noqa: E402
import export  # noqa: E402
import lib  # noqa: E402
import motion  # noqa: E402
import rig  # noqa: E402
from common import (GOLD, HERO_BONES, PARCH, SAFFRON, SCALE, ClayKit, catmull_chain, limb_weights,  # noqa: E402
                    smooth_weights)
from motion import HPose, Style, blend, reach, rot_x, rot_y, rot_z, set_arm, set_legs, smooth  # noqa: E402

V = Vector
Q0 = Quaternion()

# ---------------------------------------------------------------- palette (T44 4.3; R10)
SKIN = "#F2C29B"
ROSE = "#D15587"            # sari, lotus petals, seat colour
ROSE_DEEP = "#9A3560"       # the same cloth in shade: pleat valleys, pallu stripe
ROSE_LIGHT = "#E383A8"      # inner lotus petals
HAIR = "#35221A"
LEAF = "#4E9A5C"
MARIGOLD = "#F6A93A"

# ---------------------------------------------------------------- the rig: shared bones, braid instead of the tail
SITA_BONES = {k: v for k, v in HERO_BONES.items() if not k.startswith("tail.")}
# the cloth bones carry the pallu: it hangs down her back from the left shoulder and streams behind her when she runs
SITA_BONES["cloth.01"] = ("chest", (2.6, 5.2, 47.0), (2.6, 5.5, 35.0))
SITA_BONES["cloth.02"] = ("cloth.01", (2.6, 5.5, 35.0), (2.6, 5.8, 22.0))
# the braid: over the left shoulder, hanging down her chest (front); +2 bones = 29
SITA_BONES["braid.01"] = ("chest", (4.7, -5.5, 43.5), (4.5, -5.6, 38.0))
SITA_BONES["braid.02"] = ("braid.01", (4.5, -5.6, 38.0), (4.4, -5.4, 31.5))
assert len(SITA_BONES) == 29
motion.use_bones(SITA_BONES, ("foot.L", "foot.R", "hand.R", "head", "braid.02", "prop.R"))
BRAID_BONES = ("braid.01", "braid.02")
PALLU_BONES = ("cloth.01", "cloth.02")

HC = (0.0, 0.0, 61.5)       # the head sphere (shared with the face atlas: patch x +-6.2, z 55.2..67.4)
HEAD_R = 7.2

# ---------------------------------------------------------------- the lotus (prop.R, rest pose in design units)
GRIP = V(HERO_BONES["prop.R"][1])       # fist centre; the stem runs along +Z through it
LOTUS_BASE = 15.5                        # bloom centre height above the grip
CARRY_WRIST = V((-7.2, -7.8, 34.6))      # chest-attached wrist target: lotus held before the waist
CARRY_POLE = V((-0.7, 0.2, -1.0))
CARRY_TILT = rot_y(-27) @ rot_x(2)       # the bloom leans out to her right, clear of the face and the garland


# ---------------------------------------------------------------- mesh helpers

def smooth01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ribbon(kit, pts, half_widths, thick, width_axis=(1, 0, 0)):
    """A flat cloth strip swept along `pts` (hexagonal flattened section so the smooth shading rounds the edges)."""
    pts = [V(p) for p in pts]
    w_axis = V(width_axis)
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        w = (w_axis - t * w_axis.dot(t)).normalized()
        n = t.cross(w).normalized()
        hw = half_widths[i] if isinstance(half_widths, (list, tuple)) else half_widths
        section = [(-hw, 0.0), (-hw * 0.55, thick), (hw * 0.55, thick), (hw, 0.0), (hw * 0.55, -thick), (-hw * 0.55, -thick)]
        rings.append([kit.bm.verts.new(p + w * a + n * b) for a, b in section])
    k = len(rings[0])
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(k):
            j = (i + 1) % k
            kit.bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        c = kit.bm.verts.new(sum((v.co for v in ring), V()) / k)
        for i in range(k):
            j = (i + 1) % k
            kit.bm.faces.new((ring[j], ring[i], c) if flip else (ring[i], ring[j], c))
    kit._fix_normals()


def shell(kit, levels, sides=20, pleat=0.0, pleat_n=10, open_ends=True, front_weight=True):
    """Elliptical skirt shell through (z, rx, ry) levels, with pleat ridges over the front half."""
    rings = []
    for z, rx, ry in levels:
        ring = []
        for i in range(sides):
            a = 2 * math.pi * i / sides
            front = max(0.0, -math.sin(a)) if front_weight else 1.0
            m = 1.0 + pleat * front * math.cos(pleat_n * a)
            ring.append(kit.bm.verts.new((math.cos(a) * rx * m, math.sin(a) * ry * m, z)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(sides):
            j = (i + 1) % sides
            kit.bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    kit._fix_normals()


def skirt_weights(co):
    """The sari follows the legs: waist band on the hips, then left/right halves on each thigh and shin (<= 4 bones)."""
    z = co.z
    a = smooth01((33.5 - z) / 8.0)
    hw = 2.8 + 2.4 * smooth01((24.0 - z) / 12.0)   # the lower the hem, the wider the cloth between the legs shears
    left = smooth01((co.x + hw) / (2 * hw))
    out = {}
    if a < 1.0:
        out["hips"] = 1.0 - a
    knee = limb_weights(13.5, 2.4, "T", "S")(co)
    for side, share in (("L", left), ("R", 1.0 - left)):
        for key, bone in (("T", f"thigh.{side}"), ("S", f"shin.{side}")):
            w = a * share * knee.get(key, 0.0)
            if w > 1e-4:
                out[bone] = out.get(bone, 0.0) + w
    return out


def pleat_stripes(kit, verts, n=10):
    """Pleat valleys in the deeper rose, painted on the skirt vertices (front half only)."""
    light = lib.hex_to_linear(ROSE)
    deep = lib.hex_to_linear(ROSE_DEEP)
    for v in verts:
        a = math.atan2(v.co.y, v.co.x)
        front = max(0.0, -math.sin(a))
        t = front * smooth01((-math.cos(n * a) + 0.15) / 0.85)
        v[kit.col] = tuple(light[i] + (deep[i] - light[i]) * t for i in range(3)) + (1.0,)


def hair_radius(u, centre, radii):
    """Distance from the head centre to the hair ellipsoid along unit direction u (0 if the ray misses)."""
    c = V(centre)
    r = V(radii)
    d = V((u.x / r.x, u.y / r.y, u.z / r.z))
    o = V((-c.x / r.x, -c.y / r.y, -c.z / r.z))
    a = d.dot(d)
    b = 2 * d.dot(o)
    k = o.dot(o) - 1.0
    disc = b * b - 4 * a * k
    return 0.0 if disc < 0 else (-b + math.sqrt(disc)) / (2 * a)


HAIR_C = (0.0, 2.0, 2.4)       # relative to the head centre
HAIR_R = (7.5, 7.8, 6.3)
SKIRT_SIDES = 20
GARLAND_BEADS = 18


# ---------------------------------------------------------------- mesh

TORSO = [(33.5, 4.2), (36.5, 4.35), (41, 4.8), (45, 5.0), (49, 4.5), (51.6, 3.3)]


def torso_radius(z):
    for (z0, r0), (z1, r1) in zip(TORSO, TORSO[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return TORSO[0][1] if z < TORSO[0][0] else TORSO[-1][1]


def on_torso(x, z, out, back=False):
    r = torso_radius(z)
    x = max(-0.92 * r, min(0.92 * r, x))
    y = (0.84 if back else -0.84) * r * math.sqrt(1 - (x / r) ** 2)
    return V((x, y, z)) + V((x / r, (-1.0 if not back else 1.0) * 0.9, 0)).normalized() * out


def build_mesh():
    kit = ClayKit("Sita")
    torso_w = lambda co: smooth_weights([30, 36, 44], ["hips", "spine", "chest"])(co.z)
    braid_w = lambda co: smooth_weights([-57, -48, -41.5, -34], ["head", "chest", "braid.01", "braid.02"])(-co.z)

    # ---- blouse (saffron, covers the torso: modest), gold piping
    kit.lathe(TORSO, sides=10, squash=(1.0, 0.84))
    kit.paint("spine", SAFFRON, torso_w)
    kit.lathe([(33.3, 4.3), (34.2, 4.5), (35.4, 4.3)], sides=10, squash=(1.0, 0.84), cap=False)
    kit.paint("spine", GOLD, torso_w)
    kit.lathe([(50.4, 3.7), (51.2, 3.95), (51.9, 3.3)], sides=10, squash=(1.0, 0.86), cap=False)
    kit.paint("chest", GOLD)

    # ---- sari: wrap at the waist, the skirt down to the ankles (leg-skinned), pleats in front, gold border
    kit.lathe([(38.0, 4.5), (36.4, 5.05), (34.0, 5.5)], sides=10, squash=(1.0, 0.86), cap=False)
    kit.paint("spine", ROSE, torso_w)
    skirt = [(35.0, 5.5, 4.6), (27.0, 7.3, 5.5), (19.0, 8.0, 5.8), (14.0, 8.2, 5.9), (10.0, 8.4, 6.0), (6.6, 8.7, 6.15)]
    shell(kit, skirt, sides=SKIRT_SIDES, pleat=0.06, pleat_n=10)
    skirt_verts, _ = kit._new_geometry()
    kit.paint("hips", ROSE, skirt_weights)
    pleat_stripes(kit, skirt_verts)
    for k in range(5):                                   # the pleats of the front panel: five ridges in the deep rose
        a = math.radians(-90 + (k - 2) * 12.0)
        ridge = [V((math.cos(a) * rx * 1.045, math.sin(a) * ry * 1.045, z)) for z, rx, ry in skirt[1:5]]
        kit.tube(ridge, [0.5, 0.55, 0.6, 0.6], sides=3, round_caps=False)
        kit.paint("hips", ROSE_DEEP, skirt_weights)
    border = [(10.6, 8.95, 6.4), (8.6, 9.08, 6.45), (6.5, 9.2, 6.55)]
    shell(kit, border, sides=SKIRT_SIDES, front_weight=False)
    kit.paint("hips", GOLD, skirt_weights)
    kit.lathe([(35.6, 5.45), (36.4, 5.65), (37.4, 5.2)], sides=10, squash=(1.0, 0.86), cap=False)
    kit.paint("spine", GOLD, torso_w)

    # ---- pallu: strap over the left shoulder (rigid on the chest), then down her back, swinging on cloth.01/.02
    strap = [V((3.2, 4.7, 49.5)), V((4.6, 3.4, 52.0)), V((5.5, 0.6, 53.0)), V((5.5, -3.0, 50.6)), V((4.6, -5.1, 44.5))]
    ribbon(kit, strap, [2.1, 2.2, 2.2, 2.1, 1.9], 0.55)
    kit.paint("chest", ROSE)
    back_y = {49.5: 4.9, 41.0: 5.05, 33.0: 5.45, 25.0: 6.5, 17.5: 6.9}
    panel = [V((2.6, y, z)) for z, y in back_y.items()]
    ribbon(kit, panel, [2.9, 3.0, 3.2, 3.4, 3.5], 0.6)
    kit.paint("cloth.01", ROSE, lambda co: smooth_weights([-49, -41, -29], ["chest", "cloth.01", "cloth.02"])(-co.z))
    ribbon(kit, [V((2.6, 6.85, 21.2)), V((2.6, 6.9, 19.0))], [3.55, 3.58], 0.72)
    kit.paint("cloth.02", GOLD)
    ribbon(kit, [V((2.6, 6.7, 24.8)), V((2.6, 6.73, 23.6))], [3.4, 3.42], 0.68)
    kit.paint("cloth.02", ROSE_DEEP)
    for dx in (0.2, 2.6, 5.0):
        kit.sphere((dx, 6.95, 16.6), (0.6, 0.6, 1.0), u=5, v=3)
        kit.paint("cloth.02", GOLD)

    # ---- neck, head, cheeks, chin, nose
    kit.lathe([(49.5, 2.6), (53, 2.5), (56.5, 2.35)], sides=7)
    kit.paint("neck", SKIN)
    kit.sphere(HC, HEAD_R, u=12, v=8)
    kit.paint("head", SKIN)
    surfaces = [(HC, (HEAD_R, HEAD_R, HEAD_R))]
    kit.sphere((0, -7.45, 59.7), (0.85, 0.85, 1.0), u=6, v=4)           # nose
    kit.paint("head", SKIN)
    kit.ring((1.05, -8.05, 59.0), (1, 0.2, 0), 0.62, 0.17, sides=4, segs=3)   # nose ring
    kit.paint("head", GOLD)
    face = common.face_material()
    common.face_patch(kit, surfaces, (-6.2, 6.2), (55.2, 67.4), nx=9, nz=10)
    kit.bind("head", face)
    for sx in (-1, 1):
        kit.ellipsoid((sx * 7.0, 1.0, 61.0), (0.9, 1.7, 2.2), None, u=6, v=4)   # ears
        kit.paint("head", SKIN)
        kit.sphere((sx * 7.35, 0.8, 58.1), 0.62, u=5, v=3)                      # earring stud
        kit.paint("head", GOLD)
        kit.sphere((sx * 7.35, 0.8, 56.6), (0.5, 0.5, 0.8), u=5, v=4)           # drop
        kit.paint("head", ROSE)

    # ---- hair: two lobes meet in a centre parting, a small mass behind, the braid starts at the nape
    for sx in (-1, 1):
        kit.ellipsoid((sx * 1.25, HC[1] + HAIR_C[1], HC[2] + HAIR_C[2]), (HAIR_R[0] - 0.4, HAIR_R[1], HAIR_R[2]),
                      None, u=9, v=6)
        kit.paint("head", HAIR)
    kit.ellipsoid((0.4, 4.0, 57.8), (4.4, 3.4, 4.6), None, u=8, v=5)
    kit.paint("head", HAIR)

    # ---- tiara: thin gold band along the hairline, a crest of three leaves and a rose jewel
    pts = []
    for k in range(-4, 5):
        psi = math.radians(k * 17.0)
        elev = math.radians(50.0 - 26.0 * (abs(k) / 4.0) ** 2)
        u = V((math.sin(psi) * math.cos(elev), -math.cos(psi) * math.cos(elev), math.sin(elev))).normalized()
        r = max(HEAD_R, hair_radius(u, HAIR_C, HAIR_R)) + 0.22
        pts.append(V(HC) + u * r)
    kit.tube(pts, 0.5, sides=4)
    kit.paint("head", GOLD)
    top = pts[4]
    for dx, tilt, h in ((-4.0, 52, 1.9), (4.0, -52, 1.9), (-2.1, 27, 2.6), (2.1, -27, 2.6), (0.0, 0, 3.4)):
        base = V((dx, top.y + 0.1 + abs(dx) * 0.04, top.z + 0.15 - abs(dx) * 0.25))
        q = Quaternion((0, 1, 0), math.radians(tilt))
        kit.ellipsoid(base + q @ V((0, 0, h * 0.8)), (0.7, 0.45, h), q, u=6, v=4)
        kit.paint("head", GOLD)
    kit.sphere(top + V((0, -0.55, 0.3)), (1.0, 0.6, 1.05), u=6, v=4)
    kit.paint("head", ROSE)
    kit.sphere(top + V((0, 0.0, 6.9)), 0.7, u=5, v=4)
    kit.paint("head", ROSE)

    # ---- braid: over the left shoulder, down her chest; gold ties, jasmine
    path = [V((2.4, 5.2, 60.0)), V((4.6, 4.6, 56.0)), V((6.2, 2.6, 53.8)), V((6.6, 0.0, 53.6)),
            V((6.3, -2.8, 51.4)), V((5.4, -4.6, 48.0)), V(SITA_BONES["braid.01"][1]),
            V((4.6, -5.6, 41.0)), V(SITA_BONES["braid.02"][1]), V((4.5, -5.5, 35.0)), V((4.4, -5.3, 31.9))]
    pts = catmull_chain(path[:7], per=1)[:-1] + catmull_chain(path[6:], per=2)
    rad = []
    for p in pts:
        base = 1.55 if p.z > 47 else 1.5 - 0.45 * smooth01((46 - p.z) / 14.0)
        bump = 0.0 if p.z > 46 else 0.22 * math.cos((46 - p.z) * 2 * math.pi / 2.6)
        rad.append(base + bump)
    kit.tube(pts, rad, sides=5)
    kit.paint("braid.01", HAIR, braid_w)
    kit.ring(path[1], path[2] - path[0], 1.75, 0.42, sides=4, segs=3)       # gold tie where the braid leaves the hair
    kit.paint("head", GOLD)
    kit.ellipsoid((3.2, 7.4, 60.6), (2.2, 0.7, 1.5), Quaternion((0, 0, 1), math.radians(20)), u=6, v=4)   # hair slide (seen from behind)
    kit.paint("head", GOLD)
    kit.sphere((3.2, 8.0, 60.6), (0.8, 0.5, 0.8), u=5, v=3)
    kit.paint("head", ROSE)
    for z in (45.6, 40.0, 34.8):
        j = min(pts, key=lambda p: abs(p.z - z))
        kit.sphere(j, 1.0, u=5, v=3)
        kit.paint("braid.01", PARCH, braid_w)
    tie = pts[-3]
    kit.lathe([(tie.z - 0.5, 1.45), (tie.z, 1.7), (tie.z + 0.5, 1.45)], origin=(tie.x, tie.y, 0), sides=6, cap=False)
    kit.paint("braid.02", GOLD)
    kit.sphere(pts[-1] + V((0, 0, -1.2)), (1.0, 1.0, 2.2), u=6, v=4)       # hair tuft below the tie
    kit.paint("braid.02", HAIR)
    kit.sphere(pts[-1] + V((0, 0, -3.4)), (0.7, 0.7, 0.9), u=5, v=3)
    kit.paint("braid.02", ROSE)
    mid = pts[len(pts) // 2 + 2]
    kit.lathe([(mid.z - 0.45, 1.65), (mid.z, 1.85), (mid.z + 0.45, 1.65)], origin=(mid.x, mid.y, 0), sides=6, cap=False)
    kit.paint("braid.01", GOLD, braid_w)
    for (x, y, z) in ((-2.8, -5.7, 66.2), (3.6, -6.0, 66.2), (4.6, 3.2, 62.6), (-5.4, -3.6, 64.8)):
        kit.sphere((x, y, z), 0.7, u=5, v=3)       # jasmine in the hair
        kit.paint("head", PARCH)

    # ---- marigold garland over the shoulders: ~0.6 u loop of saffron beads hung on the chest
    loop = []
    for k in range(GARLAND_BEADS):
        s = 2 * math.pi * k / GARLAND_BEADS
        x = 3.8 * math.sin(s)
        front = math.cos(s)                       # +1 at the front
        z = 51.4 - (6.2 * front ** 2 if front > 0 else 2.6 * front ** 2)
        back = front < 0
        r = torso_radius(z)
        y = (1.0 if back else -1.0) * (0.84 * r * math.sqrt(max(0.05, 1 - (x / (r + 1.3)) ** 2)) + 1.2)
        loop.append(V((x, y, z)))
    length = sum((loop[i] - loop[i - 1]).length for i in range(len(loop)))
    GARLAND["length_u"] = length * SCALE
    for k, p in enumerate(loop):
        kit.sphere(p, 1.55, u=5, v=3)
        kit.paint("chest", MARIGOLD if k % 2 == 0 else GOLD)

    # ---- arms: skin tube, short saffron sleeve with gold hem, armlet, four bangles, hand
    for side, sx in (("L", 1), ("R", -1)):
        ua, fa = f"upperArm.{side}", f"foreArm.{side}"
        kit.sphere((sx * 6.2, 0, 49.0), 2.6, u=6, v=4)
        kit.paint(f"shoulder.{side}", SAFFRON)
        pts = [V((sx * 6.2, 0, 48.6)), V((sx * 6.6, 0, 43.0)), V((sx * 7.0, 0, 37.5)), V((sx * 7.4, 0, 31.8))]
        kit.tube(pts, [2.5, 2.3, 2.0, 1.75], sides=6)
        kit.paint(ua, SKIN, limb_weights(40.0, 2.4, ua, fa))
        kit.lathe([(48.8, 2.9), (46.5, 2.95), (44.0, 2.85)], origin=(sx * 6.45, 0, 0), sides=7, cap=False)
        kit.paint(ua, SAFFRON)
        kit.lathe([(43.5, 2.9), (43.9, 3.0), (44.5, 2.9)], origin=(sx * 6.55, 0, 0), sides=7, cap=False)
        kit.paint(ua, GOLD)
        kit.lathe([(38.2, 2.3), (38.7, 2.4), (39.5, 2.3)], origin=(sx * 6.95, 0, 0), sides=6, cap=False)
        kit.paint(ua, GOLD, limb_weights(40.0, 2.4, ua, fa))
        for zz, col in ((33.6, GOLD), (32.8, ROSE), (32.0, GOLD), (31.2, ROSE)):
            kit.lathe([(zz - 0.38, 1.9), (zz, 2.05), (zz + 0.38, 1.9)], origin=(sx * 7.3, 0, 0), sides=6, cap=False)
            kit.paint(fa, col)
        kit.ellipsoid((sx * 7.6, 0, 29.4), (2.1, 1.9, 2.7), None, u=7, v=5)
        kit.paint(f"hand.{side}", SKIN)
        if side == "L":
            kit.sphere((6.1, -1.9, 30.3), 0.95, u=5, v=3)                    # thumb
            kit.paint("hand.L", SKIN)
        else:
            for dz in (-1.0, 0.0, 1.0):                                      # fingers wrapped round the stem
                kit.sphere((-7.6, -2.2, 29.0 - dz * 1.3), 0.9, u=5, v=3)
                kit.paint("hand.R", SKIN)

    # ---- lotus (prop.R): leaf-green stem through the fist, bloom of rose petals, gold seed pod, a leaf
    gx, gy, gz = GRIP
    kit.capsule((gx, gy, gz - 4.8), (gx, gy, gz + LOTUS_BASE), 0.55, 0.5, sides=4)
    kit.paint("prop.R", LEAF)
    cz = gz + LOTUS_BASE
    kit.ellipsoid((gx + 1.9, gy, gz + 5.4), (2.6, 0.5, 1.0), Quaternion((0, 1, 0), math.radians(-28)), u=6, v=3)
    kit.paint("prop.R", LEAF)
    for ring_k, (count, tilt, length, width, colour) in enumerate(((6, 64, 4.0, 1.7, ROSE), (5, 38, 3.5, 1.45, ROSE_LIGHT))):
        for k in range(count):
            az = 2 * math.pi * (k + 0.5 * (ring_k % 2)) / count
            t = math.radians(tilt)
            d = V((math.sin(t) * math.cos(az), math.sin(t) * math.sin(az), math.cos(t)))
            q = Quaternion((0, 0, 1), az) @ Quaternion((0, 1, 0), t)
            c = V((gx, gy, cz)) + d * (length * 0.85)
            kit.ellipsoid(c, (0.55, width, length), q, u=6, v=3)
            kit.paint("prop.R", colour)
    kit.sphere((gx, gy, cz + 1.0), (1.1, 1.1, 0.9), u=6, v=4)
    kit.paint("prop.R", GOLD)

    # ---- legs and feet: slender skin tubes (the hem hides all but the ankles), gold anklets with a bell, bare feet
    for side, sx in (("L", 1), ("R", -1)):
        th, sn, ft, toe = f"thigh.{side}", f"shin.{side}", f"foot.{side}", f"toe.{side}"
        pts = [V((sx * 3, 0, 25.0)), V((sx * 3, 0, 13.5)), V((sx * 3, 0, 8.0)), V((sx * 3, 0, 4.0))]
        kit.tube(pts, [3.0, 2.5, 2.0, 1.75], sides=6, round_caps=False)
        kit.paint(th, SKIN, limb_weights(13.5, 2.4, th, sn))
        for dz in (0.0, 1.0):
            kit.lathe([(4.6 + dz - 0.4, 2.05), (4.6 + dz, 2.2), (4.6 + dz + 0.4, 2.05)], origin=(sx * 3, 0, 0), sides=6, cap=False)
            kit.paint(sn, GOLD)
        kit.sphere((sx * 3, -2.35, 4.2), 0.62, u=5, v=3)
        kit.paint(sn, GOLD)
        kit.sphere((sx * 3, -2.1, 2.1), (2.6, 4.9, 2.1), u=6, v=4)
        kit.paint(ft, SKIN, lambda co, ft=ft, toe=toe: _foot_w(co, ft, toe))
        kit.sphere((sx * 3, -7.0, 1.15), (2.1, 1.2, 0.9), u=5, v=3)         # toes
        kit.paint(toe, SKIN)
    return kit


GARLAND = {}


def _foot_w(co, foot, toe):
    t = smooth((-co.y - 3.2) / 2.2)
    return {foot: 1 - t, toe: t} if 0 < t < 1 else ({foot: 1.0} if t == 0 else {toe: 1.0})


# ---------------------------------------------------------------- gait tables (R1-R3: dignified)
# Rows as in motion._WALK_HALF: (hipL, kneeL, ankL, hipR, kneeR, ankR, shL, shR, elL, elR, lean); only the left arm
# is read (the right arm carries the lotus), so shR/elR are inert.
def _soft_walk():
    out = []
    for r in motion._WALK_HALF:
        out.append((r[0], r[1], r[2], r[3], r[4], r[5], r[6] * 0.55, r[7] * 0.55, 6 + 0.4 * r[8], r[9], 3))
    return out


SITA_RUN_HALF = [
    #  hipL kneeL ankL hipR kneeR ankR  shL  shR elL elR lean
    (+34, 14, +5, -26, 52, -10, -14, +14, 34, 34, 6),     # contact
    (+10, 26, -5, +12, 58, -18, -7, +7, 36, 36, 6),       # down
    (-28, 22, -22, +38, 50, 0, +14, -14, 40, 40, 7),      # air
]
motion._WALK_T, motion._WALK_ROWS = motion._table(_soft_walk(), [0, 3, 6, 9], motion.WALK_FRAMES)
motion._RUN_T, motion._RUN_ROWS = motion._table(SITA_RUN_HALF, [0, 3, 6], motion.RUN_FRAMES)

# the leap is a bound (R3): no tuck, no spin, arms low; knees never past 40.
#  f:   hipL kneeL ankL hipR kneeR ankR lean shL elL shR  elR mace head
motion._LEAP_KEYS = {
    0:  (0, 0, 0, 0, 0, 0, 0, 3, 10, 3, 10, 0, 0),
    4:  (24, 34, 6, 24, 34, 6, 5, -8, 16, -8, 16, 0, 2),           # anticipation: a gathered dip
    6:  (-6, 4, -30, -6, 4, -30, 5, 12, 14, 12, 14, 0, -2),        # takeoff: rise on the toes
    11: (36, 34, -8, -26, 20, -30, 6, 20, 12, 20, 12, 0, -3),      # bound: one leg forward, the other trailing
    16: (30, 26, -4, -16, 18, -22, 6, 16, 12, 16, 12, 0, -2),
    18: (22, 30, 8, 20, 28, 6, 6, 8, 16, 8, 16, 0, 1),             # land: soft knees
    22: (4, 6, 0, 4, 6, 0, 1, 4, 10, 4, 10, 0, 0),
}


# ---------------------------------------------------------------- style: lotus in the right hand, braid and pallu sway

def hold_lotus(pose, wrist=CARRY_WRIST, tilt=CARRY_TILT, bob=V(), pole=CARRY_POLE):
    """Right hand to a chest-attached point, lotus tilted in the chest frame (follows every lean)."""
    kin = motion.SKEL.kin(pose)
    reach(pose, "R", kin.point("chest", wrist) + bob, pole)
    kin = motion.SKEL.kin(pose)
    pose.world["prop.R"] = kin.D["chest"] @ tilt


def sway_hair(pose, ph, amp, lag=0.8, lean_forward=3.0):
    """Braid swings forward and sideways (never into the chest: rot_x <= 0 keeps it off her), pallu ripples."""
    for i, b in enumerate(BRAID_BONES):
        a = ph - i * lag
        pose.add_rel(b, rot_x(-lean_forward - amp * (1.0 + 0.6 * i) * (0.5 + 0.5 * math.sin(a))))
        pose.add_rel(b, rot_y(amp * 0.9 * math.sin(a - 0.7)))
    for i, b in enumerate(PALLU_BONES):
        a = ph - 0.9 - i * 0.9
        pose.add_rel(b, rot_y(0.8 * amp * math.sin(a)))
        pose.add_rel(b, rot_x(0.5 * amp * math.sin(a - 0.6)))


class SitaStyle(Style):
    def arms(self, pose, kind, p, ph):
        if kind in ("idle", "walk", "run"):
            set_arm(pose, "L", p["shL"], p["elL"])
            bob = V((0, 0, 0.45 * math.sin(2 * ph))) if kind != "idle" else V((0, 0, 0.25 * math.sin(ph)))
            hold_lotus(pose, bob=bob)
        else:                                   # leap: free arm angle keyed, lotus carried low and steady
            set_arm(pose, "L", p["shL"], p["elL"], abduct=6)
            hold_lotus(pose, bob=V((0, 0, 0.6)))

    def tail(self, pose, kind, p, ph):
        if kind == "idle":
            sway_hair(pose, ph, 1.6)
        elif kind == "walk":
            sway_hair(pose, 2 * ph, 3.2, lean_forward=2.0)
        elif kind == "run":
            sway_hair(pose, 2 * ph, 5.0, lean_forward=3.0)
        else:
            sway_hair(pose, ph, 3.0, lean_forward=4.0)


STYLE = SitaStyle()


# ---------------------------------------------------------------- emotion poses (T44 4.5, R1-R3)

def _stand():
    pose = HPose()
    set_legs(pose, 0, 0, 0, 0, 0, 0)
    return pose


def happy_pose(f):
    """Raises the lotus to her chest, smiling: the bloom comes up beside her cheek; she sways a little, upright."""
    pose = _stand()
    pose.rot("head", rot_y(5))
    pose.rot("head", rot_x(-3))
    pose.rot("spine", rot_x(-1.5))
    kin = motion.SKEL.kin(pose)
    reach(pose, "L", kin.point("chest", V((2.0, -7.0, 38.5))), V((1.0, 0.3, -0.5)))
    hold_lotus(pose, wrist=V((-6.2, -7.8, 39.5)), tilt=rot_y(-27) @ rot_x(-2), pole=V((-0.6, 0.2, -1.0)))
    sway = 2 * math.pi * f / 36
    pose.rot("chest", rot_z(1.5 * math.sin(sway)))
    pose.hop = 0.35 * abs(math.sin(sway * 2))
    sway_hair(pose, sway * 2, 2.5)
    return pose


def excited_pose(f):
    """Raised-hand blessing (abhaya) with the left hand and a small, light bound; the lotus stays in the right hand."""
    pose = _stand()
    bound = math.sin(math.pi * ((f - 8) / 12.0)) if 8 <= f <= 20 else 0.0
    bound2 = 0.5 * math.sin(math.pi * ((f - 24) / 10.0)) if 24 <= f <= 34 else 0.0
    air = max(bound, bound2)
    knee = 5 + 7 * (1 - air)
    set_legs(pose, knee * 0.4, knee, -10 * air, knee * 0.4, knee, -10 * air)
    pose.hop = 2.4 * air
    pose.rot("head", rot_x(-3))
    pose.rot("head", rot_z(2.0 * math.sin(f * 0.35)))
    pose.rot("spine", rot_x(-1.0))
    kin = motion.SKEL.kin(pose)
    reach(pose, "L", kin.point("chest", V((13.2, -8.0, 55.5))), V((0.4, 0.4, -1.0)))
    hold_lotus(pose, wrist=V((-6.6, -8.2, 37.0)), bob=V((0, 0, 0.7 * air)))
    sway_hair(pose, f * 0.5, 3.0)
    return pose


def scared_pose(f):
    """Concern: a step back, the left hand to her chest; upright, composed (R2: no cowering)."""
    pose = _stand()
    pose.shift["root"] = V((0, 3.2, 0))
    set_legs(pose, -9, 8, 0, 7, 22, 0)
    pose.rot("chest", rot_x(-2.5))
    pose.rot("head", rot_x(-2))
    pose.rot("head", rot_z(2.5 * math.sin(f * 0.5) if f >= 10 else 0.0))
    kin = motion.SKEL.kin(pose)
    reach(pose, "L", kin.point("chest", V((1.8, -6.6, 42.5))), V((1.0, 0.2, -0.7)))
    hold_lotus(pose, wrist=V((-6.8, -7.0, 34.0)), tilt=rot_y(-22))
    sway_hair(pose, f * 0.6, 1.8)
    return pose


def sad_pose(f):
    """A slow sigh: head dips 6 degrees, the lotus lowered, shoulders soft; she never slumps (R1)."""
    pose = _stand()
    sigh = math.sin(2 * math.pi * f / 36)
    pose.rot("spine", rot_x(2.0))
    pose.rot("head", rot_x(6.0))
    pose.rot("shoulder.L", rot_y(4))
    pose.rot("shoulder.R", rot_y(-4))
    pose.rot("chest", rot_x(-1.2 * sigh))
    set_arm(pose, "L", 2, 10)
    hold_lotus(pose, wrist=V((-6.8, -6.2, 30.5)), tilt=rot_y(-14), pole=V((-0.5, 0.3, -1.0)))
    sway_hair(pose, f * 0.35, 1.0, lean_forward=2.0)
    return pose


# ---------------------------------------------------------------- cheer: she claps, lotus in hand (Win screen)

def cheer_pose(f):
    pose = _stand()
    c = 0.5 - 0.5 * math.cos(2 * math.pi * f / 15.0)      # 0 hands apart, 1 hands meet; four claps in 2.5 s
    turn = 2 * math.pi * f / 60.0
    knee = 4 + 3 * math.sin(2 * math.pi * f / 15.0 + 1.0)
    set_legs(pose, knee * 0.4, knee, 0, knee * 0.4, knee, 0)
    pose.hop = 0.45 * (1 - math.cos(2 * math.pi * f / 15.0)) / 2
    pose.rot("head", rot_x(-4))
    pose.rot("head", rot_z(3.0 * math.sin(turn * 2)))
    pose.rot("chest", rot_z(2.0 * math.sin(turn * 2)))
    kin = motion.SKEL.kin(pose)
    apart = V((5.4, -6.6, 40.5))
    meet = V((-2.6, -8.6, 38.4))
    reach(pose, "L", kin.point("chest", apart.lerp(meet, c)), V((1.0, 0.3, -0.6)))
    hold_lotus(pose, wrist=V((-4.8, -8.6, 37.8)), tilt=rot_y(-34) @ rot_x(-3), pole=V((-0.6, 0.3, -1.0)))
    sway_hair(pose, turn * 4, 3.0)
    return pose


# ---------------------------------------------------------------- main

CLIPS = ("idle", "walk", "run", "leap", "happy", "excited", "scared", "sad", "cheer")


def emotion_clip(builder, frames, rise):
    idle0 = motion.idle_pose(STYLE, 0)
    return motion.clip_from_blend(idle0, builder, frames, rise)


def cheer_clip():
    poses = [motion.finish(cheer_pose(f)) for f in range(60)]
    motion.solve_ground(poses)
    return motion.loop_close(poses)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "sita.glb"
    metrics_path = argv[argv.index("--metrics") + 1] if "--metrics" in argv else None
    t0 = time.time()
    lib.reset_scene()
    kit = build_mesh()
    obj = kit.build_object()
    common.bake_ao_and_jitter(obj)
    arm = rig.build_armature(scale=SCALE, bones=SITA_BONES)
    rig.skin(obj, arm)

    clips = {"idle": motion.clip_idle(STYLE)}
    clips["walk"], walk_drift = motion.clip_walk(STYLE)
    clips["run"], run_drift = motion.clip_run(STYLE)
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
        report[name]["max_root_y_shift"] = round(max(abs(p.shift.get("root", V()).y) for p in poses), 2)
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
    arm["garland_loop_u"] = GARLAND.get("length_u", 0.0)
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
        "garland_loop_u": round(arm["garland_loop_u"], 3),
        "walk_drift_du": round(walk_drift, 4),
        "run_drift_du": round(run_drift, 4),
        "fk_error_du": round(fk_err, 4),
        "build_s": round(t1 - t0, 2),
        "glb_bytes": os.path.getsize(out),
    }
    print("TOP " + json.dumps(sorted(kit.tri_log, reverse=True)[:40]))
    print("METRICS " + json.dumps(metrics))
    print("REPORT " + json.dumps(report))
    if metrics_path:
        with open(metrics_path, "w") as fh:
            json.dump({"metrics": metrics, "report": report}, fh, indent=1)


main()
