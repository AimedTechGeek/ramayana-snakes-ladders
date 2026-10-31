"""T44.3 board diorama: oak plinth, soil-strata slab, brass rail/posts, and the 14 block variants -> one GLB.

Run (headless):  node scripts/blender/run.mjs scripts/blender/board.py public/models/board/board.glb

Everything is authored in THREE axes (x right, y up, z toward the viewer; 1 unit = one block pitch) and mapped to
Blender's Z-up at vertex creation (a pure rotation, so winding is kept). Colours are flat per face (corner-domain
colour attribute "Color") with a little value jitter and an analytic ambient-occlusion factor, so the exported GLB has
COLOR_0 only: no textures.

Layout (matches src/app/board3d/boardLayout.ts):
  field plate top y = 0; slab spans y in [-0.90, 0]; plinth y in [-1.35, -0.90]; block tops are y = height.
  Block meshes are built with their top at BLOCK_H0 and their base at 0; the vertex shader slides the top region by
  (height - BLOCK_H0) per instance, so one mesh serves every height.

Objects exported: Plinth, Slab, Brass, Block_<region>_<a|b> (14 blocks, 2 per region).
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import export  # noqa: E402
import lib  # noqa: E402

BLOCK_H0 = 0.30      # authored block height (top ring at this y)
BLOCK_HALF = 0.46    # block half width: 0.92 top, 0.08 groove
SLAB_HALF = 6.3
SLAB_H = 0.90
PLINTH_HALF = 6.8
PLINTH_BOTTOM = -1.35
PLINTH_TOP = -0.90
LEDGE = (6.8, 8.2, 4.8, 6.8)  # x0, x1, z0, z1 of the dice-tray ledge (front-right)
REGIONS = ("mithila", "ayodhya", "dandaka", "ganga", "kishkindha", "sea", "lanka")

random.seed(44)


# ---------------------------------------------------------------- tiny geometry kit (three axes in, Blender out)

def tb(x, y, z):
    """three (x right, y up, z toward viewer) -> Blender (x, -z, y)."""
    return Vector((x, -z, y))


def clamp01(v):
    return max(0.0, min(1.0, v))


def hex_lin(h, jitter=0.0, ao=1.0):
    r, g, b = lib.hex_to_linear(h)
    k = ao * (1.0 + (random.random() * 2.0 - 1.0) * jitter)
    return (r * k, g * k, b * k, 1.0)


class Part:
    """One bmesh with a corner colour layer. Faces are added with a colour; outward direction is auto-oriented."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Color")
        self.vcol = {}  # per-vertex colour (smooth parts share vertices, so the GLB stays small)

    def v(self, x, y, z, colour=None):
        vert = self.bm.verts.new(tb(x, y, z))
        if colour is not None:
            self.vcol[vert] = colour
        return vert

    def face(self, verts, colour, hint=None, smooth=True):
        f = self.bm.faces.new(verts)
        f.normal_update()
        if hint is not None:
            hb = tb(*hint) - tb(0, 0, 0)
            if f.normal.dot(hb) < 0:
                f.normal_flip()
        f.smooth = smooth
        for loop in f.loops:
            loop[self.col] = self.vcol.get(loop.vert, colour)
        return f

    def paint_verts(self, verts, fn):
        """Smooth part: colour each vertex with fn(vert) and push it to every face corner."""
        for vert in verts:
            self.vcol[vert] = fn(vert)
        for f in {f for vert in verts for f in vert.link_faces}:
            f.smooth = True
            for loop in f.loops:
                if loop.vert in self.vcol:
                    loop[self.col] = self.vcol[loop.vert]

    def recolour_face(self, f, colour):
        for loop in f.loops:
            loop[self.col] = colour

    # ---- primitives (already coloured)
    def box(self, c, size, hex_, jitter=0.03, ao_bottom=1.0, bevel=0.0):
        cx, cy, cz = c
        sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
        pts = {}
        for ix in (-1, 1):
            for iy in (-1, 1):
                for iz in (-1, 1):
                    pts[(ix, iy, iz)] = self.v(cx + ix * sx, cy + iy * sy, cz + iz * sz)
        for axis, sign in ((0, 1), (0, -1), (1, 1), (1, -1), (2, 1), (2, -1)):
            vs = []
            for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                key = [0, 0, 0]
                key[axis] = sign
                key[(axis + 1) % 3] = a
                key[(axis + 2) % 3] = b
                vs.append(pts[tuple(key)])
            hint = [0, 0, 0]
            hint[axis] = sign
            ao = ao_bottom if (axis == 1 and sign == -1) else 1.0
            self.face(vs, hex_lin(hex_, jitter, ao), tuple(hint), smooth=False)

    def blob(self, c, radii, hex_, subdiv=1, jitter=0.04, rot_y=0.0, ao_bottom=0.8):
        """Squashed icosphere. subdiv 0 = 20 tris, 1 = 80 tris."""
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0)
        verts = res["verts"]
        for vert in verts:
            p = vert.co
            p = Vector((p.x * radii[0], p.y * radii[2], p.z * radii[1]))  # blender (x, y(=-z three), z(=y three))
            if rot_y:
                p = Matrix.Rotation(rot_y, 3, "Z") @ p
            vert.co = p + tb(*c)
        def paint(vert):
            ao = 1.0 - (1.0 - ao_bottom) * clamp01(0.5 - vert.co.z / max(radii[1], 1e-4) * 0.5)
            return hex_lin(hex_, jitter, ao)
        self.paint_verts(verts, paint)

    def cone(self, c, r, h, hex_, seg=5, tilt=(0.0, 0.0), r2=0.0, jitter=0.05):
        """Upright cone/cylinder with its base centre at c (three coords)."""
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                    radius1=r, radius2=r2, depth=h)
        verts = res["verts"]
        for vert in verts:
            p = vert.co.copy()
            p.z += h / 2
            # tilt: lean the top toward (tx, tz) three offsets proportional to height
            k = p.z / h if h else 0
            p.x += tilt[0] * k
            p.y += -tilt[1] * k
            vert.co = p + tb(*c)
        self.paint_verts(verts, lambda vert: hex_lin(hex_, jitter))

    def cyl(self, p0, p1, r, hex_, seg=8, jitter=0.0):
        a, b = tb(*p0), tb(*p1)
        d = b - a
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                    radius1=r, radius2=r, depth=d.length)
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        mat = Matrix.Translation((a + b) / 2) @ rot
        bmesh.ops.transform(self.bm, matrix=mat, verts=res["verts"])
        self.paint_verts(res["verts"], lambda vert: hex_lin(hex_, jitter))

    def finish(self, material, bevel=None):
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        mesh.materials.append(material)
        mesh.color_attributes.active_color = mesh.color_attributes["Color"]
        mesh.color_attributes.render_color_index = mesh.color_attributes.find("Color")
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if bevel:
            width, segs, angle = bevel
            mod = obj.modifiers.new("Bevel", "BEVEL")
            mod.width = width
            mod.segments = segs
            mod.limit_method = "ANGLE"
            mod.angle_limit = angle
            dg = bpy.context.evaluated_depsgraph_get()
            new_mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
            obj.modifiers.remove(mod)
            old = obj.data
            obj.data = new_mesh
            bpy.data.meshes.remove(old)
            new_mesh.color_attributes.active_color = new_mesh.color_attributes["Color"]
            new_mesh.color_attributes.render_color_index = new_mesh.color_attributes.find("Color")
        keep = obj.data.color_attributes["Color"]
        for attr in list(obj.data.color_attributes):
            if attr.name != keep.name:
                obj.data.color_attributes.remove(attr)
        obj.data.name = self.name
        return obj


