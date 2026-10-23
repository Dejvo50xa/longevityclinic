# Blender verze lesních lázní

Fotorealistická verze 3D areálu z `src/Sauna.jsx`: stejné rozmístění, skutečné textury
a skenovaná vegetace z Poly Haven (CC0), osvětlení z fotografií oblohy.

```bash
python3 blender/fetch_assets.py                     # ~800 MB do ~/dev/longevityclinic-blender-assets
blender -b -P blender/build_scene.py                # postaví scénu -> sauna.blend (~20 s)
blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- stills
blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- video
blender -b ~/dev/longevityclinic-blender-assets/sauna.blend -P blender/render.py -- encode
blender -b -P blender/render.py -- encode --web      # menší kopie videa pro web -> public/sauna-renders/
```

- `scene_kit.py` — stavebnice geometrie, materiály, sníh, rozmisťování vegetace, nastavení renderu
- `scene_parts.py` — rozmístění objektů přeložené z webové scény, krajina, les, světla, kamery (`SHOTS`)
- `people.py` — realistické postavy (MakeHuman) místo bílých figurín, stejná místa a pózy
- `render.py` — nálady den / soumrak / zima (`MODES`), seznam snímků (`STILLS`), trasa videa (`TOUR`)

Náhled: `-- stills --only finska:day --quick`. Výstupy jdou do `~/dev/longevityclinic-blender-assets/renders/`
a do gitu nepatří. První render na GPU trvá déle (kompilace kernelů).

## Lidé (volitelné)

Realistické postavy vyrábí rozšíření MakeHuman for Blender (MPFB, zdarma). Bez něj zůstanou bílé figuríny.

1. Blender → Edit → Preferences → Get Extensions → nainstalovat „MPFB“.
2. Z <https://static.makehumancommunity.org/assets/assetpacks.html> stáhnout a rozbalit do datové složky MPFB
   (`~/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data`):
   `makehuman_system_assets` a `skins01`, `skins02` (CC0) a pro plavky `underwear03` a `pants03` (CC-BY).

Zdroje s licencí CC-BY (uvádět autora při zveřejnění): balíčky MakeHuman „Underwear 03“ a „Pants 03“,
autoři uvedeni v souborech balíčků, makehumancommunity.org.
