"""The 13 coiled clay snakes of the diorama (T44 5.2-5.4), one skinned GLB each, plus snakesManifest.json.

Run:  node scripts/blender/run.mjs scripts/blender/snakes.py public/models/snakes src/app/board3d/snakesManifest.json [id ...]

Design units (du): 56 du = 1 board block (u).  Blender axes: +Z up, the snake faces -Y (the viewer after the glTF
export), +X right.  The coil centre is the origin; the game anchors it 0.25 u behind the head block's centre.

Mesh: ONE skinned mesh, one vertex-colour clay material (1 draw call).  Rig (11 bones, spec 9 + `bulge` + `root`
absent): coil (root, static coil, props), neck.01-05, head, jaw, tongue, bulge.  The swallow bulge is a lump in the
same mesh on its own bone, scale 0 at rest, so it costs no extra draw call.
Clips (24 fps): rise 9 f, idle 72 f loop, hold 4 f, strike 4 f, swallow 8 f, settle 5 f (5.4; `hold` is the head
turning to face the token).  Every clip is played at runtime stretched to the spec's milliseconds.
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "heroes"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import anim  # noqa: E402
import common  # noqa: E402
import export  # noqa: E402
import lib  # noqa: E402
import rig  # noqa: E402
from common import ClayKit, catmull_chain, chain_weights  # noqa: E402

def V(*a):
    return Vector(a[0]) if len(a) == 1 else Vector(a)


SCALE = 1.0 / 56.0
FPS = 24
CELL_HALF = 28.0                     # half a block pitch in du
ANCHOR_BACK = 14.0                   # the coil centre sits 0.25 u behind the block centre

INK = "#2A1A0F"
GOLD = "#E9C12F"
SAFFRON = "#F39C2B"
BLOOD = "#8E3B3B"
PARCH = "#F3E3B8"
WOOD = "#7A5A3A"
EYE = "#1B1B2A"
MOUTH = "#3A1620"
DORSAL = V((0.0, -0.45, 0.9)).normalized()      # the side the camera sees: patterns are centred on it


# ---------------------------------------------------------------- the 13 snakes (5.1-5.3)
def S(id_, R, body, pattern, pitch, **kw):
    spec = dict(id=id_, R=R, body=body, pattern=pattern, pitch=pitch, accent=None, head="plain", motifs=[], props=[],
                base=(-3.2, 2.4), face_yaw=0.0, anchor_back=ANCHOR_BACK, strike=None)
    spec.update(kw)
    return spec


SPECS = [
    S("tataka", 2.6, "#457334", "bands", 6, head="plain", motifs=["hair"], props=["stump"]),
    S("manthara", 2.2, "#1C1F4D", "diamonds", 7, accent=GOLD, motifs=["shawl"], props=["scroll"]),
    S("kaikeyi", 2.6, "#7B3B6E", "spots", 5, motifs=["bangles"], props=["window"], base=(-8.0, 5.5), face_yaw=-57.0, strike=dict(lean_cap=10, push=1.5, dip=0.0, aim=0.0)),   # the wedding deck crosses 0.2 u in front of the coil: the head sits behind it and looks along it
    S("viradha", 2.8, "#A4703E", "bands_dots", 6, props=["club"]),
    S("shurpanakha", 2.6, "#8E3B3B", "bands", 6, motifs=["nosering"], props=["nails"]),
    S("golden-deer", 2.6, "#E9C12F", "spots", 5, accent=PARCH, motifs=["deer"]),
    S("abduction", 2.8, "#783431", "spots", 5, props=["wheel", "feathers"]),
    S("kabandha", 3.0, "#457334", "bands", 6, head="stout", motifs=["arms"]),
    S("indrajit-arrows", 2.6, "#3A3F9E", "braid", 8, motifs=["bowknot"], props=["arrows"], anchor_back=11.0),   # rama-setu's deck passes 0.38 u behind the coil: stand 0.055 u further forward
    S("prahasta", 2.8, "#C98B4B", "bands_gold", 5, accent=GOLD, motifs=["crest"], props=["shield"]),
    S("kumbhakarna", 3.4, "#A6723E", "bands", 8, motifs=["sleepy"], props=["drum"]),
    S("brahmastra", 2.2, "#F39C2B", "chevrons", 6, accent=GOLD, head="arrow"),
    S("ravana", 4.0, "#1C1F4D", "diamond_bands", 10, accent=GOLD, motifs=["crown"], props=["banner", "mace"]),
]


def geometry_of(R):
    """Coil outer radius and head top (du) by body radius (5.2 sizes table, x56)."""
    if R <= 2.3:
        return 10.0, 29.0
    if R <= 3.0:
        return 11.5, 33.0 + (R - 2.6) * 2.5
    if R <= 3.5:
        return 12.3, 36.0
    return 14.0, 41.1


# ---------------------------------------------------------------- small helpers
def hex_rgb(h):
    h = h.lstrip("#")
    return V(tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)))


def rgb_hex(v):
    return "#%02X%02X%02X" % tuple(max(0, min(255, int(round(c * 255)))) for c in v)


def mix(a, b, t):
    return rgb_hex(hex_rgb(a) * (1 - t) + hex_rgb(b) * t)


def shade(a, k):
    return rgb_hex(hex_rgb(a) * k)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def rot_x(d):
    return Quaternion((1, 0, 0), math.radians(d))


def rot_y(d):
    return Quaternion((0, 1, 0), math.radians(d))


def rot_z(d):
    return Quaternion((0, 0, 1), math.radians(d))


def set_colour(kit, v, hex_colour):
    r, g, b = lib.hex_to_linear(hex_colour)
    v[kit.col] = (r, g, b, 1.0)


def finish_part(kit, bone, weights=None, colour=None):
    """Bind the geometry made since the last part. colour=None keeps the per-vertex colours already set."""
    if colour is not None:
        kit.paint(bone, colour, weights)
    else:
        verts, faces = kit._new_geometry()
        kit.tri_log.append((sum(len(f.verts) - 2 for f in faces), bone, "painted"))
        kit.parts += 1
        kit.bind(bone, kit.clay, weights)


def ordered_weights(items):
    """Skin weights in vertex creation order (MeshKit.bind walks bm.verts in that order)."""
    it = iter(items)
    return lambda co: next(it)


def add_face(bm, verts):
    uniq = []
    for v in verts:
        if not uniq or uniq[-1] is not v:
            uniq.append(v)
    if len(uniq) > 1 and uniq[0] is uniq[-1]:
        uniq.pop()
    if len(uniq) >= 3 and len(set(uniq)) == len(uniq):
        try:
            bm.faces.new(uniq)
        except ValueError:
            pass


# ---------------------------------------------------------------- sweep with frames, colours and weights
def sweep(kit, pts, radii, colour_fn, sides, ring_weights=None, cap_end=True):
    """Tube along pts with per-point radius.  colour_fn(i, alpha, belly) -> hex.  Returns (rings, weights-in-vertex-order)."""
    n = len(pts)
    frames = []
    up = V((0, 0, 1))
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        nrm = up - t * up.dot(t)
        if nrm.length < 1e-4:
            nrm = V((1, 0, 0)) - t * t.x
        nrm.normalize()
        up = nrm
        frames.append((p, t, nrm, t.cross(nrm)))
    weights = []
    apex0 = kit.bm.verts.new(pts[0] - frames[0][1] * radii[0])
    set_colour(kit, apex0, colour_fn(0, 0.0, False))
    weights.append(ring_weights[0] if ring_weights else None)
    rings = []
    for i, ((p, t, nrm, b), r) in enumerate(zip(frames, radii)):
        dsal = DORSAL - t * DORSAL.dot(t)
        dsal = dsal.normalized() if dsal.length > 1e-4 else nrm
        dperp = t.cross(dsal)
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            w = nrm * math.cos(a) + b * math.sin(a)
            v = kit.bm.verts.new(p + w * r)
            alpha = math.atan2(w.dot(dperp), w.dot(dsal))
            set_colour(kit, v, colour_fn(i, alpha, w.z < -0.35))
            ring.append(v)
            weights.append(ring_weights[i] if ring_weights else None)
        rings.append(ring)
    apex1 = None
    if cap_end:
        apex1 = kit.bm.verts.new(pts[-1] + frames[-1][1] * radii[-1])
        set_colour(kit, apex1, colour_fn(n - 1, 0.0, False))
        weights.append(ring_weights[-1] if ring_weights else None)
    for k in range(n - 1):
        for j in range(sides):
            jj = (j + 1) % sides
            add_face(kit.bm, (rings[k][j], rings[k][jj], rings[k + 1][jj], rings[k + 1][j]))
    for j in range(sides):
        jj = (j + 1) % sides
        add_face(kit.bm, (rings[0][jj], rings[0][j], apex0))
        if apex1 is not None:
            add_face(kit.bm, (rings[-1][j], rings[-1][jj], apex1))
    kit._fix_normals()
    return rings, weights


# ---------------------------------------------------------------- body path
class Body:
    """Centre line of tail -> ground spiral -> climbing helix -> neck, with the facts the rest of the build needs."""

    def __init__(self, spec, head_top):
        R = spec["R"]
        self.R = R
        self.r_out = geometry_of(R)[0]
        self.r0 = self.r_out - R                       # centre-line radius at the ground start / top of the first turn
        self.r_in = self.r0 - 5.0                      # the ground spiral fills the centre (5.2: 0.09 u)
        self.phi_tail = 30.0                           # tail tip at the coil's front-right
        step = 18.0
        pts, rad = [], []

        def pos(phi, r, z):
            a = math.radians(phi)
            return V((r * math.sin(a), -r * math.cos(a), z))

        # ground spiral, one turn inwards
        n_ground = int(360 / step)
        for k in range(n_ground + 1):
            u = k / n_ground
            pts.append(pos(self.phi_tail + 360 * u, self.r0 + (self.r_in - self.r0) * u, R * 0.98))
        # climb: 2.5 turns, 2R per turn; outwards on the first turn, then tapering 2 du towards the top
        n_climb = int(900 / step)
        for k in range(1, n_climb + 1):
            ph = 900.0 * k / n_climb
            r = self.r_in + (self.r0 - self.r_in) * smooth(ph / 360) if ph < 360 else self.r0 - 2.0 * (ph - 360) / 540
            pts.append(pos(self.phi_tail + 360 + ph, r, R * 0.98 + ph / 360 * 2 * R))
        self.coil_count = len(pts)
        self.collar = pts[-1].copy()
        # tail taper 0.45 R -> R over 0.18 u = 10 du of arc
        arc = 0.0
        for i, p in enumerate(pts):
            if i:
                arc += (p - pts[i - 1]).length
            rad.append(R * (0.45 + 0.55 * smooth(arc / 10.0)))
        # the collar tangent (continues the helix), then the neck rises in an S to the head base
        tangent = (pts[-1] - pts[-2]).normalized()
        self.head_top = head_top
        self.neck_ctrl_extra = tangent
        self.pts, self.rad = pts, rad

    def neck_controls(self, base):
        """Control points of the neck from the collar to the head base `base` (S-curve: arches back, head leans forward)."""
        R = self.R
        c = self.collar
        t = self.neck_ctrl_extra
        p1 = c + t * (1.0 * R) + V((0, 0, 1.3 * R))
        ctrl = [c, p1]
        for k in (0.35, 0.65):
            h = p1.z + (base.z - p1.z) * k
            q = p1.lerp(base, smooth(k))
            q.y += 1.1 * R * math.sin(math.pi * k)
            q.z = h
            ctrl.append(q)
        ctrl.append(base)
        return ctrl


# ---------------------------------------------------------------- patterns
def body_colour(spec, s):
    """Returns colour_fn(i, alpha, belly) closure over arclength table s (du)."""
    R = spec["R"]
    body = spec["body"]
    accent = spec["accent"] or shade(body, 0.62)
    pitch = spec["pitch"] * R
    kind = spec["pattern"]
    blood_belly = mix(body, BLOOD, 0.4)

    def fn(i, alpha, belly):
        base = blood_belly if belly else body
        d = abs(alpha)
        m = s[min(i, len(s) - 1)] % pitch
        c = base
        if kind == "bands":
            if m < pitch * 0.38:
                c = shade(base, 0.62) if not spec["accent"] else accent
        elif kind == "bands_dots":
            if m < pitch * 0.38:
                c = shade(base, 0.66)
            if (s[min(i, len(s) - 1)] % (pitch * 0.5)) < pitch * 0.1 and d < 1.1:
                c = shade(base, 0.45)
        elif kind == "bands_gold":
            if m < pitch * 0.34:
                c = shade(base, 0.7)
            if abs(m - pitch * 0.34) < pitch * 0.07 or abs(m) < pitch * 0.05:
                c = accent
        elif kind in ("spots",):
            if d < 0.75 and 0.2 * pitch < m < 0.62 * pitch:
                c = accent if spec["accent"] else shade(base, 0.6)
        elif kind in ("diamonds", "diamond_bands"):
            q = abs(m - pitch / 2) / (pitch / 2)
            if d / 0.95 + q < 1.0:
                c = accent
            elif kind == "diamond_bands" and m < pitch * 0.12:
                c = shade(base, 0.55)
        elif kind == "braid":
            for off, phase in ((0.7, 0.0), (-0.7, 0.5)):
                q = abs(((m / pitch + phase) % 1.0) - 0.5) * 2
                if abs(alpha - off) / 0.8 + q < 1.0:
                    c = shade(base, 0.55) if phase == 0 else mix(base, "#9AA3FF", 0.45)
        elif kind == "chevrons":
            q = (m / pitch) % 1.0
            if abs(q - 0.5 + d * 0.22) < 0.1:
                c = accent
        return c

    return fn


# ---------------------------------------------------------------- the head
HEAD_PROFILES = {
    # (x in R, radius in R); apex at both ends
    "plain": [(-0.3, 0.0), (0.0, 0.85), (0.5, 1.28), (1.3, 1.52), (2.2, 1.55), (3.0, 1.38), (3.7, 1.0), (4.2, 0.55), (4.5, 0.0)],
    "stout": [(-0.3, 0.0), (0.0, 0.95), (0.5, 1.45), (1.2, 1.7), (2.0, 1.7), (2.6, 1.4), (3.1, 0.85), (3.4, 0.0)],
    "arrow": [(-0.3, 0.0), (0.0, 0.9), (0.6, 1.5), (1.4, 1.95), (2.3, 1.45), (3.4, 0.85), (4.6, 0.3), (5.2, 0.0)],
}
SEAM = 0.30        # the mouth line sits this far below the head's axis (fraction of the local radius)
SQUASH_V = {"plain": 0.9, "stout": 0.92, "arrow": 0.72}


class Head:
    """Head frame at the neck's top: B base centre, f forward (pitched down), u up, right = +X."""

    def __init__(self, base, R, kind, pitch_deg=12.0, yaw_deg=0.0):
        self.B, self.R, self.kind = base, R, kind
        p = math.radians(pitch_deg)
        yaw = Matrix.Rotation(math.radians(yaw_deg), 3, "Z")
        self.f = yaw @ V((0, -math.cos(p), -math.sin(p)))
        self.u = yaw @ V((0, -math.sin(p), math.cos(p)))
        self.r = yaw @ V((1, 0, 0))
        self.profile = HEAD_PROFILES[kind]
        self.squash = SQUASH_V[kind]

    def radius_at(self, x):
        pr = self.profile
        for (x0, r0), (x1, r1) in zip(pr, pr[1:]):
            if x0 <= x <= x1:
                t = (x - x0) / (x1 - x0)
                # ease like the lathe rings do
                return r0 + (r1 - r0) * t
        return 0.0

    def at(self, x, lat, up):
        """World point from head-local (x forward, lateral right, up) in du."""
        return self.B + self.f * x + self.r * lat + self.u * up

    def surf(self, x_R, theta_deg, out_R=0.0):
        """A point on the head surface: x (in R), angle from the top toward the right, pushed out by out_R."""
        R = self.R
        rr = self.radius_at(x_R) + out_R
        th = math.radians(theta_deg)
        return self.at(x_R * R, rr * R * math.sin(th), rr * R * math.cos(th) * self.squash)

    def mouth_point(self):
        R = self.R
        x = 3.2 if self.kind == "plain" else (2.6 if self.kind == "stout" else 3.8)
        return self.at(x * R, 0.0, -SEAM * self.radius_at(x) * R * self.squash)


