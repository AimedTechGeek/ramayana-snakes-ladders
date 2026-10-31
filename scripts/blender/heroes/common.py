"""Shared parts of every hero build (Hanuman now; Rama, Sita, Lakshmana reuse this file unchanged).

What a hero script gets from here:
  * HERO_BONES  the one 31-bone T44 4.1 rig (same bone names for all four heroes; GLTFLoader strips the dots)
  * SCALE       1/56: design units (the figure is 80 tall) -> game units, so the GLB is in board units
  * ClayKit     MeshKit that paints vertex colours (one clay material, T44 1.2) + AO bake + colour jitter
  * face_patch  curved patch hugging head/cheeks/muzzle with UVs, textured at runtime from the face atlas
  * weight helpers (smooth_weights, limb_weights, chain weights)
  * export_hero build the skinned GLB with the clips, extras and a metrics/respect report (see motion.py)
Axes are Blender axes: +Z up, the character faces -Y, the character's LEFT is +X.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import lib  # noqa: E402

SCALE = 1.0 / 56.0
FPS = 24

# ---------------------------------------------------------------- the shared 31-bone rig (T44 4.1), design units


def _lr(bones, name, parent, head, tail):
    """Add name.L (+X) and name.R (-X); parent may be a template with a {s} side placeholder."""
    for side, sx in (("L", 1.0), ("R", -1.0)):
        p = parent.format(s=side) if parent else None
        bones[f"{name}.{side}"] = (p, (head[0] * sx, head[1], head[2]), (tail[0] * sx, tail[1], tail[2]))


def _hero_bones():
    b = {
        "root": (None, (0, 0, 0), (0, 4, 0)),
        "hips": ("root", (0, 0, 24.5), (0, 0, 28)),
        "spine": ("hips", (0, 0, 28), (0, 0, 38)),
        "chest": ("spine", (0, 0, 38), (0, 0, 50)),
        "neck": ("chest", (0, 0, 50), (0, 0, 55)),
        "head": ("neck", (0, 0, 55), (0, 0, 69)),
    }
    _lr(b, "shoulder", "chest", (1.5, 0, 48.6), (6.2, 0, 49))
    _lr(b, "upperArm", "shoulder.{s}", (6.2, 0, 49), (6.9, 0, 40))
    _lr(b, "foreArm", "upperArm.{s}", (6.9, 0, 40), (7.4, 0, 31.6))
    _lr(b, "hand", "foreArm.{s}", (7.4, 0, 31.6), (7.6, 0, 28.2))
    _lr(b, "thigh", "hips", (3.0, 0, 24.5), (3.0, 0, 13.5))
    _lr(b, "shin", "thigh.{s}", (3.0, 0, 13.5), (3.0, 0, 3.6))
    _lr(b, "foot", "shin.{s}", (3.0, 0, 3.6), (3.0, -4.4, 1.4))
    _lr(b, "toe", "foot.{s}", (3.0, -4.4, 1.4), (3.0, -7.2, 0.9))
    # sockets: gada / bow / lotus in a hand, quiver on the back
    b["prop.R"] = ("hand.R", (-7.6, -0.5, 29.6), (-7.6, -0.5, 39.6))
    b["prop.L"] = ("hand.L", (7.6, -0.5, 29.6), (7.6, -0.5, 39.6))
    b["back"] = ("chest", (0, 3.5, 44), (0, 5.0, 52))
    # loincloth / sari front panel
    b["cloth.01"] = ("hips", (0, -5.4, 31), (0, -5.8, 26.5))
    b["cloth.02"] = ("cloth.01", (0, -5.8, 26.5), (0, -6.0, 21.5))
    # hero extra: Hanuman's tail (Sita's braid, Rama/Lakshmana's quiver strap take these four slots' place)
    b["tail.01"] = ("hips", (0, 4.8, 26), (3.0, 8.6, 27.5))
    b["tail.02"] = ("tail.01", (3.0, 8.6, 27.5), (8.2, 8.4, 33))
    b["tail.03"] = ("tail.02", (8.2, 8.4, 33), (10.2, 7.0, 43))
    b["tail.04"] = ("tail.03", (10.2, 7.0, 43), (8.4, 7.1, 58))
    return b


HERO_BONES = _hero_bones()
assert len(HERO_BONES) <= 32

# ---------------------------------------------------------------- palette (T44 4.3 / 1.1; R10 colour restraint)
FUR = "#F0A96B"
PARCH = "#F3E3B8"
SAFFRON = "#F39C2B"
GOLD = "#E9C12F"
SEAT = "#E4572E"
WOOD = "#5A3A1E"
INK = "#2A1A0F"

V = Vector


# ---------------------------------------------------------------- weights


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


def limb_weights(joint_z, half, upper, lower):
    """Blend two bones across a joint whose rest limb is roughly vertical: upper above, lower below."""
    def f(co):
        t = max(0.0, min(1.0, (joint_z + half - co.z) / (2 * half)))
        t = t * t * (3 - 2 * t)
        return {upper: 1 - t, lower: t} if 0 < t < 1 else ({upper: 1.0} if t == 0 else {lower: 1.0})
    return f


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


def chain_weights(pts, joints, bone_names):
    """Skin weights for a swept tube: blend the bone chain by arclength of the nearest polyline point.
    joints = rest joint positions between bones (len(bone_names)+1 points incl. both ends)."""
    arc = [0.0]
    for a, b in zip(pts, pts[1:]):
        arc.append(arc[-1] + (b - a).length)
    joint_s = [arc[min(range(len(pts)), key=lambda i: (pts[i] - j).length)] for j in joints]
    mids = [(joint_s[i] + joint_s[i + 1]) / 2 for i in range(len(bone_names))]

    def nearest(co):
        best, best_d = 0.0, 1e9
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            ab = b - a
            t = max(0.0, min(1.0, (co - a).dot(ab) / max(1e-9, ab.length_squared)))
            d = (a + ab * t - co).length
            if d < best_d:
                best_d, best = d, arc[i] + t * (arc[i + 1] - arc[i])
        return best

    def f(co):
        s = nearest(co)
        if s <= mids[0]:
            return {bone_names[0]: 1.0}
        if s >= mids[-1]:
            return {bone_names[-1]: 1.0}
        for i in range(len(mids) - 1):
            if mids[i] <= s <= mids[i + 1]:
                t = (s - mids[i]) / (mids[i + 1] - mids[i])
                t = t * t * (3 - 2 * t)
                return {bone_names[i]: 1 - t, bone_names[i + 1]: t}
        return {bone_names[-1]: 1.0}
    return f


# ---------------------------------------------------------------- clay kit: one material, vertex colours


def clay_vertex_material(name="clay", roughness=0.9):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def face_material(name="face"):
    """Placeholder: a 4x4 white image keeps TEXCOORD_0 and a texture slot in the GLB; the runtime swaps the map."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    img = bpy.data.images.new("face_atlas_placeholder", 4, 4)
    img.pixels = [1.0] * (4 * 4 * 4)
    img.pack()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    return mat


