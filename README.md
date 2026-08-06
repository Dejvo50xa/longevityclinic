# AEVUM — klinika dlouhověkosti

Prezentační web připravovaného projektu longevity kliniky: špičková diagnostika
a regenerační technologie v přírodním prostředí — wellness, fyzioterapie, masáže
a kompletní revitalizace.

Vizuální podpis webu je **yin-yang vortex** — dvě protilehlé spirály částic
(jang = technologie, jin = příroda), které do sebe plynule přecházejí.

## Stack

- Vite 5 + React 18
- three.js (raw, bez react-three-fiber) + UnrealBloomPass
- Čisté CSS, žádný UI framework

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
src/Vortex.jsx      3D vortex (three.js, instancované částice)
src/index.css       design systém a responzivita
public/             favicon, robots.txt, sitemap.xml
```

## Výkon 3D vrstvy

- barvy a jednotkové matice se počítají jen jednou při startu; ve smyčce se
  přepisuje pouze translace instancí (indexy 12–14 matice)
- počet částic podle šířky okna: 4 500 (mobil) / 9 000 (tablet) / 14 000 (desktop)
- po odscrollování z hera se renderuje na poloviční frekvenci a vrstva se
  ztlumí na ~12 % krytí
- vortex se vůbec nespustí bez WebGL nebo při `prefers-reduced-motion: reduce`
- animace se pozastaví, když je záložka na pozadí

## Co upravit před ostrým spuštěním

- název, doména a kanonická URL (`index.html`, `public/sitemap.xml`, `public/robots.txt`)
- kontaktní e-mail a telefon (`src/App.jsx` — sekce Kontakt a funkce `submit`)
- adresa a `geo` údaje v JSON-LD
- `public/og.png` (1200 × 630) pro náhledy na sociálních sítích
- ceny programů jsou orientační placeholdery

## Nasazení

Push do `main` → Vercel automaticky nasadí.