_MAT_CACHE = {}


def attr_material(name, rough=0.92, metal=0.0, tint=None):
    """Principled BSDF fed by the "Color" colour attribute (exports as COLOR_0), or a flat tint."""
    if name in _MAT_CACHE:
        return _MAT_CACHE[name]
    mat = bpy.data.materials.new(name)
    _MAT_CACHE[name] = mat
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if tint:
        r, g, b = lib.hex_to_linear(tint)
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    else:
        node = nodes.new("ShaderNodeVertexColor")
        node.layer_name = "Color"
        links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


# ---------------------------------------------------------------- noise

def vnoise(x, seed=0.0):
    """Smooth 1-D value noise in [0, 1] (deterministic)."""
    def h(i):
        return (math.sin(i * 127.1 + seed * 311.7) * 43758.5453) % 1.0
    i = math.floor(x)
    f = x - i
    f = f * f * (3 - 2 * f)
    return h(i) * (1 - f) + h(i + 1) * f


# ---------------------------------------------------------------- rounded-rectangle loops

def rrect(half, r, n, seg):
    """CCW loop (x, z, nx, nz) of a rounded square (half width `half`, corner radius `r`), seen from above.
    n straight samples per side (>=1), seg arc segments per corner. The point count depends only on (n, seg)."""
    h = half - r
    pts = []
    corners = [((h, h), 0.0), ((-h, h), 90.0), ((-h, -h), 180.0), ((h, -h), 270.0)]
    # three-space: x right, z toward viewer. Walk: east side (+x) from z=-h..h?  Use angle in the x-z plane.
    for (cx, cz), start in corners:
        for k in range(seg + 1):
            a = math.radians(start + 90.0 * k / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a), math.cos(a), math.sin(a)))
        # straight run to the next corner (exclusive of both ends)
    # Assemble with the straights between arcs.
    out = []
    for i in range(4):
        arc = pts[i * (seg + 1):(i + 1) * (seg + 1)]
        out.extend(arc)
        nxt = pts[((i + 1) % 4) * (seg + 1)]
        last = arc[-1]
        for k in range(1, n):
            t = k / n
            out.append((last[0] + (nxt[0] - last[0]) * t, last[1] + (nxt[1] - last[1]) * t, last[2], last[3]))
    return out