class ClayKit(lib.MeshKit):
    """MeshKit whose parts carry a colour instead of a material: `paint(bone, hex, weights)`."""

    def __init__(self, name, scale=SCALE):
        super().__init__(name, scale)
        self.col = self.bm.verts.layers.float_color.new("Col")
        self.clay = clay_vertex_material()
        self.parts = 0
        self.tri_log = []

    def paint(self, bone, colour, weights=None):
        verts, faces = self._new_geometry()
        self.tri_log.append((sum(len(f.verts) - 2 for f in faces), bone, colour))
        r, g, b = lib.hex_to_linear(colour)
        for v in verts:
            v[self.col] = (r, g, b, 1.0)
        self.parts += 1
        self.bind(bone, self.clay, weights)

    def ellipsoid(self, centre, radii, rot=None, u=10, v=7):
        """Ellipsoid, optionally rotated about its centre by a mathutils Euler/Quaternion/Matrix3."""
        if rot is None:
            return self.sphere(centre, radii, u=u, v=v)
        if not isinstance(radii, (tuple, list)):
            radii = (radii,) * 3
        m = (Matrix.Translation(Vector(centre)) @ rot.to_matrix().to_4x4()
             @ Matrix.Diagonal(Vector((*radii, 1.0))))
        bmesh.ops.create_uvsphere(self.bm, u_segments=u, v_segments=v, radius=1.0, matrix=m)


