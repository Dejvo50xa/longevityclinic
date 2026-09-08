# HANDOFF — AEVUM, web kliniky dlouhověkosti

Tenhle soubor je zadání pro jazykový model, který má na projektu pokračovat.
Přečti ho celý, než něco změníš. Na konci je **protokol odevzdání** — je závazný,
protože tvůj výstup se posílá zpátky do Claude Cowork, kde se odbuilduje a pushne
na GitHub. Když ho nedodržíš, práci nejde nasadit.

---

## 1. Co to je

**AEVUM** — prezentační web připravovaného projektu longevity kliniky v ČR.
Klinika kombinuje špičkovou diagnostiku a regenerační technologie s přírodním
prostředím: wellness, fyzioterapie, masáže, kompletní revitalizace.

- **Repo:** `github.com/Dejvo50xa/longevityclinic`, větev `main`
- **Deploy:** push do `main` → Vercel nasadí automaticky
- **Doména:** `longevityclinic-one.vercel.app`
- **Majitel:** David (GitHub `Dejvo50xa`). Píše česky, mluv na něj česky.

Vizuální podpis je **kontrast měřitelného a nezměřitelného** — jang (světlá
plocha, technologie a data) proti jin (tmavá plocha, příroda a regenerace).
V sekci Filozofie stojí obě poloviny doslova vedle sebe: světlý panel
„Technologie" a tmavý panel „Příroda". Značka je stylizovaný jin-jang.
Tuhle metaforu neruš — je to jediná věc, která web odlišuje od stovky jiných
klinik. **Nese ji ale typografie a plochy, ne 3D grafika.**

> **Historie (září 2026):** dřív byl na pozadí celého webu animovaný 3D „vortex" —
> dvě protilehlé spirály částic v three.js s bloomem. David ho nechal odstranit
> (svítící objekt na pozadí zhoršoval čitelnost a přidával ~500 kB do bundlu).
> Web je teď **světlý, statický, bez WebGL v hlavní stránce**. Soubor
> `src/Vortex.jsx` zůstal v repu jako archiv, ale **nikde se neimportuje** —
> nevracej ho zpátky bez výslovného pokynu.

---

## 2. Stack a tvrdá pravidla

| | |
|---|---|
| Build | Vite 5 |
| UI | React 18 (ne 19) |
| 3D | three.js `^0.169.0`, **raw** — používá se **jen** ve stránce `?sauna` |
| Styly | Čisté CSS v jednom souboru, **žádný Tailwind, žádná UI knihovna** |
| Routing | Žádný — jednostránkový web s kotvami + `?sauna` v `main.jsx` |
| Backend | Žádný — formulář otevírá `mailto:` |

**Nepřidávej závislosti.** Aktuální `package.json` má tři runtime balíčky
(`react`, `react-dom`, `three`) a dva dev (`vite`, `@vitejs/plugin-react`).
Tenhle stav je záměrný — dřívější verze na r3f + drei se rozbíjela na
verzích. Jestli si myslíš, že knihovnu potřebuješ, napiš proč a nech
rozhodnutí na Davidovi; nepřidávej ji rovnou.

**Hlavní stránka nesmí sáhnout na three.js.** `Sauna.jsx` je jediný soubor,
který ho importuje, a je lazy-loadovaný v `main.jsx` jen při `?sauna`. Díky tomu
je hlavní bundle ~170 kB (55 kB gzip) a chunk s three.js se stáhne jen tomu,
kdo si otevře 3D saunu. Zachovej to.

**Nepoužívej `localStorage` ani `sessionStorage`.** Nejsou potřeba a v náhledech
se chovají nespolehlivě.

---

## 3. Struktura souborů

```
index.html          129 ř.  meta, Open Graph, JSON-LD, Google Fonts, #root
vite.config.js        7 ř.  plugin-react, chunkSizeWarningLimit
package.json                3 runtime + 2 dev závislosti
src/main.jsx         11 ř.  createRoot, přepínač ?sauna, import index.css
src/App.jsx         ~900 ř. VEŠKERÝ obsah a všechny sekce hlavní stránky
src/index.css      ~1180 ř. světlý design systém, komponentní třídy, responzivita
src/Sauna.jsx       239 ř.  3D areál lesní sauny (three.js), route ?sauna
src/sauna.css        35 ř.  styly overlaye pro 3D saunu
src/Vortex.jsx      228 ř.  ARCHIV — starý 3D vortex, nikde se neimportuje
public/favicon.svg          yin-yang značka
public/og.png               1200×630 náhled pro sociální sítě
public/robots.txt
public/sitemap.xml
```