def perimeter_s(loop):
    """Cumulative arc length along a loop (for along-edge noise)."""
    s = [0.0]
    for i in range(1, len(loop)):
        s.append(s[-1] + math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]))
    return s


def side_of(nx, nz):
    if abs(nz) >= abs(nx):
        return "S" if nz > 0 else "N"
    return "E" if nx > 0 else "W"


# ---------------------------------------------------------------- board grid facts (python twin of layout.ts)

def grid_of(square):
    idx = square - 1
    row = idx // 12
    off = idx % 12
    return row, (off if row % 2 == 0 else 11 - off)


def region_of(square):
    if square in (49, 50, 71, 72, 73, 74):
        return "ganga"
    if square <= 36:
        return "mithila"
    if square <= 48:
        return "ayodhya"
    if square <= 84:
        return "dandaka"
    if square <= 108:
        return "kishkindha"
    if square <= 120:
        return "sea"
    return "lanka"


def square_centre(square):
    row, col = grid_of(square)
    return col - 5.5, 5.5 - row


def water_edges():
    """{side: [(lo, hi), ...]} along-edge ranges (x for N/S, z for E/W) where a water block touches the slab edge."""
    out = {"S": [], "N": [], "E": [], "W": []}
    for sq in range(1, 145):
        if region_of(sq) not in ("ganga", "sea"):
            continue
        row, col = grid_of(sq)
        x, z = square_centre(sq)
        if row == 0:
            out["S"].append((x - 0.5, x + 0.5))
        if row == 11:
            out["N"].append((x - 0.5, x + 0.5))
        if col == 0:
            out["W"].append((z - 0.5, z + 0.5))
        if col == 11:
            out["E"].append((z - 0.5, z + 0.5))
    return out


# ---------------------------------------------------------------- slab (soil cross-section)

BANDS = [  # name, thickness
    ("grass", 0.06), ("topsoil", 0.16), ("loam", 0.24), ("stone", 0.30), ("bedrock", 0.14),
]
STRATA = {
    "grass": {"S": "#7FC060", "N": "#78B85C", "E": "#78B85C", "W": "#78B85C"},
    "topsoil": {"S": "#684A32", "N": "#5E4230", "E": "#5E4230", "W": "#5E4230"},
    "loam": {"S": "#BC8D58", "N": "#8A7360", "E": "#B0845A", "W": "#B0845A"},
    "stone": {"S": "#8E8A80", "N": "#6D6973", "E": "#8E8A80", "W": "#8E8A80"},
    "bedrock": {"S": "#5B5652", "N": "#5B5652", "E": "#5B5652", "W": "#5B5652"},
}
LENS_WATER = "#78BBD2"
LENS_SAND = "#D9C9A0"


