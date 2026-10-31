"""Diorama landmarks (T44 2.5): modelled individually, <= 1,200 tris each. Imported by props.py, which exports
landmarks.glb with the props pack. Authoring units are px of the T42 world (see clay.py); front faces -Y.

Respect: the gate is a gate, not a shrine (T40 9 #8); the throne is EMPTY (no figure, no offerings, no lamps);
the chhatra stands behind the dais on the rim, never over the standing field.
"""
import math
import os

import clay

LANDMARKS, kind = clay.kind_table()
PI = math.pi
GOLD, SAFFRON = "#EBC53C", "#F6A33B"
LEAF, LEAF2 = "#9BCB7E", "#82B966"
TERRA = "#E2956A"

# catalog entries the T42 seed rule needs (the meshes live in landmarks.glb)
CATALOG = {}


def catalog(name, regions, zone, squares, budget=1200, anim="none"):
    CATALOG[name] = dict(regions=regions, zone=zone, squares=squares, budget=budget, anim=anim)


catalog("ayodhya-threshold", ["mithila"], "side", [1], anim="flicker")
catalog("janaka-palace", ["mithila"], "side", [36])
catalog("dais", ["lanka"], "centre", [144], budget=144)


@kind("ayodhya-threshold", 1200, anim="flicker")
def gate(k):
    """Torana: two stout posts, two lintels, mango garland, two lamps, a parchment road strip to the block.
    Origin = centre of the gate on the rim; the block is toward +Y."""
    W = 17.0
    for sx in (-1, 1):
        x = sx * W
        k.lathe((x, 0, 0), [(0, 4.6), (1.4, 4.2), (2.6, 3.1), (26, 2.9), (28.6, 3.6), (30.2, 3.2)], "#E8D2A2", sides=8,
                top=True, cols=["#C9B07A", "#C9B07A", "#E8D2A2", "#E8D2A2", GOLD, GOLD])
        k.blob((x, 0, 32.6), (3.2, 3.2, 2.8), GOLD, u=8, v=5)
        k.cone((x, 0, 34.6), 0.7, 3.4, GOLD, sides=5)
    k.rbox((0, 0, 29.6), (2 * W + 9, 4.6, 3.6), "#E8D2A2", r=0.4)
    k.rbox((0, 0, 33.4), (2 * W + 3, 4.0, 3.0), SAFFRON, r=0.45)
    k.rbox((0, 0, 36.2), (2 * W - 9, 3.4, 2.6), "#E8D2A2", r=0.45)
    k.blob((0, -2.2, 38.4), (3, 1.3, 2.6), GOLD, u=7, v=4)
    # garland of mango leaves and marigolds sagging under the lintel
    n = 11
    for i in range(n):
        t = i / (n - 1)
        x = (t - 0.5) * (2 * W - 5)
        z = 28.2 - 3.4 * math.sin(math.pi * t)
        k.blob((x, -2.4, z), (1.3, 0.8, 2.2), LEAF if i % 2 else LEAF2, u=4, v=3)
        if i % 3 == 1:
            k.blob((x, -3.0, z - 1.8), 0.95, "#F4A04A", u=4, v=3)
    k.tube([(-W + 1, -2.0, 28.6), (0, -2.0, 24.4), (W - 1, -2.0, 28.6)], 0.4, LEAF2, sides=4)
    # hanging lamps (the glow flickers at runtime)
    for sx in (-1, 1):
        x = sx * (W - 7.5)
        k.tube([(x, -2.0, 29.2), (x, -2.0, 25.6)], 0.28, "#8C7A5A", sides=3)
        k.lathe((x, -2.0, 20.8), [(0, 1.0), (1.2, 2.0), (3.6, 2.2), (4.8, 1.0)], "#E9C97A", sides=7, top=True)
        k.blob((x, -2.0, 23.0), (1.2, 1.2, 1.5), "#FFD27A", u=5, v=3, glow=True)
    # parchment road strip from the rim to the block
    k.sheet((0, 6, 0.15), 13, 40, "#F3E3B8", cols=1, rows=1, vertical=False)
    for i in range(3):
        k.box((0, -6 + i * 8, 0), (8.6 - i, 5, 0.5), "#E8D5A2")
    # low gate-wall stubs and flower pots at the foot of the posts
    for sx in (-1, 1):
        k.box((sx * 25.5, 0, 0), (6.4, 5.4, 7), "#E8D2A2")
        k.lathe((sx * 25.5, -0.4, 7), [(0, 2.0), (1.8, 2.8), (3, 3)], TERRA, sides=7, top=True)
        k.blob((sx * 25.5, -0.4, 11), (2.8, 2.6, 2.2), LEAF, u=6, v=4)
        k.blob((sx * 25.5, -1.4, 12.6), 1.0, "#F3A9BB", u=4, v=3)


