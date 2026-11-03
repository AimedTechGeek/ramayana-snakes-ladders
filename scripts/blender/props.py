"""Diorama props pack (T44 2.4): every scenery kind as one named node of ONE GLB, plus the manifest the app reads.

Run (headless):  node scripts/blender/run.mjs scripts/blender/props.py public/models/props src/app/board3d/propsManifest.json
Writes <dir>/props.glb, <dir>/landmarks.glb and the manifest (catalog for the T42 seed rule + measured triangles).
Authoring units are px of the T42 world (1 u = 56 px); the front of a prop faces -Y. See clay.py.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import clay  # noqa: E402
import landmarks  # noqa: E402
import lib  # noqa: E402

KINDS, kind = clay.kind_table()
PI = math.pi

# ---- pastel clay palette (T44 1.1, lifted toward white)
LEAF, LEAF2, LEAF3 = "#9BCB7E", "#82B966", "#B9DC93"
DARK, DARK2 = "#5F9A62", "#4E8756"
TRUNK, TRUNK2 = "#B08A5E", "#8F6B47"
STONE, STONE2, STONE3 = "#CBC6BC", "#A9A396", "#E4E0D6"
CREAM, SAND, THATCH = "#F6EBD0", "#EAD3A3", "#D9B877"
TERRA, ROOF, BRICK = "#E2956A", "#CB7E5B", "#C9694F"
SAFFRON, GOLD, BLOOD = "#F6A33B", "#EBC53C", "#B84A4A"
WHITE, PINK, BLUE, TEAL = "#F7F7FB", "#F3A9BB", "#82C2D8", "#4FB0A8"
INDIGO, INDIGO2, INK = "#5A5F9C", "#474C86", "#3A2F3F"
WOOD, WOOD2 = "#D2AE82", "#B58C5E"
RED, ORANGE, PURPLE = "#E56A5E", "#F4A04A", "#A98BD0"
CAVE = "#4A3E48"


def stalk(k, base, tip, col, r=0.5, sides=3):
    k.tube([base, tip], r, col, sides=sides, caps=False)


# =========================================================== mithila
@kind("mango-tree", 180, ["mithila"], "side", "sway", squares=None)
def mango_tree(k):
    k.lathe((0, 0, 0), [(0, 2.6), (3, 1.9), (9, 1.6)], TRUNK, sides=5, top=False)
    k.blob((0, 0, 14), (7, 6.2, 6), LEAF, u=7, v=5)
    k.blob((-4.5, 0.5, 11), (4.4, 4, 3.8), LEAF2, u=6, v=4)
    k.blob((4, -1, 10.5), (3.6, 3.4, 3.2), LEAF3, u=5, v=4)
    k.blob((2.2, -5, 11.5), 1.4, ORANGE, u=4, v=3)
    k.blob((-3, -4.5, 9.5), 1.3, SAFFRON, u=4, v=3)


@kind("rice-stripes", 24, ["mithila"], "side", "none", squares=[2, 3])
def rice_stripes(k):
    k.box((-2.4, 0, 0), (3.6, 30, 2.2), LEAF2)
    k.box((2.6, 0, 0), (3.6, 30, 2.6), LEAF3)


@kind("sage-hut", 140, ["mithila"], "side", "smoke", squares=[24])
def sage_hut(k):
    k.rbox((0, 0, 0), (10, 9, 6.5), CREAM, r=0.25)
    k.lathe((0, 0, 6), [(0, 8.6), (1, 8), (5.6, 0.6)], THATCH, sides=6, rot=PI / 6, squash=(1.0, 0.92), top=True)
    k.box((0, -4.8, 0), (2.6, 0.8, 4), WOOD2)
    k.box((-3.4, -4.7, 2.2), (1.8, 0.6, 1.8), BLUE)
    k.cyl((3.4, 1.5, 6.4), 1.1, 3.4, STONE2, sides=5)
    k.blob((-8.2, -2, 1.2), 1.2, LEAF2, u=4, v=3)


@kind("lamp", 60, ["mithila", "ayodhya"], "back", "flicker")
def lamp(k):
    k.lathe((0, 0, 0), [(0, 1.6), (0.8, 1.3), (8, 0.7)], STONE2, sides=4, top=False)
    k.box((0, 0, 8), (3.2, 3.2, 3.6), CREAM)
    k.blob((0, 0, 9.8), (1.1, 1.1, 1.4), "#FFD27A", u=5, v=3, glow=True)
    k.cone((0, 0, 11.6), 2.4, 1.8, TERRA, sides=4, rot=PI / 4)


@kind("plough", 80, ["mithila"], "back", "none", squares=[30])
def plough(k):
    k.tube([(0, -5, 2.2), (0, 1, 3.4), (0, 5, 3.2)], 0.7, WOOD2, sides=4)
    k.tube([(-1.6, 4, 3.2), (-2.2, 7, 5.8)], 0.55, WOOD2, sides=4)
    k.tube([(1.6, 4, 3.2), (2.2, 7, 5.8)], 0.55, WOOD2, sides=4)
    k.box((0, -3.4, 0), (1.2, 3, 3.2), STONE2)
    k.box((0, 0, 3.4), (4.4, 0.9, 0.8), TRUNK2)


@kind("peacock", 160, ["mithila"], "back", "sway")
def peacock(k):
    k.blob((0, 0, 3.4), (2.1, 3.2, 2.2), TEAL, u=6, v=4, rot=0)
    k.tube([(0, -2.4, 4), (0, -3.2, 6.2), (0, -3.4, 7.6)], [1.0, 0.8, 0.7], "#3F9AA8", sides=3)
    k.blob((0, -3.6, 8.2), 0.95, TEAL, u=5, v=3)
    k.cone((0, -4.5, 8.2), 0.4, 0.9, GOLD, sides=3, rot=(PI / 2, 0, 0))
    k.cone((0, 4.6, 5.6), 4.6, 3.6, "#69C7B9", sides=7, rot=(-PI / 2 + 0.9, 0, 0), squash=(1.0, 0.3))
    k.blob((-1.8, 5.2, 7.0), 0.75, GOLD, u=4, v=3)
    k.blob((1.8, 5.2, 7.0), 0.75, GOLD, u=4, v=3)
    for sx in (-1, 1):
        stalk(k, (sx * 0.9, 0, 2), (sx * 0.9, 0.2, 0), "#C9A24A", 0.35)


@kind("cow", 190, ["mithila"], "back", "none")
def cow(k):
    k.rbox((0, 0, 3.2), (4.6, 8.4, 3.8), CREAM, r=0.45)
    k.blob((0, -4.6, 6.6), (1.9, 1.8, 1.6), CREAM, u=6, v=4)
    for sx in (-1, 1):
        k.cone((sx * 1.4, -4.4, 7.7), 0.55, 1.1, "#EFE3BC", sides=3, rot=(0, sx * 0.6, 0))
        for sy in (-3, 3):
            k.cyl((sx * 1.4, sy, 0), 0.8, 3.4, "#E7D8B2", sides=4, top=True)
    k.blob((0.6, 0.6, 6.2), (1.6, 2.2, 0.8), "#B48866", u=5, v=3)
    k.tube([(0, 4.2, 6), (0, 5.3, 4.8), (0, 5.4, 3)], 0.35, "#E7D8B2", sides=3)


@kind("path-stone", 12, ["mithila"], "back", "none")
def path_stone(k):
    k.box((0, 0, 0), (6.4, 4.2, 1.4), STONE3, rot=0.25)


@kind("marigold-bush", 90, ["mithila"], "back", "sway")
def marigold_bush(k):
    k.blob((0, 0, 2.6), (3.8, 3.2, 2.8), LEAF2, u=6, v=4)
    for x, y, z in ((-2.2, -2.2, 4.6), (1.8, -2.6, 4.2), (0.2, 0.8, 5.6)):
        k.blob((x, y, z), 1.25, ORANGE, u=4, v=3)


@kind("haystack", 60, ["mithila"], "back", "none")
def haystack(k):
    k.lathe((0, 0, 0), [(0, 4.2), (3, 3.9), (6, 2.4), (8.4, 0.3)], "#E8CF84", sides=7, top=True)


@kind("potted-plant", 90, ["mithila", "ayodhya"], "back", "sway")
def potted_plant(k):
    k.lathe((0, 0, 0), [(0, 1.8), (2.2, 2.6), (3.6, 2.9)], TERRA, sides=6, top=True)
    k.blob((0, 0, 5.6), (2.8, 2.8, 2.4), LEAF, u=6, v=4)
    k.blob((1.2, -0.6, 7.2), 1.2, PINK, u=4, v=3)


# =========================================================== ayodhya
def crenels(k, n, z, colour, x0, span, size=(3.2, 2.6, 1.8), along="y"):
    for i in range(n):
        t = x0 + span * i / max(1, n - 1)
        k.box((0, t, z) if along == "y" else (t, 0, z), size, colour)


# T45.2 walkways: a wall's doorway sits at its middle, on the heroes' lane (the wall stands on the lane's line).
# The clear gap is 18 px = 0.45 u after the 1.4 render scale (a lane is 0.22 u; walkers starting on a fan slot sweep wider); the wall is 36 px long along Y.
WALL_LEN = 36.0
DOOR = 18.0
HALF_LEN = (WALL_LEN - DOOR) / 2   # each half of the wall
JAMB = 3.2


def doored_wall(k, h, body, cap, cap_z, crenel, plate):
    """Two wall halves around the doorway, a taller jamb pillar on each side of the gap, a crenel per half."""
    for s in (-1, 1):
        yc = s * (DOOR / 2 + HALF_LEN / 2)
        k.box((0, yc, 0), (7.4, HALF_LEN, h), body)
        k.box((0, yc, h), (8.6, HALF_LEN + 0.5, 1.6), cap)
        k.box((0, s * (DOOR / 2 + JAMB / 2), 0), (8.6, JAMB, h + 3.0), body)
        k.box((0, s * 13.0, cap_z), (4.4, 4.6, 3.2), crenel)
    k.box((0, -16.2, 0), (4.4, 0.8, 5.6), plate)


def wall_colliders():
    """Solid parts of a doored wall, px (Blender x, y): the two halves, jamb pillars included."""
    return [dict(x=[-4.3, 4.3], y=[DOOR / 2, WALL_LEN / 2 + 0.5]), dict(x=[-4.3, 4.3], y=[-WALL_LEN / 2 - 0.5, -DOOR / 2])]


COLLIDERS = {"rampart": wall_colliders(), "lanka-wall": wall_colliders()}
COLLIDERS.update(landmarks.COLLIDERS)


@kind("rampart", 120, ["ayodhya"], "side", "none", squares=[48, 47])
def rampart(k):
    doored_wall(k, 11, "#EFD9A8", "#E9C98A", 12.6, "#EFD9A8", "#B89A64")


@kind("dome", 160, ["ayodhya"], "side", "none", squares=[45])
def dome(k):
    k.rbox((0, 0, 0), (13, 13, 6), "#F1DDB0", r=0.3)
    k.lathe((0, 0, 6), [(0, 5.2), (1.6, 5.6), (5.4, 4.8), (8.4, 2.8), (10.4, 0.5)], "#F8F1E0", sides=8)
    k.cone((0, 0, 16.4), 0.5, 3.8, GOLD, sides=4)
    k.box((0, -6.6, 0), (3.4, 0.8, 4.4), "#B89A64")
    k.ring((0, 0, 6.0), 4.6, 5.4, GOLD, sides=8)


@kind("chariot", 220, ["ayodhya"], "side", "none", squares=[42])
def chariot(k):
    k.rbox((0, 0, 3.2), (7.4, 11, 3.6), "#EBC15A", r=0.4)
    k.box((-3.6, 1.2, 6.8), (0.9, 7.6, 3.4), "#F2D883")
    k.box((3.6, 1.2, 6.8), (0.9, 7.6, 3.4), "#F2D883")
    for sx in (-1, 1):
        k.cyl((sx * 4.4, 0, 3.6), 3.8, 1.2, TRUNK2, sides=8, rot=(0, PI / 2, 0), top=True, bottom=True)
    k.tube([(0, -5.4, 5), (0, -13, 3.6)], 0.7, TRUNK2, sides=4)
    k.tube([(0, 4.5, 6.8), (0, 4.5, 16.8)], 0.4, GOLD, sides=4)
    k.sheet((0.6, 4.5, 11.4), 5.2, 5.2, SAFFRON, cols=2, rows=2, wave=0.7, rot=PI / 2)


@kind("banner-saffron", 40, ["ayodhya"], "side", "sway")
def banner_saffron(k):
    k.cyl((0, 0, 0), 0.6, 16, STONE2, sides=4, r_top=0.45)
    k.blob((0, 0, 16), 0.9, GOLD, u=4, v=3)
    k.sheet((0, 0, 8.6), 5.4, 6.4, SAFFRON, cols=2, rows=2, wave=0.8, rot=PI / 2)


@kind("dark-tree", 160, ["ayodhya"], "side", "sway", squares=[37, 38, 39, 40])
def dark_tree(k):
    k.lathe((0, 0, 0), [(0, 2.4), (3, 1.7), (8, 1.5)], TRUNK2, sides=5, top=False)
    k.blob((0, 0, 10), (5.6, 5.4, 4.2), DARK, u=6, v=4)
    k.blob((0, 0, 15), (4.4, 4.2, 4.4), DARK2, u=6, v=4)
    k.blob((0, 0, 18.6), (2.6, 2.6, 3), DARK, u=6, v=4)
    k.blob((3.4, -3.4, 12), 1.2, GOLD, u=4, v=3)
    k.blob((-2.4, -3.8, 16), 1.1, GOLD, u=4, v=3)


@kind("fountain", 150, ["ayodhya"], "side", "shimmer")
def fountain(k):
    k.lathe((0, 0, 0), [(0, 6.4), (3, 6.8), (4.2, 6.2)], "#E7D6AE", sides=8, top=False)
    k.lathe((0, 0, 0), [(3.2, 5.6), (3.6, 5.6)], "#9ACFE0", sides=8, top=True)
    k.cyl((0, 0, 3.4), 0.9, 6, "#E7D6AE", sides=5, r_top=0.7)
    k.lathe((0, 0, 8.8), [(0, 2.8), (1.4, 3.1), (2.2, 2.6)], "#E7D6AE", sides=6, top=False)
    k.blob((0, 0, 10.6), (1.2, 1.2, 2.6), "#BDE4F0", u=5, v=4)
    k.blob((0, 0, 14), 0.9, "#E8F6FB", u=4, v=3)


@kind("bench", 70, ["ayodhya"], "back", "none")
def bench(k):
    k.box((0, 0, 2.6), (9.4, 3.4, 1.0), WOOD)
    k.box((0, 1.4, 4.2), (9.4, 0.9, 2.6), WOOD2)
    for sx in (-3.6, 3.6):
        k.box((sx, 0, 0), (1.0, 3, 2.8), STONE2)


# =========================================================== dandaka
@kind("sal-tree", 200, ["dandaka"], "side", "sway")
def sal_tree(k):
    k.lathe((0, 0, 0), [(0, 2.6), (3, 1.8), (11, 1.5)], TRUNK2, sides=5, top=False)
    k.blob((0, 0, 11.5), (5.8, 5.6, 4.4), "#6BA45F", u=7, v=4)
    k.blob((0.4, 0, 16), (4.6, 4.4, 4.2), "#7BB36B", u=7, v=4)
    k.blob((0, 0, 18.4), (3, 3, 3.2), "#8AC079", u=6, v=4)
    k.blob((-3.8, -2.8, 10.4), 1.5, "#5C9456", u=5, v=3)


@kind("vine-post", 90, ["dandaka"], "side", "sway")
def vine_post(k):
    k.cyl((0, 0, 0), 1.5, 17, TRUNK2, sides=5, r_top=1.0)
    k.tube([(1.2, 0, 15), (3.6, -1.6, 10), (1.6, -2.4, 4)], 0.45, DARK2, sides=3)
    k.tube([(-1.2, 0, 14), (-3.4, 1.2, 9), (-1.6, 2, 3)], 0.45, DARK, sides=3)
    k.blob((3.4, -1.6, 9), 1.1, LEAF, u=4, v=3)
    k.blob((-3.2, 1.2, 8), 1.1, LEAF2, u=4, v=3)


@kind("hidden-eyes", 8, ["dandaka"], "back", "flicker")
def hidden_eyes(k):
    for sx in (-1, 1):
        k.sheet((sx * 1.9, 0, 4.6), 2.2, 1.4, "#FFD84A", cols=2, rows=1, glow=True)
    # the kind is a pair of floating eyes only; the foliage hiding them is the neighbouring prop (spec: 8 tris)


@kind("panchavati-hut", 140, ["dandaka"], "side", "smoke", squares=[66])
def panchavati_hut(k):
    k.rbox((0, 0, 0), (9.6, 9.6, 2.6), WOOD, r=0.3)
    k.box((0, 0, 2.6), (8.4, 8.4, 4.2), "#EBD9AF")
    k.lathe((0, 0, 6.6), [(0, 8.4), (0.9, 7.8), (5.4, 0.5)], "#8DB86B", sides=6, rot=PI / 6)
    k.box((0, -4.6, 2.6), (2.4, 0.8, 3.6), WOOD2)
    k.cyl((3, 1.5, 6.6), 1.0, 3.2, STONE2, sides=5)


@kind("rock", 60, ["dandaka"], "back", "none")
def rock(k):
    k.blob((0, 0, 2.2), (4.2, 3.4, 2.6), STONE2, u=6, v=4)
    k.blob((3.2, -1, 1.2), (2, 1.8, 1.4), STONE, u=5, v=3)


@kind("fern", 70, ["dandaka"], "back", "sway")
def fern(k):
    for i in range(4):
        a = i * PI / 2 + 0.4
        k.blob((math.cos(a) * 1.6, math.sin(a) * 1.6, 1.6), (0.9, 3.4, 0.5), LEAF if i % 2 else LEAF3, u=4, v=3,
               rot=(0.5, 0, a + PI / 2))


@kind("reed", 30, ["dandaka", "ganga"], "back", "sway", squares=[49, 50, 71, 72, 73, 74])
def reed(k):
    for x, h in ((-1.4, 10.4), (0, 11), (1.5, 9)):
        stalk(k, (x, 0, 0), (x * 1.4, 0, h), "#8CBF6C", 0.4)
    k.cone((0, 0, 8), 0.8, 3, "#9A6B45", sides=4)


@kind("mushroom-cluster", 50, ["dandaka"], "back", "none")
def mushroom_cluster(k):
    k.cyl((0, 0, 0), 0.9, 3, CREAM, sides=4)
    k.lathe((0, 0, 3), [(0, 2.6), (0.8, 2.7), (2.2, 0.6)], RED, sides=6)


@kind("log-pile", 80, ["dandaka"], "back", "none")
def log_pile(k):
    for x, z in ((-2.2, 0), (2.2, 0), (0, 3.2)):
        k.cyl((x, 0, z + 1.8), 1.8, 7, TRUNK, sides=5, rot=(PI / 2, 0, 0), top=True, bottom=True)


# =========================================================== ganga
@kind("lotus-pad", 24, ["ganga"], "back", "shimmer")
def lotus_pad(k):
    k.disc((0, 0, 0.3), 3.2, LEAF2, sides=6)
    k.lathe((0.6, 0.4, 0.4), [(0, 1.0), (1.8, 1.4), (3.2, 0.2)], PINK, sides=3)


@kind("boat-post", 40, ["ganga"], "back", "sway")
def boat_post(k):
    k.cyl((0, 0, 0), 1.1, 8, TRUNK2, sides=4, r_top=0.9)
    k.blob((0, 0, 8.4), 1.2, GOLD, u=4, v=3)
    k.ring((0, 0, 4), 1.1, 1.7, "#E6D2A4", sides=4)


@kind("ghat-step", 48, ["ganga"], "back", "none")
def ghat_step(k):
    k.box((0, 0, 0), (8.6, 4.2, 1.8), STONE3)
    k.box((0, 0.6, 1.8), (7.4, 3.2, 1.8), STONE)
    k.box((0, 1.2, 3.6), (6.2, 2.4, 1.6), STONE3)


@kind("river-rock", 40, ["ganga"], "back", "shimmer")
def river_rock(k):
    k.blob((0, 0, 1.6), (3.2, 2.6, 2.0), "#9DB3BA", u=5, v=3)
    k.blob((2.6, 0.4, 0.8), (1.6, 1.4, 1.0), "#B6C7CC", u=4, v=3)


@kind("net-pole", 60, ["ganga"], "side", "sway")
def net_pole(k):
    k.cyl((0, -6, 0), 0.7, 13, TRUNK2, sides=4)
    k.cyl((0, 6, 0), 0.7, 11, TRUNK2, sides=4)
    k.sheet((0, 0, 4.6), 12.4, 6.2, "#E9DFC4", cols=3, rows=2, wave=0.8, rot=PI / 2)


@kind("fish-ripple", 8, ["ganga"], "back", "shimmer")
def fish_ripple(k):
    k.ring((0, 0, 0.2), 2.0, 4.0, "#F4F9FB", sides=4, rot=PI / 4)


# =========================================================== kishkindha
@kind("boulder", 70, ["kishkindha"], "back", "none")
def boulder(k):
    k.blob((0, 0, 2.6), (4.2, 3.6, 3), "#BE9871", u=6, v=4)
    k.blob((3.8, 0.6, 1.4), (2.0, 2.0, 1.6), "#AE8862", u=5, v=3)


@kind("cave-mouth", 120, ["kishkindha"], "side", "none", squares=[90])
def cave_mouth(k):
    k.blob((0, 0, 4.4), (8.2, 7, 7.6), "#C39D74", u=6, v=4)
    k.blob((0, -5.2, 3.0), (3.6, 1.2, 4.4), CAVE, u=6, v=4)
    k.blob((-3.4, -5, 6.6), (1.8, 1.6, 1.6), "#B58E67", u=5, v=3)
    k.blob((3.4, -5, 6.6), (1.8, 1.6, 1.6), "#B58E67", u=5, v=3)


@kind("waterfall", 100, ["kishkindha"], "side", "shimmer", squares=[96])
def waterfall(k):
    k.blob((0, 3, 7), (5, 3.4, 8), "#BC966F", u=6, v=4)
    k.sheet((0, -0.1, 0.6), 2.6, 15, "#A8DCEE", cols=1, rows=3, wave=0.5, glow=True)
    k.disc((0, -3.6, 0.2), 3.6, "#9ACFE0", sides=8)
    k.blob((0, -4.4, 0.9), (2.3, 1.2, 0.9), WHITE, u=5, v=3)


@kind("banana-plant", 110, ["kishkindha"], "side", "sway")
def banana_plant(k):
    k.cyl((0, 0, 0), 1.4, 7, "#9CC070", sides=5, r_top=1.0)
    for i in range(4):
        a = i * PI / 2 + 0.7
        k.blob((math.cos(a) * 2.8, math.sin(a) * 2.8, 9.2), (1.5, 4.8, 0.55), LEAF, u=4, v=3,
               rot=(0.45, 0, a + PI / 2))
    k.blob((0, -1.4, 5.4), 1.0, "#F1D55C", u=4, v=3)


@kind("berry-bush", 90, ["kishkindha"], "back", "sway", squares=[85])
def berry_bush(k):
    k.blob((0, 0, 2.8), (3.8, 3.4, 2.9), LEAF2, u=6, v=4)
    for x, y, z in ((-2, -2.6, 3.8), (1.6, -2.8, 4.4), (0.4, 1.6, 5.4)):
        k.blob((x, y, z), 0.95, "#D9515E", u=4, v=3)


@kind("basket", 80, ["kishkindha"], "back", "none", squares=[85])
def basket(k):
    k.lathe((0, 0, 0), [(0, 2.4), (2.4, 3.2), (4.2, 3.4)], "#D9B26A", sides=6, top=False)
    k.blob((-0.8, 0, 4.4), 1.3, "#D9515E", u=4, v=3)
    k.blob((1.2, -0.6, 4.2), 1.3, "#F1D55C", u=4, v=3)


@kind("monkey-frieze-stone", 100, ["kishkindha"], "back", "none")
def monkey_frieze(k):
    k.rbox((0, 0, 0), (6.4, 3.4, 8.2), "#C8A47B", r=0.3)
    k.blob((0, -1.7, 6.2), (1.6, 0.6, 1.4), "#E8B879", u=5, v=3)
    k.blob((0, -1.8, 4.0), (1.2, 0.5, 1.2), "#E8B879", u=5, v=3)
    k.box((0, 0, 8.1), (7.6, 4.2, 1.3), "#B58E67")


@kind("hill", 160, ["kishkindha"], "side", "none", squares=[97])
def hill(k):
    k.lathe((0, 0, 0), [(0, 8.4), (4, 7.2), (10, 4.4), (16.4, 0.8)], "#C9A275", sides=7, squash=(0.9, 1.0))
    k.blob((0, -2, 17), (3.6, 3, 2), "#B8916A", u=5, v=3)
    k.blob((-3.4, -3, 7.4), 2.2, LEAF2, u=5, v=3)
    k.blob((3.6, -3.4, 9), 2.0, LEAF, u=5, v=3)


# =========================================================== sea
@kind("wave-crest", 20, ["sea"], "back", "shimmer")
def wave_crest(k):
    k.blob((0, 0, 2.6), (5.2, 1.6, 3.2), "#F2F8FB", u=5, v=3)


@kind("rock-stack", 90, ["sea"], "back", "shimmer")
def rock_stack(k):
    k.blob((0, 0, 2.6), (4.6, 4.2, 2.8), "#97938A", u=6, v=4)
    k.blob((0.4, 0, 6), (3.2, 3, 2.2), "#A9A59B", u=5, v=3)
    k.blob((0.2, 0, 8.4), (2, 1.9, 1.5), "#BBB7AD", u=5, v=3)


@kind("buoy-stone", 40, ["sea"], "back", "shimmer")
def buoy_stone(k):
    k.lathe((0, 0, 0), [(0, 3.2), (4, 2.8), (8, 1.4), (10.4, 0.5)], BRICK, sides=5,
            cols=[BRICK, BRICK, WHITE, WHITE])


@kind("foam-ring", 8, ["sea"], "back", "shimmer")
def foam_ring(k):
    k.ring((0, 0, 0.2), 2.4, 4.6, "#F6FAFC", sides=4, rot=PI / 4)


@kind("shell", 40, ["sea"], "back", "none")
def shell(k):
    k.lathe((0, 0, 0), [(0, 3.2), (1.4, 3.0), (3.6, 0.5)], "#F5D0C2", sides=6, squash=(1, 0.8), rot=0.5)


@kind("gull-perch", 80, ["sea"], "back", "sway")
def gull_perch(k):
    k.cyl((0, 0, 0), 1.0, 8.2, TRUNK2, sides=4, r_top=0.8)
    k.blob((0, 0, 10.4), (1.9, 2.8, 1.9), WHITE, u=6, v=4)
    k.blob((0, -1.8, 11.6), 1.2, WHITE, u=5, v=3)
    k.cone((0, -3.2, 11.6), 0.5, 1.2, ORANGE, sides=3, rot=(PI / 2, 0, 0))


# =========================================================== lanka
@kind("lanka-wall", 120, ["lanka"], "side", "none", squares=[121, 132])
def lanka_wall(k):
    doored_wall(k, 11.5, INDIGO, GOLD, 13, INDIGO, INDIGO2)


@kind("tower-banner", 150, ["lanka"], "side", "sway", squares=[125, 129])
def tower_banner(k):
    k.lathe((0, 0, 0), [(0, 5.2), (13, 4.2), (14.4, 5.6)], INDIGO2, sides=6, top=False,
            cols=[INDIGO2, INDIGO, GOLD])
    k.lathe((0, 0, 14.4), [(0, 5.6), (5.2, 0.4)], INDIGO, sides=6)
    k.tube([(0, 0, 19), (0, 0, 21.4)], 0.4, GOLD, sides=3)
    k.sheet((0, 0, 14.8), 3.4, 4.4, BLOOD, cols=1, rows=2, wave=0.6, rot=PI / 2)
    k.box((0, -4.9, 0), (2.4, 0.7, 4.2), GOLD)


@kind("arrow-stack", 60, ["lanka"], "back", "none", squares=[123, 131])
def arrow_stack(k):
    k.cyl((0, 0, 0), 2.6, 5, "#B58C5E", sides=5)
    for i, x in enumerate((-1.4, -0.4, 0.7, 1.7)):
        stalk(k, (x, 0, 4.6), (x * 1.5, 0.2, 10.6), "#E0C48A", 0.28)
    k.cone((0, 0, 10.2), 0.7, 1.2, STONE2, sides=3)


@kind("fire", 30, ["lanka"], "back", "flicker", variety=False, squares=[134, 136])
def fire(k):
    k.cone((0, 0, 0.8), 1.8, 7, "#FF9A2E", sides=3, glow=True)
    k.cone((0.6, 0.3, 0.8), 1.1, 5, "#FFD05A", sides=3, glow=True)
    stalk(k, (-2.4, -1, 0.6), (2.4, 1, 1.0), TRUNK2, 0.7)
    stalk(k, (-2.4, 1, 0.6), (2.4, -1, 1.0), TRUNK, 0.7)


@kind("broken-banner", 90, ["lanka"], "side", "sway", squares=[137], double_sided=True)
def broken_banner(k):
    k.tube([(0, 0, 0), (0.6, 0, 11), (3.6, 0.4, 16)], 0.55, TRUNK2, sides=4)
    k.sheet((0, 0.2, 5), 4.6, 6.4, "#9C4B58", cols=2, rows=3, wave=0.7, rot=PI / 2)
    # ten crown marks (small gold triangles), never heads (RESPECT T42 5.6 #2)
    for i in range(10):
        col, row = i % 5, i // 5
        a = (-1.7 + col * 0.85, -0.5, 7.1 + row * 2.0)
        k.tri(a, (a[0] + 0.5, a[1], a[2]), (a[0] + 0.25, a[1], a[2] + 0.6), GOLD)
    k.box((0, 0, 0), (4, 4, 1.6), INDIGO2)


@kind("gold-lamp", 70, ["lanka"], "back", "flicker")
def gold_lamp(k):
    k.lathe((0, 0, 0), [(0, 2.2), (1.2, 1.4), (8, 0.8)], GOLD, sides=5, top=False)
    k.lathe((0, 0, 8), [(0, 1.0), (1.4, 2.6), (2.4, 2.8)], GOLD, sides=6, top=False)
    k.cone((0, 0, 10.4), 1.4, 3.2, "#FFB43C", sides=4, glow=True)


@kind("terrace-step", 24, ["lanka"], "back", "none")
def terrace_step(k):
    k.box((0, 0, 0), (9.4, 4.4, 2.4), INDIGO)
    k.box((0, 0.8, 2.4), (8.2, 3.2, 1.8), "#6B70AE")


# =========================================================== air (ambient meshes, not placed on blocks)
@kind("bird", 70, [], "back", "none", variety=False, fly=True)
def bird(k):
    k.blob((0, 0, 0), (1.5, 2.8, 1.4), "#EDEDF2", u=5, v=3)
    for sx in (-1, 1):
        k.blob((sx * 3.4, 0, 0.2), (3.4, 1.3, 0.35), "#DADCE6", u=4, v=3)
    k.cone((0, -3.2, 0.1), 0.55, 1.4, ORANGE, sides=3, rot=(PI / 2, 0, 0))
    k.sheet((0, 3, 0), 1.8, 2.4, "#C8CBD8", cols=1, rows=1, vertical=False)


@kind("butterfly", 8, [], "back", "none", variety=False, fly=True, double_sided=True)
def butterfly(k):
    for sx in (-1, 1):
        k.sheet((sx * 0.9, 0, 0), 1.8, 1.8, "#F8D56B", cols=1, rows=1, vertical=False)


def colliders_of(name):
    """Solid parts (board units, three-space x / z) for kinds with a doorway; others use their footprint box."""
    parts = COLLIDERS.get(name)
    if not parts:
        return {}
    return {"colliders": [dict(x=[round(p["x"][0] / 56, 4), round(p["x"][1] / 56, 4)],
                              z=[round(-p["y"][1] / 56, 4), round(-p["y"][0] / 56, 4)]) for p in parts]}


def main():
    out_dir, manifest_path = sys.argv[sys.argv.index("--") + 1:][:2]
    os.makedirs(out_dir, exist_ok=True)
    lib.reset_scene()
    clay._MAT.clear()
    objects, stats = clay.build_kinds(KINDS)
    flat = [o for objs in objects.values() for o in objs.values()]
    clay.export_glb(os.path.join(out_dir, "props.glb"), flat)
    lm_stats = landmarks.export_landmarks(out_dir)
    for name, s in lm_stats.items():
        s.update(colliders_of(name))

    kinds = {}
    for name, meta in KINDS.items():
        s = stats[name]
        kinds[name] = dict(kind=name, regions=meta["regions"], zone=meta["zone"], height=s["height"],
                           anim=meta["anim"], variety=meta["variety"], fly=meta["fly"], glow=s["glow"],
                           tris=s["tris"], budget=meta["budget"], glb="props", landmark=False,
                           footprint=s["footprint"], **colliders_of(name),
                           **({"squares": meta["squares"]} if meta["squares"] else {}))
    for name, meta in landmarks.CATALOG.items():
        s = lm_stats[name]
        kinds[name] = dict(kind=name, regions=meta["regions"], zone=meta["zone"], height=s["height"],
                           anim=meta["anim"], variety=False, fly=False, glow=s["glow"], tris=s["tris"],
                           budget=meta["budget"], glb="landmarks", landmark=True, footprint=s["footprint"],
                           **colliders_of(name),
                           **({"squares": meta["squares"]} if meta["squares"] else {}))
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump({"kinds": kinds, "landmarkMeshes": {n: s for n, s in lm_stats.items()},
                   "bytes": {f: os.path.getsize(os.path.join(out_dir, f)) for f in ("props.glb", "landmarks.glb")}},
                  fh, indent=1)
    over = [n for n, v in kinds.items() if v["tris"] > v["budget"]]
    print("PROPS kinds:", len(kinds), "total tris:", sum(v["tris"] for v in kinds.values()), "over budget:", over)
    for n, v in kinds.items():
        print(f"  {n:22s} tris {v['tris']:4d}/{v['budget']:<4d} h {v['height']:5.1f}")


main()