def build_slab():
    part = Part("Slab")
    n, seg = 64, 5
    loop = rrect(SLAB_HALF, 0.16, n, seg)
    count = len(loop)
    arc = perimeter_s(loop)
    water = water_edges()

    boundaries = [0.0]
    for _, t in BANDS:
        boundaries.append(boundaries[-1] - t)

    def offset(k, bkey, prof):
        """Outward displacement; `bkey` identifies the boundary (or mid) row so neighbouring bands agree."""
        s = arc[k]
        return (0.018 * prof + 0.034 * (vnoise(s * 1.7, bkey * 3.1) - 0.5)
                + 0.012 * (vnoise(s * 6.0, bkey) - 0.5) + 0.01)

    def in_lens(side, px, pz):
        along = pz if side in ("E", "W") else px
        return any(lo + 0.02 < along < hi - 0.02 for lo, hi in water[side])

    def band_colour(bi, k, yv):
        px, pz, nx, nz = loop[k]
        side = side_of(nx, nz)
        name = BANDS[bi][0]
        hexv = STRATA[name][side]
        if name == "grass" and side == "N" and px < -2.3:
            hexv = "#6F6A66"  # scorched near the throne corner
        if in_lens(side, px, pz):
            if yv > -0.12:
                hexv = LENS_WATER
            elif yv > -0.2:
                hexv = LENS_SAND
        ao = 0.84 + 0.16 * clamp01((yv + SLAB_H) / SLAB_H)
        return hex_lin(hexv, 0.05, ao)

    for bi in range(len(BANDS)):
        top, bot = boundaries[bi], boundaries[bi + 1]
        rows = []
        for ri, (yv, prof, bkey) in enumerate(((top, 0.0, bi), ((top + bot) / 2, 1.0, bi + 0.5), (bot, 0.0, bi + 1))):
            vs = []
            for k, (px, pz, nx, nz) in enumerate(loop):
                o = 0.0 if (bi == 0 and ri == 0) else offset(k, bkey, prof)
                if yv > -0.19 and not (bi == 0 and ri == 0) and in_lens(side_of(nx, nz), px, pz):
                    o = -0.025
                vs.append(part.v(px + nx * o, yv, pz + nz * o, colour=band_colour(bi, k, yv)))
            rows.append(vs)
        for ri in range(2):
            for k in range(count):
                k2 = (k + 1) % count
                part.face([rows[ri][k], rows[ri][k2], rows[ri + 1][k2], rows[ri + 1][k]],
                          None, (loop[k][2], 0, loop[k][3]))
    bottom = [part.v(px, -SLAB_H, pz, colour=hex_lin("#5B5652")) for px, pz, _, _ in loop]
    part.face(bottom, None, (0, -1, 0))

    # top: stone field plate (flat) + grass rim strip stitched to the rounded outline
    inner = 6.0
    rim = hex_lin("#8CC46A", 0.04)
    plate_col = hex_lin("#8F8062", 0.02, 0.9)
    plate = [part.v(cx, 0.0, cz, colour=plate_col)
             for cx, cz in ((inner, inner), (-inner, inner), (-inner, -inner), (inner, -inner))]
    part.face(plate, None, (0, 1, 0))
    outer_top = [part.v(px, 0.0, pz, colour=rim) for px, pz, _, _ in loop]
    inner_pts = [part.v(max(-inner, min(inner, px)), 0.0, max(-inner, min(inner, pz)), colour=rim)
                 for px, pz, _, _ in loop]
    for k in range(count):
        k2 = (k + 1) % count
        if (inner_pts[k].co - inner_pts[k2].co).length < 1e-6:
            part.face([outer_top[k], outer_top[k2], inner_pts[k]], None, (0, 1, 0))
        else:
            part.face([outer_top[k], outer_top[k2], inner_pts[k2], inner_pts[k]], None, (0, 1, 0))

    # ---- detail: pebbles (stone band), roots (E/W), embers (N)
    stone_top, stone_bot = boundaries[3], boundaries[4]
    sides = {"S": (0, 1), "N": (0, -1), "E": (1, 0), "W": (-1, 0)}
    for side, (nx, nz) in sides.items():
        for _ in range(30):
            along = random.uniform(-SLAB_HALF + 0.4, SLAB_HALF - 0.4)
            yv = random.uniform(stone_bot + 0.03, stone_top - 0.03)
            r = random.uniform(0.018, 0.04)
            if nz:
                c, radii = (along, yv, nz * (SLAB_HALF + 0.004)), (r * 1.4, r, r * 0.7)
            else:
                c, radii = (nx * (SLAB_HALF + 0.004), yv, along), (r * 0.7, r, r * 1.4)
            part.blob(c, radii, "#6F6A66", subdiv=0, ao_bottom=0.85)
    for side in ("E", "W"):
        nx = sides[side][0]
        for i in range(6):
            along = -5.2 + i * 2.1 + random.uniform(-0.3, 0.3)
            part.cone((nx * (SLAB_HALF + 0.004), boundaries[1] - 0.04, along), 0.018, 0.1, "#5B4030", seg=4,
                      tilt=(nx * 0.07, 0.0), jitter=0.06)
    for i, along in enumerate((-4.3, -1.1, 3.0)):
        part.blob((along, (stone_top + stone_bot) / 2 + (i - 1) * 0.04, -(SLAB_HALF + 0.003)),
                  (0.03, 0.03, 0.012), "#F39C2B", subdiv=0, jitter=0.0, ao_bottom=1.0)

    return part.finish(attr_material("clay"))


