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
- **Doména:** `longevityclinic.vercel.app`
- **Majitel:** David (GitHub `Dejvo50xa`). Píše česky, mluv na něj česky.

Vizuální podpis je **yin-yang vortex** — dvě protilehlé spirály částic, které do
sebe plynule přecházejí. Jang (světlá, teplá slonovina) = technologie a měření.
Jin (hluboká zelenomodrá) = příroda a regenerace. Celá myšlenka webu je, že se
tyhle dvě věci nevylučují, ale potřebují. Neruš tuhle metaforu — je to jediná
věc, která web odlišuje od stovky jiných klinik.

---

## 2. Stack a tvrdá pravidla

| | |
|---|---|
| Build | Vite 5 |
| UI | React 18 (ne 19) |
| 3D | three.js `^0.169.0`, **raw**, bez `@react-three/fiber` a bez `drei` |
| Styly | Čisté CSS v jednom souboru, **žádný Tailwind, žádná UI knihovna** |
| Routing | Žádný — jednostránkový web s kotvami |
| Backend | Žádný — formulář otevírá `mailto:` |

**Nepřidávej závislosti.** Aktuální `package.json` má tři runtime balíčky
(`react`, `react-dom`, `three`) a dva dev (`vite`, `@vitejs/plugin-react`).
Tenhle stav je záměrný — dřívější verze na r3f + drei se rozbíjela na
verzích. Jestli si myslíš, že knihovnu potřebuješ, napiš proč a nech
rozhodnutí na Davidovi; nepřidávej ji rovnou.

**Nepoužívej `localStorage` ani `sessionStorage`.** Nejsou potřeba a v náhledech
se chovají nespolehlivě.

---

## 3. Struktura souborů

```
index.html          129 ř.  meta, Open Graph, JSON-LD, Google Fonts, #root
vite.config.js        7 ř.  plugin-react, chunkSizeWarningLimit
package.json                3 runtime + 2 dev závislosti
src/main.jsx          9 ř.  createRoot, import index.css
src/App.jsx         894 ř.  VEŠKERÝ obsah a všechny sekce
src/Vortex.jsx      228 ř.  3D vortex, raw three.js
src/index.css      1238 ř.  design systém, komponentní třídy, responzivita
public/favicon.svg          yin-yang značka
public/og.png               1200×630 náhled pro sociální sítě
public/robots.txt
public/sitemap.xml
```

### `src/App.jsx` — jak je organizovaný

Nahoře jsou **datová pole**, pak pomocné komponenty, pak jedna velká
`export default function App()`. Obsah se needituje v JSX, ale v těch polích:

| Pole | Řádek | Tvar | Kam se renderuje |
|---|---|---|---|
| `NAV` | 9 | `[label, id]` | navigace + patička |
| `DIAGNOSTIKA` | 18 | `{t, d, tag}` | karty, `grid-4` |
| `REGENERACE` | 61 | `{t, d, tag}` | karty, `grid-3` |
| `FYZIO` | 109 | `{t, d, m}` | řádky `.row` |
| `MASAZE` | 142 | `{t, d, m}` | řádky `.row` |
| `PROSTREDI` | 175 | `{t, d}` | `.env-card` |
| `DEN` | 202 | `[čas, název, popis]` | timeline |
| `PROGRAMY` | 214 | `{n, len, price, per, items[], featured?}` | ceník |
| `FAQ` | 262 | `[otázka, odpověď]` | akordeon |

`t` = titulek, `d` = popis, `tag` = štítek na kartě, `m` = meta vpravo v řádku.

**Přidat službu = přidat objekt do pole.** Nesahej kvůli tomu do JSX.
Když přidáš položku do `FAQ`, přidej ji **taky do JSON-LD `FAQPage`**
v `index.html` — jinak se strukturovaná data rozejdou s obsahem.

Sekce (`id` pro kotvy, v tomhle pořadí):
`filozofie` · `diagnostika` · `regenerace` · `fyzioterapie` · `masaze` ·
`prostredi` · `den` · `programy` · `faq` · `kontakt`

