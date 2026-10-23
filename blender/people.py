"""Realistic people for the renders, made with MakeHuman for Blender (MPFB, free; generated people are CC0).

Every white figure placed by scene_parts.person() is replaced here by a person with real skin, eyes, hair and
clothes: swimwear in the saunas, tub, pool and on loungers, everyday clothes on the paths and at the clinic.
Poses are set by aiming limbs at directions, so they do not depend on the skeleton's internal bone axes.

Needs the MPFB extension and the MakeHuman asset packs (see README). Without them the white figures stay.
"""
import glob
import math
import os
import random

import bpy
from mathutils import Matrix, Vector

from scene_kit import C, collection

ADDON = 'bl_ext.user_default.mpfb'
rng = random.Random(7)


def data_dir():
    return os.path.join(bpy.utils.extension_path_user(ADDON, create=True), 'data')


def available():
    import addon_utils
    try:
        addon_utils.enable(ADDON, default_set=True)
    except Exception:
        return False
    return os.path.isdir(os.path.join(data_dir(), 'skins'))


def _asset(sub, *names):
    """First existing asset among names, as the 'folder/file.mhclo' fragment MPFB expects."""
    for n in names:
        if glob.glob(os.path.join(data_dir(), sub, n, '*.mhclo')):
            return f'{n}/{os.path.basename(glob.glob(os.path.join(data_dir(), sub, n, "*.mhclo"))[0])}'
    return None


SWIM_F = ['mindfront_f_one-piece_swimsuit_01', 'punkduck_one_piece_bikini01', 'elvs_vintage_swimwear1_50s_strapless',
          'elvs_all_tied_up_bikini']  # Underwear 03 pack (CC-BY)
SWIM_M = ['mindfront_male_swimming_trunks_01', 'mindfront_male_swimming_trunks_02', 'mindfront_male_swimming_trunks_03',
          'elvs_male_swim_shorts1']  # Pants 03 pack (CC-BY)


SKINS_F = ['young_caucasian_female', 'young_caucasian_female2', 'middleage_caucasian_female', 'toigo_light_skin_female_freckles',
           'onlytheghosts_young_eurasian_female', 'old_caucasian_female', 'young_asian_female', 'middleage_african_female']
SKINS_M = ['young_caucasian_male', 'young_caucasian_male2', 'middleage_caucasian_male', 'toigo_light_skin_male_freckles',
           'old_caucasian_male', 'middleage_asian_male', 'young_african_male', 'mindfront_aksel_skin']
HAIR_F = ['bob01', 'bob02', 'long01', 'ponytail01', 'braid01']
HAIR_M = ['short01', 'short02', 'short03', 'short04']
CASUAL_F = ['female_casualsuit01', 'female_casualsuit02', 'female_sportsuit01']
CASUAL_M = ['male_casualsuit01', 'male_casualsuit02', 'male_casualsuit03', 'male_casualsuit04', 'male_casualsuit05', 'male_casualsuit06']


def _skin(name):
    f = glob.glob(os.path.join(data_dir(), 'skins', name, '*.mhmat'))
    return 'skins/' + name + '/' + os.path.basename(f[0]) if f else None