def build_head(kit, head, spec, upper_colour, jaw_colour, upper_fn=None):
    """Upper head (bone head) and jaw (bone jaw) as two closed shells that meet at the mouth seam, with a dark interior."""
    R = head.R
    prof = head.profile
    th_c = math.degrees(math.acos(-SEAM))            # seam angle from the top
    sides_up, sides_jaw = 10, 5

    def ring_pts(x_R, r_R, a0, a1, n):
        out = []
        for k in range(n + 1):
            th = math.radians(a0 + (a1 - a0) * k / n)
            out.append(head.at(x_R * R, r_R * R * math.sin(th), r_R * R * math.cos(th) * head.squash))
        return out

    def shell(a0, a1, n, colour, bone, interior_up):
        rings = []
        for x_R, r_R in prof:
            if r_R < 1e-6:
                v = kit.bm.verts.new(head.at(x_R * R, 0, 0))
                set_colour(kit, v, colour if not callable(colour) else colour(x_R, 0.0))
                rings.append([v] * (n + 1))
            else:
                ring = []
                for k, p in enumerate(ring_pts(x_R, r_R, a0, a1, n)):
                    v = kit.bm.verts.new(p)
                    set_colour(kit, v, colour if not callable(colour) else colour(x_R, a0 + (a1 - a0) * k / n))
                    ring.append(v)
                rings.append(ring)
        for ka in range(len(rings) - 1):
            for k in range(n):
                add_face(kit.bm, (rings[ka][k], rings[ka][k + 1], rings[ka + 1][k + 1], rings[ka + 1][k]))
        # interior cap across the seam chord: a small grid between the two edge rings
        grid = []
        for ka, (x_R, r_R) in enumerate(prof):
            left, right = rings[ka][0].co.copy(), rings[ka][n].co.copy()
            row = []
            for m in range(5):
                v = kit.bm.verts.new(left.lerp(right, m / 4))
                set_colour(kit, v, MOUTH)
                row.append(v)
            grid.append(row)
        for ka in range(len(grid) - 1):
            for m in range(4):
                add_face(kit.bm, (grid[ka][m], grid[ka + 1][m], grid[ka + 1][m + 1], grid[ka][m + 1]))
        kit._fix_normals()
        finish_part(kit, bone)

    shell(-th_c, th_c, sides_up, upper_fn or upper_colour, "head", False)
    shell(th_c, 360 - th_c, sides_jaw, jaw_colour, "jaw", True)


