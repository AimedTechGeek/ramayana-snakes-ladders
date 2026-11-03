"""T44.3 board diorama: oak plinth, soil-strata slab, brass rail/posts, and the 14 block variants -> one GLB.

Run (headless):  npm run blender:board  (scripts/blender/board-build.mjs writes the layout JSON and runs this)

Everything is authored in THREE axes (x right, y up, z toward the viewer; 1 unit = one block pitch) and mapped to
Blender's Z-up at vertex creation (a pure rotation, so winding is kept). Colours are flat per face (corner-domain
colour attribute "Color") with a little value jitter and an analytic ambient-occlusion factor, so the exported GLB has
COLOR_0 only: no textures.

Layout (matches src/app/board3d/boardLayout.ts):
  field plate top y = 0; slab spans y in [-0.90, 0]; plinth y in [-1.35, -0.90]; block tops are y = height.
  Block meshes are built with their top at BLOCK_H0 and their base at 0; the vertex shader slides the top region by
  (height - BLOCK_H0) per instance, so one mesh serves every height.

T45.1: rows 1..11 stand on terraces (heights, row-end stairs, the sea lip and the waterfall sheets come from
boardLayout.ts through board-build.mjs's scratch JSON, --layout); the terraces, stairs and lip are part of Slab.

Objects exported: Plinth, Slab, Brass, Waterfall, Block_<region>_<a|b> (14 blocks, 2 per region).
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

    def covered(side, pz):
        """T45.1: the terraces of rows 1..11 stand on the slab top, so its sides there carry no grass and no lens."""
        return side == "N" or (side in ("E", "W") and pz < 5.0)

    def in_lens(side, px, pz):
        if covered(side, pz):
            return False
        along = pz if side in ("E", "W") else px
        return any(lo + 0.02 < along < hi - 0.02 for lo, hi in water[side])

    def band_colour(bi, k, yv):
        px, pz, nx, nz = loop[k]
        side = side_of(nx, nz)
        name = BANDS[bi][0]
        if name == "grass" and covered(side, pz):
            name = "topsoil"
        hexv = STRATA[name][side]
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

    build_terraces(part, LAYOUT)
    build_stairs(part, LAYOUT)
    build_sea_lip(part, LAYOUT)
    return part.finish(attr_material("clay"))


# ---------------------------------------------------------------- terraces (T45.1)

LAYOUT = None  # board-build.mjs's scratch JSON (terraces, stairs, sea lip, falls), read in main()

# horizontal strata of the hill the terraces are cut from (absolute y, so the bands run on across the steps)
HILL_BANDS = [(0.0, "#A97C50"), (0.24, "#C29563"), (0.46, "#A3774D"), (0.72, "#BD9062"), (0.98, "#9F744B"),
              (1.24, "#B88B5E"), (1.5, "#9A7049"), (1.76, "#B3875B")]
CAP_GRASS = "#78B85C"
CAP_SCORCHED = "#6F6A66"
CAP_SOIL = "#5E4230"
CAP_LENS = "#78BBD2"


def hill_colour(y):
    hexv = HILL_BANDS[0][1]
    for y0, h in HILL_BANDS:
        if y >= y0:
            hexv = h
    return hexv


def side_bands(top, scorched, lens):
    """(y0, y1, hex) bands of a terrace side face from the slab top (0) to its tread `top`."""
    cap = [(top - 0.04, top, CAP_LENS if lens else (CAP_SCORCHED if scorched else CAP_GRASS)),
           (top - 0.12, top - 0.04, LENS_SAND if lens else CAP_SOIL)]
    cuts = sorted({0.0, *[y0 for y0, _ in HILL_BANDS if 0.0 < y0 < top - 0.12], top - 0.12})
    bands = []
    for a, b in zip(cuts, cuts[1:]):
        if b - a > 1e-4:
            bands.append((a, b, hill_colour(a + 1e-4)))
    return bands + cap


def quad(part, pts, hex_, hint, jitter=0.04, ao=1.0):
    part.face([part.v(*p) for p in pts], hex_lin(hex_, jitter, ao), hint, smooth=False)


def build_terraces(part, layout):
    """Rows 1..11 each stand on a soil terrace TERRACE_RISE above the row in front: a stone tread under the blocks,
    grass rims at the sides (and at the back of the top row), a front riser between the rows, and a staircase soil
    cross-section on the east, west and back faces."""
    terraces = layout["terraces"]
    lens = {(w["row"], w["side"]) for w in layout["edgeWater"]}
    xs = SLAB_HALF
    inner = 6.0
    plate = "#8F8062"
    for row in range(1, 12):
        top = terraces[row]
        below = terraces[row - 1]
        zf = 6.0 - row
        zb = -SLAB_HALF if row == 11 else 5.0 - row
        scorched = row >= 10
        rim_hex = CAP_SCORCHED if scorched else "#8CC46A"
        # tread: the stone plate under the blocks and the grass rims at the sides
        quad(part, [(-inner, top, zf), (inner, top, zf), (inner, top, max(zb, -inner)), (-inner, top, max(zb, -inner))],
             plate, (0, 1, 0), 0.02, 0.9)
        for sx in (-1, 1):
            wet = (row, "E" if sx > 0 else "W") in lens
            quad(part, [(sx * inner, top, zf), (sx * xs, top, zf), (sx * xs, top, zb), (sx * inner, top, zb)],
                 LENS_SAND if wet else rim_hex, (0, 1, 0))
        if row == 11:
            quad(part, [(-inner, top, -inner), (inner, top, -inner), (inner, top, zb), (-inner, top, zb)],
                 rim_hex, (0, 1, 0))
        # front riser between this row and the one in front
        for y0, y1, hexv in side_bands(top, scorched, False):
            if y1 <= below + 1e-4:
                continue
            quad(part, [(-xs, max(y0, below), zf), (xs, max(y0, below), zf), (xs, y1, zf), (-xs, y1, zf)],
                 hexv if y1 > top - 0.13 else CAP_SOIL, (0, 0, 1), 0.03, 0.92)
        # the cross-section: east and west faces, and the back of the top row
        for sx in (-1, 1):
            wet = (row, "E" if sx > 0 else "W") in lens
            for y0, y1, hexv in side_bands(top, scorched, wet):
                ao = 0.84 + 0.16 * clamp01((y0 + SLAB_H) / (SLAB_H + 2.0))
                quad(part, [(sx * xs, y0, zf), (sx * xs, y0, zb), (sx * xs, y1, zb), (sx * xs, y1, zf)],
                     hexv, (sx, 0, 0), 0.05, ao)
        if row == 11:
            for y0, y1, hexv in side_bands(top, scorched, False):
                quad(part, [(-xs, y0, zb), (xs, y0, zb), (xs, y1, zb), (-xs, y1, zb)], hexv, (0, 0, -1), 0.05, 0.9)


STAIR_STONE = {  # tread, riser by the region the flight climbs into
    "mithila": ("#E2D2B0", "#C2AC86"), "ayodhya": ("#EAD9AE", "#C9B07A"), "dandaka": ("#B9B49A", "#8F8B72"),
    "ganga": ("#C9C2A6", "#9E977C"), "kishkindha": ("#D6B48A", "#AE8762"), "sea": ("#C9C2A6", "#9E977C"),
    "lanka": ("#6A6FA6", "#4A4E80"),
}


def build_stairs(part, layout):
    """The row-end flights (boardLayout.ROW_END_STAIRS): tread k at yLow + k * rise, from the first riser on the
    lower block's back up to the upper block's front edge; cheeks reach down to the groove floor."""
    for s in layout["stairs"]:
        tread_hex, riser_hex = STAIR_STONE[s["region"]]
        n = s["steps"]
        x0, x1 = s["x"] - s["halfWidth"], s["x"] + s["halfWidth"]
        zb, zt = s["zBottom"], s["zTop"]
        depth = (zb - zt) / n
        rise = (s["yHigh"] - s["yLow"]) / n
        base = s["base"]
        for k in range(1, n + 1):
            za = zb - (k - 1) * depth
            zc = zt if k == n else zb - k * depth
            y = s["yLow"] + k * rise
            yprev = s["yLow"] - 0.02 if k == 1 else s["yLow"] + (k - 1) * rise
            quad(part, [(x0, y, za), (x1, y, za), (x1, y, zc), (x0, y, zc)], tread_hex, (0, 1, 0), 0.03)
            quad(part, [(x0, yprev, za), (x1, yprev, za), (x1, y, za), (x0, y, za)], riser_hex, (0, 0, 1), 0.03, 0.9)
            for xx, sx in ((x0, -1), (x1, 1)):
                quad(part, [(xx, base, za), (xx, base, zc), (xx, y, zc), (xx, y, za)], riser_hex, (sx, 0, 0), 0.03, 0.85)


def build_sea_lip(part, layout):
    """The sea row is a channel set into its terrace: a low stone dam in the groove in front of it, open where the
    108 -> 109 stair climbs in."""
    lip = layout["seaLip"]
    z, y0, y1 = lip["z"], lip["y0"], lip["y1"]
    gaps = sorted(lip["gaps"])
    spans, start = [], -SLAB_HALF
    for g0, g1 in gaps:
        spans.append((start, g0))
        start = g1
    spans.append((start, SLAB_HALF))
    for a, b in spans:
        if b - a > 0.02:
            part.box(((a + b) / 2, (y0 + y1) / 2, z), (b - a, y1 - y0, 0.07), "#9C9688", jitter=0.04)
            part.box(((a + b) / 2, y1 + 0.006, z), (b - a, 0.012, 0.075), "#B7B1A2", jitter=0.03)


def build_falls(layout):
    """Waterfalls (T45.1): sheets down the Ganga risers and over the board's sides at the sea channel's ends. Vertex
    colour runs light at the lip to foam at the foot; Board.tsx draws them with the animated waterfall shader."""
    part = Part("Waterfall")
    across_seg = 6
    for f in layout["falls"]:
        prof = f["profile"]
        rows = []
        for i, (n, y) in enumerate(prof):
            t = i / (len(prof) - 1)
            hexv = "#A7D8EA" if t < 0.2 else ("#F4F4F8" if t > 0.85 else "#78BBD2")
            row = []
            for j in range(across_seg + 1):
                a = f["a0"] + (f["a1"] - f["a0"]) * j / across_seg
                x, z = (a, n) if f["across"] == "x" else (n, a)
                row.append(part.v(x, y, z, colour=hex_lin(hexv, 0.0)))
            rows.append(row)
        for i in range(len(rows) - 1):
            for j in range(across_seg):
                part.face([rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]], None, None)
    return part.finish(attr_material("waterfall", rough=0.2))


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
    # ledge for the dice tray (front-right): an oak block joined to the plinth. The tray itself (teak, brass rim,
    # indigo felt) is die.glb's: an inset well here covered its felt (T44.14), so the ledge top stays plain oak.
    x0, x1, z0, z1 = LEDGE
    part.box(((x0 + x1) / 2 - 0.1, (PLINTH_BOTTOM + PLINTH_TOP) / 2, (z0 + z1) / 2),
             (x1 - x0 + 0.2, PLINTH_TOP - PLINTH_BOTTOM, z1 - z0), OAK_SIDE, jitter=0.04)
    return part.finish(attr_material("clay"), bevel=(0.03, 2, math.radians(55)))


# ---------------------------------------------------------------- brass

def build_brass(layout):
    part = Part("Brass")
    brass = "#C9A24A"
    p = PLINTH_HALF - 0.25
    terraces = layout["terraces"]
    back = terraces[-1]
    for sx in (-1, 1):
        for sz in (-1, 1):
            lift = back if sz < 0 else 0.0  # T45.1: the back posts stand clear of the top terrace
            part.cyl((sx * p, PLINTH_TOP, sz * p), (sx * p, 0.5 + lift, sz * p), 0.05, brass, seg=10)
            part.cyl((sx * p, PLINTH_TOP, sz * p), (sx * p, PLINTH_TOP + 0.1, sz * p), 0.085, brass, seg=10)
            part.blob((sx * p, 0.58 + lift, sz * p), (0.075, 0.075, 0.075), brass, subdiv=1, jitter=0.0, ao_bottom=1.0)
    # rail around the slab top edge; T45.1: on the east and west sides it climbs the terraces like a banister
    r = SLAB_HALF - 0.04
    y = 0.035
    runs = [[(-r, y, r), (r, y, r)], [(-r, back + y, -r), (r, back + y, -r)]]
    for sx in (-1, 1):
        pts = [(sx * r, y, r)]
        for row in range(1, 12):
            z = 6.0 - row + 0.03
            pts += [(sx * r, terraces[row - 1] + y, z), (sx * r, terraces[row] + y, z)]
        pts.append((sx * r, back + y, -r))
        runs.append(pts)
    for pts in runs:
        for a, b in zip(pts, pts[1:]):
            part.cyl(a, b, 0.03, brass, seg=8)
        for q in pts:
            part.blob(q, (0.04, 0.04, 0.04), brass, subdiv=0, jitter=0.0, ao_bottom=1.0)
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
        print("usage: board.py <out.glb> --layout layout.json [--metrics file.json]  (npm run blender:board)")
        sys.exit(2)
    out = argv[0]
    metrics = argv[argv.index("--metrics") + 1] if "--metrics" in argv else None
    global LAYOUT
    with open(argv[argv.index("--layout") + 1]) as fh:
        LAYOUT = json.load(fh)
    lib.reset_scene()
    objs = [build_plinth(), build_slab(), build_brass(LAYOUT), build_falls(LAYOUT)]
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
