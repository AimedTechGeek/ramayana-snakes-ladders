"""glTF binary export: +Y up, one animation per NLA track (named like the action), meshopt compression."""
import bpy


def export_glb(path, objects, meshopt=True, extras=True):
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
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_skins=True,
        export_extras=extras,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_cameras=False,
        export_lights=False,
    )
    if meshopt:
        kwargs["export_meshopt_compression_enable"] = True
    bpy.ops.export_scene.gltf(**kwargs)