# ---------------------------------------------------------------- props and motifs (all in du, ground at z = 0)
def rbox(kit, centre, size, rot_deg=(0, 0, 0), bevel=0.35):
    m = Matrix.Translation(V(centre)) @ Matrix.Rotation(math.radians(rot_deg[2]), 4, "Z") \
        @ Matrix.Rotation(math.radians(rot_deg[1]), 4, "Y") @ Matrix.Rotation(math.radians(rot_deg[0]), 4, "X") \
        @ Matrix.Diagonal(V((size[0], size[1], size[2], 1.0)))
    res = bmesh.ops.create_cube(kit.bm, size=1.0, matrix=m)
    edges = list({e for v in res["verts"] for e in v.link_edges})
    bmesh.ops.bevel(kit.bm, geom=edges, offset=bevel, segments=1, affect="EDGES")
    kit._fix_normals()


def cyl(kit, a, b, r, sides=8):
    """Capped cylinder (flat ends) from a to b."""
    a, b = V(a), V(b)
    axis = b - a
    kit.lathe([(0, r), (axis.length, r)], origin=a, axis=axis, sides=sides)


PROPS = {}


def prop(name):
    def deco(fn):
        PROPS[name] = fn
        return fn
    return deco


@prop("stump")
def _stump(kit, spec):
    kit.lathe([(0, 4.6), (3, 4.2), (7, 3.6), (8.5, 2.8)], origin=(-20, -22, 0), sides=7)
    kit.paint("coil", WOOD)
    kit.lathe([(8.5, 2.8), (8.6, 0.0)], origin=(-20, -22, 0), sides=7, cap=False)
    kit.paint("coil", "#C8A46E")
    kit.sphere((-20.8, -21.4, 8.7), (1.4, 1.2, 0.7), u=6, v=4)
    kit.paint("coil", "#B58C58")


@prop("scroll")
def _scroll(kit, spec):
    kit.lathe([(0, 1.5), (7, 1.5)], origin=(15.5, -24, 1.5), axis=(1, 0.2, 0), sides=8)
    kit.paint("coil", PARCH)
    kit.lathe([(-0.2, 1.7), (0.9, 1.7)], origin=(15.3, -24, 1.5), axis=(1, 0.2, 0), sides=8)
    kit.paint("coil", BLOOD)
    kit.lathe([(6.4, 1.7), (7.3, 1.7)], origin=(15.5, -24, 1.5), axis=(1, 0.2, 0), sides=8)
    kit.paint("coil", BLOOD)


@prop("window")
def _window(kit, spec):
    rbox(kit, (-19, -14, 6.5), (14, 3.6, 13), (0, 0, 8), bevel=0.45)
    kit.paint("coil", "#E8D8B0")
    rbox(kit, (-19, -15.8, 7.5), (7.4, 0.8, 8), (0, 0, 8), bevel=0.2)
    kit.paint("coil", "#2B2F5C")
    kit.sphere((-19, -15.9, 11.6), (3.7, 0.5, 2.2), u=8, v=5)
    kit.paint("coil", "#2B2F5C")
    # the drawn curtain over the right half of the opening
    rbox(kit, (-16.4, -16.4, 7.2), (3.6, 1.3, 8.8), (0, 0, 8), bevel=0.5)
    kit.paint("coil", "#7B3B6E")
    rbox(kit, (-22.2, -16.2, 7.4), (1.6, 1.0, 8.2), (0, 0, 8), bevel=0.4)
    kit.paint("coil", "#7B3B6E")


@prop("club")
def _club(kit, spec):
    kit.tube([(9, -23, 2.0), (16, -27, 2.8), (23.5, -31, 3.6)], [1.7, 2.3, 3.4], sides=8)
    kit.paint("coil", "#8A6238")
    for k in range(3):
        kit.ring((20 + k * 2.2, -28 + -k * 1.1, 3.2), (1, -0.5, 0), 3.0 + k * 0.3, 0.55, sides=6, segs=4)
        kit.paint("coil", "#4A3A28")


