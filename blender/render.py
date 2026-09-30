"""Render the sauna retreat: studio stills in four moods and a fly-through video.

  blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- stills
  blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- stills --only overview:day --quick
  blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- video
Output goes to ~/dev/longevityclinic-blender-assets/renders/.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scene_kit import ASSETS, HDRI, hdri_sun_direction, set_control, use_gpu  # noqa: E402

OUT = os.path.join(ASSETS, 'renders')
# Real skies; 'az' turns each sky so its sun sits where the web scene's sun is (degrees, Blender world).
MODES = {
    'day': dict(hdri='kloofendal_38d_partly_cloudy_puresky', strength=1., az=-95, night=0., snow=0., exposure=.55),
    'dusk': dict(hdri='qwantani_dusk_2_puresky', strength=.18, az=-100, night=1., snow=0., exposure=.6),
    'winter_day': dict(hdri='snow_field_puresky', strength=1.2, az=-95, night=0., snow=1., exposure=.2),
    'winter_dusk': dict(hdri='qwantani_dusk_1_puresky', strength=.2, az=-100, night=1., snow=1., exposure=.35),
}
STILLS = [(s, 'day') for s in ('overview', 'finska', 'finska_interior', 'herbal', 'ceremonial', 'lounge', 'lounge_interior',
                              'plunge', 'pool', 'pergola', 'clinic', 'entrance', 'stream')]
STILLS += [(s, m) for m in ('dusk', 'winter_day', 'winter_dusk') for s in ('overview', 'finska', 'pool', 'ceremonial', 'lounge')]
_sun_cache = {}


def mode_name(dusk, winter):
    return ('winter_' if winter else '') + ('dusk' if dusk else 'day')


def apply_mode(dusk=False, winter=False, name=None):
    name = name or mode_name(dusk, winter)
    M = MODES[name]
    scene = bpy.context.scene
    nodes = scene.world.node_tree.nodes
    path = os.path.join(HDRI, M['hdri'] + '.hdr')
    nodes['SkyImage'].image = bpy.data.images.load(path, check_existing=True)
    if path not in _sun_cache:
        _sun_cache[path] = hdri_sun_direction(path)[0]
    s = _sun_cache[path]
    gamma = math.atan2(s.y, s.x) - math.radians(M['az'])
    nodes['SkyRotation'].inputs['Rotation'].default_value = (0, 0, gamma)
    nodes['SkyStrength'].inputs['Strength'].default_value = M['strength']
    sun = bpy.data.objects.get('Sun')
    if sun:  # the sky image already contains the sun; the lamp only marks its direction
        d = s.copy()
        d.rotate(__import__('mathutils').Matrix.Rotation(-gamma, 3, 'Z'))
        sun.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        sun.data.energy = 0.
    set_control('NightLevel', M['night'])
    set_control('SnowAmount', M['snow'])
    for ob in bpy.data.collections['Night lights'].objects:
        ob.data.energy = ob['day'] + (ob['dusk'] - ob['day']) * M['night']
    winter = M['snow'] > 0
    for cname, show in (('SummerOnly', not winter), ('WinterOnly', winter)):
        c = bpy.data.collections.get(cname)
        if c:
            c.hide_render = not show
            c.hide_viewport = not show
    scene.view_settings.exposure = M['exposure']
    return name


def render_stills(plan, quick=False):
    scene = bpy.context.scene
    os.makedirs(OUT, exist_ok=True)
    if quick:
        scene.render.resolution_percentage = 40
        scene.cycles.samples = 48
    current = None
    for shot, mode in plan:
        if mode != current:
            apply_mode(name=mode)
            current = mode
        scene.camera = bpy.data.objects['Cam ' + shot]
        scene.render.filepath = os.path.join(OUT, f'{shot}_{mode}{"_quick" if quick else ""}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', scene.render.filepath, flush=True)


# Fly-through: (three.js position, look-at target) waypoints, flown along a smooth curve.
TOUR = [((18, 16, 42), (0, 1, 2)), ((7, 4.5, 22), (0, 1.5, 5)), ((8.5, 2.2, 9), (1, 1.4, 0)), ((-6, 2.6, 26), (-19, .6, 20)),
        ((-22, 5.5, 37), (-31, 1.2, 24)), ((-20, 7, 8), (-33, 1.5, 0)), ((-15, 5, -11), (-28, 0, -23)), ((5, 5, -17), (0, 1.5, -29)),
        ((30, 4.5, -25), (18, 2, -39)), ((46, 40, 58), (0, 0, -3))]


def render_video(fps=25, seconds=36, engine='EEVEE', res=(1920, 1080), frames=None):
    """Animate a camera along TOUR, render PNG frames (resumable), then encode an MP4 with Blender's own encoder."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from scene_kit import Curve, bl
    scene = bpy.context.scene
    apply_mode(name='day')
    n = fps * seconds
    pos = Curve([(p[0], p[2]) for p, _ in TOUR])
    tgt = Curve([(t[0], t[2]) for _, t in TOUR])
    ph, th = [p[1] for p, _ in TOUR], [t[1] for _, t in TOUR]

    def height(hs, u):  # smooth height between waypoints
        k = u * (len(hs) - 1)
        i = min(int(k), len(hs) - 2)
        f = k - i
        f = f * f * (3 - 2 * f)
        return hs[i] * (1 - f) + hs[i + 1] * f
    cd = bpy.data.cameras.new('Tour')
    cd.lens = 24
    cd.clip_end = 3000
    cam = bpy.data.objects.new('Cam tour', cd)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for f in range(n):
        u = f / (n - 1)
        u = .5 - .5 * math.cos(u * math.pi)  # ease in and out
        p, t = pos.point(u), tgt.point(u)
        P, T = bl(p.x, height(ph, u), p.z), bl(t.x, height(th, u), t.z)
        cam.location = P
        cam.rotation_euler = (T - P).to_track_quat('-Z', 'Y').to_euler()
        cam.keyframe_insert('location', frame=f + 1)
        cam.keyframe_insert('rotation_euler', frame=f + 1)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'  # steady motion for ripples and smoke
    for mat in bpy.data.materials:  # moving ripples and drifting smoke
        if mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.name in ('Ripples', 'Wisps'):
                    w = node.inputs['W']
                    w.default_value = 0
                    w.keyframe_insert('default_value', frame=1)
                    w.default_value = seconds * (.35 if node.name == 'Ripples' else .18)
                    w.keyframe_insert('default_value', frame=n)
    scene.frame_start, scene.frame_end = 1, n
    scene.render.fps = fps
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    if engine == 'EEVEE':
        scene.render.engine = next(e for e in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE') if e in {i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items})
        ee = scene.eevee
        for attr, val in (('taa_render_samples', 64), ('use_raytracing', True), ('use_shadows', True), ('volumetric_tile_size', '4'),
                          ('use_volumetric_shadows', True), ('shadow_ray_count', 2), ('shadow_step_count', 8)):
            if hasattr(ee, attr):
                try:
                    setattr(ee, attr, val)
                except Exception:
                    pass
    else:  # Cycles: scene stays on the GPU between frames; few samples, the denoiser does the rest
        scene.render.engine = 'CYCLES'
        scene.render.use_persistent_data = True
        scene.cycles.samples = 24
        scene.cycles.adaptive_threshold = .05
    frames_dir = os.path.join(OUT, 'tour_frames')
    os.makedirs(frames_dir, exist_ok=True)
    scene.render.image_settings.file_format = 'PNG'
    for f in frames or range(1, n + 1):
        path = os.path.join(frames_dir, f'{f:04d}.png')
        if os.path.exists(path):
            continue
        scene.frame_set(f)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print('frame', f, flush=True)


def encode_video(fps=25):
    """Join the PNG frames into an H.264 MP4 using Blender's sequencer."""
    frames_dir = os.path.join(OUT, 'tour_frames')
    files = sorted(f for f in os.listdir(frames_dir) if f.endswith('.png'))
    scene = bpy.data.scenes.new('Encode')
    bpy.context.window_scene = scene if bpy.context.window else None
    scene.sequence_editor_create()
    strip = scene.sequence_editor.strips.new_image('tour', os.path.join(frames_dir, files[0]), 1, 1)
    for f in files[1:]:
        strip.elements.append(f)
    scene.frame_start, scene.frame_end = 1, len(files)
    scene.render.fps = fps
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.filepath = os.path.join(OUT, 'aevum_flythrough.mp4')
    bpy.ops.render.render(animation=True, scene=scene.name)


def main(argv):
    args = argv[argv.index('--') + 1:] if '--' in argv else []
    quick = '--quick' in args
    use_gpu()
    if args and args[0] == 'stills':
        plan = STILLS
        if '--only' in args:
            plan = [tuple(x.split(':')) for x in args[args.index('--only') + 1].split(',')]
        render_stills(plan, quick)
    elif args and args[0] == 'video':
        frames = None
        if '--frames' in args:
            a, b = args[args.index('--frames') + 1].split('-')
            frames = range(int(a), int(b) + 1)
        render_video(engine='EEVEE' if '--eevee' in args else 'CYCLES', res=(1280, 720), frames=frames)
    elif args and args[0] == 'encode':
        encode_video()


if __name__ == '__main__':
    main(sys.argv)
