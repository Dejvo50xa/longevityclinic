"""Toolkit for the Blender version of the sauna retreat: geometry, materials, assets, scattering.

Coordinates: the layout is copied from src/Sauna.jsx, which uses three.js axes
(x right, y up, z towards the viewer). Everything here is written in those
coordinates and converted to Blender's z-up axes when meshes are created.
"""
import bpy
import glob
import math
import os
import random

import numpy as np
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ASSETS = os.path.expanduser('~/dev/longevityclinic-blender-assets')
TEX = os.path.join(ASSETS, 'textures')
MODELS = os.path.join(ASSETS, 'models')
HDRI = os.path.join(ASSETS, 'hdri')
rng = random.Random(42)
TAU = math.tau

# three.js (y up) -> Blender (z up): (x, y, z) -> (x, -z, y). A proper rotation, so face winding is kept.
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def bl(x, y, z):
    return Vector((x, -z, y))


def rot(rx=0., ry=0., rz=0., order='XYZ'):
    X, Y, Z = Matrix.Rotation(rx, 4, 'X'), Matrix.Rotation(ry, 4, 'Y'), Matrix.Rotation(rz, 4, 'Z')
    return X @ Y @ Z if order == 'XYZ' else Z @ Y @ X  # same convention as three.js Euler


def trs(x=0., y=0., z=0., rx=0., ry=0., rz=0., s=(1., 1., 1.), order='XYZ'):
    return Matrix.Translation((x, y, z)) @ rot(rx, ry, rz, order) @ Matrix.Diagonal((*s, 1))