@prop("nails")
def _nails(kit, spec):
    for k, x in enumerate((-24, -20, -16)):
        rbox(kit, (x, -23, 0.5), (1.5, 12, 1.0), (0, 0, 18 - k * 4), bevel=0.3)
        kit.paint("coil", SAFFRON)


@prop("wheel")
def _wheel(kit, spec):
    c = V((17, -25, 1.6))
    kit.ring(c, (0, 0, 1), 7.5, 1.4, sides=4, segs=6)
    kit.paint("coil", WOOD)
    kit.sphere(c, (2.1, 2.1, 1.6), u=8, v=5)
    kit.paint("coil", "#4A3A28")
    for k in range(6):
        a = math.pi * k / 3
        kit.tube([c, c + V((math.cos(a) * 7.0, math.sin(a) * 7.0, 0))], [0.9, 0.9], sides=4, round_caps=False)
        kit.paint("coil", "#8A6238")


@prop("feathers")
def _feathers(kit, spec):
    for k, (x, y, ang) in enumerate(((-15, -27, 20), (-19, -23, 0), (-15, -20, -22))):
        a = math.radians(ang + 90)
        d = V((math.cos(a), math.sin(a), 0))
        kit.ellipsoid(V((x, y, 0.7)) + d * 0.0, (1.5, 5.8, 0.7), rot=Quaternion((0, 0, 1), math.radians(ang)), u=8, v=5)
        kit.paint("coil", "#E9DDC6" if k != 1 else "#CDB791")


@prop("arrows")
def _arrows(kit, spec):
    for x, y, tilt in ((-19, -19, 14), (-24, -26, -12), (21, -22, 10)):
        t = math.radians(tilt)
        top = V((x + math.sin(t) * 15, y, math.cos(t) * 15))
        kit.tube([V((x, y, 0.5)), top], [0.5, 0.5], sides=5, round_caps=False)
        kit.paint("coil", WOOD)
        kit.ellipsoid(top + V(-0.0, 0, -2.5), (0.3, 1.5, 3.0), rot=Quaternion((0, 1, 0), t), u=5, v=4)
        kit.paint("coil", "#E9DDC6")
        kit.sphere(top + V(0, 0, 0.8), (0.55, 0.55, 0.55), u=5, v=4)
        kit.paint("coil", INK)


@prop("shield")
def _shield(kit, spec):
    kit.lathe([(0, 7.2), (1.6, 7.0)], origin=(-20, -22, 7.5), axis=(0.2, -1, 0.55), sides=12)
    kit.paint("coil", "#8A6238")
    kit.lathe([(1.5, 7.3), (2.4, 5.4), (3.2, 1.8), (3.5, 0.0)], origin=(-20, -22, 7.5), axis=(0.2, -1, 0.55), sides=12, cap=False)
    kit.paint("coil", GOLD)


@prop("drum")
def _drum(kit, spec):
    kit.lathe([(0, 5.6), (1.5, 7.2), (6, 7.2), (8, 5.6)], origin=(-20, -22, 0), sides=10)
    kit.paint("coil", "#A6723E")
    kit.lathe([(1.8, 7.3), (2.8, 7.3)], origin=(-20, -22, 0), sides=10, cap=False)
    kit.paint("coil", SAFFRON)
    kit.lathe([(5.0, 7.3), (6.0, 7.3)], origin=(-20, -22, 0), sides=10, cap=False)
    kit.paint("coil", SAFFRON)
    kit.lathe([(8.0, 5.4), (8.3, 5.0)], origin=(-20, -22, 0), sides=10)
    kit.paint("coil", PARCH)


@prop("banner")
def _banner(kit, spec):
    kit.tube([(-22, -4, 0.5), (-22, -4, 18)], [0.75, 0.6], sides=6)
    kit.paint("coil", WOOD)
    kit.sphere((-22, -4, 18.4), 1.0, u=6, v=4)
    kit.paint("coil", GOLD)
    rbox(kit, (-16.6, -4, 14.6), (9.8, 0.7, 6.0), (0, 0, 0), bevel=0.2)
    kit.paint("coil", BLOOD)
    for k in range(4):                      # torn lower edge
        kit.lathe([(0, 1.3 - k % 2 * 0.4), (1.5, 0.0)], origin=(-20.4 + k * 2.6, -4, 11.6), axis=(0, 0, -1), sides=4, cap=False)
        kit.paint("coil", BLOOD)
    for k in range(10):                     # ten tiny crown marks in a row
        kit.lathe([(0, 0.5), (0.9, 0.2)], origin=(-20.9 + k * 0.92, -4.5, 14.8), axis=(0, -1, 0), sides=4)
        kit.paint("coil", GOLD)


@prop("mace")
def _mace(kit, spec):
    kit.tube([(12, -22, 1.4), (19, -26, 2.2), (25, -30, 2.8)], [0.9, 1.0, 1.1], sides=6)
    kit.paint("coil", WOOD)
    kit.sphere((11, -21.5, 3.0), 3.0, u=8, v=5)
    kit.paint("coil", "#6E6B80")
    for dx, dy, dz in ((0, 0, 3), (2.6, 0, 1), (-2.6, 0, 1), (0, -2.6, 1), (0, 2.6, 1)):
        kit.sphere((11 + dx, -21.5 + dy, 3.0 + dz), 0.8, u=5, v=3)
        kit.paint("coil", GOLD)


# ---------------------------------------------------------------- build one snake
def build(spec):
    """Returns dict(kit, obj, arm, meta) with the mesh built and the armature skinned (clips are baked afterwards)."""
    R = spec["R"]
    head_top = geometry_of(R)[1]
    base_z = head_top - 1.7 * R - 4.0          # first guess, corrected after one measuring pass
    for attempt in range(2):
        kit = ClayKit("snake-" + spec["id"])
        info = build_once(kit, spec, base_z)
        top = max(v.co.z for v in kit.bm.verts)           # the kit works in du until build_object scales it
        err = head_top - top
        if abs(err) < 0.3:
            break
        base_z += err
        kit.bm.free()
        bpy.data.materials.remove(kit.clay)
    info["kit"] = kit
    return info


