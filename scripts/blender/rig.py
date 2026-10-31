"""Humanoid armature builder + pose composer (Blender 5.x).

Bone spec: name -> (parent, head, tail) in design units, Blender axes (+Z up, character faces -Y).
`Pose` lets animation code speak in armature-space rotations (rest-orientation independent):
  rel[bone]   = rotation relative to the parent's posed frame (angles add down a chain)
  world[bone] = absolute rotation (used for feet / props that must hold an orientation)
"""
import math

import bpy
from mathutils import Euler, Quaternion, Vector

HUMANOID = {
    # name:        (parent,      head,            tail)
    "root":        (None,        (0, 0, 0),       (0, 4, 0)),      # points +Y: local axes == armature axes
    "hips":        ("root",      (0, 0, 22),      (0, 0, 25)),
    "spine":       ("hips",      (0, 0, 25),      (0, 0, 31)),
    "chest":       ("spine",     (0, 0, 31),      (0, 0, 38)),
    "neck":        ("chest",     (0, 0, 38),      (0, 0, 40)),
    "head":        ("neck",      (0, 0, 40),      (0, 0, 62)),
    "upper_arm.L": ("chest",     (7.4, 0, 35),    (9.4, 0, 27.4)),
    "lower_arm.L": ("upper_arm.L", (9.4, 0, 27.4), (11.4, 0, 19.8)),
    "hand.L":      ("lower_arm.L", (11.4, 0, 19.8), (12.4, 0, 15.8)),
    "upper_arm.R": ("chest",     (-7.4, 0, 35),   (-9.4, 0, 27.4)),
    "lower_arm.R": ("upper_arm.R", (-9.4, 0, 27.4), (-11.4, 0, 19.8)),
    "hand.R":      ("lower_arm.R", (-11.4, 0, 19.8), (-12.4, 0, 15.8)),
    "prop":        ("hand.R",    (-12.4, 0, 17.5), (-12.4, 0, 27.5)),  # gada grip point, shaft along +Z
    "thigh.L":     ("hips",      (4.2, 0, 22),    (4.2, 0, 13)),
    "shin.L":      ("thigh.L",   (4.2, 0, 13),    (4.2, 0, 4.8)),
    "foot.L":      ("shin.L",    (4.2, 0, 4.8),   (4.2, -7.5, 2.0)),
    "thigh.R":     ("hips",      (-4.2, 0, 22),   (-4.2, 0, 13)),
    "shin.R":      ("thigh.R",   (-4.2, 0, 13),   (-4.2, 0, 4.8)),
    "foot.R":      ("shin.R",    (-4.2, 0, 4.8),  (-4.2, -7.5, 2.0)),
    "tail1":       ("hips",      (0, 5, 25),      (0, 12, 27)),
    "tail2":       ("tail1",     (0, 12, 27),     (2, 19, 35)),
    "tail3":       ("tail2",     (2, 19, 35),     (3, 20, 47)),
    "tail4":       ("tail3",     (3, 20, 47),     (1, 16, 58)),
}
SPINE_ORDER = list(HUMANOID.keys())  # parents always precede children


def build_armature(scale=1.0 / 80.0, bones=HUMANOID, name="Armature"):
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, (parent, head, tail) in bones.items():
        eb = arm_data.edit_bones.new(bname)
        eb.head = Vector(head) * scale
        eb.tail = Vector(tail) * scale
        eb.roll = 0.0
        if parent:
            eb.parent = arm_data.edit_bones[parent]
        eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def skin(mesh_obj, arm):
    """Armature modifier using the vertex groups the MeshKit wrote (rigid / hand-blended weights)."""
    mesh_obj.parent = arm
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    mod.use_vertex_groups = True


# ---- rotation helpers (armature space)
def rot_x(deg):
    return Quaternion((1, 0, 0), math.radians(deg))


def rot_y(deg):
    return Quaternion((0, 1, 0), math.radians(deg))


def rot_z(deg):
    return Quaternion((0, 0, 1), math.radians(deg))


class Pose:
    """One pose = a set of rotations (+ optional root offset). Missing bones stay at rest."""

    def __init__(self):
        self.rel = {}
        self.world = {}
        self.loc = {}      # bone -> Vector in armature axes (root only is sensible)
        self.scale = {}    # bone -> Vector

    def add_rel(self, bone, q):
        self.rel[bone] = self.rel.get(bone, Quaternion()) @ q

    def set_world(self, bone, q):
        self.world[bone] = q


def solve_local_rotations(arm, pose, bones=HUMANOID):
    """Pose -> {bone: local quaternion for pose_bone.rotation_quaternion}."""
    delta = {}   # total armature-space delta per bone
    out = {}
    for bname in SPINE_ORDER:
        parent = bones[bname][0]
        d_parent = delta[parent] if parent else Quaternion()
        if bname in pose.world:
            q_arm = d_parent.inverted() @ pose.world[bname]
        else:
            q_arm = pose.rel.get(bname, Quaternion())
        delta[bname] = d_parent @ q_arm
        rest = arm.data.bones[bname].matrix_local.to_quaternion()
        out[bname] = rest.inverted() @ q_arm @ rest
    return out


def key_pose(arm, pose, frame, bones=HUMANOID):
    """Write the pose on the armature and insert rotation/location/scale keys at `frame`."""
    local = solve_local_rotations(arm, pose, bones)
    for bname, q in local.items():
        pb = arm.pose.bones[bname]
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=frame, group=bname)
    for bname, v in pose.loc.items():
        pb = arm.pose.bones[bname]
        pb.location = v
        pb.keyframe_insert("location", frame=frame, group=bname)
    for bname, v in pose.scale.items():
        pb = arm.pose.bones[bname]
        pb.scale = v
        pb.keyframe_insert("scale", frame=frame, group=bname)
