# AEVUM — klinika dlouhověkosti

Prezentační web připravovaného projektu longevity kliniky: špičková diagnostika
a regenerační technologie v přírodním prostředí — wellness, fyzioterapie, masáže
a kompletní revitalizace.

Vizuální podpis webu je **kontrast měřitelného a nezměřitelného** — světlá
papírová plocha (jang = technologie a data) proti tmavým blokům hluboké zeleně
(jin = příroda a regenerace). V sekci Filozofie stojí obě poloviny vedle sebe.

## Stack

- Vite 5 + React 18
- Čisté CSS, žádný UI framework
- three.js jen pro samostatnou stránku 3D sauny (`?sauna`), lazy-loadovanou —
  hlavní stránka žádné WebGL nepoužívá

## Vývoj

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
npm run preview
```

## Struktura

```
index.html          meta, Open Graph, JSON-LD (MedicalClinic + FAQPage)
src/App.jsx         veškerý obsah a sekce webu
src/index.css       světlý design systém a responzivita
src/Sauna.jsx       3D areál lesní sauny (three.js), route ?sauna
src/Vortex.jsx      archiv — starý 3D vortex, nikde se neimportuje
public/             favicon, og.png, robots.txt, sitemap.xml
```

Podrobné zadání pro další práci na webu je v `HANDOFF.md`.