# ---------------------------------------------------------------- plinth

OAK_TOP = "#C9A77E"
OAK_SIDE = "#B08A5E"


def build_plinth():
    part = Part("Plinth")
    tiers = [  # half, y bottom, y top
        (PLINTH_HALF, PLINTH_BOTTOM, -1.07),
        (PLINTH_HALF - 0.2, -1.07, PLINTH_TOP),
    ]
    loops = [rrect(h, 0.14, 12, 4) for h, _, _ in tiers]
    count = len(loops[0])

    def grain(y, k):
        stripe = 0.035 * math.sin(k * 0.9) + 0.03 * (vnoise(k * 0.35, y * 9) - 0.5)
        return hex_lin(OAK_SIDE, 0.03, (0.86 + 0.14 * clamp01((y - PLINTH_BOTTOM) / 0.45)) * (1 + stripe))

    oak_top = hex_lin(OAK_TOP, 0.03, 0.97)
    for ti, (half, yb, yt) in enumerate(tiers):
        loop = loops[ti]
        rows = [yb, yb + 0.03, yt - 0.03, yt]
        insets = [0.04, 0.0, 0.0, 0.03]  # soft top and bottom edges
        ring = [[part.v(px - nx * insets[ri], y, pz - nz * insets[ri], colour=grain(y, k))
                 for k, (px, pz, nx, nz) in enumerate(loop)] for ri, y in enumerate(rows)]
        for ri in range(3):
            for k in range(count):
                k2 = (k + 1) % count
                part.face([ring[ri][k], ring[ri][k2], ring[ri + 1][k2], ring[ri + 1][k]], None,
                          (loop[k][2], 0, loop[k][3]))
        top = [part.v(px - nx * insets[3], yt, pz - nz * insets[3], colour=oak_top) for px, pz, nx, nz in loop]
        if ti == 0:
            upper = loops[1]
            inner = [part.v(px - nx * 0.04, yt, pz - nz * 0.04, colour=oak_top) for px, pz, nx, nz in upper]
            for k in range(count):
                k2 = (k + 1) % count
                part.face([top[k], top[k2], inner[k2], inner[k]], None, (0, 1, 0))
        else:
            fan = part.v(0.0, yt, 0.0, colour=oak_top)
            for k in range(count):
                k2 = (k + 1) % count
                part.face([top[k], top[k2], fan], None, (0, 1, 0))
    # ledge for the dice tray (front-right): an oak block joined to the plinth, with a darker inset well
    x0, x1, z0, z1 = LEDGE
    part.box(((x0 + x1) / 2 - 0.1, (PLINTH_BOTTOM + PLINTH_TOP) / 2, (z0 + z1) / 2),
             (x1 - x0 + 0.2, PLINTH_TOP - PLINTH_BOTTOM, z1 - z0), OAK_SIDE, jitter=0.04)
    part.box(((x0 + x1) / 2 + 0.05, PLINTH_TOP + 0.002, (z0 + z1) / 2), (1.15, 0.008, 1.7), "#A58058", jitter=0.02)
    return part.finish(attr_material("clay"), bevel=(0.03, 2, math.radians(55)))


# ---------------------------------------------------------------- brass

def build_brass():
    part = Part("Brass")
    brass = "#C9A24A"
    p = PLINTH_HALF - 0.25
    for sx in (-1, 1):
        for sz in (-1, 1):
            part.cyl((sx * p, PLINTH_TOP, sz * p), (sx * p, 0.5, sz * p), 0.05, brass, seg=10)
            part.cyl((sx * p, PLINTH_TOP, sz * p), (sx * p, PLINTH_TOP + 0.1, sz * p), 0.085, brass, seg=10)
            part.blob((sx * p, 0.58, sz * p), (0.075, 0.075, 0.075), brass, subdiv=1, jitter=0.0, ao_bottom=1.0)
    # rail around the slab top edge
    r = SLAB_HALF - 0.04
    pts = [(-r, 0.035, -r), (r, 0.035, -r), (r, 0.035, r), (-r, 0.035, r)]
    for i in range(4):
        part.cyl(pts[i], pts[(i + 1) % 4], 0.03, brass, seg=8)
        part.blob(pts[i], (0.04, 0.04, 0.04), brass, subdiv=1, jitter=0.0, ao_bottom=1.0)
    # maker's plate on the front face of the plinth (no text)
    part.box((0.0, (PLINTH_BOTTOM + -1.07) / 2 + 0.02, PLINTH_HALF + 0.012), (0.9, 0.2, 0.03), brass, jitter=0.0)
    return part.finish(attr_material("brass", rough=0.35, metal=0.9, tint=brass), bevel=(0.008, 2, math.radians(50)))