@kind("janaka-palace", 1200)
def janaka_palace(k):
    """Mithila palace silhouette, 0.5 u tall: a long hall, three domed pavilions, balcony, flags. Faces -Y."""
    k.rbox((0, 0, 0), (32, 11, 12), "#F3E3BD", r=0.18)
    k.box((0, 0, 12), (34, 12, 1.8), "#E6C88A")
    for x in (-10, 0, 10):
        k.rbox((x, -1, 13.8), (8, 8, 7), "#F6EBD0", r=0.3)
        k.lathe((x, -1, 20.8), [(0, 4.4), (1.4, 4.7), (4.4, 3.4), (6.6, 1.2), (7.8, 0.3)], "#F8F1E0", sides=9)
        k.cone((x, -1, 28.2), 0.4, 3.6, GOLD, sides=4)
        k.box((x, -5.2, 13.8), (3, 0.8, 4.6), "#B89A64")
        k.blob((x, -5.4, 18.4), (1.5, 0.5, 1.4), "#9ACFE0", u=6, v=4)
    for x in (-13.5, 13.5):
        k.lathe((x, 0, 12), [(0, 3.2), (9, 2.6), (10.4, 3.4)], "#F6EBD0", sides=8)
        k.lathe((x, 0, 22.4), [(0, 3.4), (4.4, 0.4)], SAFFRON, sides=8)
        k.tube([(x, 0, 26.8), (x, 0, 31)], 0.35, GOLD, sides=3)
        k.sheet((x, 0, 28.4), 3, 2.4, SAFFRON, cols=1, rows=1, rot=PI / 2)
    for i in range(7):
        k.box((-12 + i * 4, -6.4, 12), (1.8, 1.4, 2.0), "#E6C88A")
    k.box((0, -7.4, 0), (10, 5, 1.0), "#E6C88A")
    k.box((0, -8.8, 0), (13, 3.6, 0.6), "#E6C88A")
    k.box((0, -5.7, 0), (3.6, 0.5, 6.6), "#8C6A3C")


@kind("dais", 144)
def dais(k):
    """The coronation dais: a low gold-trimmed ring (0.08 u tall) covering the block."""
    k.lathe((0, 0, 0), [(0, 24.5), (3.6, 24.0), (4.6, 23.0)], "#F3E3B8", sides=12, top=True, bottom=False,
            cols=["#E8D2A2", "#F3E3B8", "#F3E3B8"])
    k.ring((0, 0, 4.4), 22.0, 24.2, GOLD, sides=12)
    k.ring((0, 0, 4.5), 17.0, 17.8, GOLD, sides=12)


@kind("throne", 1200)
def throne(k):
    """The empty throne, 0.42 u tall (23.5 px): gold, saffron cushion, nobody on it. Front faces -Y."""
    k.rbox((0, 0, 0), (12.4, 9.4, 3.2), "#E9D08A", r=0.3)
    k.rbox((0, 0, 3.2), (11, 8.2, 4.8), GOLD, r=0.3)
    k.rbox((0, -0.6, 8.0), (9.4, 6.8, 1.8), SAFFRON, r=0.5)
    k.rbox((0, 3.2, 8.0), (11, 2.4, 13.4), GOLD, r=0.3)
    k.blob((0, 3.4, 21.8), (5.2, 1.5, 2.8), GOLD, u=8, v=5)
    k.blob((0, 3.4, 24.0), (1.4, 1.2, 1.4), SAFFRON, u=5, v=3)
    for sx in (-1, 1):
        k.rbox((sx * 5.4, -0.2, 8.0), (1.8, 7, 3.8), GOLD, r=0.4)
        k.blob((sx * 5.4, -3.8, 12.0), 1.2, GOLD, u=5, v=3)
        k.blob((sx * 5.4, 3.0, 22.0), 1.3, SAFFRON, u=5, v=3)
    k.rbox((0, -6.6, 0), (9.4, 4.2, 1.6), "#F3E3B8", r=0.4)


@kind("chhatra", 1200)
def chhatra(k):
    """Parasol on a pole planted on the rim behind the dais. Origin = pole foot; canopy centre over it at z 104..117,
    well above a standing hero's head (80 px) so from the default camera it never reads as a halo (R6)."""
    k.lathe((0, 0, 0), [(0, 3.4), (1.2, 2.4), (2.4, 1.1)], "#C9A24A", sides=8, top=False)
    k.cyl((0, 0, 1.6), 0.9, 112, GOLD, sides=6, r_top=0.8)
    k.lathe((0, 0, 104), [(0, 19.0), (1.2, 19.4), (3.6, 17.2), (7.6, 11.4), (10.8, 5.0), (12.4, 0.8)], SAFFRON, sides=14,
            cols=["#F8E7B4", "#F6D083", SAFFRON, SAFFRON, "#F4983A", GOLD], bottom=True)
    for i in range(14):
        a = 2 * PI * i / 14
        k.blob((math.cos(a) * 19.4, math.sin(a) * 19.4, 104.6), (1.5, 1.5, 2.1), GOLD, u=5, v=3)
    k.blob((0, 0, 117.4), (1.5, 1.5, 2.2), GOLD, u=6, v=4)
    k.cone((0, 0, 119), 0.6, 3.6, GOLD, sides=5)


def export_landmarks(out_dir):

    objects, stats = clay.build_kinds(LANDMARKS)
    clay.export_glb(os.path.join(out_dir, "landmarks.glb"), [o for objs in objects.values() for o in objs.values()])
    for name, s in stats.items():
        s["budget"] = LANDMARKS[name]["budget"]
    return stats