def build_once(kit, spec, base_z):
    R = spec["R"]
    r_out, head_top = geometry_of(R)
    body = Body(spec, head_top)
    kind = spec["head"]
    # head base: over the coil's back-left, a little behind the centre; the head leans forward over the coil
    base = V((spec["base"][0], spec["base"][1], base_z))
    head = Head(base, R, kind, yaw_deg=spec["face_yaw"])
    ctrl = body.neck_controls(base)
    neck_pts = catmull_chain([V(p) for p in ctrl], per=4)
    # the neck joins the head 0.5 R inside it
    neck_end = head.at(0.5 * R, 0, 0)
    neck_pts[-1] = neck_end
    arc = [0.0]
    for a, b in zip(neck_pts, neck_pts[1:]):
        arc.append(arc[-1] + (b - a).length)
    # bones: joints equally spaced by arc along the neck up to the head base
    total = arc[-1]
    joints = []
    for k in range(6):
        target = total * 0.9 * k / 5
        i = min(range(len(arc)), key=lambda j: abs(arc[j] - target))
        joints.append(neck_pts[i].copy())
    joints[0] = body.collar.copy()
    joints[5] = base.copy()
    # full path = coil + neck
    pts = [p.copy() for p in body.pts] + [p for p in neck_pts[1:]]
    rad = list(body.rad) + [R * (1.0 - 0.06 * k / (len(neck_pts) - 2)) for k in range(1, len(neck_pts))]
    s_tab = [0.0]
    for a, b in zip(pts, pts[1:]):
        s_tab.append(s_tab[-1] + (b - a).length)
    # skin weights per ring: coil rings -> coil; neck rings -> chain by arc
    neck_names = ["neck.01", "neck.02", "neck.03", "neck.04", "neck.05"]
    neck_w = chain_weights(neck_pts, joints, neck_names)
    ring_w = []
    for i, p in enumerate(pts):
        if i < body.coil_count:
            ring_w.append({"coil": 1.0})
        else:
            ring_w.append(neck_w(p))
    body_fn = body_colour(spec, s_tab)
    _, weights = sweep(kit, pts, rad, body_fn, sides=6, ring_weights=ring_w)
    finish_part(kit, "coil", ordered_weights(weights))
    # the filler that closes the coil's centre (no post, 5.6 #4): a flat ellipsoid under the helix
    kit.sphere((0, 0, R * 0.6), (body.r_in * 0.9, body.r_in * 0.9, R * 0.75), u=8, v=4)
    kit.paint("coil", shade(spec["body"], 0.85))

    # ---- head
    upper = spec["body"]
    jaw_c = mix(spec["body"], BLOOD, 0.4)
    if "deer" in spec["motifs"]:
        upper_fn = None
    build_head(kit, head, spec, upper, jaw_c)
    add_face_details(kit, head, spec)
    mouth = head.mouth_point()

    # neck-attached motifs
    neck_frame = lambda t: neck_frame_at(neck_pts, arc, t)
    add_neck_motifs(kit, head, spec, neck_pts, arc, joints, neck_names)

    # tongue: forked, on its own bone, tip hidden at rest by the bone scale
    t0 = mouth + head.f * (0.9 * R)
    dirn = head.f
    side = head.r
    kit.tube([t0, t0 + dirn * 1.2 * R], [0.2 * R, 0.2 * R], sides=4, round_caps=False)
    for sgn in (-1, 1):
        kit.tube([t0 + dirn * 1.1 * R, t0 + dirn * 1.7 * R + side * sgn * 0.3 * R, t0 + dirn * 2.4 * R + side * sgn * 0.62 * R],
                 [0.16 * R, 0.13 * R, 0.07 * R], sides=4, round_caps=False)
    finish_part(kit, "tongue", colour=mix(spec["body"], "#C0353A", 0.65))

    # bulge: an ellipsoid 1.6 R x 1.2 R in the body colour on its own bone, scale 0 at rest
    kit.sphere(joints[5], (1.25 * R, 1.25 * R, 1.6 * R), u=6, v=4)
    finish_part(kit, "bulge", colour=spec["body"])

    # props beside the coil (rigid to the coil)
    for name in spec["props"]:
        PROPS[name](kit, spec)

    return dict(spec=spec, body=body, head=head, neck_pts=neck_pts, joints=joints, mouth=mouth,
                neck_names=neck_names, arc=arc)


def neck_frame_at(neck_pts, arc, t):
    """Point, tangent at fraction t (0 collar .. 1 head) of the neck."""
    target = arc[-1] * t
    for i in range(len(arc) - 1):
        if arc[i] <= target <= arc[i + 1]:
            k = (target - arc[i]) / max(1e-9, arc[i + 1] - arc[i])
            p = neck_pts[i].lerp(neck_pts[i + 1], k)
            tan = (neck_pts[i + 1] - neck_pts[i]).normalized()
            return p, tan
    return neck_pts[-1], (neck_pts[-1] - neck_pts[-2]).normalized()


def neck_bone_at(joints, t):
    """Which neck bone covers fraction t of the neck (0.9 of the arc is divided into five bones)."""
    k = min(4, int(t / 0.18))
    return f"neck.0{k + 1}"


def add_face_details(kit, head, spec):
    R = head.R
    kind = head.kind
    dark = shade(spec["body"], 0.5)
    sleepy = "sleepy" in spec["motifs"]
    eye_c = "#C0392B" if spec["id"] == "ravana" else EYE
    x_eye, th_eye = (2.45, 40) if kind == "plain" else ((1.9, 48) if kind == "stout" else (2.0, 56))
    if kind == "stout":
        x_eye, th_eye = 2.0, 30            # kabandha: the eyes sit on the front of the cap
    for sgn in (-1, 1):
        c = head.surf(x_eye, sgn * th_eye, 0.05)
        if sleepy:
            # closed eyes: a short downward-curved arc on the cheek
            a0 = head.surf(x_eye - 0.5, sgn * (th_eye + 4), 0.08)
            a1 = head.surf(x_eye, sgn * (th_eye + 1), 0.16)
            a2 = head.surf(x_eye + 0.5, sgn * (th_eye - 4), 0.08)
            kit.tube([a0, a1, a2], [0.16 * R] * 3, sides=5)
            kit.paint("head", INK)
        else:
            kit.sphere(c, 0.46 * R, u=7, v=4)
            kit.paint("head", eye_c)
            hl = c + (head.u * 0.6 + head.f * 0.45 + head.r * sgn * 0.0) * (0.3 * R)
            kit.sphere(hl, 0.15 * R, u=5, v=3)
            kit.paint("head", "#FFFFFF")
            # brow: slanted, inner end lower (menacing-cute)
            b_in = head.surf(x_eye + 0.35, sgn * (th_eye - 22), 0.12)
            b_out = head.surf(x_eye - 0.45, sgn * (th_eye - 4), 0.18)
            kit.tube([b_in, b_out], [0.13 * R, 0.16 * R], sides=4)
            kit.paint("head", dark)
        n = head.surf(4.0 if kind == "plain" else (3.1 if kind == "stout" else 4.5), sgn * 24, 0.02)
        kit.sphere(n, 0.1 * R, u=5, v=3)
        kit.paint("head", dark)


