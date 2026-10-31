"""Clay-toy prop primitives for the diorama scenery (props.py, landmarks.py).

Every `Kit` collects soft, smooth-shaded shapes into one mesh with per-vertex colours (the diorama material is
vertex-coloured, no textures). Authoring units are PIXELS of the T42 world (1 block = 56 px = 1 u); `build()`
scales to metres so one glTF metre is one board unit. Blender axes: +Z up, the FRONT of a prop faces -Y (which
the glTF export turns into +Z, toward the viewer). A part flagged `glow=True` goes to a second mesh, `<name>.glow`,
that the runtime draws with a flickering emissive material.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PX = 1.0 / 56.0
_MAT = {}


def lin(hex_colour):
    h = hex_colour.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def vertex_material(name, roughness=0.92, double_sided=False):
    """One material that reads the 'Col' vertex colour (exports as COLOR_0 + baseColor)."""
    if name in _MAT:
        return _MAT[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    mat.use_backface_culling = not double_sided
    _MAT[name] = mat
    return mat


def _noise(x, y, z):
    """Deterministic value jitter in [-1, 1] (no RNG state: the GLB is reproducible)."""
    n = math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
    return (n - math.floor(n)) * 2.0 - 1.0


class Kit:
    def __init__(self, name):
        self.name = name
        self.bm = {"main": bmesh.new(), "glow": bmesh.new()}
        self.layer = {k: b.verts.layers.float_color.new("Col") for k, b in self.bm.items()}

    # ------------------------------------------------------------ plumbing
    def _vert(self, glow, co, colour):
        key = "glow" if glow else "main"
        v = self.bm[key].verts.new(co)
        r, g, b = colour
        v[self.layer[key]] = (r, g, b, 1.0)
        return v

    def _face(self, glow, verts):
        try:
            f = self.bm["glow" if glow else "main"].faces.new(verts)
            f.smooth = True
            return f
        except ValueError:
            return None

    @staticmethod
    def _xf(c, rot, scale=(1, 1, 1)):
        if isinstance(rot, (int, float)):
            rot = (0.0, 0.0, rot)
        return Matrix.Translation(Vector(c)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal(Vector((*scale, 1.0)))

    # ------------------------------------------------------------ shapes
    def blob(self, c, r, colour, u=7, v=5, rot=0.0, glow=False):
        """Ellipsoid (radii r = float or (rx, ry, rz)). Tris = 2*u*(v-1)."""
        if not isinstance(r, (tuple, list)):
            r = (r, r, r)
        m = self._xf(c, rot, r)
        col = lin(colour)
        rings = []
        for j in range(1, v):
            phi = math.pi * j / v
            ring = []
            for i in range(u):
                th = 2 * math.pi * i / u
                p = Vector((math.sin(phi) * math.cos(th), math.sin(phi) * math.sin(th), math.cos(phi)))
                ring.append(self._vert(glow, m @ p, col))
            rings.append(ring)
        top = self._vert(glow, m @ Vector((0, 0, 1)), col)
        bot = self._vert(glow, m @ Vector((0, 0, -1)), col)
        for i in range(u):
            j = (i + 1) % u
            self._face(glow, (rings[0][j], rings[0][i], top))
            self._face(glow, (rings[-1][i], rings[-1][j], bot))
        for k in range(len(rings) - 1):
            for i in range(u):
                j = (i + 1) % u
                self._face(glow, (rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))

    def lathe(self, c, profile, colour, sides=8, rot=0.0, squash=(1.0, 1.0), top=True, bottom=False, glow=False,
              cols=None):
        """Surface of revolution: profile [(z, radius), ...] from the base up. Tris = 2*sides*(n-1) + caps.
        `cols` = optional per-profile-point colours (list of hex) for painted bands."""
        m = self._xf(c, rot)
        rings = []
        for k, (z, r) in enumerate(profile):
            col = lin(cols[k]) if cols else lin(colour)
            ring = []
            for i in range(sides):
                a = 2 * math.pi * i / sides
                ring.append(self._vert(glow, m @ Vector((math.cos(a) * r * squash[0], math.sin(a) * r * squash[1], z)), col))
            rings.append(ring)
        for k in range(len(rings) - 1):
            for i in range(sides):
                j = (i + 1) % sides
                self._face(glow, (rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
        for ring, (z, _), up, on in ((rings[-1], profile[-1], True, top), (rings[0], profile[0], False, bottom)):
            if not on:
                continue
            col = lin(cols[-1 if up else 0]) if cols else lin(colour)
            apex = self._vert(glow, m @ Vector((0, 0, z)), col)
            for i in range(sides):
                j = (i + 1) % sides
                self._face(glow, (ring[i], ring[j], apex) if up else (ring[j], ring[i], apex))

    def cone(self, c, r, h, colour, sides=8, **kw):
        self.lathe(c, [(0, r), (h, r * 0.04)], colour, sides=sides, **kw)

    def cyl(self, c, r, h, colour, sides=8, r_top=None, **kw):
        rt = r if r_top is None else r_top
        self.lathe(c, [(0, r), (h, rt)], colour, sides=sides, **kw)

    def box(self, c, size, colour, rot=0.0, soft=True, glow=False, lift=0.0):
        """Eight-vertex cube, smooth shaded so it reads as a soft pillow (12 tris). `c` = base centre."""
        sx, sy, sz = (s / 2 for s in size)
        m = self._xf((c[0], c[1], c[2] + sz), rot)
        col = lin(colour)
        pts = {}
        for x in (-1, 1):
            for y in (-1, 1):
                for z in (-1, 1):
                    pts[(x, y, z)] = self._vert(glow, m @ Vector((x * sx, y * sy, z * sz + (lift if z > 0 else 0))), col)
        quads = [((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1)),
                 ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)),
                 ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)),
                 ((1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)),
                 ((-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)),
                 ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1))]
        for q in quads:
            self._face(glow, [pts[k] for k in q])

    def rbox(self, c, size, colour, rot=0.0, r=0.3, glow=False):
        """Rounded box: cube grid (2 per side) pushed to a rounded-box surface. 48 tris. `c` = base centre."""
        sx, sy, sz = (s / 2 for s in size)
        m = self._xf((c[0], c[1], c[2] + sz), rot)
        col = lin(colour)
        n = 2
        a = 1.0 - r
        keys = {}

        def vert(p):
            k = tuple(round(x, 4) for x in p)
            if k not in keys:
                q = Vector(p)
                cl = Vector((max(-a, min(a, q.x)), max(-a, min(a, q.y)), max(-a, min(a, q.z))))
                d = q - cl
                if d.length > 1e-6:
                    q = cl + d.normalized() * r
                keys[k] = self._vert(glow, m @ Vector((q.x * sx, q.y * sy, q.z * sz)), col)
            return keys[k]

        steps = [-1 + 2 * i / n for i in range(n + 1)]
        for axis in range(3):
            for sign in (-1, 1):
                for i in range(n):
                    for j in range(n):
                        quad = []
                        for di, dj in ((0, 0), (1, 0), (1, 1), (0, 1)):
                            u, w = steps[i + di], steps[j + dj]
                            p = [0, 0, 0]
                            p[axis] = sign
                            p[(axis + 1) % 3] = u
                            p[(axis + 2) % 3] = w
                            quad.append(vert(tuple(p)))
                        if sign < 0:
                            quad.reverse()
                        self._face(glow, quad)

    def tube(self, pts, radius, colour, sides=5, glow=False, caps=True):
        """Swept tube along a polyline; `radius` float or per-point list. Tris ~ 2*sides*(n-1) + 2*sides."""
        pts = [Vector(p) for p in pts]
        rad = radius if isinstance(radius, (list, tuple)) else [radius] * len(pts)
        col = lin(colour)
        rings = []
        up = Vector((0, 0, 1)) if abs((pts[1] - pts[0]).normalized().z) < 0.95 else Vector((1, 0, 0))
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            nrm = (up - t * up.dot(t)).normalized()
            up = nrm
            b = t.cross(nrm)
            rings.append([self._vert(glow, p + (nrm * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * rad[i], col)
                          for k in range(sides)])
        for k in range(len(rings) - 1):
            for i in range(sides):
                j = (i + 1) % sides
                self._face(glow, (rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
        if caps:
            for ring, p, flip in ((rings[0], pts[0], True), (rings[-1], pts[-1], False)):
                apex = self._vert(glow, p, col)
                for i in range(sides):
                    j = (i + 1) % sides
                    self._face(glow, (ring[j], ring[i], apex) if flip else (ring[i], ring[j], apex))

    def sheet(self, c, w, h, colour, rot=0.0, cols=1, rows=1, wave=0.0, glow=False, vertical=True, bottom_colour=None):
        """Flat strip in its local XZ plane (a banner, cloth, flow) facing -Y; wave bends it along Y.
        `c` = bottom-centre. vertical=False lays it on the ground (XY plane) instead."""
        m = self._xf(c, rot)
        grid = []
        for j in range(rows + 1):
            row = []
            for i in range(cols + 1):
                x = (i / cols - 0.5) * w
                t = j / rows
                off = wave * math.sin(t * math.pi * 1.4 + i * 0.9) * (0.4 + t)
                p = Vector((x, off, t * h)) if vertical else Vector((x, t * h - h / 2, off))
                colr = lin(bottom_colour) if (bottom_colour and j == 0) else lin(colour)
                row.append(self._vert(glow, m @ p, colr))
            grid.append(row)
        for j in range(rows):
            for i in range(cols):
                self._face(glow, (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))

    def tri(self, a, b, c, colour, glow=False):
        col = lin(colour)
        self._face(glow, [self._vert(glow, Vector(p), col) for p in (a, b, c)])

    def disc(self, c, r, colour, sides=8, rot=0.0, glow=False, squash=(1, 1)):
        """Flat disc on the ground (sides tris)."""
        m = self._xf(c, rot)
        col = lin(colour)
        ring = [self._vert(glow, m @ Vector((math.cos(2 * math.pi * i / sides) * r * squash[0],
                                             math.sin(2 * math.pi * i / sides) * r * squash[1], 0)), col)
                for i in range(sides)]
        mid = self._vert(glow, m @ Vector((0, 0, 0)), col)
        for i in range(sides):
            self._face(glow, (ring[i], ring[(i + 1) % sides], mid))

    def ring(self, c, r0, r1, colour, sides=4, rot=0.0, glow=False, z1=0.0):
        """Flat annulus on the ground: 2*sides tris."""
        m = self._xf(c, rot)
        col = lin(colour)
        outer = [self._vert(glow, m @ Vector((math.cos(2 * math.pi * i / sides) * r1, math.sin(2 * math.pi * i / sides) * r1, z1)), col)
                 for i in range(sides)]
        inner = [self._vert(glow, m @ Vector((math.cos(2 * math.pi * i / sides) * r0, math.sin(2 * math.pi * i / sides) * r0, 0)), col)
                 for i in range(sides)]
        for i in range(sides):
            j = (i + 1) % sides
            self._face(glow, (inner[i], inner[j], outer[j], outer[i]))

    # ------------------------------------------------------------ finish
    def _finish_colours(self, key):
        """Value jitter +-3 % and a cheap baked ambient occlusion: darker near the ground and in the lower third."""
        bm = self.bm[key]
        layer = self.layer[key]
        if key == "glow" or not bm.verts:
            return
        top = max(v.co.z for v in bm.verts) or 1.0
        for v in bm.verts:
            r, g, b, _ = v[layer]
            ao = 0.80 + 0.20 * min(1.0, max(0.0, v.co.z / (0.30 * top + 1.5)))
            k = ao * (1.0 + 0.03 * _noise(v.co.x, v.co.y, v.co.z))
            v[layer] = (r * k, g * k, b * k, 1.0)

    def build(self, collection=None, materials=None):
        """Scale to metres, return {'main': obj, 'glow': obj?}."""
        out = {}
        coll = collection or bpy.context.scene.collection
        for key, bm in self.bm.items():
            if not bm.verts:
                continue
            self._finish_colours(key)
            bmesh.ops.scale(bm, vec=(PX, PX, PX), verts=list(bm.verts), space=Matrix.Identity(4))
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            for f in bm.faces:
                f.smooth = True
            name = self.name if key == "main" else self.name + "__glow"
            mesh = bpy.data.meshes.new(name)
            bm.to_mesh(mesh)
            mesh.update()
            mesh.color_attributes.active_color = mesh.color_attributes["Col"]
            mesh.color_attributes.render_color_index = 0
            mesh.materials.append(materials[key])
            obj = bpy.data.objects.new(name, mesh)
            coll.objects.link(obj)
            out[key] = obj
            bm.free()
        return out


def tri_count(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def extents_px(objs):
    """(width x, depth y, height z) in px over the meshes of one kind."""
    vs = [v.co for o in objs for v in o.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return [(hi[i] - lo[i]) / PX for i in range(3)], lo, hi


# ---------------------------------------------------------------- registry + export

def kind_table():
    """Returns (table, decorator). A decorated builder takes a Kit and draws one prop; meta is kept for the manifest."""
    table = {}

    def kind(name, budget, regions=(), zone="side", anim="none", variety=True, squares=None, landmark=False,
             fly=False, double_sided=False):
        def wrap(fn):
            table[name] = dict(fn=fn, budget=budget, regions=list(regions), zone=zone, anim=anim, variety=variety,
                               squares=squares, landmark=landmark, fly=fly, double_sided=double_sided)
            return fn
        return wrap
    return table, kind


def build_kinds(table):
    """Builds every kind, one object per mesh at the origin. Returns {name: {'main': obj, 'glow': obj?}} and the stats."""
    solid = vertex_material("clay", 0.92)
    cloth = vertex_material("clay-cloth", 1.0, double_sided=True)
    glow = vertex_material("clay-glow", 0.6, double_sided=True)
    objects, stats = {}, {}
    for name, meta in table.items():
        kit = Kit(name)
        meta["fn"](kit)
        objs = kit.build(materials={"main": cloth if meta["double_sided"] else solid, "glow": glow})
        objects[name] = objs
        tris = sum(tri_count(o) for o in objs.values())
        size, lo, hi = extents_px(list(objs.values()))
        stats[name] = dict(tris=tris, glow="glow" in objs, width=round(size[0], 1), depth=round(size[1], 1),
                           height=round(size[2], 1))
    return objects, stats


def export_glb(path, objects):
    """Static glTF binary with meshopt, vertex colours as COLOR_0 only (the shared export.py is for rigged meshes)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
        export_animations=False, export_skins=False, export_materials="EXPORT", export_image_format="NONE",
        export_cameras=False, export_lights=False, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True, export_meshopt_compression_enable=True)