def hemisphere_dirs(n):
    """Deterministic cosine-weighted directions in the +Z hemisphere (Hammersley)."""
    out = []
    for i in range(n):
        u = (i + 0.5) / n
        v = int(format(i + 1, "b")[::-1], 2) / float(1 << len(format(i + 1, "b")))
        r = math.sqrt(u)
        a = 2 * math.pi * v
        out.append(V((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - u)))))
    return out


def bake_ao_and_jitter(obj, strength=0.4, rays=20, reach_du=5.0, jitter=0.03):
    """Bake ambient occlusion and +-3 % value jitter into the 'Col' attribute (T44 1.2: AO baked, no SSAO)."""
    mesh = obj.data
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(obj, dg)
    attr = mesh.color_attributes["Col"]
    dirs = hemisphere_dirs(rays)
    reach = reach_du * SCALE
    mesh.update()
    for v in mesh.vertices:
        n = v.normal.normalized()
        t = n.cross(V((0, 0, 1)) if abs(n.z) < 0.9 else V((1, 0, 0))).normalized()
        b = n.cross(t)
        origin = v.co + n * (0.15 * SCALE)
        hits = 0.0
        for d in dirs:
            w = t * d.x + b * d.y + n * d.z
            hit = bvh.ray_cast(origin, w, reach)
            if hit[0] is not None:
                hits += 1.0 - hit[3] / reach * 0.6
        ao = hits / rays
        shade = 1.0 - strength * ao
        value = 1.0 + jitter * noise.noise(v.co * 40.0)
        c = attr.data[v.index].color
        attr.data[v.index].color = (c[0] * shade * value, c[1] * shade * value, c[2] * shade * value, 1.0)


# ---------------------------------------------------------------- face patch


def face_patch(kit, surfaces, x_range, z_range, nx=14, nz=16, lift=0.07):
    """A curved patch that follows the union of ellipsoids `surfaces` [(centre, radii)] seen from the front.
    UVs map the (x, z) rectangle to 0..1 (v up). Returns nothing; bind with kit.bind('head', face_mat) afterwards."""
    bm = kit.bm
    uv_layer = bm.loops.layers.uv.verify()

    def front_y(x, z):
        best = None
        for (c, r) in surfaces:
            q = 1 - ((x - c[0]) / r[0]) ** 2 - ((z - c[2]) / r[2]) ** 2
            if q > 0:
                y = c[1] - r[1] * math.sqrt(q)
                best = y if best is None else min(best, y)
        return best

    grid = []
    for iz in range(nz + 1):
        row = []
        for ix in range(nx + 1):
            x = x_range[0] + (x_range[1] - x_range[0]) * ix / nx
            z = z_range[0] + (z_range[1] - z_range[0]) * iz / nz
            y = front_y(x, z)
            row.append(None if y is None else bm.verts.new((x, y - lift, z)))
        grid.append(row)
    for iz in range(nz):
        for ix in range(nx):
            quad = [grid[iz][ix], grid[iz][ix + 1], grid[iz + 1][ix + 1], grid[iz + 1][ix]]
            if any(q is None for q in quad):
                continue
            try:
                f = bm.faces.new(quad)  # CCW seen from -Y: the normal faces the viewer
            except ValueError:
                continue
            for loop in f.loops:
                p = loop.vert.co
                loop[uv_layer].uv = ((p.x - x_range[0]) / (x_range[1] - x_range[0]),
                                     (p.z - z_range[0]) / (z_range[1] - z_range[0]))
