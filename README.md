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


## November 2026 redesign

The homepage is semantic HTML in `index.html`, styled by `src/index.css`; `src/App.jsx` initializes its dialogs, navigation and demo form. `src/main.jsx` loads React and the unchanged 3D sauna only for `?sauna`. Assets and font licenses are in `public/img`. No dependencies were added. The contact form is explicitly a demo and sends no data. Prices, services and opening date remain provisional.


## Longevity content update

The homepage now emphasizes preventive assessment, a personal longitudinal care plan and the annual Longevity program. Planned equipment has its own section: cryotherapy, hyperbaric oxygen therapy, red/near-infrared light and functional diagnostics. Availability, models and indications remain provisional; no life-extension or rejuvenation outcomes are promised.

Editorial references reviewed on 2026-11-21:
- https://hx.clinic/nas-pristup/ and https://hx.clinic/programy/ (care concept only; original AEVUM wording, no borrowed staff, credentials or product names).
- https://www.fda.gov/medical-devices/letters-health-care-providers/follow-instructions-safe-use-hyperbaric-oxygen-therapy-devices-letter-health-care-providers
- https://www.aad.org/public/cosmetic/safety/cryotherapy
- https://www.aad.org/public/cosmetic/safety/red-light-therapy

Validation: production build, structural and local-asset verification, desktop and mobile layout, technology disclosures and the updated Longevity dialog. No lint or type-check scripts are configured.