### `src/App.jsx` — jak je organizovaný

Nahoře jsou **datová pole**, pak pomocné komponenty, pak jedna velká
`export default function App()`. Obsah se needituje v JSX, ale v těch polích:

| Pole | Tvar | Kam se renderuje |
|---|---|---|
| `NAV` | `[label, id]` | navigace + patička |
| `OBSAH` | `[číslo, label, id]` | rejstřík v pravém sloupci hera |
| `DIAGNOSTIKA` | `{t, d, tag}` | karty, `grid-4` |
| `REGENERACE` | `{t, d, tag}` | karty, `grid-3` |
| `FYZIO` | `{t, d, m}` | řádky `.row` |
| `MASAZE` | `{t, d, m}` | řádky `.row` |
| `PROSTREDI` | `{t, d}` | `.env-card` |
| `DEN` | `[čas, název, popis]` | `.timeline` (tmavá sekce) |
| `PROGRAMY` | `{n, len, price, per, items[], featured?}` | ceník |
| `FAQ` | `[otázka, odpověď]` | akordeon |

`t` = titulek, `d` = popis, `tag` = štítek na kartě, `m` = meta vpravo v řádku.

**Přidat službu = přidat objekt do pole.** Nesahej kvůli tomu do JSX.
Když přidáš položku do `FAQ`, přidej ji **taky do JSON-LD `FAQPage`**
v `index.html` — jinak se strukturovaná data rozejdou s obsahem.
Když přidáš sekci, přidej ji i do `OBSAH`, ať sedí rejstřík v heru.

Sekce (`id` pro kotvy, v tomhle pořadí):
`filozofie` · `diagnostika` · `regenerace` · `fyzioterapie` · `masaze` ·
`prostredi` · `den` · `programy` · `faq` · `kontakt`

### Stav a efekty v `App`

| | |
|---|---|
| `scrolled` | přepíná `.nav.scrolled` po 40 px |
| `menu` | mobilní menu, zamyká `body` scroll |
| `open` | otevřená položka FAQ (index, `-1` = zavřeno) |

Scroll handler je **jeden**, throttlovaný přes `requestAnimationFrame`, listener
je `{ passive: true }`. Nepřidávej další scroll listenery — rozšiř tenhle.
`useReveal()` je `IntersectionObserver`, který přidává `.visible` třídám `.reveal`.

---

## 4. `src/Sauna.jsx` — 3D sauna na `?sauna`