### Stav a efekty v `App`

| | |
|---|---|
| `scrolled` | přepíná `.nav.scrolled` po 40 px |
| `menu` | mobilní menu, zamyká `body` scroll |
| `open` | otevřená položka FAQ (index, `-1` = zavřeno) |
| `show3D` | vortex se mountne jen s WebGL a bez `prefers-reduced-motion` |
| `count` | částic podle šířky okna: `<700` → 4500, `<1200` → 9000, jinak 14000 |
| `layerRef` | scroll handler mu nastavuje `--vortex-opacity` |
| `idleRef` | `true` po odscrollování z hera → vortex jede na půl snímků |

Scroll handler je jeden, throttlovaný přes `requestAnimationFrame`, listener je
`{ passive: true }`. Nepřidávej další scroll listenery — rozšiř tenhle.

---

## 4. `src/Vortex.jsx` — nesahat bez čtení

Celý 3D běh je v jednom `useEffect` s poctivým cleanupem. Matematika spirály je
převzatá z původního prototypu a je **záměrně** taková, jaká je:

```
r      = RADIUS * sqrt(u)
spiral = GOLDEN*local + side*TWIST*sqrt(u) + side*t*FLOW
x      = side * r * cos(spiral) * (1-u)
y      = HEIGHT * (0.5-u) * sin(spiral*0.5 + t)
z      =        r * sin(spiral) * (1-u)
```

Konstanty nahoře souboru: `RADIUS 70`, `TWIST 5`, `FLOW 1.3`, `HEIGHT 40`.
Ladit se dají, ale drž `TWIST` mezi 3 a 8 — mimo to se yin-yang rozpadne na
kouli nebo na disk.

### Optimalizace, které nesmíš rozbít

Tohle je rozdíl mezi plynulým webem a topícím se notebookem:

1. **Barvy se počítají jen jednou** při startu (`setColorAt` v init smyčce).
   Barva závisí čistě na `u` a `side`, obojí je na částici konstantní.
   Nikdy nevolej `setColorAt` v render smyčce.
2. **Matice se nesestavuje.** V každém snímku se přepisují jen indexy
   `12`, `13`, `14` v `mesh.instanceMatrix.array` (translace). Zbytek matice
   je jednotkový a nastaví se jednou. Nepoužívej `Object3D` + `updateMatrix()`.
3. **Konstanty na částici** jsou předpočítané v `Float32Array`
   (`side`, `uArr`, `rArr`, `base`, `blend`). Ve smyčce zbyde jen trigonometrie.
4. **Půlka snímků mimo hero** — `idleRef.current` přeskakuje každý druhý snímek.
5. **Pauza na skryté záložce** přes `visibilitychange`.
6. **DPR strop 1.6**, `antialias: false`.

Postprocessing: `EffectComposer` → `RenderPass` → `UnrealBloomPass` → `OutputPass`,
importované z `three/examples/jsm/postprocessing/*`. Renderer je **neprůhledný**
s `clearColor` `#04070a` — schválně, průhledné plátno pod bloomem dělalo artefakty.
Barva plátna je totožná s `--bg`, takže při ztlumení vrstvy není vidět šev.

Vortex je lazy-loaded (`React.lazy`) — drží hlavní bundle malý. Zachovej to.

---

## 5. Design systém (`src/index.css`)

### Tokeny

```css
--bg: #04070a        --ivory: #ece8e0      --accent: #2ee0b0
--bg-2: #070c11      --ivory-dim: #b9b5ac  --accent-deep: #0e7a64
--bg-3: #0b1116      --muted: #7f8a86      --gold: #c9ab72
--line: rgba(236,232,224,.10)   --line-soft: rgba(236,232,224,.05)
--serif: 'Cormorant Garamond'   --sans: 'Inter'
--maxw: 1180px       --pad: clamp(1.25rem, 5vw, 3.5rem)
```

