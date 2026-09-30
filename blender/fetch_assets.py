"""Download the free (CC0) Poly Haven assets used by the Blender scene.

Run with plain Python 3:  python3 blender/fetch_assets.py
Files go to ~/dev/longevityclinic-blender-assets (outside the repo). Already
downloaded files are skipped, so the script can be re-run safely.
"""
import json
import os
import sys
import urllib.request

ASSETS = os.path.expanduser('~/dev/longevityclinic-blender-assets')
UA = {'User-Agent': 'aevum-sauna-render/1.0'}

# Photo-scanned models. The big trees use 1k textures: their geometry already dominates the size.
MODELS = {
    'fir_tree_01': '1k', 'fir_sapling_medium': '1k', 'tree_small_02': '1k',
    'grass_medium_01': '2k', 'grass_medium_02': '2k', 'fern_02': '2k', 'shrub_02': '2k', 'shrub_04': '2k',
    'dandelion_01': '2k', 'moss_01': '2k', 'rock_moss_set_01': '2k', 'rock_moss_set_02': '2k',
    'boulder_01': '2k', 'stone_01': '2k', 'tree_stump_01': '2k', 'dry_branches_medium_01': '2k',
}
# Surface textures: colour, normal, roughness and displacement at 2k.
TEXTURES = [
    'plywood', 'kitchen_wood', 'fine_grained_wood', 'pine_bark', 'gravel_floor_02', 'granite_tile', 'concrete_floor_02', 'leafy_grass',
    'forest_ground_04', 'brown_mud_leaves_01', 'snow_02', 'box_profile_metal_sheet', 'large_sandstone_blocks_01',
    'dry_river_pebbles', 'metal_plate',
]
# Real skies for lighting: summer day, dusk (two) and overcast winter.
HDRIS = ['kloofendal_38d_partly_cloudy_puresky', 'qwantani_dusk_2_puresky', 'qwantani_dusk_1_puresky', 'snow_field_puresky']


def api(path):
    return json.load(urllib.request.urlopen(urllib.request.Request('https://api.polyhaven.com/' + path, headers=UA)))


def fetch(url, dest, size):
    if os.path.exists(dest) and os.path.getsize(dest) == size:
        return 0
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.part'
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r, open(tmp, 'wb') as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(tmp, dest)
    return size


def main():
    total = 0
    for name, res in MODELS.items():
        blend = api('files/' + name)['blend'][res]['blend']
        folder = os.path.join(ASSETS, 'models', name)
        total += fetch(blend['url'], os.path.join(folder, os.path.basename(blend['url'])), blend['size'])
        for rel, info in blend.get('include', {}).items():
            total += fetch(info['url'], os.path.join(folder, rel), info['size'])
        print('model  ', name, flush=True)
    for name in TEXTURES:
        files = api('files/' + name)
        for kind in ('Diffuse', 'nor_gl', 'Rough', 'Displacement'):
            if kind in files and '2k' in files[kind]:
                info = files[kind]['2k'].get('jpg') or files[kind]['2k'].get('png')
                ext = os.path.splitext(info['url'])[1]
                total += fetch(info['url'], os.path.join(ASSETS, 'textures', name, kind.lower() + ext), info['size'])
        print('texture', name, flush=True)
    for name in HDRIS:
        info = api('files/' + name)['hdri']['4k']['hdr']
        total += fetch(info['url'], os.path.join(ASSETS, 'hdri', name + '.hdr'), info['size'])
        print('sky    ', name, flush=True)
    print(f'done, downloaded {total / 1e6:.0f} MB', flush=True)


if __name__ == '__main__':
    sys.exit(main())