# ---------------------------------------------------------------- blocks

INLAY = BLOCK_H0 + 0.006


def inlay(part, cx, cz, sx, sz, hex_, lift=0.006, jitter=0.02):
    part.box((cx, BLOCK_H0 + lift / 2 - 0.004, cz), (sx, lift + 0.008, sz), hex_, jitter=jitter)


def build_block_body(part, base_hex, seed, jitter=0.035):
    """Top grid (rolled edge by the bevel pass) + three wall rows with AO toward the bottom. Per-vertex colours."""
    seg = 4
    h = BLOCK_HALF
    rnd = random.Random(seed)
    grid = []
    for i in range(seg + 1):
        row = []
        for j in range(seg + 1):
            x = -h + 2 * h * i / seg
            z = -h + 2 * h * j / seg
            edge = i in (0, seg) or j in (0, seg)
            dy = 0.0 if edge else (rnd.random() - 0.5) * 0.016
            d = min(i, seg - i, j, seg - j)
            ao = 0.86 + 0.14 * min(1.0, d / 1.0)  # soft darkening toward the rolled edge
            row.append(part.v(x, BLOCK_H0 + dy, z, colour=hex_lin(base_hex, jitter, ao)))
        grid.append(row)
    for i in range(seg):
        for j in range(seg):
            part.face([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]], None, (0, 1, 0))
    loop = [(i, 0) for i in range(seg)] + [(seg, j) for j in range(seg)] \
        + [(i, seg) for i in range(seg, 0, -1)] + [(0, j) for j in range(seg, 0, -1)]
    ys = [BLOCK_H0, 0.15, 0.0]
    aos = [1.0, 0.9, 0.78]
    top_ring = [grid[i][j] for i, j in loop]
    rings = [top_ring]
    for ri in range(1, len(ys)):
        rings.append([part.v(vt.co.x, ys[ri], -vt.co.y, colour=hex_lin(base_hex, jitter, aos[ri]))
                      for vt in top_ring])
    n = len(loop)
    for ri in range(len(ys) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            i, j = loop[k]
            nx = nz = 0.0
            if j == 0 and i < seg:
                nz = -1
            elif i == seg and j < seg:
                nx = 1
            elif j == seg:
                nz = 1
            else:
                nx = -1
            part.face([rings[ri][k], rings[ri][k2], rings[ri + 1][k2], rings[ri + 1][k]], None, (nx, 0, nz))


def tufts(part, rnd, n, hex_, pos_fn=None, h=0.07, r=0.035):
    for _ in range(n):
        x, z = pos_fn(rnd) if pos_fn else (rnd.uniform(-0.38, 0.38), rnd.uniform(-0.38, 0.38))
        part.cone((x, BLOCK_H0 - 0.005, z), r, h, hex_, seg=4, r2=0.004, tilt=(rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02)))


def corner_pos(rnd):
    return (rnd.choice((-1, 1)) * rnd.uniform(0.3, 0.4), rnd.choice((-1, 1)) * rnd.uniform(0.3, 0.4))


def detail_mithila(part, pat, rnd):
    if pat == "a":
        inlay(part, 0.0, 0.12, 0.92, 0.15, "#F3E3B8")
        tufts(part, rnd, 3, "#8FBE6E", lambda r: (r.uniform(-0.38, 0.38), r.uniform(-0.4, -0.2)))
        part.blob((-0.3, BLOCK_H0 + 0.01, -0.28), (0.022, 0.022, 0.022), "#F39C2B", subdiv=0, jitter=0.0)
        part.blob((0.32, BLOCK_H0 + 0.01, -0.3), (0.02, 0.02, 0.02), "#FFF8EA", subdiv=0, jitter=0.0)
    else:
        inlay(part, -0.12, 0.0, 0.15, 0.92, "#F3E3B8")
        tufts(part, rnd, 3, "#8FBE6E", lambda r: (r.uniform(0.15, 0.4), r.uniform(-0.38, 0.38)))
        part.blob((0.32, BLOCK_H0 + 0.01, 0.3), (0.022, 0.022, 0.022), "#E9C12F", subdiv=0, jitter=0.0)