def make_human(index, outfit):
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    female = index % 2 == 0
    age = rng.uniform(.38, .75) if index % 5 else rng.uniform(.75, .9)
    skins = SKINS_F if female else SKINS_M
    skin = next(s for s in (_skin(skins[index // 2 % len(skins)]), _skin(skins[0])) if s)
    race = {'caucasian': 1., 'asian': 0., 'african': 0.}
    for key in ('asian', 'african'):
        if key in skin:
            race = {k: (1. if k == key else 0.) for k in race}
    clothes = []
    if outfit == 'swim':
        swim = [c for c in (_asset('clothes', n) for n in (SWIM_F if female else SWIM_M)) if c]
        if swim:
            clothes = [swim[index // 2 % len(swim)]]
        else:  # packs not installed yet: sports kit is the closest thing in the base assets
            clothes = [_asset('clothes', 'female_sportsuit01' if female else 'male_casualsuit06')]
    else:
        pool = CASUAL_F if female else CASUAL_M
        clothes = [_asset('clothes', pool[index % len(pool)], pool[0])]
    info = {
        'name': f'Person {index:02d}',
        'phenotype': {'gender': 0. if female else 1., 'age': age, 'muscle': rng.uniform(.4, .65), 'weight': rng.uniform(.38, .62),
                      'height': rng.uniform(.4, .65), 'proportions': rng.uniform(.5, .7), 'cupsize': .5, 'firmness': .5, 'race': race},
        'rig': 'default', 'eyes': _asset('eyes', 'high-poly'), 'eyebrows': _asset('eyebrows', f'eyebrow{index % 12 + 1:03d}', 'eyebrow001'),
        'eyelashes': _asset('eyelashes', 'eyelashes01'), 'teeth': _asset('teeth', 'teeth_base'),
        'hair': _asset('hair', (HAIR_F if female else HAIR_M)[index // 2 % (5 if female else 4)]),
        'clothes': [c for c in clothes if c], 'skin_mhmat': skin, 'skin_material_type': 'ENHANCED_SSS',
        'eyes_material_type': 'PROCEDURAL_EYES', 'targets': [],
    }
    settings = HumanService.get_default_deserialization_settings()
    body = HumanService.deserialize_from_dict(info, settings)
    rig = body.parent if body.parent and body.parent.type == 'ARMATURE' else None
    return rig, body


# ---------------------------------------------------------------- posing by aiming limbs
def _joint(rig, bone):
    return rig.matrix_world @ rig.pose.bones[bone].head


def aim(rig, start, end, direction):
    """Rotate bone 'start' (and its children) so the segment start-joint -> end-joint points along direction."""
    bpy.context.view_layer.update()
    a, b = _joint(rig, start), _joint(rig, end)
    cur, d = (b - a).normalized(), Vector(direction).normalized()
    ang = cur.angle(d)
    if ang < 1e-4:
        return
    axis = cur.cross(d)
    if axis.length < 1e-6:
        return
    W = rig.matrix_world
    pb = rig.pose.bones[start]
    R = Matrix.Translation(a) @ Matrix.Rotation(ang, 4, axis.normalized()) @ Matrix.Translation(-a)
    pb.matrix = W.inverted() @ R @ W @ pb.matrix
    bpy.context.view_layer.update()


def frame(rig):
    """Forward, up and left-side unit vectors of the character in world space."""
    up = (rig.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
    left = (_joint(rig, 'upperleg01.L') - _joint(rig, 'upperleg01.R')).normalized()
    fwd = up.cross(left).normalized()
    toe = _joint(rig, 'toe1-1.L') - _joint(rig, 'foot.L')
    if toe.dot(fwd) < 0:
        fwd = -fwd
    return fwd, up, left


def limbs(rig, side, thigh=None, shin=None, arm=None, forearm=None):
    s = '.L' if side > 0 else '.R'
    if thigh is not None:
        aim(rig, 'upperleg01' + s, 'lowerleg01' + s, thigh)
    if shin is not None:
        aim(rig, 'lowerleg01' + s, 'foot' + s, shin)
    if arm is not None:
        aim(rig, 'upperarm01' + s, 'lowerarm01' + s, arm)
    if forearm is not None:
        aim(rig, 'lowerarm01' + s, 'wrist' + s, forearm)


def pose(rig, kind):
    F, U, L = frame(rig)
    if kind == 'lie':  # recline the whole body onto the lounger back (about 62 degrees from upright)
        hip = (_joint(rig, 'upperleg01.L') + _joint(rig, 'upperleg01.R')) / 2
        R = Matrix.Translation(hip) @ Matrix.Rotation(math.radians(62), 4, F.cross(U)) @ Matrix.Translation(-hip)
        rig.matrix_world = R @ rig.matrix_world
        bpy.context.view_layer.update()
        F0, U0 = F, U
        F, U, L = frame(rig)
        down_torso = -U
        for sd in (1, -1):
            limbs(rig, sd, thigh=F0 + U0 * .08 + L * sd * .06, shin=F0 - U0 * .02 + L * sd * .04,
                  arm=down_torso + L * sd * .25 + F * .1, forearm=down_torso + F0 * .5 + L * sd * .1)
        return
    for sd in (1, -1):
        if kind == 'stand':
            limbs(rig, sd, thigh=-U + L * sd * .02, shin=-U, arm=-U + L * sd * .16 + F * .04, forearm=-U + F * .3 + L * sd * .05)
        elif kind == 'walk':
            step = .36 if sd > 0 else -.3
            limbs(rig, sd, thigh=-U + F * step, shin=-U + F * (.15 if sd > 0 else -.5),
                  arm=-U - F * step * .8 + L * sd * .14, forearm=-U + F * (.45 - step * .5) + L * sd * .05)
        elif kind == 'sit':
            limbs(rig, sd, thigh=F + L * sd * .12 - U * .04, shin=-U + F * .1, arm=-U + F * .5 + L * sd * .14,
                  forearm=F - U * .45 - L * sd * .12)
        elif kind == 'bathe':
            limbs(rig, sd, thigh=F + L * sd * .2 - U * .1, shin=-U + F * .2, arm=-U + F * .4 + L * sd * .5,
                  forearm=F + L * sd * .25 - U * .1)


def place(rig, kind, spec):
    """Move the posed person so their hip joints sit where the white figure's hips were, facing the same way."""
    G = spec['G']  # three.js world matrix of the figure
    S, W = spec['S'], spec['W']
    hip_local = {'sit': (0, S + .1, 0), 'lie': (0, .64, -.35), 'bathe': (0, W - .32, 0)}.get(kind, (0, .93, 0))
    target = C @ G @ Vector(hip_local)
    fwd_target = (C @ G).to_3x3() @ Vector((0, 0, 1))
    fwd_target.z = 0
    F, _, _ = frame(rig)
    F.z = 0
    yaw = math.atan2(fwd_target.y, fwd_target.x) - math.atan2(F.y, F.x)
    hip = (_joint(rig, 'upperleg01.L') + _joint(rig, 'upperleg01.R')) / 2
    rig.matrix_world = Matrix.Translation(target) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Translation(-hip) @ rig.matrix_world


def build_people(specs):
    coll = collection('People')
    keep = [m for m in bpy.data.materials if not m.use_fake_user]
    for m in keep:  # MPFB deletes every unused material while it works; protect the scene's own ones
        m.use_fake_user = True
    made = 0
    for i, spec in enumerate(specs):
        rig, body = make_human(i, spec['outfit'])
        if rig is None:
            continue
        pose(rig, spec['pose'])
        place(rig, spec['pose'], spec)
        for o in [rig] + list(rig.children_recursive):
            for c in list(o.users_collection):
                c.objects.unlink(o)
            coll.objects.link(o)
        made += 1
    for m in keep:
        m.use_fake_user = False
    print('realistic people', made)
