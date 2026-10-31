"""glTF binary export: +Y up, one animation per NLA track (named like the action), meshopt compression."""
import bpy


def export_glb(path, objects, meshopt=True, extras=True, image_format="NONE", sampling=True, keep_static_channels=True, **extra):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=sampling,   # False: only the channels that are keyed (heroes: far fewer tracks)
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=keep_static_channels,   # False: unkeyed constant bone channels are dropped
        export_skins=True,
        export_extras=extras,
        export_materials="EXPORT",
        export_image_format=image_format,
        export_cameras=False,
        export_lights=False,
    )
    kwargs.update(extra)   # board.py passes extra exporter options
    if meshopt:
        kwargs["export_meshopt_compression_enable"] = True
    bpy.ops.export_scene.gltf(**kwargs)