def detail_ayodhya(part, pat, rnd):
    g, seam = "#E9C12F", "#C9B07A"
    if pat == "a":
        for s in (-1, 1):
            inlay(part, 0.0, s * 0.37, 0.8, 0.035, g)
            inlay(part, s * 0.37, 0.0, 0.035, 0.8, g)
        inlay(part, 0.0, 0.0, 0.2, 0.2, "#EFD9A0", lift=0.004)
        part.blob((0.0, BLOCK_H0 + 0.012, 0.0), (0.045, 0.012, 0.045), g, subdiv=1, jitter=0.0)
    else:
        for c in (-0.23, 0.23):
            inlay(part, c, 0.0, 0.012, 0.88, seam, lift=0.003)
            inlay(part, 0.0, c, 0.88, 0.012, seam, lift=0.003)
        inlay(part, 0.0, 0.0, 0.88, 0.012, seam, lift=0.003)
        inlay(part, 0.0, 0.0, 0.012, 0.88, seam, lift=0.003)
        for sx in (-1, 1):
            for sz in (-1, 1):
                part.blob((sx * 0.4, BLOCK_H0 + 0.008, sz * 0.4), (0.025, 0.012, 0.025), g, subdiv=0, jitter=0.0)


def detail_dandaka(part, pat, rnd):
    moss = "#7FAE6A"
    root = "#7A5A3A"
    if pat == "a":
        for _ in range(3):
            part.blob((rnd.uniform(-0.3, 0.3), BLOCK_H0 + 0.004, rnd.uniform(-0.3, 0.3)),
                      (rnd.uniform(0.07, 0.12), rnd.uniform(0.07, 0.12), 0.018), moss, subdiv=1, jitter=0.06)
        part.cyl((-0.42, BLOCK_H0 + 0.005, 0.25), (0.05, BLOCK_H0 + 0.012, 0.32), 0.022, root, seg=5, jitter=0.05)
        part.cyl((0.05, BLOCK_H0 + 0.012, 0.32), (0.34, BLOCK_H0 + 0.004, 0.1), 0.016, root, seg=5, jitter=0.05)
    else:
        tufts(part, rnd, 4, "#5F8D4D", corner_pos, h=0.1, r=0.03)
        part.blob((0.1, BLOCK_H0 + 0.004, -0.1), (0.1, 0.08, 0.02), moss, subdiv=1, jitter=0.06)
        part.cyl((0.42, BLOCK_H0 + 0.005, -0.3), (0.0, BLOCK_H0 + 0.012, -0.2), 0.02, root, seg=5, jitter=0.05)


def detail_ganga(part, pat, rnd):
    sand = "#D9C9A0"
    if pat == "a":
        inlay(part, -0.4, 0.0, 0.08, 0.92, sand, lift=0.003)
        tufts(part, rnd, 4, "#7FAE6A", lambda r: (r.uniform(-0.42, -0.3), r.uniform(-0.4, 0.4)), h=0.16, r=0.012)
    else:
        inlay(part, 0.4, 0.0, 0.08, 0.92, sand, lift=0.003)
        tufts(part, rnd, 4, "#7FAE6A", lambda r: (r.uniform(0.3, 0.42), r.uniform(-0.4, 0.4)), h=0.16, r=0.012)


def detail_kish(part, pat, rnd):
    boulder, crev = "#B8906A", "#9C6A3E"
    if pat == "a":
        part.cyl((-0.4, BLOCK_H0 + 0.003, -0.2), (0.4, BLOCK_H0 + 0.003, 0.25), 0.02, crev, seg=4)
        part.blob((0.22, BLOCK_H0 + 0.02, -0.25), (0.12, 0.1, 0.07), boulder, subdiv=1, jitter=0.05)
        part.blob((-0.28, BLOCK_H0 + 0.015, 0.28), (0.07, 0.06, 0.05), boulder, subdiv=0, jitter=0.05)
    else:
        part.cyl((-0.35, BLOCK_H0 + 0.003, 0.3), (0.38, BLOCK_H0 + 0.003, -0.15), 0.02, crev, seg=4)
        part.blob((-0.2, BLOCK_H0 + 0.02, -0.22), (0.1, 0.09, 0.07), boulder, subdiv=1, jitter=0.05)
        part.blob((0.3, BLOCK_H0 + 0.012, 0.28), (0.06, 0.07, 0.05), boulder, subdiv=0, jitter=0.05)


