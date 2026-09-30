"""Layout of the retreat, ported object by object from src/Sauna.jsx (three.js coordinates: y up, z towards viewer)."""
import glob
import math
import os

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

from scene_kit import (C, TAU, Curve, bl, collection, find_layer_collection, g_box, g_capsule, g_circle, g_custom, g_cyl,
                       g_lathe, g_plane, g_ring, g_sphere, g_torus, load_asset, add_snow_to_asset_materials, perlin, rng,
                       rot, scatter, seg_dist, setup_world, smooth, trs, hdri_sun_direction, HDRI)

pi = math.pi
sin, cos = math.sin, math.cos
POOL = (-19., 20.)
POND = dict(x=-28.6, z=-20.6, rx=4.4, rz=3.1)
INLET = Curve([(-64, -37), (-55, -31), (-46, -27), (-38, -24), (-32.8, -21.8)])
OUTLET = Curve([(-25.4, -23), (-25, -28.5), (-24.2, -34), (-22.8, -42), (-21.2, -52), (-20, -64)])
STREAM = [p for c in (INLET, OUTLET) for p in c.spaced(160)]
_stream_kd = KDTree(len(STREAM))
for i, p in enumerate(STREAM):
    _stream_kd.insert((p.x, p.z, 0), i)
_stream_kd.balance()


def stream_dist(x, z):
    return _stream_kd.find((x, z, 0))[2]


def wobble(a):
    return 1 + .07 * sin(3 * a) + .05 * sin(5 * a + 1)


def terrain_height(x, z):
    d = min(math.hypot(x, z), math.hypot(x - 101, z + 70) + 22, seg_dist(x, z, 30, -29, 101, -59) + 40)
    amp = smooth(60, 190, d)
    return amp * ((perlin(x * .009, z * .009, 1.7) * .5 + .5) * 16 + perlin(x * .035, z * .035, 4.1) * 3) if amp else 0.


def ground_y(x, z):
    return -.225 + terrain_height(x, z)


def carved_y(x, z):
    """Ground with the stream bed, pond bowl and pool basin cut into it."""
    y = ground_y(x, z)
    d = stream_dist(x, z)
    if d < 1.6:
        y -= .3 * smooth(1.6, .2, d)
    px, pz = (x - POND['x']) / POND['rx'], (z - POND['z']) / POND['rz']
    a = math.atan2(pz, px)
    r = math.hypot(px, pz) / wobble(a)
    if r < 1.15:
        y = min(y, -.225 - .64 * smooth(1.12, .2, r))
    qx, qz = (x - POOL[0]) / 5.7, (z - POOL[1]) / 3.95
    if qx * qx + qz * qz < 1:
        y = min(y, -.75)
    return y


# ---------------------------------------------------------------- small helpers mirroring the web scene
def piers(B, x0, x1, z0, z1, top):
    nx = max(2, round((x1 - x0) / 1.5) + 1)
    nz = max(2, round((z1 - z0) / 1.5) + 1)
    for i in range(nx):
        for j in range(nz):
            B.box(.2, top + .25, .2, 'concrete', x0 + (x1 - x0) * i / (nx - 1), (top - .25) / 2, z0 + (z1 - z0) * j / (nz - 1))


def log(B, M, side='barkLog', cap='endgrain', seg=10):
    Mc = M @ rot(rz=pi / 2)
    B.add(g_cyl(1, 1, 1, seg, open_=True), side, Mc)
    B.add_raw(g_circle(1, seg), cap, Mc @ trs(0, .5, 0, rx=-pi / 2))
    B.add_raw(g_circle(1, seg), cap, Mc @ trs(0, -.5, 0, rx=pi / 2))


def flip(geom):
    V, F, UV, s = geom
    return V, [tuple(reversed(f)) for f in F], [list(reversed(u)) for u in UV], s


