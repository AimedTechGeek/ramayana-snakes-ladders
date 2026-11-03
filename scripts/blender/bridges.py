"""The nine arched stone bridges (T44 6.2-6.3): one GLB each, vertex colours only, authored in the board frame.

Input (JSON written by scripts/blender/bridges-build.mjs from src/app/board3d/bridgeGeometry.ts, so the GLB deck and the
path a hero runs along are one curve): per bridge the deck surface samples [x, y, z, ground] from the foot abutment to
the top abutment, the arch count and the story id. Output: <out>/<id>.glb and a manifest with tris, bytes and the deck
height measured back off the built mesh (the test compares it with the TypeScript formula).

Units: the script thinks in board units (u, three frame: x right, y up, z toward the viewer) and converts to the px
frame of clay.Kit on the way out (Blender +Z up, glTF export turns Blender -Y into +Z).
Run: node scripts/blender/run.mjs scripts/blender/bridges.py <input.json> <outDir> <manifest.json>
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clay  # noqa: E402
import lib  # noqa: E402

PX = 56.0
PI = math.pi
_ARGS = sys.argv[sys.argv.index("--") + 1:]
with open(_ARGS[0], encoding="utf-8") as _fh:
    _INPUT = json.load(_fh)
_C = _INPUT["consts"]
DECK_W = _C["deckWidth"]            # walkway between the parapets
PARAPET_W = _C["parapetWidth"]
BODY_W = DECK_W + 2 * PARAPET_W   # the masonry body: arches, piers, deck core
SLAB = 0.012           # flagstone thickness (the walking surface is the top of the slab)
CORE_T = 0.045         # deck thickness including the slab
RING_T = 0.04          # voussoir ring depth
PIER_ALONG = 0.11
ABUT_H = _C["abutmentHeight"]
ABUT_W = _C["abutmentWidth"]
FOOT_DEPTH, TOP_DEPTH = _C["footAbutmentDepth"], _C["topAbutmentDepth"]
GOLD, SAFFRON, LEAF, BERRY = "#EBC53C", "#F6A33B", "#7FB35E", "#B8323C"
TIMBER, ROPE, CORD, FUR = "#8C6A3C", "#D6BE8C", "#E9D8B0", "#B07A45"


def shade(hex_colour, k):
    h = hex_colour.lstrip("#")
    c = [max(0, min(255, int(round(int(h[i:i + 2], 16) * k)))) for i in (0, 2, 4)]
    return "#%02X%02X%02X" % tuple(c)


def jitter(*p):
    return clay._noise(p[0] * 91.7, p[1] * 53.3, p[2] * 71.1)


def B(p):
    """Board point (x, y up, z toward viewer) in u -> kit px frame."""
    return Vector((p[0] * PX, -p[2] * PX, p[1] * PX))


class Stones(clay.Kit):
    """clay.Kit plus flat-shaded prisms and a build() that keeps my winding (no normal recalculation)."""

    def prism(self, bottom, top, colour, wear=0.05, dark=0.78):
        """Convex prism between two matching point loops (board u). Darker toward the bottom, tiny value wear."""
        n = len(bottom)
        mid = Vector((0, 0, 0))
        for p in list(bottom) + list(top):
            mid += B(p)
        mid /= 2 * n
        k = 1.0 + wear * jitter(*bottom[0])
        top_col, bot_col = clay.lin(shade(colour, k)), clay.lin(shade(colour, k * dark))
        vb = [self._vert(False, B(p), bot_col) for p in bottom]
        vt = [self._vert(False, B(p), top_col) for p in top]
        faces = [vb[::-1], vt] + [[vb[i], vb[(i + 1) % n], vt[(i + 1) % n], vt[i]] for i in range(n)]
        for f in faces:
            self._flat(f, mid)

    def _flat(self, verts, inside):
        """Add a face wound so its normal points away from `inside`; keep it flat shaded."""
        pts = [v.co for v in verts]
        normal = Vector((0, 0, 0))
        for i, p in enumerate(pts):
            q = pts[(i + 1) % len(pts)]
            normal += Vector(((p.y - q.y) * (p.z + q.z), (p.z - q.z) * (p.x + q.x), (p.x - q.x) * (p.y + q.y)))
        centre = sum(pts, Vector((0, 0, 0))) / len(pts)
        if normal.dot(centre - inside) < 0:
            verts = verts[::-1]
        try:
            f = self.bm["main"].faces.new(verts)
            f.smooth = False
        except ValueError:
            pass

    def quad_strip(self, rows, colour, inside, dark=0.8):
        """Open strip of quads between successive point lists (board u), wound away from `inside`."""
        col_top, col_bot = clay.lin(shade(colour, 1.0)), clay.lin(shade(colour, dark))
        built = []
        for ri, row in enumerate(rows):
            c = col_top if ri == len(rows) - 1 else col_bot
            built.append([self._vert(False, B(p), c) for p in row])
        for r in range(len(built) - 1):
            for i in range(len(built[r]) - 1):
                self._flat([built[r][i], built[r][i + 1], built[r + 1][i + 1], built[r + 1][i]], B(inside))

    def finish(self, material):
        bm = self.bm["main"]
        for v in bm.verts:   # value wear only: the stones carry their own bottom-dark gradient
            r, g, b, _ = v[self.layer["main"]]
            k = 1.0 + 0.03 * clay._noise(v.co.x, v.co.y, v.co.z)
            v[self.layer["main"]] = (r * k, g * k, b * k, 1.0)
        bmesh.ops.scale(bm, vec=(clay.PX,) * 3, verts=list(bm.verts), space=Matrix.Identity(4))
        mesh = bpy.data.meshes.new(self.name)
        bm.to_mesh(mesh)
        mesh.update()
        mesh.color_attributes.active_color = mesh.color_attributes["Col"]
        mesh.color_attributes.render_color_index = 0
        mesh.materials.append(material)
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        bm.free()
        return obj


class Route:
    """The deck centre line as a function of horizontal arc length `a` (u from the foot abutment)."""

    def __init__(self, deck):
        self.p = [(d[0], d[1], d[2]) for d in deck]
        self.ground = [d[3] for d in deck]
        self.h = [0.0]
        for i in range(1, len(self.p)):
            self.h.append(self.h[-1] + math.hypot(self.p[i][0] - self.p[i - 1][0], self.p[i][2] - self.p[i - 1][2]))
        self.total = self.h[-1]

    def index(self, a):
        a = min(max(a, 0.0), self.total)
        lo, hi = 0, len(self.h) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.h[mid] <= a:
                lo = mid
            else:
                hi = mid
        span = self.h[hi] - self.h[lo] or 1.0
        return lo, hi, (a - self.h[lo]) / span

    def at(self, a):
        lo, hi, t = self.index(a)
        return tuple(self.p[lo][k] + (self.p[hi][k] - self.p[lo][k]) * t for k in range(3))

    def ground_at(self, a):
        lo, hi, t = self.index(a)
        return self.ground[lo] + (self.ground[hi] - self.ground[lo]) * t

    def tangent(self, a):
        p0, p1 = self.at(a - 0.02), self.at(a + 0.02)
        dx, dz = p1[0] - p0[0], p1[2] - p0[2]
        n = math.hypot(dx, dz) or 1.0
        return dx / n, dz / n

    def pt(self, a, off=0.0, dy=0.0):
        """Point beside the centre line: `off` toward the +side (the back/left of travel), `dy` up."""
        x, y, z = self.at(a)
        tx, tz = self.tangent(a)
        return (x + tz * off, y + dy, z - tx * off)

    def under(self, a):
        return self.at(a)[1] - CORE_T


# ------------------------------------------------------------------ masonry parts

def ellipse_pt(route, a_mid, rx, y_s, ry, theta, off):
    return route.pt(a_mid + rx * math.cos(theta), off, 0.0)[0:3:2] + (y_s + ry * math.sin(theta),)


def arch(kit, route, a0, a1, stone, seed):
    """One opening between a0 and a1: voussoir ring springing from the ground, spandrel walls up to the deck."""
    am, rx = (a0 + a1) / 2, (a1 - a0) / 2
    # T45.1: spring from the lower ground of the opening (on a terrace step the ring runs into the higher row's blocks
    # instead of standing on them and poking up through the deck)
    y_s = min(route.ground_at(a0), route.ground_at(a1), route.ground_at(am)) - 0.005
    crown = route.under(am) - 0.004
    ry = max(0.07, min(rx, crown - RING_T - y_s))
    n = max(7, min(9, int(round(rx * PI / 0.09)) | 1))
    half = BODY_W / 2 + 0.008

    def ring(theta, extra, off):
        a = am + (rx + extra) * math.cos(theta)
        p = route.pt(a, off)
        return (p[0], y_s + (ry + extra) * math.sin(theta), p[2])

    for j in range(n):
        t0, t1 = PI * j / n + 0.012, PI * (j + 1) / n - 0.012
        key = 0.012 if j == n // 2 else 0.0
        bottom = [ring(t0, 0, half), ring(t1, 0, half), ring(t1, 0, -half), ring(t0, 0, -half)]
        top = [ring(t0, RING_T + key, half), ring(t1, RING_T + key, half), ring(t1, RING_T + key, -half),
               ring(t0, RING_T + key, -half)]
        tint = 1.0 + 0.07 * jitter(seed, j, am)
        kit.prism(bottom, top, shade(stone, tint), dark=0.7)
    # spandrel: the wall between the ring's back and the deck core, both faces (open strips, outward = away from axis)
    steps = 10
    for sign in (1, -1):
        low, high = [], []
        for i in range(steps + 1):
            theta = PI - PI * i / steps
            a = am + (rx + RING_T) * math.cos(theta)
            a = min(max(a, a0 - RING_T), a1 + RING_T)
            low.append(route.pt(a, sign * (BODY_W / 2 - 0.002), 0.0)[0:3:2])
            ylow = y_s + (ry + RING_T) * math.sin(theta) - 0.002
            low[-1] = (low[-1][0], ylow, low[-1][1])
            hx, _, hz = route.pt(a, sign * (BODY_W / 2 - 0.002))
            high.append((hx, route.under(a) + 0.004, hz))
        inside = route.pt(am, 0.0, -0.05)
        kit.quad_strip([low, high], shade(stone, 0.92), inside, dark=0.7)


def pier(kit, route, a, stone, lens=False, crest=False):
    """Plinth, shaft and cap under the deck at arc position `a`."""
    g = route.ground_at(a) - 0.02
    top = route.under(a)
    tx, tz = route.tangent(a)

    def plan(along, across, y):
        if lens:
            pts = [(along, 0), (along * 0.5, across * 0.5), (-along * 0.5, across * 0.5), (-along, 0),
                   (-along * 0.5, -across * 0.5), (along * 0.5, -across * 0.5)]
        else:
            pts = [(along, across), (-along, across), (-along, -across), (along, -across)]
        base = route.at(a)
        return [(base[0] + tx * u + tz * v, y, base[2] + tz * u - tx * v) for u, v in pts]

    kit.prism(plan(PIER_ALONG / 2 + 0.02, BODY_W / 2 + 0.02, g), plan(PIER_ALONG / 2 + 0.02, BODY_W / 2 + 0.02, g + 0.045),
              shade(stone, 0.9), dark=0.7)
    kit.prism(plan(PIER_ALONG / 2, BODY_W / 2 - 0.004, g + 0.045), plan(PIER_ALONG / 2, BODY_W / 2 - 0.004, top - 0.022), stone,
              dark=0.72)
    kit.prism(plan(PIER_ALONG / 2 + 0.014, BODY_W / 2 + 0.012, top - 0.022), plan(PIER_ALONG / 2 + 0.014, BODY_W / 2 + 0.012, top + 0.002),
              shade(stone, 1.08), dark=0.85)
    if crest:  # wave-crest pier: a curl of sea-foam on each pier face
        for sign in (1, -1):
            c = route.pt(a, sign * (BODY_W / 2 + 0.005), -0.1)
            kit.blob(B((c[0], c[1] - 0.05 + 0.0, c[2])), (0.025 * PX, 0.04 * PX, 0.045 * PX), "#EAF4F6", u=5, v=3)


def abutment(kit, route, which, stone, seed):
    a = 0.0 if which == "foot" else route.total
    d = FOOT_DEPTH if which == "foot" else TOP_DEPTH
    x, y, z = route.at(a)
    ground = route.ground_at(a)
    hw, hd = ABUT_W / 2, d / 2
    pts = lambda yy: [(x + hw, yy, z + hd), (x - hw, yy, z + hd), (x - hw, yy, z - hd), (x + hw, yy, z - hd)]
    kit.prism(pts(ground - 0.02), pts(y - CORE_T + 0.004), stone, dark=0.7)   # to the deck underside
    # a lip cap in a lighter stone
    cap = lambda yy, e: [(x + hw + e, yy, z + hd + e), (x - hw - e, yy, z + hd + e), (x - hw - e, yy, z - hd - e),
                         (x + hw + e, yy, z - hd - e)]
    kit.prism(cap(y - CORE_T - 0.014, 0.01), cap(y - CORE_T + 0.004, 0.01), shade(stone, 1.1), dark=0.85)


def deck(kit, route, stone, style, seed):
    """Core slab in chunks under the walkway, flagstones (or stepping slabs) on top."""
    chunk = 0.24
    count = max(1, int(round(route.total / chunk)))
    edges = [route.total * i / count for i in range(count + 1)]
    for i in range(count):
        a0, a1 = edges[i], edges[i + 1]
        bot = [route.pt(a0, BODY_W / 2, -CORE_T), route.pt(a1, BODY_W / 2, -CORE_T), route.pt(a1, -BODY_W / 2, -CORE_T),
               route.pt(a0, -BODY_W / 2, -CORE_T)]
        top = [route.pt(a0, BODY_W / 2, -SLAB), route.pt(a1, BODY_W / 2, -SLAB), route.pt(a1, -BODY_W / 2, -SLAB),
               route.pt(a0, -BODY_W / 2, -SLAB)]
        kit.prism(bot, top, shade(stone, 0.78), dark=0.9)
    # walking surface
    if style == "setu":
        length, gap, width = 0.29, 0.036, 0.20
    else:
        length, gap, width = 0.17, 0.008, DECK_W
    n = max(1, int(round((route.total + gap) / (length + gap))))
    length = (route.total + gap) / n - gap
    for i in range(n):
        a0 = i * (length + gap)
        a1 = a0 + length
        tint = 1.0 + 0.08 * jitter(seed, i, 3.0)
        bot = [route.pt(a0, width / 2, -SLAB), route.pt(a1, width / 2, -SLAB),
               route.pt(a1, -width / 2, -SLAB), route.pt(a0, -width / 2, -SLAB)]
        top = [route.pt(a0, width / 2), route.pt(a1, width / 2), route.pt(a1, -width / 2), route.pt(a0, -width / 2)]
        kit.prism(bot, top, shade(stone, 1.12 * tint), wear=0.04, dark=0.85)
        if style == "setu":   # the inscribed name: a pale ring on each slab
            c = route.pt((a0 + a1) / 2, 0, 0.002)
            kit.ring(B(c), 0.045 * PX, 0.062 * PX, "#EAF1F2", sides=10)
    return n


def posts(route, spacing):
    """Post positions along the deck: both ends plus an even spread (about `spacing` apart)."""
    n = max(1, int(round(route.total / spacing)))
    return [route.total * i / n for i in range(n + 1)]


def parapet_walls(kit, route, stone, kind):
    """Both sides: stone wall with posts ('wall'), a low kerb for timber/rope rails ('kerb'), blocks ('blocks')."""
    spans = posts(route, 0.29)
    for sign in (1, -1):
        off = sign * (DECK_W / 2 + PARAPET_W / 2)
        tall = {"wall": 0.07, "kerb": 0.03, "blocks": 0.05}[kind]
        for i in range(len(spans) - 1):
            a0, a1 = spans[i], spans[i + 1]
            parts = 1 if kind != "blocks" else 2
            for k in range(parts):
                b0 = a0 + (a1 - a0) * k / parts + (0.006 if kind == "blocks" else 0)
                b1 = a0 + (a1 - a0) * (k + 1) / parts - (0.006 if kind == "blocks" else 0)
                w = PARAPET_W / 2 if kind != "kerb" else PARAPET_W / 2 + 0.002
                bot = [route.pt(b0, off + w, -SLAB), route.pt(b1, off + w, -SLAB), route.pt(b1, off - w, -SLAB),
                       route.pt(b0, off - w, -SLAB)]
                top = [route.pt(b0, off + w, tall), route.pt(b1, off + w, tall), route.pt(b1, off - w, tall),
                       route.pt(b0, off - w, tall)]
                kit.prism(bot, top, shade(stone, 1.05 + 0.05 * jitter(sign, i, k)), wear=0.05, dark=0.8)
    return spans


def post_blocks(kit, route, spans, stone, height=0.105, half=0.03, cap=True, colour=None):
    for sign in (1, -1):
        off = sign * (DECK_W / 2 + PARAPET_W / 2)
        for i, a in enumerate(spans):
            tx, tz = route.tangent(a)
            x, y, z = route.at(a)
            cx, cz = x + tz * off, z - tx * off
            corners = lambda yy, e: [(cx + (tx * u + tz * v) , yy, cz + (tz * u - tx * v)) for u, v in
                                     ((half + e, half + e), (-half - e, half + e), (-half - e, -half - e), (half + e, -half - e))]
            kit.prism(corners(y - SLAB, 0), corners(y + height, 0), colour or shade(stone, 1.12), dark=0.8)
            if cap:
                kit.prism(corners(y + height, 0.006), corners(y + height + 0.014, 0.006), colour or shade(stone, 1.2), dark=0.9)


# ------------------------------------------------------------------ story identity

def ornaments(kit, route, spec, stone, spans):
    """Story identity (6.3): parapet dressing and the foot / top ornaments. Foot and top pieces stand beside the
    walking line (off-centre), never on it, so a hero leaping on or off lands on bare stone."""
    id_ = spec["id"]
    side = DECK_W / 2 + PARAPET_W / 2
    last = len(spans) - 1

    def foot_pt(off, dy=0.0, a=0.07):
        return route.pt(a, off, dy)

    def top_pt(off, dy=0.0, a=0.07):
        return route.pt(route.total - a, off, dy)

    def post_top(i, sign, lift=0.0):
        return route.pt(spans[i], sign * side, 0.13 + lift)

    def rail(points, radius, colour, sides=4):
        kit.tube([B(p) for p in points], radius * PX, colour, sides=sides)

    def along(offset, y, n=None, wave=0.0, phase=0.0, a_from=0.0, a_to=None):
        a_to = route.total if a_to is None else a_to
        n = n or max(3, int(round(route.total / 0.3)))
        return [route.pt(a_from + (a_to - a_from) * i / n, offset + wave * math.sin(i / n * 6 * PI + phase), y)
                for i in range(n + 1)]

    def blob(p, r, colour, u=6, v=4):
        kit.blob(B(p), r * PX, colour, u=u, v=v)

    def flat(p, r, h, colour, sides=10):
        kit.cyl(B(p), r * PX, h * PX, colour, sides=sides)

    if id_ == "vishwamitra":
        for sign in (1, -1):
            for y in (0.06, 0.115):
                rail(along(sign * side, y), 0.013, TIMBER, sides=3)
            for a in spans[1:-1]:
                p = route.pt(a, sign * side, 0.08)
                flat((p[0], p[1] - 0.025, p[2]), 0.04, 0.055, CORD, sides=5)
        pot = foot_pt(-0.12, 0.0)   # kamandalu: a turned water pot with a spout
        kit.lathe(B(pot), [(0, 0.016 * PX), (0.012 * PX, 0.05 * PX), (0.06 * PX, 0.064 * PX), (0.1 * PX, 0.036 * PX),
                           (0.13 * PX, 0.022 * PX), (0.15 * PX, 0.032 * PX)], "#C98B4B", sides=9, top=True)
        rail([(pot[0] + 0.03, pot[1] + 0.09, pot[2]), (pot[0] + 0.07, pot[1] + 0.13, pot[2]), (pot[0] + 0.09, pot[1] + 0.1, pot[2])],
             0.009, "#C98B4B", sides=4)
        for sign in (1, -1):   # bowstring tied across the last two posts
            a, b = spans[-1], spans[-2]
            rail([route.pt(a, sign * side, 0.155), route.pt((a + b) / 2, sign * side, 0.2), route.pt(b, sign * side, 0.155)],
                 0.006, "#3B2B1A", sides=3)
            for q in (a, b):
                blob(route.pt(q, sign * side, 0.16), 0.016, "#3B2B1A", u=5, v=3)
    elif id_ == "shiva-bow":
        for sign in (1, -1):   # two gold bow halves bowed outward, strung to the posts
            n = 16
            pts = [route.pt(route.total * i / n, sign * (side + 0.035 * math.sin(PI * i / n) + 0.012),
                            0.1 + 0.06 * math.sin(PI * i / n)) for i in range(n + 1)]
            rail(pts, 0.02, GOLD, sides=5)
            for a in spans[1:-1]:
                rail([route.pt(a, sign * side, 0.1 + 0.06 * math.sin(PI * a / route.total)), route.pt(a, sign * side, 0.02)],
                     0.006, "#F4EAC8", sides=3)
        c = top_pt(0.0, 0.004, a=0.02)   # burst star: a gold boss with six spokes
        flat(c, 0.04, 0.014, GOLD, sides=10)
        for k in range(6):
            ang = k * PI / 3
            kit.blob(B((c[0] + math.cos(ang) * 0.09, c[1] + 0.008, c[2] + math.sin(ang) * 0.09)),
                     (0.05 * PX, 0.011 * PX, 0.012 * PX), GOLD, u=5, v=3, rot=(0, 0, -ang))
    elif id_ == "wedding":
        for sign in (1, -1):   # saffron swags with marigolds between the posts
            for i in range(len(spans) - 1):
                pa, pb = route.pt(spans[i], sign * side, 0.115), route.pt(spans[i + 1], sign * side, 0.115)
                mid = tuple((pa[k] + pb[k]) / 2 for k in range(3))
                rail([pa, (mid[0], mid[1] - 0.06, mid[2]), pb], 0.01, SAFFRON, sides=3)   # 0.01 thin: 3 sides read round
                for t in (0.3, 0.7):   # u=4: the bowed deck (Kaikeyi, T44.14) is longer, so more spans share 3,000 tris
                    q = tuple(pa[k] + (pb[k] - pa[k]) * t for k in range(3))
                    blob((q[0], q[1] - 0.06 * 4 * t * (1 - t) - 0.012, q[2]), 0.026,
                         "#F4A04A" if t < 0.5 else "#FFD36B", u=4, v=3)
        for k in range(8):   # garland loop on the foot abutment, beside the walking line
            ang = k * 2 * PI / 8
            c = foot_pt(-0.13, 0.0)
            blob((c[0] + math.cos(ang) * 0.065, c[1] + 0.016, c[2] + math.sin(ang) * 0.065), 0.02,
                 "#F4A04A" if k % 2 else LEAF, u=5, v=3)
        for sign in (1, -1):   # crown discs on the end posts
            p = post_top(last, sign, 0.0)
            flat((p[0], p[1] - 0.006, p[2]), 0.052, 0.014, GOLD, sides=10)
            for k in range(5):
                ang = k * 2 * PI / 5
                kit.cone(B((p[0] + math.cos(ang) * 0.036, p[1] + 0.008, p[2] + math.sin(ang) * 0.036)), 0.013 * PX, 0.04 * PX,
                         GOLD, sides=4)
    elif id_ == "guha":
        for sign in (1, -1):   # oar rails with a paddle at the foot end
            rail(along(sign * side, 0.11), 0.015, "#A9784A")
            p = route.pt(0.06, sign * side, 0.11)
            kit.blob(B(p), (0.06 * PX, 0.02 * PX, 0.04 * PX), "#C48D55", u=6, v=4)
        for a in spans[1:-1]:   # rope ties across the deck
            rail([route.pt(a, DECK_W / 2 - 0.01, 0.004), route.pt(a, -DECK_W / 2 + 0.01, 0.004)], 0.008, ROPE, sides=3)
    elif id_ == "shabari":
        for sign in (1, -1):   # vine rails with berries and leaves
            pts = along(sign * side, 0.1, n=10, wave=0.014)
            rail(pts, 0.012, "#5E7A3B")
            for i, p in enumerate(pts[1:-1]):
                blob((p[0], p[1] + 0.016, p[2]), 0.016, BERRY if i % 2 else "#D8473F", u=5, v=3)
                kit.blob(B((p[0], p[1] + 0.008, p[2] + (0.03 if sign > 0 else -0.03))),
                         (0.03 * PX, 0.008 * PX, 0.016 * PX), LEAF, u=4, v=3)
        c = foot_pt(-0.12, 0.0)   # basket cup
        kit.lathe(B(c), [(0, 0.04 * PX), (0.03 * PX, 0.052 * PX), (0.065 * PX, 0.06 * PX)], "#B8874A", sides=9, top=False)
        for k in range(3):
            blob((c[0] + math.cos(k * 2.1) * 0.025, c[1] + 0.066, c[2] + math.sin(k * 2.1) * 0.025), 0.018, BERRY, u=5, v=3)
    elif id_ == "hanuman-meeting":
        for sign in (1, -1):   # rope rails with fur collars
            for y in (0.065, 0.115):
                rail(along(sign * side, y, wave=0.004), 0.011, ROPE, sides=4)
            for a in spans[1:-1]:
                kit.blob(B(route.pt(a, sign * side, 0.09)), (0.042 * PX, 0.042 * PX, 0.055 * PX), FUR, u=6, v=4)
        m = foot_pt(-0.12, 0.012)   # tiny mace lying on the abutment
        kit.cyl(B(m), 0.01 * PX, 0.09 * PX, "#6D5A3E", sides=5, rot=(0, PI / 2, 0))
        blob((m[0] - 0.09, m[1] + 0.014, m[2]), 0.034, "#8C8C94")
        base = top_pt(0.12, 0.0, a=0.0)   # tail curl finial ending in a tuft, beside the walking line
        pts = []
        for i in range(21):
            t = i / 20
            r = 0.06 * (1 - 0.6 * t)
            ang = t * 3 * PI
            pts.append((base[0] + math.cos(ang) * r, base[1] + 0.01 + t * 0.09, base[2] + math.sin(ang) * r))
        rail(pts, 0.014, FUR, sides=5)
        blob(pts[-1], 0.034, "#E3A15B")
    elif id_ == "sugriva":
        for sign in (1, -1):   # pillar posts with clasped-hands medallions
            for a in spans[1:-1]:
                p = route.pt(a, sign * (side + PARAPET_W / 2 + 0.004), 0.055)
                kit.blob(B(p), (0.034 * PX, 0.034 * PX, 0.034 * PX), GOLD, u=7, v=4)
        c = top_pt(0.12, 0.0, a=0.02)   # crown disc with two ear cylinders, beside the walking line
        flat((c[0], c[1] + 0.06, c[2]), 0.075, 0.02, GOLD, sides=12)
        flat((c[0], c[1] + 0.0, c[2]), 0.012, 0.06, "#E3A15B", sides=6)
        for s2 in (-1, 1):
            flat((c[0] + s2 * 0.065, c[1] + 0.07, c[2]), 0.02, 0.045, "#E3A15B", sides=7)
    elif id_ == "hanuman-leap":
        for sign in (1, -1):   # wave rails
            rail(along(sign * side, 0.115, n=30, wave=0.034, phase=0.3 * sign), 0.014, "#EAF4F6")
        p = post_top(last, 1, 0.0)
        tx, tz = route.tangent(route.total)
        for k in range(4):   # tuft finials fanning +-35 degrees from the last post
            ang = math.radians(-35 + k * 70 / 3)
            tip = (p[0] + tz * math.sin(ang) * 0.09, p[1] + math.cos(ang) * 0.09, p[2] - tx * math.sin(ang) * 0.09)
            rail([p, tip], 0.009, "#E8E2C8", sides=3)
            blob(tip, 0.016, "#F4EFDC", u=5, v=3)
    elif id_ == "rama-setu":
        for da, ds in ((0.0, 0.05), (0.07, -0.05)):   # squirrel footprints on the first slab
            c = route.pt(0.08 + da, ds, 0.004)
            kit.disc(B(c), 0.014 * PX, "#5B6E73", sides=6)
            for j in range(3):
                kit.disc(B(route.pt(0.08 + da + 0.034, ds + (j - 1) * 0.02, 0.004)), 0.007 * PX, "#5B6E73", sides=5)


STORIES = {
    "vishwamitra": dict(stone="#8E8A80", parapet="kerb", post=TIMBER, lens=False),
    "shiva-bow": dict(stone="#D9BE82", parapet="wall", post=None, lens=False),
    "wedding": dict(stone="#E8B9CB", parapet="wall", post=None, lens=False),
    "guha": dict(stone="#8FA3A8", parapet="kerb", post="#A9784A", lens=True),
    "shabari": dict(stone="#7F8A5F", parapet="wall", post=None, lens=False),
    "hanuman-meeting": dict(stone="#C98B4B", parapet="kerb", post="#7A5A38", lens=False),
    "sugriva": dict(stone="#CF975B", parapet="wall", post="#B97F46", lens=False),
    "hanuman-leap": dict(stone="#658DA2", parapet="kerb", post="#9FB9C4", lens=False),
    "rama-setu": dict(stone="#8AA0A6", parapet="blocks", post=None, lens=False),
}


def build_bridge(spec, material):
    story = STORIES[spec["id"]]
    stone = story["stone"]
    route = Route(spec["deck"])
    kit = Stones("bridge-" + spec["id"])
    seed = float(spec["from"])
    n = spec["openings"]
    # piers sit at the route parameter k / n; the end piers are the abutments
    pier_a = [route.h[round(k * (len(route.h) - 1) / n)] for k in range(n + 1)]
    foot_e, top_e = 0.07, 0.07
    for k in range(n):
        a0 = pier_a[k] + (foot_e if k == 0 else PIER_ALONG / 2 + 0.014)
        a1 = pier_a[k + 1] - (top_e if k == n - 1 else PIER_ALONG / 2 + 0.014)
        arch(kit, route, a0, a1, stone, seed + k)
    for k in range(1, n):
        pier(kit, route, pier_a[k], stone, lens=story["lens"], crest=spec["id"] == "hanuman-leap")
    abutment(kit, route, "foot", stone, seed)
    abutment(kit, route, "top", stone, seed + 7)
    deck(kit, route, stone, "setu" if spec["id"] == "rama-setu" else "flag", seed)
    spans = parapet_walls(kit, route, stone, story["parapet"])
    if story["parapet"] != "blocks":
        post_blocks(kit, route, spans, stone, colour=story["post"] and shade(story["post"], 1.0))
    ornaments(kit, route, spec, stone, spans)
    # moss and grass at the pier bases: a few soft cushions, cheap and charming
    for k in range(1, n):
        for sign in (1, -1):
            p = route.pt(pier_a[k], sign * (BODY_W / 2 + 0.02))
            kit.blob(B((p[0], route.ground_at(pier_a[k]) + 0.006, p[2])), (0.05 * PX, 0.04 * PX, 0.016 * PX), "#8FBF6A", u=6, v=3)
    obj = kit.finish(material)
    return obj, route


def measure_deck(obj, spec, route):
    """Deck surface read back off the built mesh with downward rays: per sample, the best of three rays (a ray that
    falls in a seam between flagstones sees the core, 12 mm lower). Returns [(a, formula y, measured y)] every 10th."""
    mesh = obj.data
    bvh = BVHTree.FromPolygons([tuple(v.co) for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons])
    out = []
    for i in range(0, len(route.h), 10):
        best = None
        for da in (0.0, -0.04, 0.04):
            a = min(max(route.h[i] + da, 0.0), route.total)
            x, y, z = route.at(a)
            hit = bvh.ray_cast(Vector((x, -z, y + 0.5)), Vector((0, 0, -1)))
            if hit[0] is not None and (best is None or hit[0].z - y > best[0]):
                best = (hit[0].z - y, hit[0].z, y)
        out.append([round(route.h[i], 4), round(best[2], 4), round(best[1], 4)] if best else None)
    return out


def export_glb(path, objects):
    """Static GLB, vertex colours only and no normals: the runtime material is flat shaded from screen derivatives."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
        export_animations=False, export_skins=False, export_materials="EXPORT", export_image_format="NONE",
        export_cameras=False, export_lights=False, export_normals=False, export_tangents=False,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
        export_meshopt_compression_enable=True)


def main():
    _, out_dir, manifest = _ARGS[:3]
    specs = _INPUT["bridges"]
    os.makedirs(out_dir, exist_ok=True)
    stats = {}
    for spec in specs:
        lib.reset_scene()
        clay._MAT.clear()
        material = clay.vertex_material("bridge-stone", 0.9)
        obj, route = build_bridge(spec, material)
        path = os.path.join(out_dir, spec["id"] + ".glb")
        export_glb(path, [obj])
        tris = clay.tri_count(obj)
        ext, lo, hi = clay.extents_px([obj])
        stats[spec["id"]] = dict(tris=tris, bytes=os.path.getsize(path), openings=spec["openings"],
                                 deckRays=measure_deck(obj, spec, route),
                                 min=[round(lo.x, 3), round(lo.z, 3), round(-hi.y, 3)],
                                 max=[round(hi.x, 3), round(hi.z, 3), round(-lo.y, 3)])
        print(f"  {spec['id']:16s} tris {tris:5d} bytes {stats[spec['id']]['bytes']:6d}")
    with open(manifest, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=1)


main()