def add_neck_motifs(kit, head, spec, neck_pts, arc, joints, neck_names):
    R = head.R
    motifs = spec["motifs"]
    id_ = spec["id"]

    def ring(t, major, minor, colour, tilt_front=0.0):
        p, tan = neck_frame_at(neck_pts, arc, t)
        kit.ring(p, tan, major, minor, sides=4, segs=5)
        kit.paint(neck_bone_at(joints, t), colour)

    if "shawl" in motifs:
        for t in (0.22, 0.38, 0.54):
            ring(t, 0.95 * R, 0.26 * R, "#7B6FC0")
    if "bangles" in motifs:
        for t in (0.3, 0.46):
            ring(t, 0.95 * R, 0.23 * R, GOLD)
    if "bowknot" in motifs:
        p, tan = neck_frame_at(neck_pts, arc, 0.42)
        front = V((0, -1, 0)) - tan * V((0, -1, 0)).dot(tan)
        front.normalize()
        right = V((1, 0, 0))
        knot = p + front * (1.0 * R)
        kit.sphere(knot, 0.28 * R, u=6, v=4)
        kit.paint(neck_bone_at(joints, 0.42), GOLD)
        for sgn in (-1, 1):
            c = knot + right * sgn * 0.62 * R - front * 0.05 * R
            axis = (front * 0.8 + right * sgn * 0.5)
            kit.ring(c, axis, 0.4 * R, 0.13 * R, sides=5, segs=4)
            kit.paint(neck_bone_at(joints, 0.42), SAFFRON)
    if "nosering" in motifs:
        c = head.at(4.05 * R, 0, -0.18 * R)
        kit.ring(c, head.r, 0.55 * R, 0.1 * R, sides=5, segs=5)
        kit.paint("head", GOLD)
    if "hair" in motifs:
        ink = "#2A1A0F"
        for k, (x, th) in enumerate(((0.9, -42), (1.5, 18), (2.1, -12), (1.2, 46), (2.7, 38))):
            sgn = 1 if th >= 0 else -1
            a = head.surf(x, th, 0.12)
            b = head.surf(x + 0.15, sgn * (abs(th) + 24), 0.38)
            c = head.surf(x + 0.3, sgn * 86, 0.4)
            d = head.surf(x + 0.5, sgn * 100, 0.3)
            kit.tube([a, b, c, d], [0.3 * R, 0.28 * R, 0.24 * R, 0.14 * R], sides=4, round_caps=False)
            kit.paint("head", ink)
    if "crest" in motifs:
        kit.ellipsoid(head.at(1.4 * R, 0, 1.55 * R * head.squash + 0.3 * R), (1.5 * R, 0.2 * R, 0.62 * R), rot=Quaternion((1, 0, 0), math.atan2(head.f.z, -head.f.y)),
                      u=8, v=5)
        kit.paint("head", SAFFRON)
        kit.ellipsoid(head.at(1.4 * R, 0, 1.55 * R * head.squash + 0.15 * R), (1.7 * R, 0.26 * R, 0.4 * R), rot=Quaternion((1, 0, 0), math.atan2(head.f.z, -head.f.y)),
                      u=8, v=4)
        kit.paint("head", GOLD)
    if "deer" in motifs:
        mask_c = PARCH
        for sgn in (-1, 1):
            base_pt = head.surf(1.8, sgn * 34, 0.12)
            beam = [base_pt, base_pt + V(sgn * 0.5 * R, -0.2 * R, 0.9 * R), base_pt + V(sgn * 0.95 * R, -0.35 * R, 1.8 * R),
                    base_pt + V(sgn * 0.8 * R, -0.55 * R, 2.5 * R)]
            kit.tube(beam, [0.2 * R, 0.17 * R, 0.14 * R, 0.08 * R], sides=5)
            kit.paint("head", "#E9DDC6")
            for t_pt, dirv in ((beam[1], V(sgn * 0.9, -0.5, 0.9)), (beam[2], V(sgn * 0.2, -0.9, 0.9))):
                kit.tube([t_pt, t_pt + dirv.normalized() * 0.95 * R], [0.12 * R, 0.07 * R], sides=4)
                kit.paint("head", "#E9DDC6")
        # the mask: a thin cap on the upper face with a blood band at its edge
        th_mask = 70
        n = 8
        R_ = head.R
        rings = []
        for x_R in (0.9, 1.5, 2.2, 2.9, 3.5):
            r_R = head.radius_at(x_R) + 0.1
            ring = []
            for k in range(n + 1):
                th = -th_mask + 2 * th_mask * k / n
                v = kit.bm.verts.new(head.at(x_R * R_, r_R * R_ * math.sin(math.radians(th)), r_R * R_ * math.cos(math.radians(th)) * head.squash))
                edge = abs(k - n / 2) >= n / 2 - 0.5 or x_R in (0.9, 3.5)
                set_colour(kit, v, BLOOD if edge else "#F1D88A")
                ring.append(v)
            rings.append(ring)
        for a in range(len(rings) - 1):
            for k in range(n):
                add_face(kit.bm, (rings[a][k + 1], rings[a][k], rings[a + 1][k], rings[a + 1][k + 1]))
        kit._fix_normals()
        finish_part(kit, "head")
    if "crown" in motifs:
        sq = head.squash
        base_up = 1.55 * R * sq
        axis = head.u
        tiers = [(1.25 * R, 0.5 * R, GOLD), (0.98 * R, 0.5 * R, SAFFRON), (0.68 * R, 0.55 * R, GOLD)]
        z0 = base_up - 0.1 * R
        for rad_t, h, col in tiers:
            origin = head.at(1.45 * R, 0, z0)
            kit.lathe([(0, rad_t), (h, rad_t * 0.96)], origin=origin, axis=axis, sides=8)
            kit.paint("head", col)
            z0 += h
        for sgn in (-1, 1):
            o = head.at(1.45 * R, sgn * 1.1 * R, base_up + 0.2 * R)
            kit.lathe([(0, 0.26 * R), (1.2 * R, 0.0)], origin=o, axis=head.u * 0.9 + head.r * sgn * 0.45, sides=5)
            kit.paint("head", GOLD)
        kit.sphere(head.at(1.45 * R, 0, z0 + 0.05 * R), 0.22 * R, u=6, v=4)
        kit.paint("head", "#C0392B")
    if "arms" in motifs:
        for sgn in (-1, 1):
            p, tan = neck_frame_at(neck_pts, arc, 0.82)
            sh = p + V(sgn * 0.6 * R, -0.3 * R, -0.3 * R)
            el = sh + V(sgn * 0.2 * R, -1.0 * R, -1.4 * R)
            hd = el + V(-sgn * 0.1 * R, -1.5 * R, -1.1 * R)
            kit.tube([sh, el, hd], [0.42 * R, 0.4 * R, 0.36 * R], sides=5)
            kit.paint(neck_bone_at(joints, 0.82), spec["body"])
            kit.sphere(hd + V(0, -0.1 * R, -0.15 * R), (0.72 * R, 0.66 * R, 0.6 * R), u=7, v=5)
            kit.paint(neck_bone_at(joints, 0.82), mix(spec["body"], PARCH, 0.35))
            kit.sphere(hd + V(-sgn * 0.5 * R, -0.35 * R, 0.1 * R), 0.28 * R, u=5, v=3)
            kit.paint(neck_bone_at(joints, 0.82), mix(spec["body"], PARCH, 0.35))


# ---------------------------------------------------------------- animation
NECK = ["neck.01", "neck.02", "neck.03", "neck.04", "neck.05"]
LEAN_W = [0.22, 0.26, 0.26, 0.18, 0.08]
BONES = ["coil"] + NECK + ["head", "jaw", "tongue", "bulge"]


def bone_table(info, R):
    """Bone specs in du for rig.build_armature: name -> (parent, head, tail)."""
    head, joints = info["head"], info["joints"]
    B = head.B
    t = {"coil": (None, V((0, 0, 0)), V((0, 0, 2 * R)))}
    for i, name in enumerate(NECK):
        t[name] = ("coil" if i == 0 else NECK[i - 1], joints[i], joints[i + 1])
    t["head"] = ("neck.05", B, B + head.f * 4.4 * R)
    hinge = head.at(0.5 * R, 0, -0.35 * R)
    t["jaw"] = ("head", hinge, hinge + head.f * 3.0 * R)
    mp = info["mouth"]
    t["tongue"] = ("head", mp + head.f * 0.9 * R, mp + head.f * 2.5 * R)
    j5 = joints[5]
    t["bulge"] = ("coil", j5, j5 + V((0, 0, 1.0)))
    return {k: (p, tuple(h), tuple(tl)) for k, (p, h, tl) in t.items()}


def back_out_c(peak):
    """Overshoot constant c of Back.easeOut for a given peak (1.08)."""
    lo, hi = 0.1, 3.0
    for _ in range(40):
        c = (lo + hi) / 2
        m = max(1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2 for u in [k / 200 for k in range(201)])
        lo, hi = (c, hi) if m < peak else (lo, c)
    return (lo + hi) / 2


def back_out(u, c):
    return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2


class Pose:
    def __init__(self):
        self.rot = {}
        self.scale = {}
        self.loc = {}       # armature-space displacement (du), parent rotation ignored (coil only)
        self.bulge = None   # (position in armature du, scale)

    def add_rot(self, bone, q):
        self.rot[bone] = self.rot.get(bone, Quaternion()) @ q


