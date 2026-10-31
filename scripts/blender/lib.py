"""Blender 5.x headless helpers: clay-toy materials and rounded primitives.

All builders add geometry to ONE shared bmesh (`MeshKit`). After building a part call
`kit.bind(bone, material)` to give the new faces a material slot and skin weights.
Weights are rigid (1.0 to one bone) unless a callable returning {bone: weight} is passed.
Units: callers work in "design units" (character ~80 tall); `kit.scale` converts to metres.
Axes are Blender axes: +Z up, character faces -Y.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- materials

_MATERIALS = {}


def clay_material(name, hex_colour, roughness=0.62, metallic=0.0):
    """Soft clay look: Principled BSDF base colour + roughness only (exports to glTF PBR cleanly)."""
    if name in _MATERIALS:
        return _MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    r, g, b = hex_to_linear(hex_colour)
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    mat.diffuse_color = (r, g, b, 1.0)
    _MATERIALS[name] = mat
    return mat


def hex_to_linear(hex_colour):
    h = hex_colour.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# ---------------------------------------------------------------- scene

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATERIALS.clear()


# ---------------------------------------------------------------- mesh kit

class MeshKit:
    """Accumulates rounded primitives into one bmesh with a deform layer for skin weights."""

    def __init__(self, name, scale=1.0 / 80.0):
        self.name = name
        self.scale = scale
        self.bm = bmesh.new()
        self.deform = self.bm.verts.layers.deform.verify()
        self.materials = []       # ordered list of bpy materials -> slot index
        self.groups = []          # ordered vertex group names
        self._bound_verts = set()   # BMesh reuses freed pool slots (remove_doubles), so track by identity, not by index
        self._bound_faces = set()

    # -- part bookkeeping
    def _new_geometry(self):
        verts = [v for v in self.bm.verts if v not in self._bound_verts]
        faces = [f for f in self.bm.faces if f not in self._bound_faces]
        return verts, faces

    def bind(self, bone, material, weights=None):
        """Finish the part just built: material slot + skin weights (rigid, or callable(co)->{bone: w})."""
        verts, faces = self._new_geometry()
        if material not in self.materials:
            self.materials.append(material)
        slot = self.materials.index(material)
        for f in faces:
            f.material_index = slot
            f.smooth = True
        for v in verts:
            wmap = weights(v.co) if weights else {bone: 1.0}
            for b, w in wmap.items():
                if b not in self.groups:
                    self.groups.append(b)
                v[self.deform][self.groups.index(b)] = w
        self._bound_verts.update(verts)
        self._bound_faces.update(faces)

    # -- primitives (centre/points in design units)
    def sphere(self, centre, radii, u=14, v=9):
        """Ellipsoid. radii = (rx, ry, rz) or a single float."""
        if not isinstance(radii, (tuple, list)):
            radii = (radii,) * 3
        m = Matrix.Translation(Vector(centre)) @ Matrix.Diagonal(Vector((*radii, 1.0)))
        bmesh.ops.create_uvsphere(self.bm, u_segments=u, v_segments=v, radius=1.0, matrix=m)

    def lathe(self, profile, origin=(0, 0, 0), axis=(0, 0, 1), squash=(1.0, 1.0), sides=14, cap=True):
        """Surface of revolution. profile = [(height, radius), ...] along `axis`; squash scales local x/y.
        Ends are closed with a rounded-ish fan when cap is True."""
        rot = Vector(axis).normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        base = Matrix.Translation(Vector(origin)) @ rot
        rings = []
        for h, r in profile:
            ring = []
            for i in range(sides):
                a = 2 * math.pi * i / sides
                p = Vector((math.cos(a) * r * squash[0], math.sin(a) * r * squash[1], h))
                ring.append(self.bm.verts.new(base @ p))
            rings.append(ring)
        for k in range(len(rings) - 1):
            for i in range(sides):
                j = (i + 1) % sides
                self.bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
        if cap:
            for ring, (h, _) in ((rings[0], profile[0]), (rings[-1], profile[-1])):
                c = self.bm.verts.new(base @ Vector((0, 0, h)))
                for i in range(sides):
                    self.bm.faces.new((ring[i], ring[(i + 1) % sides], c))
        self._fix_normals()

    def tube(self, points, radii, sides=10, round_caps=True, closed=False):
        """Swept tube along a polyline with per-point radius and hemispherical caps (a bendy capsule)."""
        pts = [Vector(p) for p in points]
        rad = list(radii) if isinstance(radii, (list, tuple)) else [radii] * len(pts)
        if closed:
            pts.append(pts[0].copy())
            rad.append(rad[0])
        frames = []
        up = Vector((0, 0, 1)) if abs((pts[1] - pts[0]).normalized().z) < 0.95 else Vector((1, 0, 0))
        for i, p in enumerate(pts):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == len(pts) - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            t.normalize()
            n = up - t * up.dot(t)
            n.normalize()
            up = n
            frames.append((p, t, n, t.cross(n)))
        rings = []

        def add_ring(centre, n, b, r):
            ring = []
            for i in range(sides):
                a = 2 * math.pi * i / sides
                ring.append(self.bm.verts.new(centre + (n * math.cos(a) + b * math.sin(a)) * r))
            return ring

        caps_start = []
        caps_end = []
        if round_caps and not closed:
            p, t, n, b = frames[0]
            for ang in (62, 25):  # hemisphere rings, rear cap
                s, c = math.sin(math.radians(ang)), math.cos(math.radians(ang))
                caps_start.append(add_ring(p - t * rad[0] * s, n, b, rad[0] * c))
        for (p, t, n, b), r in zip(frames, rad):
            rings.append(add_ring(p, n, b, r))
        if round_caps and not closed:
            p, t, n, b = frames[-1]
            for ang in (25, 62):
                s, c = math.sin(math.radians(ang)), math.cos(math.radians(ang))
                caps_end.append(add_ring(p + t * rad[-1] * s, n, b, rad[-1] * c))
        allr = caps_start + rings + caps_end
        for k in range(len(allr) - 1):
            for i in range(sides):
                j = (i + 1) % sides
                self.bm.faces.new((allr[k][i], allr[k][j], allr[k + 1][j], allr[k + 1][i]))
        if round_caps and not closed:
            p, t, _, _ = frames[0]
            c0 = self.bm.verts.new(p - t * rad[0])
            c1 = self.bm.verts.new(frames[-1][0] + frames[-1][1] * rad[-1])
            for i in range(sides):
                j = (i + 1) % sides
                self.bm.faces.new((allr[0][i], allr[0][j], c0)[::-1])
                self.bm.faces.new((allr[-1][i], allr[-1][j], c1))
        if closed:
            # weld the duplicated closing ring
            bmesh.ops.remove_doubles(self.bm, verts=[v for r_ in (rings[0], rings[-1]) for v in r_], dist=1e-5)
        self._fix_normals()

    def capsule(self, a, b, ra, rb=None, sides=10):
        self.tube([a, b], [ra, ra if rb is None else rb], sides=sides)

    def ring(self, centre, axis, major, minor, sides=12, segs=6):
        """Torus (armlets, anklets, belts)."""
        axis = Vector(axis).normalized()
        rot = axis.to_track_quat("Z", "Y").to_matrix()
        pts = []
        for i in range(segs * 2):
            a = 2 * math.pi * i / (segs * 2)
            pts.append(Vector(centre) + rot @ Vector((math.cos(a) * major, math.sin(a) * major, 0)))
        self.tube(pts, minor, sides=sides, round_caps=False, closed=True)

    def _fix_normals(self):
        bmesh.ops.recalc_face_normals(self.bm, faces=list(self.bm.faces))

    # -- finish
    def build_object(self, collection=None):
        """Scale to metres, convert to a mesh object with materials + vertex groups."""
        bmesh.ops.scale(self.bm, vec=(self.scale,) * 3, verts=list(self.bm.verts), space=Matrix.Identity(4))
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        mesh.update()
        for mat in self.materials:
            mesh.materials.append(mat)
        obj = bpy.data.objects.new(self.name, mesh)
        (collection or bpy.context.scene.collection).objects.link(obj)
        for g in self.groups:
            obj.vertex_groups.new(name=g)
        # vertex groups were created in order, indices match self.groups
        return obj


# ---------------------------------------------------------------- bevel / subdivision helpers

def apply_subsurf(obj, levels=1):
    """Bake a Subdivision Surface modifier into the mesh (rounds box-like parts)."""
    _bake_modifier(obj, "SUBSURF", levels=levels, render_levels=levels)


def apply_bevel(obj, width=0.01, segments=2):
    _bake_modifier(obj, "BEVEL", width=width, segments=segments)


def _bake_modifier(obj, kind, **props):
    mod = obj.modifiers.new(kind.title(), kind)
    for k, v in props.items():
        setattr(mod, k, v)
    dg = bpy.context.evaluated_depsgraph_get()
    new_mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.remove(mod)
    old = obj.data
    obj.data = new_mesh
    bpy.data.meshes.remove(old)


def triangle_count(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)
