#!/bin/sh
# Web copies of the Blender renders: homepage pictures (public/img), the sauna gallery and the 360° photos.
# Needs cwebp (brew install webp). Run from the repository root after rendering.
set -e
R=~/dev/longevityclinic-blender-assets/renders
mkdir -p public/img
# name on the web : render : width
for item in overview:overview_day:1920 overview-dusk:overview_dusk:1920 pool:pool_day:1280 lounge-interior:lounge_interior_day:1280 \
            finska-interior:finska_interior_day:1280 plunge:plunge_day:1280; do
  IFS=: read -r name src width <<EOT
$item
EOT
  cwebp -quiet -q 80 -m 6 -resize "$width" 0 "$R/$src.png" -o "public/img/$name.webp"
done
# Hero: upright 4:5 crop from the middle of the Finnish sauna at dusk; social preview: 1200x630.
cwebp -quiet -q 82 -m 6 -crop 528 0 864 1080 "$R/finska_dusk.png" -o public/img/hero.webp
sips -s format png -z 675 1200 "$R/overview_dusk.png" --out /tmp/aevum-og.png >/dev/null
sips -c 630 1200 /tmp/aevum-og.png --out public/og.png >/dev/null
# Sauna page gallery.
for s in overview_dusk finska_day finska_interior_day plunge_day lounge_interior_day pool_day ceremonial_winter_dusk overview_winter_day; do
  n=$(echo "$s" | tr _ -)
  cwebp -quiet -q 78 -resize 1600 0 "$R/$s.png" -o "public/sauna-renders/$n.webp"
  cwebp -quiet -q 70 -resize 320 0 "$R/$s.png" -o "public/sauna-renders/$n-thumb.webp"
done
# 360° photos: full size and a smaller one for phones.
for f in areal finska herbal solna odpocivarna ochlazeni bazen u-vody klinika vstup potok; do
  cwebp -quiet -q 78 -m 6 "$R/panoramas/$f.png" -o "public/sauna-renders/pano-$f.webp"
  cwebp -quiet -q 78 -m 6 -resize 4096 2048 "$R/panoramas/$f.png" -o "public/sauna-renders/pano-$f-m.webp"
done