Samostatná stránka mimo hlavní web, dostupná přes `?sauna` (odkaz je v NAV jako
„3D sauna"). Celý 3D běh je v jednom `useEffect` s poctivým cleanupem:
OrbitControls, procedurální shader na dřevo a vodu, stínové mapy, devět
předdefinovaných pohledů v poli `stops`. Má vlastní `sauna.css`, které si resetuje
styly zděděné z hlavního webu.

Když na ní pracuješ: drž ji lazy-loadovanou, ať se three.js nedostane do hlavního
bundlu, a nezaváděj nové závislosti (viz sekce 2).

---

## 5. Design systém (`src/index.css`)

Web je od září 2026 **světlý**. Základ je papírová plocha, akcent hluboká zeleň,
tmavé jsou jen tři místa: panel „Příroda" ve Filozofii, sekce **Den v klinice**
a patička (+ zvýrazněný program v ceníku).

### Tokeny

```css
/* plochy */          --paper: #f7f5f0   --paper-2: #efece4   --paper-3: #e7e3d9
/* tmavé bloky */     --ink: #0f1a16     --ink-2: #142019     --ink-3: #0a120f
/* text na papíře */  --text: #26332e    --text-dim: #5a6863  --muted: #8b948f
/* text na tmavém */  --on-dark: #ece9e1 --on-dark-dim: #a6b0ab --on-dark-muted: #74807b
/* akcenty */         --accent: #17624c  --accent-hi: #1e8264 --accent-light: #4fbf9c
                      --sand: #a8834f
/* linky */           --line / --line-soft (na papíře)
                      --line-dark / --line-dark-soft (na tmavém)
/* typografie */      --serif: 'Cormorant Garamond'   --sans: 'Inter'
/* rozměry */         --maxw: 1220px   --pad: clamp(1.25rem, 5vw, 4rem)
                      --sec-y: clamp(4.5rem, 8vw, 7.5rem)   --r: 3px
```

**Používej proměnné, nepiš hex napřímo.** `--accent-light` je verze zeleně pro
tmavé podklady — na papíře je moc světlá, na `--ink` je naopak `--accent` moc
tmavá. Vždycky ber akcent ze stejné sady jako podklad.

### Konvence

- Nadpisy `h1`–`h3` serifem, tenkým řezem, těsným prokladem. Text sansem 400.
- `.eyebrow` = zelený nadtitulek s čárkou před textem, otvírá každou sekci.
- `.section-head` je **dvousloupcový**: vlevo `eyebrow` + `h2` (zabalené v `div`),
  vpravo `.lead`. Pod 900 px se skládá pod sebe. Když přidáváš sekci, drž tenhle
  tvar — jinak zůstane vpravo díra, kvůli které se web předělával.
- `.wrap` = max šířka 1220 px na střed. Každá sekce má `.wrap` uvnitř.
- **Střídání ploch:** sekce bez třídy = `--paper`, `.tone-2` = `--paper-2`,
  `.dark` = tmavá inverze (`--ink`). Rytmus je paper → tone-2 → paper → …,
  jediná `.dark` sekce je `den`. Nedělej dvě tmavé sekce za sebou.
- `.split` = sticky sloupec s nadpisem vlevo + `.rows` vpravo (fyzio, masáže).
- `.reveal` = fade-in při scrollu přes `IntersectionObserver`. Přidej ji každému
  novému bloku, jinak vypadne z rytmu stránky.
- Karty a mřížky: `.grid.grid-4` / `.grid-3` / `.grid-2` + `.card`, dál `.env`,
  `.timeline` a `.plans`. Všechny drží hairline oddělovače přes `gap: 1px` na
  pozadí `--line` (na tmavém `--line-dark`) — **nepřepisuj `gap`**.
- Karta má stejné pozadí jako sekce, ve které stojí (`.tone-2 .card` atd.);
  odděluje je jen vlásová linka. Na hover jde o stupeň světleji.

### Responzivita

Breakpointy `1100px` (grid-4 → 2 sloupce, hero a split se skládají),
`900px` (section-head, grid-3, env, timeline, plans → 2 sloupce),
`860px` (schová `.nav-links`, ukáže `.burger`), `720px` (všechno na 1 sloupec,
skryje se `.hero-index`), `480px` (tlačítka na plnou šířku).
Nový blok vždycky zkontroluj na 375 px šířky. Existuje blok
`@media (prefers-reduced-motion: reduce)` — nové animace do něj dopiš.

---

## 6. Obsahová pravidla

- **Jazyk: čeština.** Střídmá, věcná, bez marketingového nafukování. Krátké věty.
  Vykání. Žádné vykřičníky, žádné emoji, žádné „revoluční" a „jedinečné".
- **Diakritika a pomlčky píš jako skutečné znaky** (`–`, `—`, `°`, `₂`, `⁺`),
  ne jako `\uXXXX` escapy a ne jako HTML entity. Soubory jsou UTF-8.
- **Zdravotnická poctivost — tohle je nepřekročitelné:**
  - Neslibuj léčebné účinky ani konkrétní výsledky. Terapie „podporuje",
    „napomáhá", ne „vyléčí".
  - Netvrď, že klinika existuje a funguje. Je to připravovaný projekt,
    v heru je `Otevíráme 2027` a v patičce disclaimer. **Disclaimer v patičce
    nesmaž ani neoslabuj.**
  - Ceny jsou orientační placeholdery a je to u nich napsané. Nech to tam.
  - Nevymýšlej si certifikace, jména lékařů, reference klientů, počty
    ošetřených pacientů ani ocenění. Nic z toho není pravda.
- **Placeholdery, které čekají na skutečná data:** název AEVUM,
  `info@aevum.cz`, `+420 000 000 000`, lokalita, ceny, rok otevření.
  Když je David nedodá, nech je být — nenahrazuj je vlastními výmysly.

---

## 7. Když měníš meta / SEO

Kanonická URL `https://longevityclinic-one.vercel.app/` je na **šesti místech**
v `index.html` plus v `public/sitemap.xml` a `public/robots.txt`. Při změně
domény projeď všechna. V `index.html` jsou dva bloky JSON-LD:
`MedicalClinic` (služby) a `FAQPage` (musí odpovídat poli `FAQ` v `App.jsx`).
`<meta name="theme-color">` je `#f7f5f0` — při změně `--paper` ho sjednoť.

---

## 8. PROTOKOL ODEVZDÁNÍ — závazné

Tvůj výstup dostane David a nahraje ho zpátky do Claude Cowork, kde se
odbuilduje (`npx vite build`) a pushne na `main`. Aby to prošlo:

1. **Odevzdávej celé soubory, ne diffy.** Žádné `// ...zbytek beze změny`,
   žádné patche, žádné úryvky. Kompletní obsah souboru od prvního po poslední
   řádek. `App.jsx` má ~900 řádků a `index.css` ~1180 — ano, i tak celé.
2. **Jeden soubor = jeden artefakt / jeden code block.** Nemíchej dva soubory
   do jednoho bloku.
3. **Pojmenuj soubor přesnou cestou z repa**, ať je jasné, kam patří:
   `src/App.jsx`, `src/index.css`, `index.html`, `src/Sauna.jsx`.
   Když je to artefakt, dej cestu do titulku.
4. **Nepřejmenovávej soubory** a nezaváděj nové adresáře.
5. **Když měníš `package.json`**, napiš to výslovně a odůvodni každou novou
   závislost — jinak se změna zamítne (viz sekce 2).
6. **Na konec připoj krátký changelog**: co jsi změnil, které soubory jsou
   v balíku, a na co si dát pozor při kontrole. Bez odstavců o tom, jak skvělé
   to je — stačí seznam.
7. **Binární soubory neposílej** (`og.png`, `favicon.svg`). Když je potřeba
   změnit, popiš co a nech to na Claude Cowork.

Šablona changelogu:

```
## Změny
- src/App.jsx — přidána sekce „Tým" mezi Prostředí a Den, nové pole TYM
- src/index.css — třídy .team, .team-card + breakpoint 900 px

## Zkontrolovat
- JSON-LD ve index.html jsem nesahal, FAQ beze změny
- na 375 px se karty týmu skládají pod sebe
```

---

## 9. Kontrolní seznam před odevzdáním

Projdi ho po sobě, ať build neshoří na hlouposti:

- [ ] Každý změněný soubor je odevzdaný **celý**
- [ ] JSX má vyvážené závorky a tagy; žádný `class=` místo `className=`
- [ ] Každý `.map()` má `key`
- [ ] Žádná nová závislost (nebo je zdůvodněná)
- [ ] Hlavní stránka neimportuje `three` ani `Vortex.jsx`
- [ ] Nové bloky mají `.reveal` a používají CSS proměnné
- [ ] Nová sekce má `id`, `.wrap` uvnitř, dvousloupcový `.section-head`
      a je v `NAV` / `OBSAH`, pokud tam patří
- [ ] Střídání ploch sedí (paper → tone-2 → paper), žádné dvě tmavé za sebou
- [ ] Ověřeno na 375 px
- [ ] Disclaimer v patičce a `Otevíráme 2027` v heru pořád na místě
- [ ] Žádné vymyšlené lékařské tvrzení, jméno ani certifikace
- [ ] Diakritika jako skutečné znaky, UTF-8

---

## 10. Co dává smysl dělat dál

Nápady, ne úkoly — David rozhodne:

- skutečný název, doména, kontakty a ceny místo placeholderů
- fotky prostředí — světlý layout je na ně stavěný (`public/`, `loading="lazy"`);
  hero i sekce Prostředí unesou velkou fotografii bez přestavby
- sekce o týmu a o vybavení
- formulář na skutečný backend (Formspree / Vercel funkce) místo `mailto:`
- anglická mutace pro zahraniční klienty
- `og.png` z reálné fotky prostředí, až bude — současný je z tmavé verze webu
  a barevně už neodpovídá
