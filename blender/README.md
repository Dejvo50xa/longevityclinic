# Blender verze lesních lázní

Fotorealistická verze 3D areálu z `src/Sauna.jsx`: stejné rozmístění, skutečné textury
a skenovaná vegetace z Poly Haven (CC0), osvětlení z fotografií oblohy.

```bash
python3 blender/fetch_assets.py                     # ~800 MB do ~/dev/longevityclinic-blender-assets
blender -b -P blender/build_scene.py                # postaví scénu -> sauna.blend (~20 s)
blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- stills
blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- video
blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- encode
```

- `scene_kit.py` — stavebnice geometrie, materiály, sníh, rozmisťování vegetace, nastavení renderu
- `scene_parts.py` — rozmístění objektů přeložené z webové scény, krajina, les, světla, kamery (`SHOTS`)
- `render.py` — nálady den / soumrak / zima (`MODES`), seznam snímků (`STILLS`), trasa videa (`TOUR`)

Náhled: `-- stills --only finska:day --quick`. Výstupy jdou do `~/dev/longevityclinic-blender-assets/renders/`
a do gitu nepatří. První render na GPU trvá déle (kompilace kernelů).