def smooth(a, b, x):
    t = max(0., min(1., (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def seg_dist(px, pz, ax, az, bx, bz):
    dx, dz = bx - ax, bz - az
    t = max(0., min(1., ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
    return math.hypot(px - ax - dx * t, pz - az - dz * t)


def perlin(x, y, z):
    return noise.noise(Vector((x, y, z)), noise_basis='PERLIN_ORIGINAL')


# ---------------------------------------------------------------- curves (same maths as three.js CatmullRomCurve3)
class Curve:
    """Centripetal Catmull-Rom through (x, z) points, matching the web scene's paths exactly."""

    def __init__(self, pts):
        self.p = [Vector((x, 0., z)) for x, z in pts]

    def point(self, t):
        pts, n = self.p, len(self.p)
        p = (n - 1) * t
        i = int(math.floor(p))
        w = p - i
        if i >= n - 1:
            i, w = n - 2, 1.
        p0 = pts[i - 1] if i > 0 else pts[0] * 2 - pts[1]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else pts[n - 1] * 2 - pts[n - 2]
        d0 = (p0 - p1).length_squared ** .25
        d1 = (p1 - p2).length_squared ** .25
        d2 = (p2 - p3).length_squared ** .25
        d1 = d1 if d1 > 1e-4 else 1.
        d0 = d0 if d0 > 1e-4 else d1
        d2 = d2 if d2 > 1e-4 else d1
        t1 = ((p1 - p0) / d0 - (p2 - p0) / (d0 + d1) + (p2 - p1) / d1) * d1
        t2 = ((p2 - p1) / d1 - (p3 - p1) / (d1 + d2) + (p3 - p2) / d2) * d1
        c2 = -3 * p1 + 3 * p2 - 2 * t1 - t2
        c3 = 2 * p1 - 2 * p2 + t1 + t2
        return p1 + t1 * w + c2 * w * w + c3 * w * w * w

    def points(self, n):
        return [self.point(i / n) for i in range(n + 1)]

    def spaced(self, n, samples=400):
        raw = self.points(samples)
        acc = [0.]
        for a, b in zip(raw, raw[1:]):
            acc.append(acc[-1] + (b - a).length)
        out, j = [], 0
        for k in range(n + 1):
            target = acc[-1] * k / n
            while j < len(acc) - 2 and acc[j + 1] < target:
                j += 1
            f = (target - acc[j]) / max(1e-9, acc[j + 1] - acc[j])
            out.append(raw[j].lerp(raw[j + 1], f))
        return out


# ---------------------------------------------------------------- primitive geometry (three.js conventions)
# Each generator returns (vertices, faces, uvs-per-face-corner, smooth) in local three.js space; UVs are in metres.
def g_box(w, h, d):
    V = [(sx * w / 2, sy * h / 2, sz * d / 2) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    F = [(4, 6, 7, 5), (0, 1, 3, 2), (2, 3, 7, 6), (0, 4, 5, 1), (1, 5, 7, 3), (0, 2, 6, 4)]
    axes = [(1, 2), (1, 2), (0, 2), (0, 2), (0, 1), (0, 1)]
    dims = (w, h, d)
    long = max(range(3), key=lambda i: dims[i])
    UV = []
    for f, (a, b) in zip(F, axes):
        if long in (a, b):  # grain runs along the board
            u, v = long, (b if a == long else a)
        else:
            u, v = (a, b) if dims[a] >= dims[b] else (b, a)
        UV.append([(V[i][u] + dims[u] / 2, V[i][v] + dims[v] / 2) for i in f])
    return V, F, UV, False


def g_cyl(rt, rb, h, seg=16, open_=False, t0=0., tl=TAU):
    full = tl >= TAU - 1e-6
    n = seg if full else seg + 1
    V, F, UV = [], [], []
    for r, y in ((rb, -h / 2), (rt, h / 2)):
        for i in range(n):
            a = t0 + tl * i / seg
            V.append((r * math.sin(a), y, r * math.cos(a)))
    ra = max(rt, rb)
    apex = None
    if rt == 0:
        V.append((0, h / 2, 0))
        apex = len(V) - 1
    for i in range(seg):
        i2 = (i + 1) % n if full else i + 1
        u0, u1 = ra * tl * i / seg, ra * tl * (i + 1) / seg
        if apex is not None:
            F.append((i, i2, apex))
            UV.append([(u0, 0), (u1, 0), ((u0 + u1) / 2, h)])
        else:
            F.append((i, i2, n + i2, n + i))
            UV.append([(u0, 0), (u1, 0), (u1, h), (u0, h)])
    if not open_ and full:
        if rt > 0:
            top = [n + i for i in range(n)]
            F.append(tuple(top))
            UV.append([(V[k][0], V[k][2]) for k in top])
        if rb > 0:
            bot = list(reversed(range(n)))
            F.append(tuple(bot))
            UV.append([(V[k][0], V[k][2]) for k in bot])
    return V, F, UV, True


def g_sphere(r, ws=16, hs=12, p0=0., pl=TAU, t0=0., tl=math.pi):
    V, F, UV = [], [], []
    for j in range(hs + 1):
        th = t0 + tl * j / hs
        for i in range(ws + 1):
            ph = p0 + pl * i / ws
            V.append((-r * math.cos(ph) * math.sin(th), r * math.cos(th), r * math.sin(ph) * math.sin(th)))
    for j in range(hs):
        for i in range(ws):
            a, b = j * (ws + 1) + i + 1, j * (ws + 1) + i
            c, d = (j + 1) * (ws + 1) + i, (j + 1) * (ws + 1) + i + 1
            F.append((a, b, c, d))
            UV.append([(r * pl * (i + 1) / ws, r * tl * j / hs), (r * pl * i / ws, r * tl * j / hs),
                       (r * pl * i / ws, r * tl * (j + 1) / hs), (r * pl * (i + 1) / ws, r * tl * (j + 1) / hs)])
    return V, F, UV, True


def g_torus(R, r, rs=8, ts=32):
    V, F, UV = [], [], []
    for j in range(rs + 1):
        for i in range(ts + 1):
            u, v = i / ts * TAU, j / rs * TAU
            V.append(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v)))
    for j in range(1, rs + 1):
        for i in range(1, ts + 1):
            a, b = (ts + 1) * j + i - 1, (ts + 1) * (j - 1) + i - 1
            c, d = (ts + 1) * (j - 1) + i, (ts + 1) * j + i
            F.append((a, b, c, d))
            UV.append([(R * TAU * (i - 1) / ts, r * TAU * j / rs), (R * TAU * (i - 1) / ts, r * TAU * (j - 1) / rs),
                       (R * TAU * i / ts, r * TAU * (j - 1) / rs), (R * TAU * i / ts, r * TAU * j / rs)])
    return V, F, UV, True


def g_lathe(profile, seg=32):
    n = len(profile)
    V, F, UV = [], [], []
    for i in range(seg + 1):
        ph = i / seg * TAU
        for x, y in profile:
            V.append((x * math.sin(ph), y, x * math.cos(ph)))
    along = [0.]
    for (x0, y0), (x1, y1) in zip(profile, profile[1:]):
        along.append(along[-1] + math.hypot(x1 - x0, y1 - y0))
    rmax = max(p[0] for p in profile)
    for i in range(seg):
        for j in range(n - 1):
            a, b = j + i * n, j + (i + 1) * n
            F.append((a, b, b + 1, a + 1))
            u0, u1 = rmax * TAU * i / seg, rmax * TAU * (i + 1) / seg
            UV.append([(u0, along[j]), (u1, along[j]), (u1, along[j + 1]), (u0, along[j + 1])])
    return V, F, UV, True


def g_ring(ri, ro, seg=32):
    V, F, UV = [], [], []
    for r in (ri, ro):
        for i in range(seg + 1):
            a = i / seg * TAU
            V.append((r * math.cos(a), r * math.sin(a), 0))
    for i in range(seg):
        f = (i, seg + 1 + i, seg + 2 + i, i + 1)
        F.append(f)
        UV.append([(V[k][0], V[k][1]) for k in f])
    return V, F, UV, False


def g_circle(r, seg=32, t0=0., tl=TAU):
    V = [(0, 0, 0)] + [(r * math.cos(t0 + tl * i / seg), r * math.sin(t0 + tl * i / seg), 0) for i in range(seg + 1)]
    F = [(0, i, i + 1) for i in range(1, seg + 1)]
    return V, F, [[(V[k][0], V[k][1]) for k in f] for f in F], False


def g_plane(w, h):
    V = [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)]
    return V, [(0, 1, 2, 3)], [[(v[0] + w / 2, v[1] + h / 2) for v in V]], False


def g_capsule(r, length, cap=4, seg=10):
    prof = [(max(1e-4, r * math.cos(a)), -length / 2 + r * math.sin(a)) for a in
            [-math.pi / 2 + k / cap * math.pi / 2 for k in range(cap + 1)]]
    prof += [(max(1e-4, r * math.cos(a)), length / 2 + r * math.sin(a)) for a in
             [k / cap * math.pi / 2 for k in range(cap + 1)]]
    return g_lathe(prof, seg)


def g_custom(V, F, UV=None, smooth_=False):
    return V, F, UV or [[(V[i][0], V[i][2]) for i in f] for f in F], smooth_


# ---------------------------------------------------------------- mesh builder
class Builder:
    """Collects primitives into one mesh per (collection, material) with UVs, per-board tint and smoothing."""

    def __init__(self, materials):
        self.mats = materials
        self.parts = {}
        self.stack = [Matrix.Identity(4)]
        self.coll = 'Architecture'

    def push(self, M):
        self.stack.append(self.stack[-1] @ M)

    def pop(self):
        self.stack.pop()

    def add_raw(self, geom, mat, M=None, coll=None):
        self.add(geom, mat, M, coll, tint=.5, offset=False)

    def add(self, geom, mat, M=None, coll=None, tint=None, offset=True):
        V, F, UV, smooth_ = geom
        P = self.parts.setdefault((coll or self.coll, mat), {'v': [], 'f': [], 'uv': [], 't': [], 's': []})
        W = C @ self.stack[-1] @ (M or Matrix.Identity(4))
        base = len(P['v'])
        P['v'].extend(tuple(W @ Vector(v)) for v in V)
        t = rng.random() if tint is None else tint
        ou, ov = (rng.random() * 9, rng.random() * 9) if offset else (0., 0.)  # every board starts at a different spot of the texture
        for f, fu in zip(F, UV):
            P['f'].append(tuple(base + i for i in f))
            P['uv'].append([(u + ou, v + ov) for u, v in fu])
            P['t'].append(t)
            P['s'].append(smooth_)

    # Shorthands mirroring the web scene's helpers: size first, then material and three.js position.
    def box(self, w, h, d, mat, x, y, z, rx=0., ry=0., rz=0., order='XYZ', coll=None):
        self.add(g_box(w, h, d), mat, trs(x, y, z, rx, ry, rz, order=order), coll)

    def cyl(self, rt, rb, h, mat, x, y, z, seg=16, rx=0., ry=0., rz=0., open_=False, coll=None):
        self.add(g_cyl(rt, rb, h, seg, open_), mat, trs(x, y, z, rx, ry, rz), coll)

    def finish(self):
        for (coll, mat), P in self.parts.items():
            me = bpy.data.meshes.new(f'{coll}_{mat}')
            me.from_pydata(P['v'], [], P['f'])
            uv = me.uv_layers.new(name='UVMap')
            uv.data.foreach_set('uv', [c for fu in P['uv'] for corner in fu for c in corner])
            tint = me.attributes.new('tint', 'FLOAT', 'CORNER')
            tint.data.foreach_set('value', [t for f, t in zip(P['f'], P['t']) for _ in f])
            me.polygons.foreach_set('use_smooth', P['s'])
            me.materials.append(self.mats[mat])
            me.validate(clean_customdata=False)
            ob = bpy.data.objects.new(me.name, me)
            collection(coll).objects.link(ob)
        self.parts = {}


def collection(name, parent=None, exclude=False):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
        if exclude:
            find_layer_collection(bpy.context.view_layer.layer_collection, name).exclude = True
    return c


def find_layer_collection(lc, name):
    if lc.collection.name == name:
        return lc
    for ch in lc.children:
        r = find_layer_collection(ch, name)
        if r:
            return r
    return None


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.render.engine = 'CYCLES'


# ---------------------------------------------------------------- materials
def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes, nt.links


def _mix_rgb(nodes, links, blend='MIX'):
    m = nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    m.blend_type = blend
    return m, m.inputs[0], m.inputs[6], m.inputs[7], m.outputs[2]


def _mix_float(nodes):
    m = nodes.new('ShaderNodeMix')
    m.data_type = 'FLOAT'
    return m, m.inputs[0], m.inputs[2], m.inputs[3], m.outputs[0]


def control_group(name, value):
    """A tiny node group holding one number, shared by many materials (snow amount, night light level)."""
    g = bpy.data.node_groups.get(name)
    if g is None:
        g = bpy.data.node_groups.new(name, 'ShaderNodeTree')
        g.interface.new_socket('Value', in_out='OUTPUT', socket_type='NodeSocketFloat')
        out = g.nodes.new('NodeGroupOutput')
        v = g.nodes.new('ShaderNodeValue')
        v.name = 'Value'
        v.outputs[0].default_value = value
        g.links.new(v.outputs[0], out.inputs[0])
    return g


def set_control(name, value):
    bpy.data.node_groups[name].nodes['Value'].outputs[0].default_value = value


def snow_group(use_sky):
    """Mixes snow into a colour/roughness pair on up-facing surfaces; 'sky' limits it to surfaces open to the sky."""
    name = 'SnowTop' if use_sky else 'SnowOpen'
    g = bpy.data.node_groups.get(name)
    if g:
        return g
    g = bpy.data.node_groups.new(name, 'ShaderNodeTree')
    for n, t, io in (('Color', 'NodeSocketColor', 'INPUT'), ('Roughness', 'NodeSocketFloat', 'INPUT'),
                     ('Color', 'NodeSocketColor', 'OUTPUT'), ('Roughness', 'NodeSocketFloat', 'OUTPUT'),
                     ('Snow', 'NodeSocketFloat', 'OUTPUT')):
        g.interface.new_socket(n, in_out=io, socket_type=t)
    N, L = g.nodes, g.links
    gi, go = N.new('NodeGroupInput'), N.new('NodeGroupOutput')
    geo = N.new('ShaderNodeNewGeometry')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Normal'], sep.inputs[0])
    up = N.new('ShaderNodeMapRange')
    up.inputs[1].default_value, up.inputs[2].default_value = .42, .8
    L.new(sep.outputs[2], up.inputs[0])
    tex = N.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 1.6
    tex.inputs['Detail'].default_value = 6
    L.new(geo.outputs['Position'], tex.inputs['Vector'])
    edge = N.new('ShaderNodeMapRange')
    edge.inputs[1].default_value, edge.inputs[2].default_value = .22, .36
    L.new(tex.outputs['Fac'], edge.inputs[0])
    amt = N.new('ShaderNodeGroup')
    amt.node_tree = control_group('SnowAmount', 0.)
    m1 = N.new('ShaderNodeMath')
    m1.operation = 'MULTIPLY'
    L.new(up.outputs[0], m1.inputs[0])
    L.new(edge.outputs[0], m1.inputs[1])
    m2 = N.new('ShaderNodeMath')
    m2.operation = 'MULTIPLY'
    L.new(m1.outputs[0], m2.inputs[0])
    L.new(amt.outputs[0], m2.inputs[1])
    fac = m2.outputs[0]
    if use_sky:
        at = N.new('ShaderNodeAttribute')
        at.attribute_name = 'sky'
        m3 = N.new('ShaderNodeMath')
        m3.operation = 'MULTIPLY'
        L.new(fac, m3.inputs[0])
        L.new(at.outputs['Fac'], m3.inputs[1])
        fac = m3.outputs[0]
    sc = N.new('ShaderNodeTexNoise')
    sc.inputs['Scale'].default_value = 40
    L.new(geo.outputs['Position'], sc.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.78, .82, .87, 1)
    ramp.color_ramp.elements[1].color = (.93, .95, .97, 1)
    L.new(sc.outputs['Fac'], ramp.inputs[0])
    _, f, a, b, out = _mix_rgb(N, L)
    L.new(fac, f)
    L.new(gi.outputs['Color'], a)
    L.new(ramp.outputs[0], b)
    L.new(out, go.inputs['Color'])
    _, f2, a2, b2, out2 = _mix_float(N)
    L.new(fac, f2)
    L.new(gi.outputs['Roughness'], a2)
    b2.default_value = .62
    L.new(out2, go.inputs['Roughness'])
    L.new(fac, go.inputs['Snow'])
    return g


def image(path, color=True):
    img = bpy.data.images.load(path, check_existing=True)
    if not color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def pbr(name, tex=None, size=1., color=(1, 1, 1), value=1., sat=1., hue=.5, rough_add=0., rough=None, metallic=0.,
        normal=1., vary=.12, rot=0., snow='top', emission=None, sheen=0., coord='UV', spec=.5, flat_color=None, brick=None):
    """Principled material from a Poly Haven texture set, with per-board tint variation and optional snow."""
    mat = bpy.data.materials.new(name)
    nt, N, L = _nodes(mat)
    out = N.new('ShaderNodeOutputMaterial')
    bsdf = N.new('ShaderNodeBsdfPrincipled')
    L.new(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Specular IOR Level'].default_value = spec
    if sheen:
        bsdf.inputs['Sheen Weight'].default_value = sheen
    col_out, rough_out = None, None
    if tex:
        folder = os.path.join(TEX, tex)
        tc = N.new('ShaderNodeTexCoord')
        mp = N.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / size, 1 / size, 1 / size)
        mp.inputs['Rotation'].default_value = (0, 0, rot)
        L.new(tc.outputs[coord], mp.inputs['Vector'])

        def tx(kind, is_color):
            f = glob.glob(os.path.join(folder, kind + '.*'))
            if not f:
                return None
            n = N.new('ShaderNodeTexImage')
            n.image = image(f[0], is_color)
            if coord == 'Object':
                n.projection = 'BOX'
                n.projection_blend = .25
            L.new(mp.outputs[0], n.inputs['Vector'])
            return n
        d, r, nm = tx('diffuse', True), tx('rough', False), tx('nor_gl', False)
        hsv = N.new('ShaderNodeHueSaturation')
        hsv.inputs['Hue'].default_value = hue
        hsv.inputs['Saturation'].default_value = sat
        hsv.inputs['Value'].default_value = value
        L.new(d.outputs[0], hsv.inputs['Color'])
        _, f, a, b, mixed = _mix_rgb(N, L, 'MULTIPLY')
        f.default_value = 1
        L.new(hsv.outputs[0], a)
        b.default_value = (*color, 1)
        col_out = mixed
        if brick:  # staggered joints between shingles
            bk = N.new('ShaderNodeTexBrick')
            bk.offset, bk.offset_frequency = .5, 1
            bk.inputs['Scale'].default_value = 1
            bk.inputs['Brick Width'].default_value, bk.inputs['Row Height'].default_value = brick
            bk.inputs['Mortar Size'].default_value = .006
            bk.inputs['Bias'].default_value = 0
            bk.inputs['Color1'].default_value = (1, 1, 1, 1)
            bk.inputs['Color2'].default_value = (.72, .7, .66, 1)
            bk.inputs['Mortar'].default_value = (.18, .17, .16, 1)
            L.new(tc.outputs['UV'], bk.inputs['Vector'])
            _, f3, a3, b3, m3 = _mix_rgb(N, L, 'MULTIPLY')
            f3.default_value = 1
            L.new(col_out, a3)
            L.new(bk.outputs['Color'], b3)
            col_out = m3
        if r:
            rm = N.new('ShaderNodeMath')
            rm.operation = 'ADD'
            rm.use_clamp = True
            L.new(r.outputs[0], rm.inputs[0])
            rm.inputs[1].default_value = rough_add
            rough_out = rm.outputs[0]
        if nm:
            nmap = N.new('ShaderNodeNormalMap')
            nmap.inputs['Strength'].default_value = normal
            L.new(nm.outputs[0], nmap.inputs['Color'])
            L.new(nmap.outputs[0], bsdf.inputs['Normal'])
    if col_out is None:
        rgb = N.new('ShaderNodeRGB')
        rgb.outputs[0].default_value = (*(flat_color or color), 1)
        col_out = rgb.outputs[0]
    if rough_out is None or rough is not None:
        rv = N.new('ShaderNodeValue')
        rv.outputs[0].default_value = rough if rough is not None else .6
        rough_out = rv.outputs[0]
    if vary:  # each board / block is a little lighter, darker or warmer than its neighbour
        at = N.new('ShaderNodeAttribute')
        at.attribute_name = 'tint'
        at.attribute_type = 'GEOMETRY'
        mr = N.new('ShaderNodeMapRange')
        mr.inputs[3].default_value, mr.inputs[4].default_value = 1 - vary, 1 + vary
        L.new(at.outputs['Fac'], mr.inputs[0])
        hv = N.new('ShaderNodeHueSaturation')
        L.new(col_out, hv.inputs['Color'])
        L.new(mr.outputs[0], hv.inputs['Value'])
        hm = N.new('ShaderNodeMapRange')
        hm.inputs[3].default_value, hm.inputs[4].default_value = .5 - vary * .08, .5 + vary * .08
        L.new(at.outputs['Fac'], hm.inputs[0])
        L.new(hm.outputs[0], hv.inputs['Hue'])
        col_out = hv.outputs[0]
    if snow:
        sg = N.new('ShaderNodeGroup')
        sg.node_tree = snow_group(snow == 'top')
        L.new(col_out, sg.inputs['Color'])
        L.new(rough_out, sg.inputs['Roughness'])
        col_out, rough_out = sg.outputs['Color'], sg.outputs['Roughness']
    L.new(col_out, bsdf.inputs['Base Color'])
    L.new(rough_out, bsdf.inputs['Roughness'])
    if emission:
        ecol, strength = emission
        bsdf.inputs['Emission Color'].default_value = (*ecol, 1)
        night = N.new('ShaderNodeGroup')
        night.node_tree = control_group('NightLevel', 0.)
        em = N.new('ShaderNodeMath')
        em.operation = 'MULTIPLY_ADD'
        L.new(night.outputs[0], em.inputs[0])
        em.inputs[1].default_value = strength * .8
        em.inputs[2].default_value = strength * .2
        L.new(em.outputs[0], bsdf.inputs['Emission Strength'])
    return mat


def end_grain():
    """Log ends: growth rings around the centre of each cap, darker bark ring at the edge."""
    mat = bpy.data.materials.new('End grain')
    nt, N, L = _nodes(mat)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    b.inputs['Roughness'].default_value = .8
    L.new(b.outputs[0], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['UV'], sep.inputs[0])
    wave = N.new('ShaderNodeTexWave')
    wave.wave_type = 'RINGS'
    wave.inputs['Scale'].default_value = 3.5
    wave.inputs['Distortion'].default_value = 4
    wave.inputs['Detail'].default_value = 3
    mp = N.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (.5, .5, 0)
    mp.inputs['Scale'].default_value = (.5, .5, .5)
    L.new(tc.outputs['UV'], mp.inputs['Vector'])
    L.new(mp.outputs[0], wave.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.52, .36, .2, 1)
    ramp.color_ramp.elements[1].color = (.8, .64, .42, 1)
    L.new(wave.outputs['Fac'], ramp.inputs[0])
    ln = N.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    L.new(tc.outputs['UV'], ln.inputs[0])
    edge = N.new('ShaderNodeMapRange')
    edge.inputs[1].default_value, edge.inputs[2].default_value = .86, .97
    L.new(ln.outputs['Value'], edge.inputs[0])
    _, f, a, c, res = _mix_rgb(N, L)
    L.new(edge.outputs[0], f)
    L.new(ramp.outputs[0], a)
    c.default_value = (.2, .14, .09, 1)
    sg = N.new('ShaderNodeGroup')
    sg.node_tree = snow_group(True)
    L.new(res, sg.inputs['Color'])
    sg.inputs['Roughness'].default_value = .8
    L.new(sg.outputs['Color'], b.inputs['Base Color'])
    return mat


def glass(name, tint=(.94, .97, .96), rough=0.):
    """Window glass that lets sunlight through (transparent shadows) with a Fresnel reflection."""
    mat = bpy.data.materials.new(name)
    nt, N, L = _nodes(mat)
    out = N.new('ShaderNodeOutputMaterial')
    tr = N.new('ShaderNodeBsdfTransparent')
    tr.inputs['Color'].default_value = (*tint, 1)
    gl = N.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = rough
    fr = N.new('ShaderNodeFresnel')
    fr.inputs['IOR'].default_value = 1.52
    mx = N.new('ShaderNodeMixShader')
    L.new(fr.outputs[0], mx.inputs[0])
    L.new(tr.outputs[0], mx.inputs[1])
    L.new(gl.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    return mat


def water(name, absorb, density, rough=.02, wave=1.):
    """Refractive water with depth colour from volume absorption and small ripples."""
    mat = bpy.data.materials.new(name)
    nt, N, L = _nodes(mat)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (1, 1, 1, 1)
    b.inputs['Transmission Weight'].default_value = 1
    b.inputs['Roughness'].default_value = rough
    b.inputs['IOR'].default_value = 1.333
    L.new(b.outputs[0], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord')
    nz = N.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = 1.4
    nz.inputs['Detail'].default_value = 4
    nz.name = 'Ripples'
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .12 * wave
    bump.inputs['Distance'].default_value = .02
    L.new(nz.outputs['Fac'], bump.inputs['Height'])
    L.new(bump.outputs[0], b.inputs['Normal'])
    va = N.new('ShaderNodeVolumeAbsorption')
    va.inputs['Color'].default_value = (*absorb, 1)
    va.inputs['Density'].default_value = density
    L.new(va.outputs[0], out.inputs['Volume'])
    return mat


def make_materials():
    M = {}
    # Timber: light spruce cladding and benches, silver-weathered decking, charred accents.
    M['wood'] = pbr('Timber', 'plywood', 1.2, color=(1., .9, .76), value=1., rot=math.pi / 2, vary=.14, normal=.6)
    M['deck'] = pbr('Decking', 'kitchen_wood', 1.5, color=(1., .95, .88), rot=math.pi / 2, vary=.16, normal=.8)
    M['charred'] = pbr('Charred timber', 'fine_grained_wood', 1.2, color=(.28, .27, .26), value=.55, rot=math.pi / 2, vary=.05, rough_add=.1)
    M['steel'] = pbr('Dark steel', 'metal_plate', 1.2, color=(.2, .21, .21), metallic=.7, rough_add=.05, vary=0)
    M['chrome'] = pbr('Chrome', None, color=(.8, .82, .83), metallic=1., rough=.14, vary=0, snow=None)
    M['metalRoof'] = pbr('Roof steel', 'metal_plate', 2., color=(.16, .17, .17), metallic=.55, vary=0)
    M['glass'] = glass('Glass')
    M['clinicGlass'] = glass('Clinic glass', tint=(.7, .82, .84))
    M['linen'] = pbr('Linen', None, color=(.8, .76, .67), rough=.9, sheen=.4, vary=.03)
    for i, c in enumerate([(.47, .54, .45), (.72, .62, .44), (.88, .86, .81), (.22, .24, .23)]):
        M[f'towel{i}'] = pbr(f'Towel {i}', None, color=c, rough=1., sheen=.8, vary=.04)
    M['led'] = pbr('LED strip', None, color=(1, .85, .6), rough=.4, vary=0, snow=None, emission=((1, .72, .38), 30))
    M['lampGlow'] = pbr('Lamp glow', None, color=(1, .9, .72), rough=.4, vary=0, snow=None, emission=((1, .78, .5), 25))
    M['fire'] = pbr('Embers', None, color=(1, .4, .1), rough=.8, vary=0, snow=None, emission=((1, .38, .08), 60))
    M['salt'] = pbr('Salt blocks', 'dry_river_pebbles', .5, color=(1., .72, .5), value=1.3, sat=.2, rough=.6, vary=.2, snow=None,
                    emission=((1, .52, .26), 3))
    M['sedum'] = pbr('Sedum', 'leafy_grass', 1.2, color=(.72, .78, .5), sat=.9, vary=.0)
    M['shingle'] = pbr('Shingles', 'kitchen_wood', .6, color=(.78, .74, .68), vary=.25, normal=1.2, brick=(.18, .25))
    M['clinicStone'] = pbr('Limestone', 'large_sandstone_blocks_01', 3., color=(1., .98, .93), sat=.35, value=1.15, vary=.04)
    M['corten'] = pbr('Corten', 'metal_plate', .8, color=(.55, .27, .12), metallic=.3, rough_add=.25, vary=.05)
    M['copper'] = pbr('Copper', None, color=(.85, .45, .28), metallic=1., rough=.3, vary=0)
    M['ceramic'] = pbr('Ceramic', None, color=(.2, .22, .23), rough=.35, vary=.05)
    M['terracotta'] = pbr('Terracotta', None, color=(.55, .28, .17), rough=.8, vary=.05)
    for i, c in enumerate([(.3, .42, .2), (.42, .34, .58), (.62, .52, .27)]):
        M[f'herb{i}'] = pbr(f'Herbs {i}', None, color=c, rough=.9, vary=.1, snow=None)
    M['plant'] = pbr('Leaves', 'leafy_grass', .6, color=(.6, .8, .45), vary=.1)
    M['bucketWater'] = pbr('Bucket water', None, color=(.05, .12, .11), rough=.04, vary=0, snow=None)
    M['lining'] = pbr('Tub lining', None, color=(.08, .2, .19), rough=.25, vary=0, snow=None)
    M['lampShade'] = pbr('Lamp shade', None, color=(.12, .13, .13), metallic=.6, rough=.45, vary=0, snow=None)
    M['panel'] = pbr('Solar panel', None, color=(.03, .05, .1), metallic=.3, rough=.12, vary=0)
    M['concrete'] = pbr('Concrete', 'concrete_floor_02', 2., color=(.9, .9, .88), vary=.06)
    M['soil'] = pbr('Soil', 'brown_mud_leaves_01', 1., color=(.7, .6, .5), vary=0)
    M['mud'] = pbr('Stream bank', 'brown_mud_leaves_01', 2., vary=0)
    M['gravel'] = pbr('Gravel', 'gravel_floor_02', 1.5, color=(.8, .77, .72), vary=0, normal=1.2)
    M['coping'] = pbr('Coping stone', 'granite_tile', 2.5, color=(1., .97, .9), sat=.5, vary=.08)
    M['paving'] = pbr('Paving', 'granite_tile', 1.6, color=(.85, .86, .84), sat=.4, vary=.06)
    M['saunaStone'] = pbr('Sauna stones', 'dry_river_pebbles', .4, color=(.5, .5, .48), vary=.2, snow=None)
    M['rock'] = pbr('Rock', 'dry_river_pebbles', 1.5, color=(.7, .7, .66), vary=.1)
    M['barkLog'] = pbr('Log bark', 'pine_bark', .6, vary=.1)
    M['endgrain'] = end_grain()
    M['skin'] = pbr('Figure', None, color=(.8, .78, .74), rough=.55, vary=0, snow=None)
    for i, c in enumerate([(.9, .88, .84), (.5, .57, .48), (.68, .6, .45)]):
        M[f'robe{i}'] = pbr(f'Robe {i}', None, color=c, rough=1., sheen=.7, vary=0, snow=None)
    M['poolWater'] = water('Pool water', (.62, .9, .88), .45)
    M['pondWater'] = water('Pond water', (.3, .33, .22), 3.)
    M['streamWater'] = water('Stream water', (.36, .4, .27), 2.5, wave=1.6)
    M['ice'] = pbr('Ice', None, color=(.82, .9, .94), rough=.12, vary=0, snow='open')
    M['signBoard'] = pbr('Sign board', None, color=(.05, .12, .09), rough=.5, vary=0)
    M['signText'] = pbr('Sign text', None, color=(.87, .82, .68), rough=.5, vary=0, snow=None)
    M['footprint'] = pbr('Footprint', None, color=(.55, .6, .68), rough=.9, vary=0, snow=None)
    return M


# ---------------------------------------------------------------- Poly Haven assets
def load_asset(folder, names, into, rename=None):
    """Append named objects from a Poly Haven .blend into a hidden collection used only as an instance source."""
    path = glob.glob(os.path.join(MODELS, folder, '*.blend'))[0]
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in names]
    out = []
    for o in dst.objects:
        if o is None:
            continue
        o.parent = None
        o.modifiers.clear()
        M = o.matrix_basis.copy()  # keep the model's own rotation/scale by baking it into the mesh
        M.translation = (0, 0, 0)
        o.data.transform(M)
        o.matrix_basis = Matrix.Identity(4)
        into.objects.link(o)
        out.append(o)
    out.sort(key=lambda o: names.index(o.name))
    return out


def asset_names(folder):
    path = glob.glob(os.path.join(MODELS, folder, '*.blend'))[0]
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        return list(src.objects)


def add_snow_to_asset_materials(objects):
    """Insert the open-sky snow layer into the photo-scanned assets' own materials."""
    done = set()
    for o in objects:
        for m in o.data.materials:
            if not m or m.name in done or not m.use_nodes:
                continue
            done.add(m.name)
            nt = m.node_tree
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf is None:
                continue
            sg = nt.nodes.new('ShaderNodeGroup')
            sg.node_tree = snow_group(False)
            base_link = next((l for l in nt.links if l.to_socket == bsdf.inputs['Base Color']), None)
            if base_link:
                nt.links.new(base_link.from_socket, sg.inputs['Color'])
            else:
                sg.inputs['Color'].default_value = bsdf.inputs['Base Color'].default_value
            rough_link = next((l for l in nt.links if l.to_socket == bsdf.inputs['Roughness']), None)
            if rough_link:
                nt.links.new(rough_link.from_socket, sg.inputs['Roughness'])
            else:
                sg.inputs['Roughness'].default_value = bsdf.inputs['Roughness'].default_value
            nt.links.new(sg.outputs['Color'], bsdf.inputs['Base Color'])
            nt.links.new(sg.outputs['Roughness'], bsdf.inputs['Roughness'])


def scatter(name, source_coll, points, coll):
    """Instance a collection's children on points: each point has x,y,z (three.js), yaw, scale and variant index."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(bl(x, y, z)) for x, y, z, *_ in points], [], [])
    rot_a = me.attributes.new('rot', 'FLOAT_VECTOR', 'POINT')
    rot_a.data.foreach_set('vector', [c for p in points for c in (p[6] if len(p) > 6 else 0., 0., p[3])])
    sc = me.attributes.new('scl', 'FLOAT_VECTOR', 'POINT')
    sc.data.foreach_set('vector', [c for p in points for c in (p[4] if isinstance(p[4], tuple) else (p[4],) * 3)])
    var = me.attributes.new('variant', 'INT', 'POINT')
    var.data.foreach_set('value', [p[5] for p in points])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ng = bpy.data.node_groups.new(name + ' scatter', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    gi, go = N.new('NodeGroupInput'), N.new('NodeGroupOutput')
    ci = N.new('GeometryNodeCollectionInfo')
    ci.inputs['Collection'].default_value = source_coll
    ci.inputs['Separate Children'].default_value = True
    ci.inputs['Reset Children'].default_value = True
    iop = N.new('GeometryNodeInstanceOnPoints')
    iop.inputs['Pick Instance'].default_value = True

    def named(n, t):
        a = N.new('GeometryNodeInputNamedAttribute')
        a.data_type = t
        a.inputs['Name'].default_value = n
        return a
    r, s, v = named('rot', 'FLOAT_VECTOR'), named('scl', 'FLOAT_VECTOR'), named('variant', 'INT')
    e2r = N.new('FunctionNodeEulerToRotation')
    L.new(r.outputs['Attribute'], e2r.inputs[0])
    L.new(gi.outputs[0], iop.inputs['Points'])
    L.new(ci.outputs[0], iop.inputs['Instance'])
    L.new(v.outputs['Attribute'], iop.inputs['Instance Index'])
    L.new(e2r.outputs[0], iop.inputs['Rotation'])
    L.new(s.outputs['Attribute'], iop.inputs['Scale'])
    L.new(iop.outputs[0], go.inputs[0])
    mod = ob.modifiers.new('Scatter', 'NODES')
    mod.node_group = ng
    return ob


# ---------------------------------------------------------------- world, sun and render settings
def hdri_sun_direction(path):
    """Direction (Blender world space) of the brightest spot in an equirectangular sky image."""
    img = image(path, True)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    lum = px[..., 0] * .2126 + px[..., 1] * .7152 + px[..., 2] * .0722
    lum[:h // 2 - 2] = 0  # sun is above the horizon
    y, x = np.unravel_index(np.argmax(lum), lum.shape)
    u, v = (x + .5) / w, (y + .5) / h
    phi = -(u - .5) * TAU
    el = (v - .5) * math.pi
    return Vector((math.cos(el) * math.cos(phi), math.cos(el) * math.sin(phi), math.sin(el))), float(lum[y, x])


def setup_world():
    w = bpy.data.worlds.new('Sky')
    bpy.context.scene.world = w
    w.use_nodes = True
    N, L = w.node_tree.nodes, w.node_tree.links
    for n in list(N):
        N.remove(n)
    tc = N.new('ShaderNodeTexCoord')
    mp = N.new('ShaderNodeMapping')
    mp.name = 'SkyRotation'
    env = N.new('ShaderNodeTexEnvironment')
    env.name = 'SkyImage'
    bg = N.new('ShaderNodeBackground')
    bg.name = 'SkyStrength'
    out = N.new('ShaderNodeOutputWorld')
    L.new(tc.outputs['Generated'], mp.inputs['Vector'])
    L.new(mp.outputs[0], env.inputs['Vector'])
    L.new(env.outputs[0], bg.inputs['Color'])
    L.new(bg.outputs[0], out.inputs['Surface'])
    return w


def use_gpu():
    """Render on the Apple GPU (Metal). The choice lives in user preferences, not in the .blend, so call it per run."""
    s = bpy.context.scene
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == 'METAL'
        s.cycles.device = 'GPU'
    except Exception as e:  # CPU still works, only slower
        print('GPU not available:', e)


def setup_render():
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    use_gpu()
    s.cycles.samples = 128
    s.render.use_persistent_data = True  # keep the scene on the GPU between shots
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = .02
    s.cycles.use_denoising = True
    s.cycles.denoiser = 'OPENIMAGEDENOISE'
    s.cycles.max_bounces = 10
    s.cycles.diffuse_bounces = 3
    s.cycles.glossy_bounces = 3
    s.cycles.transmission_bounces = 8
    s.cycles.transparent_max_bounces = 48  # stacked needle and leaf cards
    s.cycles.volume_bounces = 1
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles.blur_glossy = 1.
    s.render.resolution_x, s.render.resolution_y = 1920, 1080
    s.render.film_transparent = False
    s.view_settings.view_transform = 'AgX'
    try:
        s.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    s.render.image_settings.file_format = 'PNG'
