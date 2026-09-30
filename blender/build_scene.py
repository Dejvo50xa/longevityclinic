"""Build the AEVUM forest sauna retreat in Blender for photorealistic renders.

The layout mirrors src/Sauna.jsx (the web 3D page) object by object; here every
surface gets a real photo texture, the forest is made of photo-scanned trees and
the light comes from real sky images.

Run:   blender -b -P blender/build_scene.py
Needs: python3 blender/fetch_assets.py  (downloads the Poly Haven assets first)
Writes ~/dev/longevityclinic-blender-assets/sauna.blend
"""
import bpy
import glob
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scene_kit import *  # noqa: F401,F403  geometry builder, materials, placement helpers
import scene_parts

OUT = os.path.join(ASSETS, 'sauna.blend')


def main():
    reset_scene()
    materials = make_materials()
    B = Builder(materials)
    layout = scene_parts.build_everything(B)
    B.finish()
    scene_parts.plant_vegetation(B, layout)
    scene_parts.add_lights_and_cameras(layout)
    import render
    render.apply_mode(dusk=False, winter=False)
    setup_render()
    bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
    print('saved', OUT)


if __name__ == '__main__':
    main()