def limb(B, a, b, r, mat, G):
    d = b - a
    M = Matrix.Translation((a + b) / 2) @ Vector((0, 1, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    B.add(g_capsule(r, max(.01, d.length), 3, 10), mat, G @ M, coll='People')


def person(B, pose, x, y, z, ry, S=.45, W=0., robe=None):
    """Faceless figure for scale, in the manner of an architectural model."""
    V = Vector
    body = robe or 'skin'
    w = 1 if pose == 'walk' else 0
    if pose == 'sit':
        J = dict(p=V((0, S + .1, 0)), c=V((0, S + .5, -.04)), h=V((0, S + .77, -.03)), hip=[V((-.09, S + .1, 0)), V((.09, S + .1, 0))],
                 knee=[V((-.1, S + .1, .42)), V((.1, S + .1, .42))], ank=[V((-.1, .08, .46)), V((.1, .08, .46))],
                 sh=[V((-.19, S + .55, -.03)), V((.19, S + .55, -.03))], el=[V((-.22, S + .3, .08)), V((.22, S + .3, .08))],
                 wr=[V((-.16, S + .17, .3)), V((.16, S + .17, .3))], foot=V((0, 0, 1)))
    elif pose == 'lie':
        J = dict(p=V((0, .66, -.38)), c=V((0, .86, -.78)), h=V((0, 1.02, -1.03)), hip=[V((-.09, .64, -.35)), V((.09, .64, -.35))],
                 knee=[V((-.09, .68, .08)), V((.09, .68, .08))], ank=[V((-.09, .64, .52)), V((.09, .64, .52))],
                 sh=[V((-.19, .89, -.83)), V((.19, .89, -.83))], el=[V((-.27, .73, -.58)), V((.27, .73, -.58))],
                 wr=[V((-.23, .67, -.32)), V((.23, .67, -.32))], foot=V((0, 1, .3)))
    elif pose == 'bathe':
        J = dict(p=V((0, W - .3, 0)), c=V((0, W + .16, 0)), h=V((0, W + .44, 0)), hip=None,
                 sh=[V((-.19, W + .21, 0)), V((.19, W + .21, 0))], el=[V((-.32, W + .01, .12)), V((.32, W + .01, .12))],
                 wr=[V((-.3, W - .06, .34)), V((.3, W - .06, .34))])
    else:
        J = dict(p=V((0, .95, 0)), c=V((0, 1.36, 0)), h=V((0, 1.64, 0)), hip=[V((-.09, .93, 0)), V((.09, .93, 0))],
                 knee=[V((-.09, .5, .12 * w)), V((.09, .5, -.08 * w))], ank=[V((-.09, .08, .22 * w)), V((.09, .08, -.2 * w))],
                 sh=[V((-.19, 1.43, 0)), V((.19, 1.43, 0))], el=[V((-.23, 1.14, -.1 * w)), V((.23, 1.14, .1 * w))],
                 wr=[V((-.24, .88, -.16 * w + .03)), V((.24, .88, .18 * w + .03))], foot=V((0, 0, 1)))
    G = trs(x, y, z, ry=ry)
    limb(B, J['p'], J['c'], .14, body, G)
    limb(B, J['sh'][0], J['sh'][1], .07, body, G)
    limb(B, J['c'], J['h'], .05, 'skin', G)
    B.add(g_sphere(.1, 16, 12), 'skin', G @ Matrix.Translation(J['h']) @ Matrix.Diagonal((1, 1.15, 1, 1)), coll='People')
    for k in range(2):
        limb(B, J['sh'][k], J['el'][k], .047, body, G)
        limb(B, J['el'][k], J['wr'][k], .04, 'skin', G)
        if J['hip']:
            limb(B, J['hip'][k], J['knee'][k], .07, 'skin', G)
            limb(B, J['knee'][k], J['ank'][k], .058, 'skin', G)
            limb(B, J['ank'][k], J['ank'][k] + J['foot'] * .14, .045, 'skin', G)
    if J['hip']:
        limb(B, J['hip'][0], J['hip'][1], .095, body, G)


def world_point(B, x, y, z):
    """Current builder transform applied to a three.js point (still in three.js space)."""
    return tuple(B.stack[-1] @ Vector((x, y, z)))


def light(L, B, x, y, z, color, day, dusk, radius=.1, kind='POINT', size=None):
    L['lights'].append(dict(pos=world_point(B, x, y, z), color=color, day=day, dusk=dusk, radius=radius, kind=kind, size=size))


# ---------------------------------------------------------------- buildings
def finnish_sauna(B, L):
    for i in range(37):
        B.box(.155, .16, 7, 'deck', -3 + i * .165, 0, 1.2)
    piers(B, -2.9, 2.85, -2.1, 4.5, -.08)
    piers(B, 3.1, 4.45, -1.8, 1, -.08)
    for w, d, x, z in ((8.9, .45, .6, -2.55), (.45, 7.6, -3.75, 1.2)):
        B.box(w, .05, d, 'gravel', x, -.2, z)
    B.box(2.6, .24, 2.6, 'concrete', 4.35, -.11, 2.7)
    for i in range(3):
        for z in (4.9, 6.5):
            B.box(.16, .35, .16, 'concrete', -.7 + i * .72, -.075, z)
    for i in range(32):
        B.box(.17, 2.65, .16, 'charred' if i % 4 == 0 else 'wood', -2.8 + i * .18, 1.43, -2)

    def roof_under(z):
        return 2.95 + z * .0889
    for k in range(21):
        zz = -1.85 + k * .18
        h = roof_under(zz) - .105
        for x in (-2.88, 2.88):
            B.box(.15, h, .17, 'wood', x, .105 + h / 2, zz)
    for x in (-2.8, 0, 2.8):
        B.box(.09, 2.65, .1, 'charred', x, 1.43, 1.96)
    B.box(5.6, 2.5, .025, 'glass', 0, 1.4, 1.96)
    B.box(5.8, .1, .1, 'charred', 0, 2.73, 1.96)
    B.box(.045, 2.5, .06, 'charred', 1.86, 1.4, 1.975)
    for j in range(2):
        B.box(5.9, .17, .05, 'wood', 0, 2.87 + j * .17, 1.97)
    B.push(trs(-.25, 3.04, .1, rx=-math.atan(.0889)))
    B.box(7.2, .16, 5.5, 'metalRoof', 0, 0, 0)
    for i in range(15):
        B.box(.035, .05, 5.5, 'metalRoof', -3.5 + i * .5, .1, 0)
    for s in (-1, 1):
        B.box(7.24, .3, .05, 'wood', 0, -.05, s * 2.77)
        B.box(.05, .3, 5.58, 'wood', s * 3.62, -.05, 0)
    B.box(7.1, .1, .14, 'steel', 0, -.16, -2.85)
    B.pop()
    B.cyl(.04, .04, 2.9, 'steel', 3.25, 1.45, -2.72, 8)
    for z, y in ((-1.15, .88), (-.45, .48)):
        for j in range(5):
            B.box(4.6, .09, .105, 'wood', -.35, y, z + j * .115)
        for x in (-2.25, 1.55):
            B.box(.09, y, .48, 'charred', x, y / 2, z + .23)
    for j in range(3):
        B.box(4.6, .105, .065, 'wood', -.35, 1.18 + j * .16, -1.81)
    B.box(4.45, .022, .025, 'led', -.35, .78, -1.35)
    B.box(.34, .1, .14, 'wood', -2.3, 1.0, -1.3, rx=-.4)
    # Stove: steel body, glowing firebox facing the glass, open cage of sauna stones, flue through the roof.
    B.box(.54, .6, .48, 'steel', 1.9, .43, .55)
    for dx, dz in ((-.22, -.18), (.22, -.18), (-.22, .18), (.22, .18)):
        B.box(.05, .1, .05, 'steel', 1.9 + dx, .08, .55 + dz)
    B.box(.36, .26, .015, 'charred', 1.9, .36, .79)
    B.box(.28, .18, .02, 'fire', 1.9, .36, .8)
    for dx, dz in ((-.24, -.2), (.24, -.2), (-.24, .2), (.24, .2)):
        B.box(.025, .5, .025, 'steel', 1.9 + dx, .98, .55 + dz)
    for s in (-1, 1):
        B.box(.5, .025, .025, 'steel', 1.9, 1.22, .55 + s * .2)
        B.box(.025, .025, .42, 'steel', 1.9 + s * .24, 1.22, .55)
    for _ in range(46):
        L['stones'].append((world_point(B, 1.9 + (rng.random() - .5) * .42, .74 + rng.random() * .42, .55 + (rng.random() - .5) * .34), .55 + rng.random() * .45))
    B.cyl(.075, .075, 3.6, 'steel', 1.9, 2.55, .3, 12)
    B.add(g_cyl(0, .2, .16, 16), 'steel', trs(1.9, 4.5, .3))
    for a in (0, 2.1, 4.2):
        B.box(.015, .14, .015, 'steel', 1.9 + cos(a) * .1, 4.39, .3 + sin(a) * .1)
    B.cyl(.13, .2, .14, 'steel', 1.9, roof_under(.3) + .26, .3)
    light(L, B, 0, 2.1, -1, (1, .72, .45), 90, 160, .3)
    light(L, B, 1.9, .45, 1.1, (1, .45, .15), 25, 60, .08, 'FIRE')
    L['smoke'].append((world_point(B, 1.9, 4.55, .3), 'chimney'))
    L['steam'].append((world_point(B, 1.9, 1.25, .55), 'stones'))
    # Interior: bucket and ladle, thermometer, slatted corner lamp, towels.
    B.cyl(.13, .1, .22, 'wood', 1.25, .64, -.38)
    for y in (.58, .7):
        B.add(g_torus(.12, .008, 6, 24), 'steel', trs(1.25, y, -.38, rx=pi / 2))
    B.add(g_circle(.11, 20), 'bucketWater', trs(1.25, .73, -.38, rx=-pi / 2))
    B.add(g_cyl(.012, .012, .5, 6), 'wood', trs(1.36, .86, -.36, rz=-.45))
    B.add(g_sphere(.05, 10, 6, 0, TAU, pi / 2, pi / 2), 'wood', trs(1.22, .72, -.37))
    B.add(g_cyl(.09, .09, .025, 24), 'wood', trs(-1.5, 2.05, -1.905, rx=pi / 2))
    B.add(g_cyl(.072, .072, .03, 24), 'linen', trs(-1.5, 2.05, -1.9, rx=pi / 2))
    B.box(.005, .06, .004, 'charred', -1.5, 2.07, -1.884)
    B.box(.12, .22, .12, 'lampGlow', -2.62, 2.25, -1.74)
    for i in range(5):
        B.box(.025, .3, .02, 'wood', -2.7 + i * .04, 2.25, -1.66)
    B.box(.55, .05, .38, 'towel2', -1.5, .955, -1.15)
    B.box(.5, .05, .36, 'towel0', .4, .955, -1.1)
    person(B, 'sit', -1.5, .525, -.95, 0, S=.4)
    person(B, 'sit', .4, .525, -.95, 0, S=.4, robe='robe0')
    person(B, 'stand', 2.7, .08, 3.6, pi / 2, robe='robe0')
    person(B, 'bathe', 4.5, 0, 2.7, -pi / 2, W=.91)
    # Cold plunge: staves, lining, hoops, water and two timber steps.
    B.add(g_cyl(.89, .82, .92, 64, open_=True), 'lining', trs(4.5, .49, 2.7))
    B.add(g_cyl(.84, .84, .05, 48), 'lining', trs(4.5, .08, 2.7))
    for i in range(48):
        a = i / 48 * TAU
        B.box(.119, 1, .095, 'wood', 4.5 + sin(a) * .94, .5, 2.7 + cos(a) * .94, ry=a)
    B.add(g_cyl(.87, .87, .78, 64), 'poolWater', trs(4.5, .52, 2.7), coll='Water')
    B.add(g_torus(.942, .064, 10, 96), 'wood', trs(4.5, 1, 2.7, rx=pi / 2))
    for y in (.18, .76):
        B.add(g_torus(.95, .025, 8, 48), 'steel', trs(4.5, y, 2.7, rx=pi / 2))
    B.box(.25, .3, .7, 'wood', 3.22, .15, 2.7)
    B.box(.2, .6, .7, 'wood', 3.45, .3, 2.7)
    L['steam'].append(((4.5, .95, 2.7), 'tub'))
    for x in (-1.8, .1):
        B.box(.9, .12, 1.65, 'wood', x, .38, 3.3)
        for z in (2.65, 3.9):
            B.box(.1, .34, .1, 'charred', x, .17, z)
    for i in range(3):
        B.box(.6, .16, 2.1, 'deck', -.7 + i * .72, .18, 5.7)
    for z in (-1.91, 1.91):
        B.box(5.8, .095, .1, 'wood', 0, .22, z)
    for i in range(37):
        for z in (-1.8, 4.4):
            B.cyl(.012, .012, .004, 'steel', -3 + i * .165, .083, z, 6)
    # Firewood under the roof overhang, chopping block and axe, slippers and a planter.
    for x in (-3.42, -3.18):
        B.box(.08, .26, 3.5, 'wood', x, -.07, -.1)
    n = 0
    for row in range(11):
        for i in range(22):
            if n >= 240 or (row > 8 and rng.random() < .35):
                continue
            r = .055 + rng.random() * .022
            log(B, trs(-3.3 + (rng.random() - .5) * .05, .13 + row * .135, -1.75 + i * .155 + (row % 2) * .075,
                       rng.random() * .5, 0, (rng.random() - .5) * .04, s=(.42 + rng.random() * .05, r, r)))
            n += 1
    log(B, trs(-4.25, .01, 2.5, rz=pi / 2, s=(.46, .25, .25)))
    B.add(g_cyl(.018, .022, .72, 8), 'wood', trs(-4.18, .52, 2.62, .62, 0, -.3))
    B.box(.03, .1, .16, 'steel', -4.24, .26, 2.47, rx=.62)
    for x, r in ((1.12, .12), (1.3, .05), (1.55, -.08), (1.72, -.02)):
        B.box(.1, .04, .25, 'towel3' if r > 0 else 'towel1', x, .1, 2.55, ry=r)
    B.box(.5, .45, .5, 'ceramic', -2.6, .3, 4.15)
    L['small_plants'] += [(world_point(B, -2.6 + cos(i * 2.4) * .12, .52, 4.15 + sin(i * 2.4) * .12), 1.6) for i in range(7)]
    # Changing room annex: bench, robes on hooks, a shower and a door open to the deck.
    B.box(1.65, .16, 3.2, 'deck', 3.78, 0, -.4)
    for i in range(9):
        B.box(.18, 2.4, .14, 'wood', 3.05 + i * .18, 1.28, -1.98)
    for i in range(17):
        B.box(.14, 2.4, .17, 'wood', 4.56, 1.28, -1.88 + i * .18)
    for x in (3.05, 3.23, 4.19, 4.37, 4.5):
        B.box(.18, 2.4, .14, 'wood', x, 1.28, 1.12)
    B.box(.82, .3, .14, 'wood', 3.7, 2.33, 1.12)
    B.box(.8, 2.05, .05, 'wood', 4.1 - .4 * cos(1.1), 1.1, 1.12 + .4 * sin(1.1), ry=1.1)
    B.box(.03, .18, .03, 'chrome', 3.8, 1.05, 1.76)
    B.box(1.95, .14, 3.5, 'metalRoof', 3.78, 2.55, -.4)
    for s in (-1, 1):
        B.box(1.99, .22, .05, 'wood', 3.78, 2.52, -.4 + s * 1.76)
    B.box(.05, .22, 3.5, 'wood', 4.77, 2.52, -.4)
    B.box(.42, .06, 2, 'wood', 4.28, .46, -.55)
    for z in (-1.4, .3):
        B.box(.36, .4, .06, 'charred', 4.28, .24, z)
    B.box(1.1, .06, .04, 'wood', 3.75, 1.72, -1.9)
    for x, m in ((3.5, 'towel2'), (4, 'towel0')):
        B.box(.38, .85, .06, m, x, 1.26, -1.86)
    B.cyl(.018, .018, 2.05, 'chrome', 3.2, 1.12, -1.82, 8)
    B.box(.03, .03, .22, 'chrome', 3.2, 2.12, -1.72)
    B.cyl(.09, .09, .02, 'chrome', 3.2, 2.1, -1.6, 16)
    for i in range(6):
        B.box(.7, .02, .08, 'charred', 3.3, .1, -1.9 + i * .13)
    light(L, B, 3.78, 2.3, -.4, (1, .78, .55), 0, 25, .15)
    sign(B, L, 'FINSKÁ', 0, 2.02, y=2.95, w=1.9, h=.3, posts=False)


def green_roof(B, L, w, d, x, y, z):
    B.box(w, .2, d, 'charred', x, y, z)
    B.box(w - .24, .08, d - .24, 'sedum', x, y + .13, z)
    for s in (-1, 1):
        B.box(w + .06, .32, .06, 'wood', x, y + .08, z + s * (d / 2 + .03))
        B.box(.06, .32, d, 'wood', x + s * (w / 2 + .03), y + .08, z)
    for _ in range(int(w * d * 5)):
        L['roof_plants'].append((world_point(B, x + (rng.random() - .5) * (w - .4), y + .17, z + (rng.random() - .5) * (d - .4)), .7 + rng.random() * .8))


def herbal_sauna(B, L):
    B.push(trs(-34, 0, 2, ry=-.32 * pi) @ trs(24, 0, 7))
    B.box(8, .18, 3.7, 'deck', -24, 0, -8.5)
    B.box(3.3, .18, 4.7, 'deck', -26.35, 0, -4.3)
    piers(B, -27.8, -20.2, -10.1, -6.9, -.09)
    piers(B, -27.8, -24.9, -6.2, -2.2, -.09)
    light(L, B, -24, 2.3, -8.5, (1, .72, .45), 0, 60, .3)
    for i in range(44):
        B.box(.17, 2.8, .14, 'wood', -27.9 + i * .18, 1.5, -10.3)
    for i in range(43):
        B.box(.14, 2.8, .17, 'wood', -28, 1.5, -10.2 + i * .18)
    for i in range(20):
        B.box(.14, 2.8, .17, 'wood', -20, 1.5, -10.2 + i * .18)
    B.box(4.7, 2.7, .025, 'glass', -22.35, 1.5, -6.65)
    B.box(.025, 2.7, 4.5, 'glass', -24.7, 1.5, -4.35)
    B.box(3.3, 2.7, .025, 'glass', -26.35, 1.5, -2)
    for i in range(5):
        B.box(.05, 2.7, .06, 'charred', -24.7 + i * 1.175, 1.5, -6.64)
    for i in range(4):
        B.box(.06, 2.7, .05, 'charred', -24.69, 1.5, -6.6 + i * 1.5)
    for i in range(3):
        B.box(.05, 2.7, .06, 'charred', -28 + i * 1.65, 1.5, -1.99)
    green_roof(B, L, 8.3, 3.9, -24, 3, -8.5)
    green_roof(B, L, 3.5, 4.7, -26.35, 3, -4.3)
    for row in range(2):
        B.box(6.8, .12, .6, 'wood', -24, .55 + row * .4, -9.4 + row * .7)
        B.box(.6, .12, 6.5, 'wood', -27.1 + row * .7, .55 + row * .4, -6.3)
    # Steam generator clad in stone with a copper bowl of herbs; dried bundles hang from the ceiling.
    B.box(.7, .8, .7, 'paving', -21.2, .5, -8.4)
    B.cyl(.26, .18, .12, 'copper', -21.2, .96, -8.4, 20)
    for i in range(5):
        B.add(g_sphere(.07, 8, 6), 'herb0', trs(-21.2 + (rng.random() - .5) * .25, 1.02, -8.4 + (rng.random() - .5) * .25, s=(1, .6, 1)))
    L['steam'].append((world_point(B, -21.2, 1.05, -8.4), 'herbal'))
    for i in range(11):
        x = -27 + i * .6
        B.cyl(.004, .004, .36, 'charred', x, 2.72, -7.25, 4)
        B.add(g_cyl(0, .075, .34, 8), f'herb{i % 3}', trs(x, 2.38, -7.25, rx=pi))
    for bx, bz, w, d in ((-25.6, -2.3, 1.5, .4), (-22.4, -4.9, 2.2, .7), (-22.4, -3.3, 2.2, .7)):
        B.box(w, .75, d, 'wood', bx, .13, bz)
        B.box(w - .08, .04, d - .08, 'soil', bx, .5, bz)
        for _ in range(int(w * d * 14)):
            L['herb_plants'].append((world_point(B, bx + (rng.random() - .5) * (w - .15), .52, bz + (rng.random() - .5) * (d - .15)), 1.3 + rng.random() * .6))
    B.pop()
    sign(B, L, 'HERBAL · L', -39, 4)


def ceremonial_sauna(B, L):
    B.push(trs(18, 0, -39, ry=.73 * pi) @ trs(-24, 0, 9))
    B.add(g_cyl(5.3, 5.3, .22, 80), 'deck', trs(24, 0, -9))
    B.add(g_cyl(5.45, 5.55, .2, 64), 'concrete', trs(24, -.14, -9))
    B.add(g_ring(5.5, 6.1, 64), 'gravel', trs(24, -.2, -9, rx=-pi / 2))
    # Sauna master's stool facing the benches, with a bucket and a birch whisk; guests on the first row.
    B.cyl(.2, .2, .05, 'wood', 24, .5, -7.5, 20)
    for i in range(3):
        a = i * 2.09
        B.box(.04, .4, .04, 'charred', 24 + sin(a) * .13, .3, -7.5 + cos(a) * .13)
    B.cyl(.15, .12, .26, 'wood', 24.55, .24, -7.3)
    B.add(g_circle(.13, 16), 'bucketWater', trs(24.55, .36, -7.3, rx=-pi / 2))
    B.add(g_cyl(0, .12, .45, 10), 'herb0', trs(23.5, .2, -7.35, rz=pi / 2 + .2))
    person(B, 'sit', 24, .11, -7.5, pi, S=.44, robe='robe0')
    for a in (2.55, 3.3, 4.05):
        person(B, 'sit', 24 + sin(a) * 2.75, .11, -9 + cos(a) * 2.75, a + pi, S=.45)
    for i in range(100):
        a = .5 + i / 99 * (TAU - 1)
        B.box(.27, 3.7, .15, 'wood', 24 + sin(a) * 5, 1.95, -9 + cos(a) * 5, ry=a)
    prof = []
    for k in range(10):
        r0 = 5.85 - k * .54
        prof += [(r0 + .05, k * .25 - .03), (r0 - .54, k * .25 + .25)]
    prof.append((.001, 2.62))
    B.add(g_lathe(prof, 96), 'shingle', trs(24, 3.78, -9))
    B.add(g_ring(4.95, 5.85, 64), 'wood', trs(24, 3.76, -9, rx=pi / 2))
    for i in range(24):
        a = i / 24 * TAU
        B.box(.1, .14, .8, 'wood', 24 + sin(a) * 5.3, 3.7, -9 + cos(a) * 5.3, ry=a)
    B.cyl(.3, .34, .3, 'steel', 24, 6.45, -9, 20)
    B.add(g_cyl(0, .62, .3, 24), 'steel', trs(24, 6.98, -9))
    for i in range(4):
        a = i * pi / 2
        B.box(.025, .3, .025, 'steel', 24 + sin(a) * .27, 6.72, -9 + cos(a) * .27)
    for s in (-1, 1):
        a = s * .55
        B.box(.2, 3.7, .2, 'charred', 24 + sin(a) * 5.05, 1.95, -9 + cos(a) * 5.05)
    B.box(5.2, .24, .24, 'charred', 24, 3.72, -9 + cos(.55) * 5.05)
    for row in range(3):
        radius = 2.6 + row * .78
        for i in range(43):
            a = .42 + i / 42 * (TAU - .84)
            B.box(.56, .12, .64, 'wood', 24 + sin(a) * radius, .5 + row * .42, -9 + cos(a) * radius, ry=a)
    B.cyl(.78, .9, .9, 'paving', 24, .56, -9, 24)
    B.cyl(.82, .82, .06, 'steel', 24, 1.03, -9, 24)
    B.box(.34, .2, .03, 'fire', 24, .42, -9 + .9)
    for i in range(34):
        L['stones'].append((world_point(B, 24 + cos(i * 2.4) * .55 * math.sqrt(rng.random()), 1.08 + rng.random() * .2, -9 + sin(i * 2.4) * .55 * math.sqrt(rng.random())), 1.1 + rng.random() * .6))
    B.cyl(.09, .09, 2.7, 'steel', 24, 2.45, -9, 12)
    B.cyl(.09, .09, 3.2, 'steel', 24, 5.4, -9, 12)
    for row in range(3):
        for i in range(24):
            a = 1.5 + (i + (row % 2) * .5) / 24 * 3.2
            B.box(.36, .25, .1, 'salt', 24 + sin(a) * 4.86, 2.12 + row * .28, -9 + cos(a) * 4.86, ry=a)
    light(L, B, 24, 1.4, -9, (1, .55, .3), 60, 160, .4, 'FIRE')
    light(L, B, 24, 2.4, -9, (1, .62, .38), 0, 60, .5)
    for s in (-1, 1):
        a = s * .62
        x, z = 24 + sin(a) * 5.3, -9 + cos(a) * 5.3
        B.box(.16, .24, .16, 'charred', x, 2.25, z)
        B.box(.1, .16, .1, 'lampGlow', x, 2.25, z)
        light(L, B, x, 2.25, z + .15 * cos(a), (1, .7, .42), 0, 15, .05)
    L['smoke'].append((world_point(B, 24, 7.1, -9), 'crown'))
    L['steam'].append((world_point(B, 24, 1.3, -9), 'stones_big'))
    B.pop()
    sign(B, L, 'CEREMONIÁLNÍ', 22, -42)


def lounger(B, x, z, k):
    B.box(1.05, .18, 2.2, 'wood', x, .35, z)
    B.box(.95, .13, 1.65, 'linen', x, .51, z + .13)
    B.box(.95, .14, .78, 'linen', x, .74, z - .86, rx=.48)
    for dz in (-.85, .85):
        B.box(.08, .3, .08, 'charred', x, .15, z + dz)
    B.add(g_cyl(.075, .075, .78, 12), f'towel{k % 3}', trs(x, .65, z + .72, rz=pi / 2))


def lounge(B, L, cx, cz, cols, rows, enclosed):
    w, d = cols * 1.65 + 2, rows * 3 + 2
    B.box(w, .2, d + 2, 'deck', cx, .01, cz + 1)
    piers(B, cx - w / 2 + .3, cx + w / 2 - .3, cz - d / 2 + .2, cz + d / 2 + 1.8, -.09)
    for i in range(cols):
        for j in range(rows):
            x, z = cx + (i - (cols - 1) / 2) * 1.65, cz + (j - (rows - 1) / 2) * 3
            lounger(B, x, z, i + j)
            if i < cols - 1 and (i + j) % 2 == 0:
                tx, tz = x + .82, z - .3
                B.cyl(.19, .19, .03, 'wood', tx, .5, tz, 20)
                B.cyl(.025, .025, .48, 'charred', tx, .25, tz, 6)
                B.cyl(.04, .035, .08, 'towel2', tx + .06, .555, tz, 10)
    for dx in (-w / 2 + .3, w / 2 - .3):
        for dz in (-d / 2 + .3, 0, d / 2 + .3):
            B.box(.16, 3.5, .16, 'wood', cx + dx, 1.75, cz + dz)
    for dx, dz in ((-w / 2 + .7, d / 2 + 1.4), (w / 2 - .7, d / 2 + 1.4)):
        B.cyl(.29, .22, .55, 'ceramic', cx + dx, .28, cz + dz, 18)
        L['pot_plants'].append((world_point(B, cx + dx, .5, cz + dz), 1.))
    if enclosed:
        B.box(w, .2, d + 2, 'charred', cx, 3.6, cz + .5)
        B.box(w - .3, .08, d + 1.7, 'sedum', cx, 3.73, cz + .5)
        for s in (-1, 1):
            B.box(w + .1, .34, .08, 'wood', cx, 3.68, cz + .5 + s * (d / 2 + 1.04))
            B.box(.08, .34, d + 2.1, 'wood', cx + s * (w / 2 + .04), 3.68, cz + .5)
        for _ in range(int(w * d * 3)):
            L['roof_plants'].append((world_point(B, cx + (rng.random() - .5) * (w - .6), 3.78, cz + .5 + (rng.random() - .5) * (d + 1.3)), .8 + rng.random()))
        B.box(w, 3.2, .025, 'glass', cx, 1.7, cz - d / 2)
        for dx in (-w / 2, w / 2):
            B.box(.025, 3.2, d, 'glass', cx + dx, 1.7, cz)
        n = round(w / 1.6)
        for i in range(n + 1):
            B.box(.05, 3.2, .06, 'charred', cx - w / 2 + i * w / n, 1.7, cz - d / 2)
        for dx in (-w / 2, w / 2):
            for i in range(1, 7):
                B.box(.06, 3.2, .05, 'charred', cx + dx, 1.7, cz - d / 2 + i * d / 7)
        for i in range(0, cols, 2):
            for j in range(rows):
                lx, lz = cx + (i - (cols - 1) / 2 + .5) * 1.65, cz + (j - (rows - 1) / 2) * 3
                B.cyl(.006, .006, .7, 'charred', lx, 3.15, lz, 4)
                B.add(g_cyl(.09, .2, .2, 20, open_=True), 'lampShade', trs(lx, 2.72, lz))
                B.add(g_sphere(.06, 10, 8), 'lampGlow', trs(lx, 2.66, lz))
                light(L, B, lx, 2.6, lz, (1, .78, .55), 0, 12, .06)
    else:
        for i in range(19):
            B.box(.12, .19, d + 1, 'wood', cx - w / 2 + i * w / 18, 3.5, cz)
        for dz in (-d / 2, d / 2):
            B.box(w, .2, .18, 'charred', cx, 3.3, cz + dz)
        for i in range(110):
            beam = rng.randrange(19)
            L['vines'].append((world_point(B, cx - w / 2 + beam * w / 18 + (rng.random() - .5) * .25, 3.62, cz + (rng.random() - .5) * (d + 1) * (.45 if beam % 3 else 1)), .5 + rng.random() * .5))
        for k in range(6):
            px = cx + (-w / 2 + .3 if k < 3 else w / 2 - .3)
            pz = cz + (-d / 2 + .3, 0, d / 2 + .3)[k % 3]
            for _ in range(14):
                L['vines'].append((world_point(B, px + (rng.random() - .5) * .3, .3 + rng.random() * 3.1, pz + (rng.random() - .5) * .3), .35 + rng.random() * .3))
        for lz in (-3, 0, 3):
            for i in range(20):
                t = i / 19
                B.add(g_sphere(.04, 8, 6), 'lampGlow', trs(cx - w / 2 + .35 + t * (w - .7), 3.32 - .28 * sin(pi * t), cz + lz))
        light(L, B, cx, 3.1, cz, (1, .75, .5), 0, 60, 1.5, 'AREA', (w - 1, d))
    B.box(w - .6, .035, .04, 'led', cx, 3.35, cz - d / 2 + .1)
    if enclosed:
        light(L, B, cx, 3.2, cz, (1, .78, .55), 0, 120, 1., 'AREA', (w - 1, d - 1))


def pool(B, L):
    px, pz = POOL
    B.add(g_cyl(1, 1, .65, 128, open_=True), 'paving', trs(px, .05, pz, s=(6, 1, 4.3)))
    B.add(flip(g_cyl(1, 1, 1.02, 128, open_=True)), 'coping', trs(px, -.13, pz, s=(5.62, 1, 3.9)))
    B.add(g_circle(1, 96), 'coping', trs(px, -.62, pz, rx=-pi / 2, s=(5.62, 3.9, 1)))
    B.add(g_ring(.93, 1., 128), 'paving', trs(px, .375, pz, rx=-pi / 2, s=(6, 4.3, 1)))
    B.add(g_cyl(1, 1, 1.01, 128), 'poolWater', trs(px, -.1, pz, s=(5.6, 1, 3.88)), coll='Water')
    for i in range(56):
        a = i / 56 * TAU
        B.box(.62, .2, .54, 'coping', px + 5.82 * cos(a), .45, pz + 4.08 * sin(a), ry=-a)
    for i in range(17):
        a = pi * .07 + i / 17 * pi * .88
        L['boulders'].append(((px + 6.5 * cos(a), .1, pz - 5 * sin(a)), .45 + (i % 3) * .16))
    for i in range(3):
        B.box(2.1, .16, .6, 'coping', px, .08 + i * .12, pz + 5.5 - i * .5)
    for _ in range(90):
        a = pi * .12 + rng.random() * pi * .76
        rr = 6.9 + rng.random() * 1.4
        L['reeds'].append(((px + rr * cos(a), -.22, pz - rr * .78 * sin(a)), 2.2 + rng.random() * 1.6))
    # Winter: ice with a swimming hole near the steps.
    V, F = [], []
    n = 70
    idx = {}
    for i in range(n + 1):
        for j in range(n + 1):
            u, v = i / n * 2 - 1, j / n * 2 - 1
            idx[i, j] = len(V)
            V.append((u, v, 0))
    for i in range(n):
        for j in range(n):
            cu, cv = (i + .5) / n * 2 - 1, (j + .5) / n * 2 - 1
            if cu * cu + cv * cv > .995 or ((cu - .25) / .2) ** 2 + ((cv + .55) / .28) ** 2 < 1:
                continue
            F.append((idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))
    B.add(g_custom(V, F, [[(V[k][0] * 5, V[k][1] * 4) for k in f] for f in F]), 'ice', trs(px, .42, pz, rx=-pi / 2, s=(5.62, 3.9, 1)), coll='WinterOnly')
    person(B, 'bathe', px + 1.39, 0, pz + 2.12, pi * .8, W=.4)
    L['steam'].append(((px + 1.39, .45, pz + 2.12), 'hole'))
    for x, z in ((-26.2, 27.4), (-24.8, 27.1), (-23.3, 26.8), (-21.8, 26.4), (-20.4, 26.1)):
        B.add(g_cyl(.4, .43, .14, 9), 'paving', trs(x, -.19, z, ry=rng.random() * 3, s=(1 + rng.random() * .3, 1, .8 + rng.random() * .2)))


def sign(B, L, text, x, z, y=2.35, w=3.1, h=.58, posts=True):
    B.box(w + .08, h + .08, .04, 'signBoard', x, y, z - .03)
    L['signs'].append(dict(text=text, M=B.stack[-1] @ trs(x, y, z - .005), w=w, h=h))
    if posts:
        for s in (-1, 1):
            B.box(.09, y + h / 2 + .1, .09, 'wood', x + s * (w / 2 - .2), (y + h / 2 + .1) / 2 - .1, z - .08)


# ---------------------------------------------------------------- paths, water, site furniture
def ribbon(B, pts, width, y_off, mat, coll=None, skip=None):
    """Flat strip following a polyline at ground height (used for gravel paths)."""
    V, F, UV = [], [], []
    along = 0.
    prev = None
    keep = []
    for k, (x, z) in enumerate(pts):
        a = pts[max(0, k - 1)]
        b = pts[min(len(pts) - 1, k + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tx, tz) or 1
        nx, nz = -tz / ln, tx / ln
        if prev is not None:
            along += math.hypot(x - prev[0], z - prev[1])
        prev = (x, z)
        y = ground_y(x, z) + y_off
        V += [(x + nx * width / 2, y, z + nz * width / 2), (x - nx * width / 2, y, z - nz * width / 2)]
        keep.append(not (skip and skip(x, z)))
    for k in range(len(pts) - 1):
        if not (keep[k] and keep[k + 1]):
            continue
        a, b = 2 * k, 2 * k + 2
        F.append((a, a + 1, b + 1, b))
    UV = [[(V[i][0], V[i][2]) for i in f] for f in F]
    B.add_raw((V, F, UV, False), mat, Matrix.Identity(4), coll)


def build_paths(B, L):
    segs = []
    L['paths'] = segs

    def curved(pts, width=1.65, skip=None, n=70):
        p = [(v.x, v.z) for v in Curve(pts).points(n)]
        pid = len(L.setdefault('path_list', []))
        L['path_list'].append((p, width))
        ribbon(B, p, width, .035 + pid * .002, 'gravel', skip=skip)
        for (x, z), (nx, nz) in zip(p, p[1:]):
            if skip and (skip(x, z) or skip(nx, nz)):
                continue
            segs.append((x, z, nx, nz, width, pid))
        return p
    L['entry'] = curved([(0, 73), (0, 40), (0, 20), (0, 8), (0, 5)], 2.4)
    L['west'] = curved([(0, 8), (-11, 12), (-25, 13), (-38, 8), (-39.5, 2.7)])
    L['east'] = curved([(0, 8), (16, 4), (32, -12), (30, -29), (21.75, -42.3)])
    L['inner'] = curved([(-25, 13), (-22, -6), (-14, -18), (0, -22.5)], 2)
    L['south'] = curved([(30, -29), (26, -26), (14, -22), (0, -22.5)], 2)
    curved([(0, 20), (-7, 21), (-12, 25), (-19, 28)], 2)
    curved([(-19, 28), (-24, 31), (-31, 29)], 2)
    curved([(0, 5), (4.5, 5), (4.5, 3.7)], 1, n=2)
    curved([(0, 20), (6, 20), (9, 18)], 1.5)
    curved([(6, 20), (10, 23), (12, 24)], 1.5)
    L['trail'] = curved([(-6, -24.5), (-13, -28.5), (-20, -31), (-28, -30.5), (-33.5, -27.5)], 1.4, skip=lambda x, z: stream_dist(x, z) < 2.1)
    L['clinic_path'] = curved([(30, -29), (45, -31), (67, -43), (83, -52), (101, -59)], 2.6)
    # Low stone edging on both sides, left out where paths meet.
    def near_other(x, z, pid, m):
        return any(j != pid and seg_dist(x, z, ax, az, bx, bz) < w / 2 + m for ax, az, bx, bz, w, j in segs)
    for x, z, nx, nz, w, pid in segs:
        ln = math.hypot(nx - x, nz - z)
        if ln < 1e-3:
            continue
        ux, uz = (nx - x) / ln, (nz - z) / ln
        for sd in (-1, 1):
            mx, mz = (x + nx) / 2 - uz * sd * (w / 2 + .05), (z + nz) / 2 + ux * sd * (w / 2 + .05)
            if not near_other(mx, mz, pid, .12):
                B.box(.09, .1, ln + .04, 'coping', mx, ground_y(mx, mz) + .07, mz, ry=math.atan2(nx - x, nz - z))
    # Path lights every few metres, alternating sides.
    def lights_along(pts, w, every):
        acc, nxt, n = 0., 4., 0
        total = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            l = math.hypot(x1 - x0, z1 - z0)
            while l and acc + l >= nxt and nxt < total - 4:
                t = (nxt - acc) / l
                sd = 1 if n % 2 else -1
                n += 1
                bx = x0 + (x1 - x0) * t - (z1 - z0) / l * sd * (w / 2 + .45)
                bz = z0 + (z1 - z0) * t + (x1 - x0) / l * sd * (w / 2 + .45)
                if not near_other(bx, bz, -1, .3) and stream_dist(bx, bz) > 2.2:
                    bollard(B, L, bx, bz)
                nxt += every
            acc += l
    for x in (-1.5, 1.5):
        for z in (11, 17, 23):
            bollard(B, L, x, z)
    for key, w in (('west', 1.65), ('east', 1.65), ('inner', 2), ('south', 2), ('trail', 1.4)):
        lights_along(L[key], w, 11)
    lights_along(L['clinic_path'], 2.6, 16)


def bollard(B, L, x, z):
    g = ground_y(x, z)
    B.box(.1, .7, .1, 'charred', x, g + .35, z)
    B.box(.16, .08, .16, 'led', x, g + .72, z)
    light(L, B, x, g + .66, z, (1, .72, .42), 0, 6, .04)


def stream_and_pond(B, L):
    for curve, n in ((INLET, 90), (OUTLET, 110)):
        pts = curve.spaced(n)
        V, F = [], []
        along = 0.
        for i, q in enumerate(pts):
            a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
            t = (b - a).normalized()
            nx, nz = -t.z, t.x
            if i:
                along += (q - pts[i - 1]).length
            y = ground_y(q.x, q.z) - .13
            V += [(q.x + nx * 1.02, y, q.z + nz * 1.02), (q.x - nx * 1.02, y, q.z - nz * 1.02)]
            if i:
                c, e = 2 * i - 2, 2 * i
                F.append((c, c + 1, e + 1, e))
            if i % 3 == 0 and 3 < i < len(pts) - 2 and rng.random() < .75:
                sd = -1 if rng.random() < .5 else 1
                L['boulders'].append(((q.x - t.z * sd * (1.2 + rng.random() * .4), ground_y(q.x, q.z) - .1, q.z + t.x * sd * (1.2 + rng.random() * .4)), .18 + rng.random() * .22))
        # Closed thin water body so the volume colour works.
        n2 = len(V)
        V2 = V + [(x, y - .12, z) for x, y, z in V]
        F2 = F + [tuple(i + n2 for i in reversed(f)) for f in F]
        for i in range(len(pts) - 1):
            c, e = 2 * i, 2 * i + 2
            F2.append((c + 1, c + n2 + 1, e + n2 + 1, e + 1))
            F2.append((e, e + n2, c + n2, c))
        B.add_raw(g_custom(V2, F2), 'streamWater', Matrix.Identity(4), 'Water')
    P = POND
    V, F = [], []
    seg = 72
    for i in range(seg):
        a = i / seg * TAU
        w = wobble(a) * .98
        V.append((P['x'] + cos(a) * P['rx'] * w, -.33, P['z'] + sin(a) * P['rz'] * w))
    V.append((P['x'], -.33, P['z']))
    c = len(V) - 1
    F = [(c, (i + 1) % seg, i) for i in range(seg)]
    n2 = len(V)
    V2 = V + [(x, -.95, z) for x, y, z in V]
    F2 = F + [tuple(k + n2 for k in reversed(f)) for f in F]
    for i in range(seg):
        j = (i + 1) % seg
        F2.append((i, j, j + n2, i + n2))
    B.add_raw(g_custom(V2, F2), 'pondWater', Matrix.Identity(4), 'Water')
    for _ in range(9):
        a, r = rng.random() * TAU, .3 + rng.random() * .5
        B.add(g_circle(.24 * (.7 + rng.random() * .6), 14, .3, 5.8), 'plant', trs(P['x'] + cos(a) * P['rx'] * r, -.32, P['z'] + sin(a) * P['rz'] * r, rx=-pi / 2, rz=rng.random() * 6), coll='SummerOnly')
    for _ in range(110):
        a, r = rng.random() * TAU, 1.02 + rng.random() * .25
        if abs(a - 3.8) < .5:
            continue
        w = wobble(a)
        L['reeds'].append(((P['x'] + cos(a) * P['rx'] * r * w, -.3, P['z'] + sin(a) * P['rz'] * r * w), 2. + rng.random() * 1.8))


def bridge_and_boardwalk(B, L):
    trail = L['trail']
    best = min(range(1, len(trail)), key=lambda i: stream_dist(*trail[i]))
    (x, z), (px, pz) = trail[best], trail[best - 1]
    B.push(trs(x, 0, z, ry=math.atan2(x - px, z - pz)))

    def arch(zz):
        return .04 + .16 * cos(zz / 2.5 * pi / 2)
    for i in range(25):
        zz = -2.4 + i * .2
        B.box(1.7, .06, .17, 'deck', 0, arch(zz), zz)
    for sx in (-.75, .75):
        B.box(.12, .18, 4.9, 'wood', sx, -.06, 0)
        for zz in (-2.2, -.75, .75, 2.2):
            B.box(.09, 1, .09, 'wood', sx * 1.08, arch(zz) + .5, zz)
        B.box(.07, .07, 4.6, 'wood', sx * 1.08, 1.1, 0)
        B.box(.05, .05, 4.6, 'wood', sx * 1.08, .62, 0)
    for zz in (-2.55, 2.55):
        B.box(2.1, .35, .5, 'concrete', 0, -.15, zz)
    B.pop()
    a, b = (-33.5, -27.5), (-31.1, -23.2)
    ln = math.hypot(b[0] - a[0], b[1] - a[1])
    B.push(trs((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, ry=math.atan2(b[0] - a[0], b[1] - a[1])))
    for i in range(round(ln / .18)):
        B.box(1.2, .05, .15, 'deck', 0, .08, -ln / 2 + .09 + i * .18)
    for sx in (-.5, .5):
        B.box(.08, .12, ln, 'wood', sx, 0, 0)
        zz = -ln / 2 + .3
        while zz < ln / 2:
            B.box(.1, .5, .1, 'wood', sx, -.2, zz)
            zz += 1.2
    B.push(trs(0, 0, ln / 2 + 1.1))
    for i in range(12):
        B.box(2.6, .05, .17, 'deck', 0, .08, -1.05 + i * .19)
    for sx in (-1.2, 1.2):
        for zz in (-1, 0, 1):
            B.box(.12, .9, .12, 'wood', sx, -.38, zz)
    B.box(1.6, .07, .38, 'wood', 0, .5, -.85)
    for sx in (-.65, .65):
        B.box(.07, .42, .34, 'charred', sx, .27, -.85)
    B.box(.1, 1.2, .1, 'wood', 1.15, .65, -.95)
    B.box(.18, .24, .18, 'charred', 1.15, 1.35, -.95)
    B.box(.12, .16, .12, 'lampGlow', 1.15, 1.35, -.95)
    light(L, B, 1.15, 1.35, -.8, (1, .72, .45), 0, 12, .05)
    seat = world_point(B, -.35, .105, -.85)
    yaw = math.atan2(b[0] - a[0], b[1] - a[1])
    B.pop()
    B.pop()
    person(B, 'sit', *seat, yaw, S=.4)


def site_furniture(B, L):
    # Rinse court.
    B.box(4, .3, 3, 'paving', 9, -.09, 17)
    for i in range(9):
        B.box(1.3, .03, .1, 'wood', 9, .075, 16.4 + i * .14)
    for x in (8, 10):
        B.cyl(.04, .04, 2.4, 'chrome', x, 1.2, 16.5, 12)
        B.box(.06, .06, .65, 'chrome', x, 2.4, 16.8)
        B.cyl(.18, .18, .035, 'chrome', x, 2.38, 17.1, 20)
    for i in range(20):
        B.box(.12, 2, .08, 'wood', 6.9 + i * .22, 1, 15.5)
    B.box(1.6, .08, .42, 'wood', 9.6, .45, 18.2)
    for x in (8.95, 10.25):
        B.box(.08, .42, .36, 'charred', x, .21, 18.2)
    person(B, 'stand', 8, .06, 16.95, 0)
    # Fire circle.
    B.cyl(3.4, 3.4, .16, 'paving', 12, -.155, 27, 48)
    for i in range(5):
        a = i / 5 * TAU
        B.box(1.7, .2, .6, 'wood', 12 + sin(a) * 2.4, .45, 27 + cos(a) * 2.4, ry=a)
        for s in (-.6, .6):
            B.box(.12, .58, .4, 'charred', 12 + sin(a) * 2.4 + cos(a) * s, .06, 27 + cos(a) * 2.4 - sin(a) * s, ry=a)
    for i in (1, 3):
        a = i / 5 * TAU
        person(B, 'sit', 12 + sin(a) * 2.55, -.225, 27 + cos(a) * 2.55, a + pi, S=.77)
    B.cyl(.5, .55, .3, 'paving', 12, .1, 27, 24)
    B.add(g_cyl(.78, .45, .34, 32, open_=True), 'corten', trs(12, .42, 27))
    B.add(g_circle(.45, 24), 'corten', trs(12, .26, 27, rx=-pi / 2))
    B.add(g_circle(.66, 24), 'fire', trs(12, .45, 27, rx=-pi / 2))
    for i in range(4):
        log(B, trs(12, .58, 27, pi / 2, i * .8, .3, s=(.8, .06, .06)), side='charred', cap='charred')
    light(L, B, 12, .9, 27, (1, .45, .15), 30, 140, .3, 'FIRE')
    L['smoke'].append(((12, .7, 27), 'fire'))
    # Tea station.
    B.box(2.5, 1.07, .8, 'wood', -8, .31, -20)
    B.box(2.7, .08, 1, 'paving', -8, .88, -20)
    for x in (-8.7, -7.4):
        B.cyl(.16, .18, .4, 'chrome', x, 1.12, -20, 16)
    for i in range(6):
        B.cyl(.035, .03, .08, 'towel2', -8.1 + i * .12, .96, -19.75, 10)
    person(B, 'stand', -8.3, -.225, -19.2, pi)
    person(B, 'walk', .7, -.12, 12, pi)
    person(B, 'walk', -17, -.12, 12.9, -pi / 2 + .1, robe='robe2')
    person(B, 'walk', 31.5, -.12, -18, pi + .1)
    person(B, 'walk', 98.5, -.12, -57.9, 2.45)
    # Open woodsheds.
    for x, z, ry in ((7.4, -43.5, pi / 2), (16.9, 31.3, -2.29)):
        B.push(trs(x, 0, z, ry=ry))
        B.box(2.7, .14, 1.3, 'concrete', 0, -.16, 0)
        for sx, sz, h in ((-1.25, -.55, 2.05), (1.25, -.55, 2.05), (-1.25, .55, 2.3), (1.25, .55, 2.3)):
            B.box(.1, h, .1, 'wood', sx, h / 2 - .09, sz)
        B.box(3, .07, 1.7, 'metalRoof', 0, 2.13, 0, rx=-.16)
        for i in range(14):
            B.box(.17, 1.95, .03, 'wood', -1.2 + i * .185, .9, -.62)
        n = 0
        for row in range(12):
            for i in range(14):
                if n >= 170 or (row > 9 and rng.random() < .4):
                    continue
                r = .055 + rng.random() * .02
                log(B, trs(-1.12 + i * .165 + (row % 2) * .08, .02 + row * .13, -.05 + (rng.random() - .5) * .04, rng.random() * .5, pi / 2, 0, s=(.4 + rng.random() * .05, r, r), order='ZYX'))
                n += 1
        B.pop()
    # Rocks along the clearing edge.
    for _ in range(34):
        a, r = rng.random() * TAU, 49 + rng.random() * 9
        L['boulders'].append(((cos(a) * r, -.2, sin(a) * r), .5 + rng.random() * .9))
    sign(B, L, 'ODPOČÍVÁRNA · 18 MÍST', 0, -21.9, y=1.3)
    sign(B, L, 'U VODY · 12 MÍST', -31, 30, y=1.3)
    sign(B, L, 'VSTUP / ODCHOD', 0, 20, posts=False)
    for x in (-1.4, 1.4):
        B.box(.08, 2.6, .08, 'wood', x, 1.15, 20)


def clinic(B, L):
    B.push(trs(101, 0, -70, ry=-.22))
    B.box(34, .3, 22, 'paving', 0, 0, 2)
    B.box(34.4, .2, 22.4, 'concrete', 0, -.2, 2)
    B.box(24, 6, 9, 'clinicStone', 0, 3, -3)
    B.box(9, 4, 13, 'clinicStone', -10, 2, 6)
    B.box(25, .35, 10, 'charred', 0, 6.2, -3)
    for s in (-1, 1):
        B.box(25, .5, .2, 'clinicStone', 0, 6.6, -3 + s * 4.9)
        B.box(.2, .5, 10, 'clinicStone', s * 12.4, 6.6, -3)
    green_roof(B, L, 10, 14, -10, 4.1, 6)
    for r in range(3):
        for i in range(6):
            B.box(1.6, .05, 1, 'panel', -6 + i * 2.2, 6.75, -6 + r * 2.3, rx=-.45)
    B.box(3, 1.2, 2, 'paving', 8, 7, -4)
    for fl in range(2):
        for i in range(10):
            B.box(1.85, 2, .08, 'clinicGlass', -10.7 + i * 2.35, 1.5 + fl * 2.8, 1.55)
            light(L, B, -10.7 + i * 2.35, 1.5 + fl * 2.8, .6, (1, .88, .7), 0, 18, .5, 'AREA', (1.6, 1.6))
    for i in range(11):
        B.box(.14, 5.6, .5, 'wood', -11.87 + i * 2.35, 2.9, 1.75)
    B.box(24, .3, .4, 'clinicStone', 0, 2.95, 1.7)
    B.box(7, 3.8, .08, 'clinicGlass', 2, 1.9, 2)
    for i in range(5):
        B.box(.06, 3.8, .1, 'charred', -1.5 + i * 1.75, 1.9, 2.03)
    B.box(11, .2, 5, 'wood', 2, 4, 4)
    for x in (-2.8, 6.8):
        B.box(.16, 4, .16, 'charred', x, 2, 5.8)
    for i in range(8):
        B.box(.12, 3.8, .13, 'wood', -13 + i * .9, 2, 12.6)
    B.add(g_cyl(1, 1, .12, 64), 'poolWater', trs(10, .11, 9, s=(3.4, 1, 2)), coll='Water')
    B.box(7.1, .14, 4.3, 'coping', 10, -.02, 9)
    for x, z in ((-3.5, 8), (0, 8.5), (15.5, 4)):
        B.box(1.8, .1, .5, 'wood', x, .45, z)
    light(L, B, 2, 3.8, 4, (1, .85, .65), 0, 150, 2, 'AREA', (9, 4))
    B.pop()
    sign(B, L, 'AEVUM · KLINIKA', 102, -60)


def build_everything(B):
    L = {k: [] for k in ('lights', 'stones', 'smoke', 'steam', 'small_plants', 'roof_plants', 'herb_plants', 'pot_plants',
                         'vines', 'boulders', 'reeds', 'signs')}
    finnish_sauna(B, L)
    herbal_sauna(B, L)
    ceremonial_sauna(B, L)
    lounge(B, L, 0, -29, 6, 3, True)
    lounge(B, L, -31, 24, 4, 3, False)
    person(B, 'lie', -2.475, 0, -32, 0)
    person(B, 'lie', 2.475, 0, -26, 0, robe='robe1')
    person(B, 'lie', -33.475, 0, 24, 0, robe='robe0')
    pool(B, L)
    stream_and_pond(B, L)
    build_paths(B, L)
    bridge_and_boardwalk(B, L)
    site_furniture(B, L)
    clinic(B, L)
    footprints(B, L)
    return L


def footprints(B, L):
    """Footprints in winter snow along the busiest routes."""
    def walk(pts, y_off, every=.42):
        carry, n = 0., 0
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            l = math.hypot(x1 - x0, z1 - z0)
            if not l:
                continue
            ux, uz = (x1 - x0) / l, (z1 - z0) / l
            t = carry
            while t < l:
                sd = .11 if n % 2 else -.11
                n += 1
                x, z = x0 + ux * t - uz * sd, z0 + uz * t + ux * sd
                B.add(g_circle(1, 10), 'footprint', trs(x, ground_y(x, z) + y_off, z, rx=-pi / 2, rz=math.atan2(ux, uz) + pi, s=(.055, .13, 1)), coll='WinterOnly')
                t += every
            carry = t - l
    walk(L['east'][:40], .075)
    walk(L['entry'][25:], .075)
    walk(L['trail'], .075)
    walk(L['west'][:35], .075)
    walk([(3.7, 1.6), (5.8, .5), (7.5, -1.5), (8.5, -4)], .012)


# ---------------------------------------------------------------- camera shots (three.js positions/targets, lens in mm)
# Eye-level shots keep the camera level and frame with lens shift, as architectural photographers do.
SHOTS = {
    'overview': dict(pos=(44, 48, 61), target=(0, 0, -3), lens=30),
    'finska': dict(pos=(8.6, 1.65, 10.2), target=(0, 1.65, .3), lens=26, shift=-.02),
    'finska_interior': dict(pos=(2.35, 1.35, 1.55), target=(-1.2, 1.05, -1.15), lens=17),
    'herbal': dict(pos=(-24, 9, 15), target=(-34, 1, 2), lens=30),
    'ceremonial': dict(pos=(31, 1.7, -24.5), target=(19, 2.2, -38), lens=24, shift=.06),
    'lounge': dict(pos=(11, 11, -12), target=(0, 1, -29), lens=30),
    'lounge_interior': dict(pos=(4.6, 1.55, -24.2), target=(-3, 1.3, -32), lens=18),
    'plunge': dict(pos=(9, 4, 8), target=(4.5, .5, 2.7), lens=30),
    'pool': dict(pos=(-10.5, 1.55, 30.5), target=(-20, .9, 18.5), lens=24, shift=-.04),
    'pergola': dict(pos=(-20, 10, 38), target=(-31, 1, 24), lens=30),
    'clinic': dict(pos=(123, 25, -46), target=(101, 3, -70), lens=32),
    'entrance': dict(pos=(12, 14, 30), target=(0, 0, 16), lens=30),
    'stream': dict(pos=(-13, 9, -9), target=(-27, 0, -24), lens=30),
}


# ---------------------------------------------------------------- landscape
def ground_material():
    from scene_kit import TEX, _mix_rgb, image, snow_group
    mat = bpy.data.materials.new('Ground')
    mat.use_nodes = True
    nt = mat.node_tree
    N, Lk = nt.nodes, nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    Lk.new(b.outputs[0], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord')

    def layer(folder, size):
        mp = N.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / size,) * 3
        Lk.new(tc.outputs['UV'], mp.inputs['Vector'])
        res = []
        for kind, col in (('diffuse', True), ('nor_gl', False), ('rough', False)):
            f = glob.glob(os.path.join(TEX, folder, kind + '.*'))[0]
            t = N.new('ShaderNodeTexImage')
            t.image = image(f, col)
            Lk.new(mp.outputs[0], t.inputs['Vector'])
            res.append(t.outputs[0])
        return res
    lawn, forest, mud = layer('leafy_grass', 2.2), layer('forest_ground_04', 3.), layer('brown_mud_leaves_01', 2.5)

    def attr(name):
        a = N.new('ShaderNodeAttribute')
        a.attribute_name = name
        return a.outputs['Fac']
    # Large-scale variation: patches of drier and lusher lawn.
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = .035
    nz.inputs['Detail'].default_value = 3
    geo = N.new('ShaderNodeNewGeometry')
    Lk.new(geo.outputs['Position'], nz.inputs['Vector'])
    green = N.new('ShaderNodeHueSaturation')  # the scanned lawn is autumnal; bring it back to summer green
    green.inputs['Hue'].default_value = .535
    green.inputs['Saturation'].default_value = 1.05
    green.inputs['Value'].default_value = .92
    Lk.new(lawn[0], green.inputs['Color'])
    lawn[0] = green.outputs[0]
    dry = N.new('ShaderNodeHueSaturation')
    dry.inputs['Hue'].default_value = .47
    dry.inputs['Saturation'].default_value = .8
    dry.inputs['Value'].default_value = 1.15
    Lk.new(lawn[0], dry.inputs['Color'])
    mr = N.new('ShaderNodeMapRange')
    mr.inputs[1].default_value, mr.inputs[2].default_value = .45, .7
    Lk.new(nz.outputs['Fac'], mr.inputs[0])
    _, f0, a0, b0, c0 = _mix_rgb(N, Lk)
    Lk.new(mr.outputs[0], f0)
    Lk.new(lawn[0], a0)
    Lk.new(dry.outputs[0], b0)
    col, nrm, rgh = c0, lawn[1], lawn[2]
    for layer_out, fac in ((forest, attr('forest')), (mud, attr('mud'))):
        for i, cur in enumerate((col, nrm, rgh)):
            _, f, a, bb, res = _mix_rgb(N, Lk)
            Lk.new(fac, f)
            Lk.new(cur, a)
            Lk.new(layer_out[i], bb)
            if i == 0:
                col = res
            elif i == 1:
                nrm = res
            else:
                rgh = res
    nm = N.new('ShaderNodeNormalMap')
    Lk.new(nrm, nm.inputs['Color'])
    Lk.new(nm.outputs[0], b.inputs['Normal'])
    sep = N.new('ShaderNodeSeparateColor')
    Lk.new(rgh, sep.inputs[0])
    sg = N.new('ShaderNodeGroup')
    sg.node_tree = snow_group(True)
    Lk.new(col, sg.inputs['Color'])
    Lk.new(sep.outputs[0], sg.inputs['Roughness'])
    Lk.new(sg.outputs['Color'], b.inputs['Base Color'])
    Lk.new(sg.outputs['Roughness'], b.inputs['Roughness'])
    return mat


def grid_mesh(name, x0, x1, z0, z1, step, height, coll, mat):
    nx, nz = int(round((x1 - x0) / step)) + 1, int(round((z1 - z0) / step)) + 1
    verts = []
    for j in range(nz):
        z = z0 + j * step
        for i in range(nx):
            x = x0 + i * step
            verts.append(tuple(bl(x, height(x, z), z)))
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(nz - 1) for i in range(nx - 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv', [c for f in faces for k in f for c in (verts[k][0], verts[k][1])])
    me.polygons.foreach_set('use_smooth', [True] * len(faces))
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob, nx, nz


def mountains(coll):
    from scene_kit import pbr
    peaks = [(-125, -30, 65, 64, 53), (-25, -5, 115, 66, 62), (82, -18, 80, 62, 50), (170, -36, 48, 54, 44)]

    def mh(x, z):
        e = sum(h * math.exp(-(((x - px) / sx) ** 2 + ((z - pz) / sz) ** 2)) for px, pz, h, sx, sz in peaks)
        edge = max(0, 1 - (abs(z) / 110) ** 4) * max(0, 1 - (abs(x) / 265) ** 6)
        return max(-.2, (e + sin(x * .11 + z * .14) * 4 + sin(x * .27 - z * .19) * 2 + abs(perlin(x * .03, z * .03, 8)) * 9 * min(1, e / 40)) * edge)
    mat = pbr('Mountain', 'forest_ground_04', 25., color=(.42, .5, .4), vary=0, snow='open')
    grid_mesh('Mountains', -265, 265, -110, 110, 2.5, lambda x, z: mh(x, z) - 1, coll, mat)[0].location = bl(0, 0, -265)
    return mh


def exposure_attribute(objs, blockers, name='sky'):
    """1 where a surface point sees the open sky straight above, 0 under roofs and decks (for snow)."""
    verts, polys = [], []
    for o in blockers:
        m = o.matrix_world
        base = len(verts)
        verts += [m @ v.co for v in o.data.vertices]
        polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    bvh = BVHTree.FromPolygons(verts, polys)
    up = Vector((0, 0, 1))
    for o in objs:
        me = o.data
        vals = []
        for v in me.vertices:
            p = o.matrix_world @ v.co + up * .03
            vals.append(0. if bvh.ray_cast(p, up, 60)[0] is not None else 1.)
        a = me.attributes.get(name) or me.attributes.new(name, 'FLOAT', 'POINT')
        a.data.foreach_set('value', vals)
    return bvh


def grey_down(objs, sat, val):
    for o in objs:
        for m in o.data.materials:
            nt = m.node_tree
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            link = next((l for l in nt.links if bsdf and l.to_socket == bsdf.inputs['Base Color']), None)
            if not link:
                continue
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Saturation'].default_value = sat
            hs.inputs['Value'].default_value = val
            nt.links.new(link.from_socket, hs.inputs['Color'])
            nt.links.new(hs.outputs[0], bsdf.inputs['Base Color'])


def plant_vegetation(B, L):
    from scene_kit import load_asset, asset_names
    arch = [o for o in collection('Architecture').objects if o.type == 'MESH']
    water_objs = list(collection('Water').objects)
    land = collection('Landscape')
    ground = ground_material()
    inner, nx, nz = grid_mesh('Ground', -92, 150, -112, 92, .5, carved_y, land, ground)
    # The coarse far ground sinks well below the detailed ground wherever they overlap, so it never covers the water.
    def far_height(x, z):
        inside = -80 < x < 138 and -100 < z < 80
        return ground_y(x, z) - (3. if inside else .08)
    grid_mesh('Ground far', -1000, 1000, -1000, 1000, 10, far_height, land, ground)
    mh = mountains(land)
    # Ground attributes: forest floor under the trees, mud by the water, trampled edges along paths.
    path_kd_pts = [(x, z, w) for pts, w in L['path_list'] for x, z in pts]
    pkd = KDTree(len(path_kd_pts))
    for i, (x, z, w) in enumerate(path_kd_pts):
        pkd.insert((x, z, 0), i)
    pkd.balance()
    for ob in land.objects:
        if ob.name == 'Mountains':
            continue
        me = ob.data
        forest, mud = [], []
        for v in me.vertices:
            x, z = v.co.x, -v.co.y
            r = math.hypot(x, z)
            f = smooth(51, 60, r + perlin(x * .05, z * .05, 3) * 6) * smooth(36, 48, math.hypot(x - 101, z + 70))
            forest.append(f)
            (_, _, _), idx, dist = pkd.find((x, z, 0))
            w = path_kd_pts[idx][2]
            px, pz = (x - POND['x']) / POND['rx'], (z - POND['z']) / POND['rz']
            wet = max(smooth(2.6, 1.1, stream_dist(x, z)), smooth(1.45, 1.05, math.hypot(px, pz)))
            mud.append(max(wet, smooth(w / 2 + .9, w / 2, dist) * .55))
        for n, vals in (('forest', forest), ('mud', mud)):
            a = me.attributes.new(n, 'FLOAT', 'POINT')
            a.data.foreach_set('value', vals)
    blockers = arch
    bvh = exposure_attribute(arch + [inner], blockers)
    exposure_attribute([o for o in land.objects if o.name != 'Mountains' and o is not inner], blockers)
    wbvh_verts, wbvh_polys = [], []
    for o in arch + water_objs:
        base = len(wbvh_verts)
        wbvh_verts += [o.matrix_world @ v.co for v in o.data.vertices]
        wbvh_polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    occ = BVHTree.FromPolygons(wbvh_verts, wbvh_polys)

    def occupied(x, z, margin=0.):
        for dx, dz in ((0, 0),) + (((margin, 0), (-margin, 0), (0, margin), (0, -margin)) if margin else ()):
            if occ.ray_cast(bl(x + dx, 40, z + dz), Vector((0, 0, -1)), 80)[0] is not None:
                return True
        return False

    def in_water(x, z, m=0.):
        px, pz = (x - POND['x']) / POND['rx'], (z - POND['z']) / POND['rz']
        qx, qz = (x - POOL[0]) / 6.3, (z - POOL[1]) / 4.6
        return stream_dist(x, z) < 1.5 + m or math.hypot(px, pz) < 1.15 + m / 3 or qx * qx + qz * qz < 1

    # Asset libraries, hidden: they only feed the instancers.
    assets = collection('Assets', exclude=True)

    def lib(name, folder, names):
        c = collection(name, assets)
        objs = load_asset(folder, names, c)
        add_snow_to_asset_materials(objs)
        return c, objs
    fir_all = lib('Fir near', 'fir_tree_01', [f'fir_tree_01_{v}_LOD{k}' for k in range(3) for v in 'abc'])
    fir_near, fir_mid, fir_far = fir_all, (collection('Fir mid', assets), fir_all[1][3:6]), (collection('Fir far', assets), fir_all[1][6:])
    for c, objs in (fir_mid, fir_far):
        for o in objs:
            fir_all[0].objects.unlink(o)
            c.objects.link(o)
    fir_near = (fir_all[0], fir_all[1][:3])
    fir_h = [o.dimensions.z for o in fir_mid[1]]
    sapling = lib('Sapling', 'fir_sapling_medium', [f'fir_sapling_medium_{v}_LOD1' for v in 'abc'])
    sap_h = [o.dimensions.z for o in sapling[1]]
    decid = lib('Deciduous', 'tree_small_02', ['tree_small_02_LOD1'])
    bare_c = collection('Deciduous bare', assets)
    bare = decid[1][0].copy()
    bare.data = decid[1][0].data.copy()
    bare.name = 'tree_small_02_bare'
    bare_c.objects.link(bare)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(bare.data)
    leaf_idx = [i for i, m in enumerate(bare.data.materials) if m and 'leaves' in m.name]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in leaf_idx], context='FACES')
    bm.to_mesh(bare.data)
    bm.free()
    decid_h = decid[1][0].dimensions.z
    grass_names = [n for n in asset_names('grass_medium_01') if n.startswith('grass_medium_01_') and n.endswith('_LOD0') and 'geonodes' not in n and 'tiny' not in n]
    grass_names += [f'grass_medium_02_{v}' for v in 'abcde']
    grass_c = collection('Grass', assets)
    grass_objs = load_asset('grass_medium_01', grass_names[:-5], grass_c) + load_asset('grass_medium_02', grass_names[-5:], grass_c)
    tall_idx = [i for i, o in enumerate(grass_objs) if '_tall_' in o.name]
    fern = lib('Fern', 'fern_02', [f'fern_02_{v}' for v in 'abcd'])
    shrub = lib('Shrub', 'shrub_02', [f'shrub_02_{v}_LOD0' for v in 'abcd'])
    small = lib('Small plant', 'shrub_04', [f'shrub_04_{v}_LOD0' for v in 'abcd'])
    flower = lib('Flower', 'dandelion_01', [f'dandelion_01_{v}_LOD1' for v in 'abcde'])
    rock_names = [n for n in asset_names('rock_moss_set_01') if 'rock0' in n] + [n for n in asset_names('rock_moss_set_02') if 'rock0' in n]
    rock_c = collection('Rocks', assets)
    rocks = load_asset('rock_moss_set_01', [n for n in rock_names if n.startswith('rock_moss_set_01')], rock_c) + load_asset('rock_moss_set_02', [n for n in rock_names if n.startswith('rock_moss_set_02')], rock_c)
    add_snow_to_asset_materials(rocks)
    stone = lib('Stone', 'stone_01', ['stone_01_LOD0'])
    grey_down(stone[1], .15, .55)  # scanned stone is sandy; sauna stones are dark peridotite
    stump = lib('Stump', 'tree_stump_01', ['tree_stump_01'])
    branch = lib('Branches', 'dry_branches_medium_01', [f'dry_branches_medium_01_{v}' for v in 'abc'])

    veg = collection('Vegetation')
    summer = collection('SummerOnly')
    winter = collection('WinterOnly')
    cams = [Vector(s['pos']) for s in SHOTS.values()]

    def near_cam(x, z, d):
        return any(math.hypot(c.x - x, c.z - z) < d for c in cams)
    # Mixed forest ring: firs, young firs and a few deciduous trees at the sunny edge.
    firs_n, firs_m, saps, decs = [], [], [], []
    cell = 4.4
    gx = -140.
    while gx <= 140:
        gz = -140.
        while gz <= 140:
            x, z = gx + (rng.random() - .5) * cell * .9, gz + (rng.random() - .5) * cell * .9
            r = math.hypot(x, z)
            edge = 54 + perlin(x * .05, z * .05, 2.2) * 7
            gz += cell
            if r < edge or r > 136 or math.hypot(x - 101, z + 70) < 46 or (z > 0 and abs(x) < 6) or rng.random() > .86:
                continue
            if in_water(x, z, 1.5) or occupied(x, z, 3):
                continue
            y = ground_y(x, z) - .15
            k = rng.random()
            if r < edge + 9 and k < .3:
                h = 13 + rng.random() * 4
                decs.append((x, y, z, rng.random() * TAU, h / decid_h, 0))
            elif k < .45:
                v = rng.randrange(3)
                saps.append((x, y, z, rng.random() * TAU, (6 + rng.random() * 5) / sap_h[v], v))
            else:
                v = rng.randrange(3)
                h = 17 + rng.random() * 11
                (firs_n if r < 72 else firs_m).append((x, y, z, rng.random() * TAU, h / fir_h[v], v))
        gx += cell
    for x, z in ((-41, 15), (-37, 34), (27, -18), (-15, -35), (38, -4), (-44, -12)):
        decs.append((x, -.35, z, rng.random() * TAU, 15 / decid_h, 0))
    scatter('Firs near', fir_near[0], firs_n, veg)
    scatter('Firs', fir_mid[0], firs_m, veg)
    scatter('Young firs', sapling[0], saps, veg)
    scatter('Deciduous', decid[0], decs, summer)
    scatter('Deciduous bare', bare_c, decs, winter)
    # Distant forest over the hills and up the mountain flanks.
    far = []
    fc = 8.5
    gx = -380.
    while gx <= 380:
        gz = -400.
        while gz <= 380:
            x, z = gx + (rng.random() - .5) * fc, gz + (rng.random() - .5) * fc
            gz += fc
            r = math.hypot(x, z)
            if r < 134 or r > 390 or math.hypot(x - 101, z + 70) < 48 or (z > 0 and abs(x) < 8):
                continue
            m = mh(x, z + 265) - 1 if z < -150 else -9
            if m > 58 + perlin(x * .04, z * .04, 5) * 10:
                continue
            v = rng.randrange(3)
            far.append((x, max(ground_y(x, z), m) - .4, z, rng.random() * TAU, (15 + rng.random() * 9) / fir_h[v], v))
        gx += fc
    scatter('Far forest', fir_far[0], far, veg)
    # Meadow grass: dense where the cameras look, sparser elsewhere; none on paths, decks or water.
    grass, flowers = [], []
    hot = [(s['target'][0], s['target'][2], 20) for s in SHOTS.values()] + [(s['pos'][0], s['pos'][2], 12) for s in SHOTS.values()]

    def try_grass(x, z, dense):
        r = math.hypot(x, z)
        forest_edge = 53 + perlin(x * .05, z * .05, 3) * 6
        if (r > forest_edge and math.hypot(x - 101, z + 70) > 44) or in_water(x, z) or occupied(x, z):
            return
        tall = perlin(x * .08, z * .08, 6) * .5 + .5
        v = rng.randrange(len(grass_objs))
        sc = (.8 + tall * .9) * (.85 + rng.random() * .3)
        grass.append((x, ground_y(x, z) + .01, z, rng.random() * TAU, sc, v))
    for hx, hz, hr in hot:
        for _ in range(int(hr * hr * math.pi * 26)):
            a, rr = rng.random() * TAU, math.sqrt(rng.random()) * hr
            try_grass(hx + cos(a) * rr, hz + sin(a) * rr, True)
    for _ in range(170000):
        a, rr = rng.random() * TAU, math.sqrt(rng.random()) * 64
        try_grass(cos(a) * rr, sin(a) * rr, False)
    for _ in range(20000):
        a, rr = rng.random() * TAU, math.sqrt(rng.random()) * 42
        try_grass(101 + cos(a) * rr, -70 + sin(a) * rr, False)
    for _ in range(9000):
        a, rr = rng.random() * TAU, 14 + math.sqrt(rng.random()) * 44
        x, z = cos(a) * rr, sin(a) * rr
        if perlin(x * .07, z * .07, 2) < .05 or in_water(x, z) or occupied(x, z):
            continue
        flowers.append((x, ground_y(x, z), z, rng.random() * TAU, 1.2 + rng.random() * .6, rng.randrange(5)))
    scatter('Grass', grass_c, grass, summer)
    scatter('Flowers', flower[0], flowers, summer)
    print('grass instances', len(grass), 'firs', len(firs_n) + len(firs_m), 'far', len(far))
    # Forest edge: ferns, shrubs, stumps, fallen branches and mossy rocks.
    ferns, shrubs, stumps, branches = [], [], [], []
    for _ in range(2600):
        a, rr = rng.random() * TAU, 47 + rng.random() * 40
        x, z = cos(a) * rr, sin(a) * rr
        if in_water(x, z, 1) or occupied(x, z, .8) or math.hypot(x - 101, z + 70) < 40:
            continue
        y = ground_y(x, z)
        k = rng.random()
        if perlin(x * .1, z * .1, 9) > 0 and k < .8:
            ferns.append((x, y, z, rng.random() * TAU, 1.2 + rng.random() * .8, rng.randrange(4)))
        elif k < .85:
            stumps.append((x, y - .05, z, rng.random() * TAU, .6 + rng.random() * .5, 0))
        elif k < .93:
            branches.append((x, y, z, rng.random() * TAU, 1 + rng.random(), rng.randrange(3)))
        else:
            shrubs.append((x, y, z, rng.random() * TAU, .6 + rng.random() * .5, rng.randrange(4)))
    scatter('Ferns', fern[0], ferns, summer)
    scatter('Stumps', stump[0], stumps, veg)
    scatter('Branches', branch[0], branches, veg)
    for gx0, gz0 in ((-13, -4), (12, -5), (-12, -23), (13, -24), (-26, 14), (-9, 29)):
        for i in range(16):
            a, rr = i * 2.399, math.sqrt(i) * .5
            shrubs.append((gx0 + cos(a) * rr, ground_y(gx0, gz0) - .05, gz0 + sin(a) * rr, rng.random() * TAU, .7 + (i % 3) * .15, rng.randrange(4)))
    scatter('Shrubs', shrub[0], shrubs, veg)
    rocks_pts = [(x, y, z, rng.random() * TAU, s / 1.3, rng.randrange(len(rocks))) for (x, y, z), s in L['boulders']]
    scatter('Rocks', rock_c, rocks_pts, veg)
    scatter('Sauna stones', stone[0], [(x, y, z, rng.random() * TAU, s, 0, rng.random() * 3) for (x, y, z), s in L['stones']], veg)
    scatter('Reeds', grass_c, [(x, y, z, rng.random() * TAU, (1.5, 1.5, s), rng.choice(tall_idx)) for (x, y, z), s in L['reeds']], veg)
    scatter('Roof plants', small[0], [(x, y, z, rng.random() * TAU, s, rng.randrange(4)) for (x, y, z), s in L['roof_plants']], veg)
    scatter('Herb beds', small[0], [(x, y, z, rng.random() * TAU, s, rng.randrange(4)) for (x, y, z), s in L['herb_plants'] + L['small_plants']], veg)
    scatter('Pot plants', shrub[0], [(x, y, z, rng.random() * TAU, .55 * s, rng.randrange(4)) for (x, y, z), s in L['pot_plants']], veg)
    scatter('Vines', shrub[0], [(x, y, z, rng.random() * TAU, (s, s, s * .6), rng.randrange(4)) for (x, y, z), s in L['vines']], summer)


# ---------------------------------------------------------------- lights, steam, signs, cameras
def volume_material(name, density, color=(1, 1, 1), scale=2.5, rise=True):
    """Soft wisps for smoke and steam: noise density fading towards the edges and top of the box."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    N, Lk = mat.node_tree.nodes, mat.node_tree.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    pv = N.new('ShaderNodeVolumePrincipled')
    pv.inputs['Color'].default_value = (*color, 1)
    Lk.new(pv.outputs[0], out.inputs['Volume'])
    tc = N.new('ShaderNodeTexCoord')
    nz = N.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.name = 'Wisps'
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 5
    Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = N.new('ShaderNodeMapRange')
    ramp.inputs[1].default_value, ramp.inputs[2].default_value = .48, .75
    Lk.new(nz.outputs['Fac'], ramp.inputs[0])
    # Gradient: dense near the source (object z = -1), gone at the top and sides.
    sep = N.new('ShaderNodeSeparateXYZ')
    Lk.new(tc.outputs['Object'], sep.inputs[0])
    ln = N.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    cxy = N.new('ShaderNodeCombineXYZ')
    Lk.new(sep.outputs[0], cxy.inputs[0])
    Lk.new(sep.outputs[1], cxy.inputs[1])
    Lk.new(cxy.outputs[0], ln.inputs[0])
    side = N.new('ShaderNodeMapRange')
    side.inputs[1].default_value, side.inputs[2].default_value = 1., .2
    Lk.new(ln.outputs['Value'], side.inputs[0])
    top = N.new('ShaderNodeMapRange')
    top.inputs[1].default_value, top.inputs[2].default_value = 1., -.6
    Lk.new(sep.outputs[2], top.inputs[0])
    m1 = N.new('ShaderNodeMath')
    m1.operation = 'MULTIPLY'
    Lk.new(ramp.outputs[0], m1.inputs[0])
    Lk.new(side.outputs[0], m1.inputs[1])
    m2 = N.new('ShaderNodeMath')
    m2.operation = 'MULTIPLY'
    Lk.new(m1.outputs[0], m2.inputs[0])
    Lk.new(top.outputs[0], m2.inputs[1])
    m3 = N.new('ShaderNodeMath')
    m3.operation = 'MULTIPLY'
    m3.inputs[1].default_value = density
    Lk.new(m2.outputs[0], m3.inputs[0])
    Lk.new(m3.outputs[0], pv.inputs['Density'])
    return mat


def volume_box(name, pos, size, mat, coll, tilt=(0, 0)):
    """Unit cube scaled so that the volume starts at pos and rises by size[2]."""
    me = bpy.data.meshes.new(name)
    v = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    me.from_pydata(v, [], f)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    p = bl(*pos)
    ob.location = (p.x + tilt[0] * size[2] / 2, p.y + tilt[1] * size[2] / 2, p.z + size[2] / 2)
    ob.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    ob.rotation_euler = (-tilt[1] * .5, tilt[0] * .5, 0)
    coll.objects.link(ob)
    return ob


def text_sign(t, coll, mat):
    cu = bpy.data.curves.new('Sign ' + t['text'], 'FONT')
    cu.body = t['text']
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    cu.size = t['h'] * .42
    cu.extrude = .003
    cu.space_character = 1.12
    ob = bpy.data.objects.new('Sign ' + t['text'], cu)
    ob.data.materials.append(mat)
    # FONT objects lie in their local XY plane facing +Z; three.js signs face +z, which is Blender -Y.
    ob.matrix_world = C @ t['M'] @ Matrix.Translation((0, 0, .02))
    coll.objects.link(ob)


def add_lights_and_cameras(L):
    setup_world()
    sun_data = bpy.data.lights.new('Sun', 'SUN')
    sun_data.angle = math.radians(.8)
    sun = bpy.data.objects.new('Sun', sun_data)
    collection('Lights').objects.link(sun)
    night = collection('Night lights')
    for i, l in enumerate(L['lights']):
        kind = 'POINT' if l['kind'] in ('POINT', 'FIRE') else 'AREA'
        d = bpy.data.lights.new(f'Lamp {i}', kind)
        d.color = l['color']
        if kind == 'POINT':
            d.shadow_soft_size = l['radius']
        else:
            d.shape = 'RECTANGLE'
            d.size, d.size_y = l['size']
        ob = bpy.data.objects.new(f'Lamp {i}', d)
        ob.location = bl(*l['pos'])
        ob['day'], ob['dusk'] = float(l['day']), float(l['dusk'])
        night.objects.link(ob)
    fx = collection('Atmosphere')
    winter = collection('WinterOnly')
    smoke = volume_material('Chimney smoke', .3, (.85, .86, .88), 1.3)
    steam = volume_material('Steam', 1.6, (1, 1, 1), 3.)
    for pos, kind in L['smoke']:
        if kind == 'fire':
            volume_box('Fire smoke', pos, (1.2, 1.2, 3.5), smoke, fx, (.25, 0))
        else:
            volume_box(f'Smoke {kind}', pos, (3.2, 3.2, 7), smoke, fx, (.25, .08))
    for pos, kind in L['steam']:
        if kind in ('stones', 'stones_big', 'herbal'):
            sz = {'stones': (.9, .9, 1.2), 'stones_big': (1.6, 1.6, 1.8), 'herbal': (.7, .7, 1.1)}[kind]
            volume_box(f'Steam {kind}', pos, sz, steam, fx)
        else:
            volume_box(f'Steam {kind}', pos, (2., 2., 1.8), steam, winter, (.2, 0))
    from scene_kit import pbr
    text_mat = bpy.data.materials['Sign text']
    for t in L['signs']:
        text_sign(t, collection('Architecture'), text_mat)
    cams = collection('Cameras')
    for name, s in SHOTS.items():
        cd = bpy.data.cameras.new(name)
        cd.lens = s['lens']
        cd.sensor_width = 36
        cd.shift_y = s.get('shift', 0.)
        cd.clip_end = 3000
        ob = bpy.data.objects.new('Cam ' + name, cd)
        p, t = bl(*s['pos']), bl(*s['target'])
        if 'shift' in s:  # level camera, framing done with lens shift
            t.z = p.z
        ob.location = p
        ob.rotation_euler = (t - p).to_track_quat('-Z', 'Y').to_euler()
        cams.objects.link(ob)
    bpy.context.scene.camera = bpy.data.objects['Cam overview']