**Používej proměnné, nepiš hex napřímo.** Kdyby David chtěl vortex zpátky do
původní modré, mění se `--accent` v CSS a hodnoty `setHSL` ve `Vortex.jsx`
(jin je teď `0.45` odstín; původní modrá byla `0.62`).

### Konvence

- Nadpisy `h1`–`h3` serifem, tenkým řezem, těsným prokladem. Text sansem 300.
- `.eyebrow` = zelený nadtitulek s čárkou před textem, otvírá každou sekci.
- `.section-head` obaluje eyebrow + `h2` + `.lead`.
- `.wrap` = max šířka 1180 px na střed. Každá sekce má `.wrap` uvnitř.
- `.solid` / `.solid-hard` = neprůhledné pozadí sekce, aby text nad vortexem
  zůstal čitelný. Sekce **bez** téhle třídy propouští vortex — používej střídavě,
  ať se to nezmění na 3D pozadí přes celý web (David to výslovně nechtěl).
- `.reveal` = fade-in při scrollu přes `IntersectionObserver`. Přidej ji každému
  novému bloku, jinak vypadne z rytmu stránky.
- Karty a mřížky: `.grid.grid-4` / `.grid-3` / `.grid-2` + `.card`. Mřížka drží
  hairline oddělovače přes `gap: 1px` na pozadí `--line-soft` — nepřepisuj `gap`.

### Responzivita

Breakpointy `1000px`, `860px` (schová `.nav-links`, ukáže `.burger`), `560px`.
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

Kanonická URL `https://longevityclinic.vercel.app/` je na **šesti místech**
v `index.html` plus v `public/sitemap.xml` a `public/robots.txt`. Při změně
domény projeď všechna. V `index.html` jsou dva bloky JSON-LD:
`MedicalClinic` (služby) a `FAQPage` (musí odpovídat poli `FAQ` v `App.jsx`).

---

## 8. PROTOKOL ODEVZDÁNÍ — závazné

Tvůj výstup dostane David a nahraje ho zpátky do Claude Cowork, kde se
odbuilduje (`npx vite build`) a pushne na `main`. Aby to prošlo:

1. **Odevzdávej celé soubory, ne diffy.** Žádné `// ...zbytek beze změny`,
   žádné patche, žádné úryvky. Kompletní obsah souboru od prvního po poslední
   řádek. `App.jsx` má 894 řádků a `index.css` 1238 — ano, i tak celé.
2. **Jeden soubor = jeden artefakt / jeden code block.** Nemíchej dva soubory
   do jednoho bloku.
3. **Pojmenuj soubor přesnou cestou z repa**, ať je jasné, kam patří:
   `src/App.jsx`, `src/index.css`, `index.html`, `src/Vortex.jsx`.
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
- src/index.css — třídy .team, .team-card + breakpoint 860 px

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
- [ ] Nové bloky mají `.reveal` a používají CSS proměnné
- [ ] Nová sekce má `id`, `.wrap` uvnitř a je v `NAV`, pokud patří do menu
- [ ] Ověřeno na 375 px
- [ ] Disclaimer v patičce a `Otevíráme 2027` v heru pořád na místě
- [ ] Žádné vymyšlené lékařské tvrzení, jméno ani certifikace
- [ ] Diakritika jako skutečné znaky, UTF-8
- [ ] Optimalizace ve `Vortex.jsx` z bodu 4 jsou netknuté

---

## 10. Co dává smysl dělat dál

Nápady, ne úkoly — David rozhodne:

- skutečný název, doména, kontakty a ceny místo placeholderů
- sekce o týmu a o vybavení s fotkami (`public/`, `loading="lazy"`)
- formulář na skutečný backend (Formspree / Vercel funkce) místo `mailto:`
- anglická mutace pro zahraniční klienty
- `og.png` z reálné fotky prostředí, až bude
- drobná jemná verze vortexu i v sekci Prostředí, aby se metafora vrátila níž