class Rig:
    """Applies a Pose to the armature (rest-relative conversions) and reads FK from Blender's evaluation."""

    def __init__(self, arm):
        self.arm = arm
        self.rest = {b.name: b.matrix_local.to_quaternion() for b in arm.data.bones}
        self.rest_m = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        self.rest_head = {b.name: b.head_local.copy() for b in arm.data.bones}

    def reset(self):
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.scale = V((1, 1, 1))
            pb.location = V((0, 0, 0))

    def apply(self, pose, evaluate=True):
        self.reset()
        for b, q in pose.rot.items():
            r = self.rest[b]
            self.arm.pose.bones[b].rotation_quaternion = r.inverted() @ q @ r
        for b, s in pose.scale.items():
            loc = self.rest_m[b].inverted() @ V(s)
            self.arm.pose.bones[b].scale = V((abs(loc.x), abs(loc.y), abs(loc.z)))
        for b, d in pose.loc.items():
            self.arm.pose.bones[b].location = (self.rest_m[b].inverted() @ V(d)) * SCALE
        if pose.bulge is None:
            self.arm.pose.bones['bulge'].scale = V((0.0001, 0.0001, 0.0001))
        else:
            pos, s = pose.bulge
            rest_head = self.rest_head["bulge"] / SCALE
            self.arm.pose.bones["bulge"].location = (self.rest_m["bulge"].inverted() @ (pos - rest_head)) * SCALE
            self.arm.pose.bones["bulge"].scale = V((max(s, 0.0001),) * 3)
        if evaluate:                    # off while baking: parked clips would overwrite the values about to be keyed
            bpy.context.view_layer.update()

    def head_of(self, bone):
        return self.arm.pose.bones[bone].head / SCALE

    def tail_of(self, bone):
        return self.arm.pose.bones[bone].tail / SCALE

    def point_on(self, bone, rest_point):
        """A rest-pose point (du, armature space) carried by `bone` into the current pose."""
        pb = self.arm.pose.bones[bone]
        local = pb.bone.matrix_local.inverted() @ (rest_point * SCALE)
        return (pb.matrix @ local) / SCALE


DIP = 1.0      # 1: the 18 deg dip of the strike; a snake whose head must stay above a bridge deck uses less
PUSH = 7.0     # du the collar slides toward the token in the strike (the neck is short; the spec asks the head to travel 0.18 u)


def lean_pose(theta, yaw, head_pitch, jaw, push=0.0):
    p = Pose()
    for name, w in zip(NECK, LEAN_W):
        p.add_rot(name, rot_x(theta * w))
    p.add_rot("neck.01", rot_z(yaw))
    p.add_rot("head", rot_x(head_pitch - 0.85 * theta))     # the head keeps (nearly) its own attitude: only the 18 deg dip shows
    p.add_rot("jaw", rot_x(jaw))
    if push:
        p.loc["neck.01"] = V((0, -push, 0))
    return p


def clip_poses(rg, info, spec, aim_yaw, strike_theta):
    """The six clips as lists of Pose (frame i = index i)."""
    R = spec["R"]
    c = back_out_c(1.08)
    clips = {}
    kumb = "sleepy" in spec["motifs"]

    def idle_at(f):
        ph = 2 * math.pi * f / 72
        p = Pose()
        p.add_rot("neck.01", rot_z(3.0 * math.sin(ph)))
        p.add_rot("neck.02", rot_z(-1.2 * math.sin(ph + 0.7)))
        p.add_rot("neck.03", rot_x(1.0 * math.sin(2 * ph)))
        if kumb:
            p.add_rot("head", rot_x(4.0 * (1 - math.cos(ph)) / 2))
        b = 1 + 0.0075 * (1 - math.cos(ph))
        p.scale["coil"] = V((b, b, b))
        return p

    clips["idle"] = [idle_at(f) for f in range(73)]
    # rise: coil scale y 0 -> 1 (Back.easeOut 1.08) over 9 f; the head follows 3 f (120 ms) later, rising 10 du
    rise = []
    for f in range(10):
        u = f / 9
        p = idle_at(0)
        s = max(0.001, back_out(u, c))
        p.scale["coil"] = V((1, 1, s))
        uh = smooth((f - 3) / 6)
        p.loc["neck.01"] = V((0, 0, -10.0 * (1 - uh)))
        rise.append(p)
    clips["rise"] = rise
    look = lambda w: lean_pose(6.0 * w, aim_yaw * 0.7 * w, 0.0, 0.0)
    hold = [look(smooth(f / 4)) for f in range(5)]
    # hold starts from the rest pose (idle frame 0 differs from rest by nothing but the breath)
    clips["hold"] = hold
    strike = []
    for f in range(5):
        u = f / 4
        e = u * u                                   # Quad.easeIn
        theta = 6.0 + (strike_theta - 6.0) * e
        yaw = aim_yaw * (0.7 + 0.3 * e)
        jaw = 25.0 * smooth(f / 1.5) if f <= 1.5 else 25.0
        strike.append(lean_pose(theta, yaw, 18.0 * DIP * e, jaw, push=PUSH * e))
    clips["strike"] = strike
    swallow = []
    n_sw = 8
    for f in range(n_sw + 1):
        u = f / n_sw
        jaw = 25.0 * (1 - smooth((f - 4) / 2.0))
        gulp = -10.0 * smooth((f - 3) / 4.0)
        p = lean_pose(strike_theta * (1 - 0.35 * smooth((f - 2) / 6.0)), aim_yaw, 18.0 * DIP + gulp * DIP, jaw, push=PUSH * (1 - 0.35 * smooth((f - 2) / 6.0)))
        swallow.append(p)
    clips["swallow"] = swallow
    settle = []
    end = swallow[-1]
    th_end = strike_theta * 0.65
    for f in range(6):
        u = math.sin(f / 5 * math.pi / 2)           # Sine.easeOut
        base = idle_at(0)
        p = lean_pose(th_end * (1 - u), aim_yaw * (1 - u), (18.0 - 10.0) * DIP * (1 - u), 0.0, push=PUSH * 0.65 * (1 - u))
        for b, q in base.rot.items():
            p.add_rot(b, Quaternion().slerp(q, u))
        p.scale = dict(base.scale)
        settle.append(p)
    clips["settle"] = settle
    # bulge: travels neck.05 -> neck.01 along the posed neck during the swallow; shrinks away in the settle
    for name, frames in (("swallow", clips["swallow"]), ("settle", clips["settle"])):
        for f, p in enumerate(frames):
            rg.apply(p)
            joints = [rg.head_of(b) for b in NECK] + [rg.tail_of("neck.05")]
            if name == "swallow":
                u = max(0.0, (f - 0.5) / (len(frames) - 1 - 0.5))
                k = u * 4.0                         # joint index 5 -> 1
                a = joints[5 - int(min(k, 3.999))]
                b = joints[4 - int(min(k, 3.999))]
                pos = a.lerp(b, k - int(min(k, 3.999)))
                s = smooth(f / 1.5)
            else:
                pos = joints[0].copy()
                s = 1.0 - smooth(f / 2.5)
            p.bulge = (pos, s)
    for f, p in enumerate(clips["rise"]):
        p.bulge = None
    return clips


def solve_strike(rg, info, spec):
    """Neck lean so the mouth travels 0.18 u (10.08 du) toward the field centre; also the yaw that aims at it."""
    rg.apply(Pose())
    head = info["head"]
    m0 = rg.point_on("head", info["mouth"])
    target = V((0.0, -spec["anchor_back"], m0.z))
    d = target - m0
    aim_yaw = math.degrees(math.atan2(-d.x, -d.y)) if False else math.degrees(math.atan2(d.x, -d.y))
    if spec["strike"] and "aim" in spec["strike"]:
        aim_yaw = spec["strike"]["aim"]
    aim = V((math.sin(math.radians(aim_yaw)), -math.cos(math.radians(aim_yaw)), 0))
    want = 0.18 * 56
    best, best_proj = 5.0, -1e9
    for theta in [t * 1.0 for t in range(2, int(spec["strike"]["lean_cap"] if spec["strike"] else 55) + 1)]:        # first lean at which the mouth has travelled 0.18 u toward the token
        rg.apply(lean_pose(theta, aim_yaw, 18.0 * DIP, 25.0, push=PUSH))
        m1 = rg.point_on("head", info["mouth"])
        proj = V((m1.x - m0.x, m1.y - m0.y, 0)).dot(aim)
        if proj > best_proj:
            best, best_proj = theta, proj
        if proj >= want:
            return aim_yaw, theta, m0
    print("WARNING strike reach", spec["id"], round(best_proj / 56, 3), "u at lean", best)
    return aim_yaw, best, m0