def detail_sea(part, pat, rnd):
    rock = "#8E8A80"
    if pat == "a":
        part.blob((0.3, BLOCK_H0 + 0.03, -0.3), (0.1, 0.07, 0.1), rock, subdiv=1, jitter=0.05)
        part.blob((0.3, BLOCK_H0 + 0.1, -0.3), (0.06, 0.05, 0.06), rock, subdiv=1, jitter=0.05)
    else:
        part.blob((-0.32, BLOCK_H0 + 0.025, 0.3), (0.09, 0.06, 0.08), rock, subdiv=1, jitter=0.05)
        part.blob((-0.12, BLOCK_H0 + 0.012, 0.36), (0.04, 0.03, 0.04), "#F3E3B8", subdiv=0, jitter=0.03)


def detail_lanka(part, pat, rnd):
    gold = "#E9C12F"
    if pat == "a":
        for a in (45, -45):
            part.cyl((-0.4 * math.cos(math.radians(a)), BLOCK_H0 + 0.004, -0.4 * math.sin(math.radians(a))),
                     (0.4 * math.cos(math.radians(a)), BLOCK_H0 + 0.004, 0.4 * math.sin(math.radians(a))),
                     0.012, gold, seg=4)
        part.blob((0.0, BLOCK_H0 + 0.014, 0.0), (0.05, 0.02, 0.05), gold, subdiv=1, jitter=0.0)
    else:
        for s in (-1, 1):
            inlay(part, 0.0, s * 0.33, 0.78, 0.022, gold, lift=0.004)
            inlay(part, s * 0.33, 0.0, 0.022, 0.78, gold, lift=0.004)
    for sx in (-1, 1):
        part.cone((sx * 0.4, BLOCK_H0 - 0.005, -0.4), 0.018, 0.06, gold, seg=6)
        part.blob((sx * 0.4, BLOCK_H0 + 0.07, -0.4), (0.025, 0.025, 0.025), "#F39C2B", subdiv=0, jitter=0.0)


DETAIL = {
    "mithila": (detail_mithila, {"a": "#A8CF86", "b": "#B3D492"}),
    "ayodhya": (detail_ayodhya, {"a": "#EAD3A3", "b": "#E2C892"}),
    "dandaka": (detail_dandaka, {"a": "#6B9A58", "b": "#6B9A58"}),
    "ganga": (detail_ganga, {"a": "#5A8FA6", "b": "#5A8FA6"}),
    "kishkindha": (detail_kish, {"a": "#D9AB78", "b": "#D0A06C"}),
    "sea": (detail_sea, {"a": "#4F93B3", "b": "#4F93B3"}),
    "lanka": (detail_lanka, {"a": "#4D528F", "b": "#454A86"}),
}


def build_block(region, pat):
    name = f"Block_{region}_{pat}"
    part = Part(name)
    fn, bases = DETAIL[region]
    seed = (REGIONS.index(region) * 7 + (1 if pat == "b" else 0)) * 101 + 13
    build_block_body(part, bases[pat], seed)
    obj = part.finish(attr_material("clay"), bevel=(0.03, 2, math.radians(50)))
    # detail is added after the bevel so thin inlays stay crisp
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    detail = Part(name + "_d")
    detail.bm = bm
    detail.col = bm.loops.layers.float_color["Color"]
    fn(detail, pat, random.Random(seed))
    mesh = obj.data
    bm.to_mesh(mesh)
    bm.free()
    mesh.color_attributes.active_color = mesh.color_attributes["Color"]
    mesh.color_attributes.render_color_index = mesh.color_attributes.find("Color")
    return obj


# ---------------------------------------------------------------- main

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not argv:
        print("usage: board.py <out.glb> [--metrics file.json]")
        sys.exit(2)
    out = argv[0]
    metrics = argv[argv.index("--metrics") + 1] if "--metrics" in argv else None
    lib.reset_scene()
    objs = [build_plinth(), build_slab(), build_brass()]
    for region in REGIONS:
        for pat in ("a", "b"):
            objs.append(build_block(region, pat))
    stats = {o.name: lib.triangle_count(o) for o in objs}
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    export.export_glb(out, objs, export_all_vertex_colors=False, export_vertex_color="ACTIVE")
    stats["_bytes"] = os.path.getsize(out)
    print("board.py:", json.dumps(stats))
    if metrics:
        with open(metrics, "w") as fh:
            json.dump(stats, fh, indent=1)


main()