def bake(rg, name, poses):
    arm = rg.arm
    act = anim.new_action(arm, name)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, len(poses) - 1
    for f, p in enumerate(poses):
        rg.apply(p, evaluate=False)
        for b in BONES:
            pb = arm.pose.bones[b]
            pb.keyframe_insert("rotation_quaternion", frame=f, group=b)
        for b in ("coil", "bulge", "neck.01"):
            pb = arm.pose.bones[b]
            pb.keyframe_insert("scale", frame=f, group=b)
            pb.keyframe_insert("location", frame=f, group=b)
    for fc in anim.iter_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    anim.park_on_nla(arm, act)


# ---------------------------------------------------------------- metrics (respect + budgets)
def metrics_of(obj, info, spec):
    """Facts measured on the final mesh, in glTF axes and board units, relative to the coil centre."""
    R = spec["R"]
    head = info["head"]
    verts = [v.co / SCALE for v in obj.data.vertices]          # obj is in board units (du * SCALE)
    xs = [v.x for v in verts]
    ys = [v.y for v in verts]
    zs = [v.z for v in verts]
    body = info["body"]
    r_out_meas = max(math.hypot(p.x, p.y) + r for p, r in zip(body.pts, body.rad))
    # rule 1: width behind the head plane (lateral distance from the neck axis, in R)
    behind_w = 0.0
    axis = info["neck_pts"]
    coil_top = body.collar.z + R
    for v in verts:
        if v.z <= coil_top:
            continue
        if (v - head.B).dot(head.f) >= 0:
            continue
        nearest = min(axis, key=lambda p: (p - v).length_squared)
        behind_w = max(behind_w, abs(v.x - nearest.x) / R)
    # rule 4: nothing tall in the coil's centre (a post): highest vertex within 0.3 of the outer radius
    centre_h = max([v.z for v in verts if math.hypot(v.x, v.y) < 0.3 * body.r_out] or [0.0])
    return {
        "id": spec["id"],
        "R_du": R,
        "coil_outer_u": round(r_out_meas / 56, 4),
        "head_top_u": round(max(zs) / 56, 4),
        "footprint_u": {"x": [round(min(xs) / 56, 4), round(max(xs) / 56, 4)],
                        "z": [round(-max(ys) / 56, 4), round(-min(ys) / 56, 4)]},
        "behind_head_half_width_R": round(behind_w, 3),
        "centre_height_u": round(centre_h / 56, 4),
    }


def on_prop(v, spec):
    return abs(v.x) > 14 or v.y < -14 or v.y > 16


def to_gltf(p):
    """Blender du -> glTF board units (x, y up, z toward the viewer), relative to the coil centre."""
    return [round(p.x / 56, 4), round(p.z / 56, 4), round(-p.y / 56, 4)]


def build_all(out_dir, manifest_path, only):
    global PUSH, DIP
    os.makedirs(out_dir, exist_ok=True)
    manifest = {"fps": FPS, "cellHalf": 0.5, "anchorBack": ANCHOR_BACK / 56, "snakes": {}}
    for spec in SPECS:
        if only and spec["id"] not in only:
            continue
        t0 = time.time()
        lib.reset_scene()
        bpy.context.scene.render.fps = FPS
        PUSH = 7.0 * max(1.0, (spec["R"] / 2.8) ** 1.2)
        DIP = 1.0
        if spec["strike"]:
            PUSH, DIP = spec["strike"]["push"], spec["strike"]["dip"]
        info = build(spec)
        kit = info["kit"]
        obj = kit.build_object()
        common.bake_ao_and_jitter(obj)
        ground_shade(obj, spec["R"])
        arm = rig.build_armature(scale=SCALE, bones=bone_table(info, spec["R"]), name="Armature")
        rig.skin(obj, arm)
        rg = Rig(arm)
        aim_yaw, strike_theta, m0 = solve_strike(rg, info, spec)
        clips = clip_poses(rg, info, spec, aim_yaw, strike_theta)
        # the strike-end and swallow-end mouths (for the token's path), measured before anything is baked
        rg.apply(clips["strike"][-1])
        m_strike = rg.point_on("head", info["mouth"])
        rg.apply(Pose())
        rg.apply(clips["hold"][-1])
        m_hold = rg.point_on("head", info["mouth"])
        rg.apply(Pose())
        frames = {}
        for name in ("rise", "idle", "hold", "strike", "swallow", "settle"):
            bake(rg, name, clips[name])
            frames[name] = len(clips[name]) - 1
        rg.reset()
        meta = metrics_of(obj, info, spec)
        meta.update({
            "clips": frames,
            "mouth": {"idle": to_gltf(m0), "hold": to_gltf(m_hold), "strike": to_gltf(m_strike)},
            "aimYawDeg": round(aim_yaw, 2),
            "strikeLeanDeg": round(strike_theta, 2),
            "pushDu": round(PUSH, 2),
            "headBase": to_gltf(info["head"].B),
            "headForward": [round(info["head"].f.x, 4), round(info["head"].f.z, 4), round(-info["head"].f.y, 4)],
            "neckAxis": [to_gltf(p) for p in info["neck_pts"]],
            "collarZ_u": round(info["body"].collar.z / 56, 4),
            "anchorBack": round(spec["anchor_back"] / 56, 4),
            "heads": 1,
            "motifs": spec["motifs"],
            "props": spec["props"],
            "hood": False,
        })
        arm["snake"] = json.dumps(meta)
        out = os.path.join(out_dir, spec["id"] + ".glb")
        export.export_glb(out, [arm, obj], meshopt=True, image_format="AUTO", keep_static_channels=True)
        print("TOP", spec["id"], sorted(kit.tri_log, reverse=True)[:9])
        meta["triangles"] = lib.triangle_count(obj)
        meta["bytes"] = os.path.getsize(out)
        meta["bones"] = len(arm.data.bones)
        meta["build_s"] = round(time.time() - t0, 1)
        manifest["snakes"][spec["id"]] = meta
        print("SNAKE %s tris %d bytes %d top %.3f coil %.3f behind %.2f" % (
            spec["id"], meta["triangles"], meta["bytes"], meta["head_top_u"], meta["coil_outer_u"],
            meta["behind_head_half_width_R"]))
    if manifest_path:
        old = {}
        if only and os.path.exists(manifest_path):
            with open(manifest_path) as fh:
                old = json.load(fh).get("snakes", {})
        old.update(manifest["snakes"])
        manifest["snakes"] = {s["id"]: old[s["id"]] for s in SPECS if s["id"] in old}
        with open(manifest_path, "w") as fh:
            json.dump(manifest, fh, indent=1)


def ground_shade(obj, R):
    """Darken the vertices near the ground so the coil sits on the block (AO of the contact)."""
    attr = obj.data.color_attributes["Col"]
    for v in obj.data.vertices:
        h = v.co.z / SCALE
        k = 0.78 + 0.22 * smooth(h / (1.6 * R))
        c = attr.data[v.index].color
        attr.data[v.index].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = argv[0] if argv else "snakes"
    manifest = argv[1] if len(argv) > 1 else None
    only = set(argv[2:])
    build_all(out_dir, manifest, only)


main()
