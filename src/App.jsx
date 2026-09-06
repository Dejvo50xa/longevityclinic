import React, { Suspense, lazy, useEffect, useRef, useState, useCallback } from 'react'

const Vortex = lazy(() => import('./Vortex.jsx'))

/* ==================================================================
   Obsah
================================================================== */

const NAV = [
  ['Filozofie', 'filozofie'],
  ['Diagnostika', 'diagnostika'],
  ['Regenerace', 'regenerace'],
  ['Fyzioterapie', 'fyzioterapie'],
  ['Masáže', 'masaze'],
  ['Programy', 'programy'],
  ['3D sauna', '?sauna'],
]

const DIAGNOSTIKA = [
  {
    t: 'Celotělová MRI',
    d: 'Nekontrastní screening bez radiační zátěže. Jedno vyšetření, přehled o mozku, páteři, orgánech a cévním řečišti.',
    tag: '60 minut',
  },
  {
    t: 'Biologický věk',
    d: 'Epigenetické hodiny z DNA metylace, délka telomer a panel markerů stárnutí. Číslo, ke kterému se dá vracet.',
    tag: 'DNA metylace',
  },
  {
    t: 'Krevní panel 80+',
    d: 'Metabolismus, záněty, hormony, lipidové subfrakce, mikroživiny, ApoB, Lp(a), homocystein, hsCRP.',
    tag: 'Nalačno',
  },
  {
    t: 'DEXA & InBody',
    d: 'Kostní denzita, viscerální tuk, svalová hmota po segmentech. Skutečné složení těla, ne odhad z váhy.',
    tag: 'Složení těla',
  },
  {
    t: 'Spiroergometrie',
    d: 'VO₂max, aerobní a anaerobní práh, efektivita dýchání. Nejsilnější jednotlivý prediktor délky života.',
    tag: 'VO₂max',
  },
  {
    t: 'Kardio & cévy',
    d: 'Kalciové skóre, tuhost tepen, echokardiografie, 24hodinový monitoring tlaku a EKG.',
    tag: 'Prevence',
  },
  {
    t: 'Mikrobiom & imunita',
    d: 'Sekvenace střevního mikrobiomu, potravinové intolerance, propustnost střeva, zánětlivý profil.',
    tag: 'Sekvenace',
  },
  {
    t: 'Kontinuální monitoring',
    d: 'CGM senzor, spánková analýza, HRV a variabilita zátěže. Data se průběžně vyhodnocují a chodí vám do aplikace.',
    tag: '24/7 data',
  },
]

const REGENERACE = [
  {
    t: 'Hyperbarická oxygenoterapie',
    d: 'Komora pro 1–4 osoby, 1,5 až 2,4 ATA. Podpora hojení, regenerace po zátěži, neuroplasticita a kvalita spánku.',
    tag: '60–90 min',
  },
  {
    t: 'Celotělová kryoterapie',
    d: 'Elektrická kryokomora do −110 °C. Tlumí zánět, urychluje regeneraci svalů, restartuje nervový systém.',
    tag: '−110 °C',
  },
  {
    t: 'Saunový svět',
    d: 'Finská sauna, bylinná parní lázeň, infrasauna a venkovní ochlazovací jezírko napájené pramenem.',
    tag: 'Kontrastní terapie',
  },
  {
    t: 'Fotobiomodulace',
    d: 'Celotělový panel červeného a blízkého infračerveného světla 660 / 850 nm. Mitochondrie, kůže, hojení.',
    tag: '660 / 850 nm',
  },
  {
    t: 'Infuzní terapie',
    d: 'NAD⁺, vysokodávkový vitamin C, glutathion, hořčík a individuální mixy. Vždy po odběru a se souhlasem lékaře.',
    tag: 'Pod dohledem lékaře',
  },
  {
    t: 'PEMF & vibrační terapie',
    d: 'Pulzní elektromagnetické pole a celotělová vibrační platforma pro cirkulaci, kosti a hluboký tonus.',
    tag: 'Cirkulace',
  },
  {
    t: 'Lymfodrenáž & presoterapie',
    d: 'Přístrojová i manuální drenáž, kompresní návleky, střídavá pneumatická komprese pro nohy a břicho.',
    tag: 'Detoxikace otoků',
  },
  {
    t: 'Floating & neurofeedback',
    d: 'Floatovací kabina v solném roztoku, řízené dechové protokoly a HRV biofeedback pro nervový systém.',
    tag: 'Nervový systém',
  },
  {
    t: 'Rázová vlna, laser, TECAR',
    d: 'Cílená instrumentální terapie na šlachy, jizvy a chronické přetížení. Vždy navázaná na fyzioterapii.',
    tag: 'Cílená terapie',
  },
]

const FYZIO = [
  {
    t: 'Vstupní funkční diagnostika',
    d: '3D analýza chůze a běhu, vyšetření pohybových stereotypů, dechového vzoru a hlubokého stabilizačního systému.',
    m: '90 min',
  },
  {
    t: 'DNS — dynamická neuromuskulární stabilizace',
    d: 'Pražská škola. Návrat k vývojovým vzorům, které tělo umí od narození.',
    m: 'Individuálně',
  },
  {
    t: 'Redcord — závěsný systém',
    d: 'Odlehčený trénink hlubokých stabilizátorů v uzavřených řetězcích. Ideální po operacích a při bolestech zad.',
    m: '50 min',
  },
  {
    t: 'Izokinetická diagnostika',
    d: 'Objektivní měření síly a stranových asymetrií. Podklad pro návrat do sportu i pro prevenci pádů.',
    m: 'Měření + plán',
  },
  {
    t: 'Silový trénink pro dlouhověkost',
    d: 'Progresivní silový plán, zóna 2, VO₂max intervaly. Síla a aerobní kapacita jsou nejlepší investice do dalších 30 let.',
    m: 'Program',
  },
  {
    t: 'Mobilita, dech, práce s jizvou',
    d: 'Kloubní rozsahy, bránice, měkké techniky, terapie jizev a fascií po operacích.',
    m: '50 min',
  },
]

const MASAZE = [
  {
    t: 'Sportovní a hluboká tkáňová',
    d: 'Pro přetížené svaly, po tréninku i po dlouhém sezení. Silný tlak, konkrétní cíl.',
    m: '60 / 90 min',
  },
  {
    t: 'Manuální lymfodrenáž',
    d: 'Jemná technika pro otoky, pooperační stavy a regeneraci imunity.',
    m: '60 min',
  },
  {
    t: 'Myofasciální release',
    d: 'Uvolnění fascií a spouštěcích bodů. Často jediné, co skutečně pomůže s chronickým tahem.',
    m: '60 min',
  },
  {
    t: 'Tradiční thajská masáž',
    d: 'Práce s energetickými liniemi, protahování, tlak. Na podložce, v oblečení.',
    m: '90 min',
  },
  {
    t: 'Masáž lávovými kameny',
    d: 'Hluboké prohřátí, ideální po kryoterapii nebo v zimních měsících.',
    m: '75 min',
  },
  {
    t: 'Reflexní masáž chodidel',
    d: 'Krátká, ale nečekaně silná. Skvěle se kombinuje s floatingem před spaním.',
    m: '45 min',
  },
]

const PROSTREDI = [
  {
    t: 'Dvanáct hektarů lesa',
    d: 'Vlastní okruhy pro chůzi, běh i pomalé procházky bez telefonu. Terapie začíná už na cestě sem.',
  },
  {
    t: 'Voda a chlad',
    d: 'Venkovní bazén, pramenné jezírko a otužovací molo. Kontrast tepla a chladu po celý rok.',
  },
  {
    t: 'Tichá zóna',
    d: 'Patro bez obrazovek a hovorů. Knihovna, čajovna a místa, kde se dá jen sedět a dívat se ven.',
  },
  {
    t: 'Kuchyně jako součást terapie',
    d: 'Sezónní, protizánětlivá, s přesnými makry. Jídelníček navazuje na výsledky vašich odběrů.',
  },
  {
    t: 'Ubytování v krajině',
    d: 'Dřevěné apartmány zapuštěné do svahu, velká okna, žádné chodby s koberci a neonem.',
  },
  {
    t: 'Architektura pro spánek',
    d: 'Cirkadiánní osvětlení, zatemnění, čistý vzduch a chladné pokoje. Spánek je nejlevnější terapie, kterou máme.',
  },
]

const DEN = [
  ['07:00', 'Odběry nalačno', 'Krev, moč, biologický věk. Než se rozední, máte to za sebou.'],
  ['08:15', 'Snídaně', 'Podle vašich metabolických dat, ne podle bufetu.'],
  ['09:00', 'Zobrazovací metody', 'Celotělová MRI, DEXA, kardio screening.'],
  ['11:00', 'Fyzioterapie', 'Funkční diagnostika a první terapeutická jednotka.'],
  ['12:30', 'Oběd a hodina ticha', 'Bez telefonu. Klidně na terase nebo v lese.'],
  ['14:00', 'Zátěžový test', 'Spiroergometrie a stanovení tréninkových zón.'],
  ['15:30', 'Regenerace', 'Hyperbarická komora, kryoterapie, sauna, jezírko.'],
  ['17:30', 'Masáž', 'Podle toho, co dopoledne ukázalo tělo i data.'],
  ['19:00', 'Konzultace s lékařem', 'Kompletní výsledky a plán na dalších dvanáct měsíců.'],
]

const PROGRAMY = [
  {
    n: 'Signature Day',
    len: 'Jeden den',
    price: 'od 12 900 Kč',
    per: 'jednorázově',
    items: [
      'Vstupní konzultace s lékařem dlouhověkosti',
      'InBody, klidové EKG a základní krevní panel',
      'Jedna regenerační terapie dle výběru',
      'Šedesátiminutová masáž',
      'Oběd a celodenní vstup do wellness',
      'Písemné doporučení a plán prvních kroků',
    ],
  },
  {
    n: 'Reset',
    len: 'Tři dny',
    price: 'od 44 900 Kč',
    per: 'za pobyt',
    featured: true,
    items: [
      'Kompletní diagnostika včetně celotělové MRI',
      'Biologický věk, DEXA a spiroergometrie',
      'Denně fyzioterapie a dvě regenerační terapie',
      'Dvě masáže dle indikace terapeuta',
      'Ubytování a plná penze podle vašich dat',
      'Závěrečná konzultace a roční plán',
      'Přístup do klientské aplikace',
    ],
  },
  {
    n: 'Longevity Program',
    len: 'Dvanáct měsíců',
    price: 'od 189 000 Kč',
    per: 'za rok',
    items: [
      'Dvakrát ročně kompletní diagnostický den',
      'Vlastní lékař dostupný po celý rok',
      'Kvartální kontroly a úprava plánu',
      'Kontinuální monitoring — CGM, spánek, HRV',
      'Dvanáct terapeutických jednotek fyzioterapie',
      'Neomezený vstup do wellness a saunového světa',
      'Přednostní rezervace a doprovod partnera',
    ],
  },
]

const FAQ = [
  [
    'Musím být nemocný, abych mohl přijet?',
    'Ne. AEVUM je postavené na prevenci. Většina klientů se cítí dobře a chce vědět, co se v těle děje dřív, než se objeví příznaky — a hlavně co s tím udělat.',
  ],
  [
    'Jak dlouho trvá vstupní diagnostika?',
    'Kompletní vstupní den zabere zhruba šest až osm hodin. Začíná se odběry nalačno, pokračuje se zobrazovacími metodami a zátěžovým testem a končí se osobní konzultací nad výsledky.',
  ],
  [
    'Hradí to zdravotní pojišťovna?',
    'Ne, jde o nadstandardní preventivní a regenerační péči hrazenou klientem. U některých zaměstnavatelských benefitů a firemních programů je ale možné čerpat příspěvek — rádi vám s tím pomůžeme.',
  ],
  [
    'Můžu přijet jen na wellness a masáž?',
    'Ano. Regenerační část je přístupná i bez diagnostického programu. Kapacita je záměrně omezená, takže doporučujeme rezervovat předem.',
  ],
  [
    'Dostanu výsledky s sebou?',
    'Ano. Všechna data máte v klientské aplikaci spolu s vyhodnocením a konkrétním plánem. Data jsou vaše a kdykoli je můžete exportovat nebo předat svému lékaři.',
  ],
  [
    'Nahrazuje to praktického lékaře?',
    'Nenahrazuje. Doplňujeme běžnou péči o hloubku a čas, na které v ordinaci není prostor. S vaším praktickým lékařem i specialisty rádi spolupracujeme.',
  ],
]

/* ==================================================================
   Pomocné komponenty
================================================================== */

function useReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path
        d="M20 1.5a9.25 9.25 0 0 0 0 18.5 9.25 9.25 0 0 1 0 18.5A18.5 18.5 0 0 1 20 1.5Z"
        fill="#2ee0b0"
        opacity="0.9"
      />
      <circle cx="20" cy="10.75" r="2.1" fill="#04070a" />
      <circle cx="20" cy="29.25" r="2.1" fill="#2ee0b0" />
    </svg>
  )
}

function Leaf() {
  return (
    <svg className="env-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <path d="M12 21c0-6 3-11 9-13-1 8-4 12-9 13Z" />
      <path d="M12 21C7 20 4 16 3 8c6 2 9 7 9 13Z" />
      <path d="M12 21v-5" />
    </svg>
  )
}

/* ==================================================================
   Hlavní komponenta
================================================================== */

export default function App() {
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(0)
  const [show3D, setShow3D] = useState(false)
  const [count, setCount] = useState(14000)
  const layerRef = useRef(null)
  const idleRef = useRef(false)

  useReveal()

  /* -- WebGL detekce, respekt k redukovanému pohybu, velikost roje -- */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let ok = false
    try {
      const c = document.createElement('canvas')
      ok = !!(c.getContext('webgl2') || c.getContext('webgl'))
    } catch (e) {
      ok = false
    }
    const w = window.innerWidth
    setCount(w < 700 ? 4500 : w < 1200 ? 9000 : 14000)
    if (ok && !reduced) {
      const id = window.setTimeout(() => setShow3D(true), 120)
      return () => window.clearTimeout(id)
    }
  }, [])

  /* -- Vortex je v hero plný, níž jen jemný podtisk -- */
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        const h = window.innerHeight
        setScrolled(y > 40)
        const p = Math.min(1, y / (h * 0.85))
        idleRef.current = p > 0.9
        if (layerRef.current) {
          layerRef.current.style.setProperty('--vortex-opacity', (1 - p * 0.88).toFixed(3))
        }
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menu])

  const go = useCallback((e, id) => {
    if (id === "?sauna") return;
    e.preventDefault()
    setMenu(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const submit = useCallback((e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = [
      `Jméno: ${f.get('jmeno') || ''}`,
      `E-mail: ${f.get('email') || ''}`,
      `Telefon: ${f.get('telefon') || ''}`,
      `Zájem o: ${f.get('program') || ''}`,
      '',
      `${f.get('zprava') || ''}`,
    ].join('\n')
    window.location.href = `mailto:info@aevum.cz?subject=${encodeURIComponent(
      'Nezávazná poptávka — AEVUM'
    )}&body=${encodeURIComponent(body)}`
  }, [])

  return (
    <>
      <div className="vortex-layer" ref={layerRef} aria-hidden="true">
        {show3D && (
          <Suspense fallback={null}>
            <Vortex count={count} bloom={count > 6000 ? 1.7 : 1.25} idleRef={idleRef} />
          </Suspense>
        )}
      </div>
      <div className="grain" aria-hidden="true" />

      {/* ---------------- Navigace ---------------- */}
      <nav className={scrolled ? 'nav scrolled' : 'nav'}>
        <a href="#top" className="brand" onClick={(e) => go(e, 'top')}>
          <Mark />
          AEVUM
        </a>
        <div className="nav-links">
          {NAV.map(([label, id]) => (
            <a key={id} href={id === '?sauna' ? '?sauna' : `#${id}`} onClick={(e) => go(e, id)}>
              {label}
            </a>
          ))}
          <a href="#kontakt" className="nav-cta" onClick={(e) => go(e, 'kontakt')}>
            Rezervace
          </a>
        </div>
        <button
          className={menu ? 'burger open' : 'burger'}
          onClick={() => setMenu((m) => !m)}
          aria-label="Menu"
          aria-expanded={menu}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={menu ? 'mobile-menu open' : 'mobile-menu'}>
        {NAV.map(([label, id]) => (
          <a key={id} href={id === '?sauna' ? '?sauna' : `#${id}`} onClick={(e) => go(e, id)}>
            {label}
          </a>
        ))}
        <a href="#kontakt" onClick={(e) => go(e, 'kontakt')}>
          Rezervace
        </a>
      </div>

      <main className="page" id="top">
        {/* ---------------- Hero ---------------- */}
        <section className="hero">
          <span className="hero-badge">
            <i className="dot" />
            Otevíráme 2027 · Česká republika
          </span>
          <h1>AEVUM</h1>
          <p className="hero-sub">Klinika dlouhověkosti</p>
          <p className="hero-lead">
            Nejmodernější diagnostika a regenerační technologie uprostřed lesa. Měříme, co se dá
            změřit — a zbytek necháváme na tichu, vodě a pohybu.
          </p>
          <div className="btn-row">
            <a href="#kontakt" className="btn btn-primary" onClick={(e) => go(e, 'kontakt')}>
              Nezávazná poptávka
            </a>
            <a href="#programy" className="btn" onClick={(e) => go(e, 'programy')}>
              Prohlédnout programy
            </a>
          </div>

          <div className="hero-stats">
            <div>
              <b>80+</b>
              <span>Biomarkerů</span>
            </div>
            <div>
              <b>3 000 m²</b>
              <span>Diagnostika a regenerace</span>
            </div>
            <div>
              <b>12 ha</b>
              <span>Vlastního lesa</span>
            </div>
            <div>
              <b>1 : 1</b>
              <span>Lékař na klienta</span>
            </div>
          </div>

          <span className="scroll-hint">
            <i />
            Rovnováha
          </span>
        </section>

        {/* ---------------- Filozofie ---------------- */}
        <section id="filozofie">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Filozofie</span>
              <h2>
                Dvě síly, které se navzájem
                <br />
                nevylučují — potřebují se.
              </h2>
              <p className="lead">
                Longevity medicína se dnes rozpadá do dvou táborů. Jeden věří jen číslům, druhý jen
                přírodě. AEVUM stojí na tom, že bez sebe nefungují: technologie ukáže, co se děje,
                a příroda dá tělu prostor to skutečně zvládnout.
              </p>
            </div>

            <div className="balance reveal">
              <div className="yang">
                <h3>Technologie</h3>
                <p>
                  Přesná data místo dohadů. Zobrazovací metody, laboratoř, zátěžová fyziologie a
                  kontinuální monitoring. Nic, co se nedá vyhodnotit a zopakovat za rok.
                </p>
                <ul>
                  <li>Celotělová MRI bez kontrastu a bez záření</li>
                  <li>Epigenetické stanovení biologického věku</li>
                  <li>Zátěžová diagnostika a izokinetické měření</li>
                  <li>Vyhodnocení dat v klientské aplikaci</li>
                </ul>
              </div>
              <div className="yin">
                <h3>Příroda</h3>
                <p>
                  Regenerace se neděje na vyšetřovně. Děje se v lese, ve vodě, v teple, v chladu a
                  hlavně ve spánku. Prostředí je tady stejně navržené jako přístroje.
                </p>
                <ul>
                  <li>Dvanáct hektarů lesa s vlastními okruhy</li>
                  <li>Kontrastní terapie teplem a chladem po celý rok</li>
                  <li>Tichá zóna bez obrazovek a hovorů</li>
                  <li>Architektura optimalizovaná pro spánek</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Diagnostika ---------------- */}
        <section id="diagnostika" className="solid">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Diagnostika</span>
              <h2>Nejdřív vědět. Teprve potom zasahovat.</h2>
              <p className="lead">
                Vstupní den vám dá obraz, jaký běžná preventivní prohlídka nedá. Ne proto, abyste
                sbírali čísla, ale proto, abychom věděli, kde se vyplatí zabrat.
              </p>
            </div>

            <div className="grid grid-4 reveal">
              {DIAGNOSTIKA.map((c, i) => (
                <article className="card" key={c.t}>
                  <span className="card-num">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                  <span className="tag">{c.tag}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Regenerace ---------------- */}
        <section id="regenerace">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Regenerace a revitalizace</span>
              <h2>Technologie, které tělu vrátí kapacitu.</h2>
              <p className="lead">
                Vybavení, které jinde najdete rozeseté po pěti různých pracovištích, tady máte na
                jedné chodbě. Terapie se neskládají náhodně — vždycky navazují na vaše výsledky.
              </p>
            </div>

            <div className="grid grid-3 reveal">
              {REGENERACE.map((c, i) => (
                <article className="card" key={c.t}>
                  <span className="card-num">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                  <span className="tag">{c.tag}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Fyzioterapie ---------------- */}
        <section id="fyzioterapie" className="solid">
          <div className="wrap split">
            <div className="section-head reveal" style={{ marginBottom: 0 }}>
              <span className="eyebrow">Fyzioterapie a pohyb</span>
              <h2>Síla je nejlepší pojistka na dalších třicet let.</h2>
              <p className="lead">
                Ze všech věcí, které dokážete ovlivnit, mají svalová hmota a aerobní kapacita
                nejsilnější vazbu na to, jak budete fungovat v osmdesáti. Proto tady fyzio není
                doplněk, ale páteř celého programu.
              </p>
            </div>
            <div className="rows reveal">
              {FYZIO.map((r, i) => (
                <div className="row" key={r.t}>
                  <span className="row-i">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="row-title">{r.t}</span>
                    <span className="row-desc">{r.d}</span>
                  </span>
                  <span className="row-meta">{r.m}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Masáže ---------------- */}
        <section id="masaze">
          <div className="wrap split">
            <div className="section-head reveal" style={{ marginBottom: 0 }}>
              <span className="eyebrow">Masáže a bodywork</span>
              <h2>Ruce, které vědí, co hledají.</h2>
              <p className="lead">
                Naši terapeuti vidí vaše výsledky dřív, než na vás sáhnou. Masáž tady není položka
                z ceníku hotelu — je to terapeutický zásah navázaný na to, co ukázalo tělo i data.
              </p>
            </div>
            <div className="rows reveal">
              {MASAZE.map((r, i) => (
                <div className="row" key={r.t}>
                  <span className="row-i">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="row-title">{r.t}</span>
                    <span className="row-desc">{r.d}</span>
                  </span>
                  <span className="row-meta">{r.m}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Prostředí ---------------- */}
        <section id="prostredi">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Prostředí</span>
              <h2>Klinika, ze které se nechce odjíždět.</h2>
              <p className="lead">
                Prostředí je terapeutický nástroj. Proto tu není recepce s neonem a chodby s
                kobercem, ale dřevo, sklo, voda a les hned za oknem.
              </p>
            </div>
            <div className="env reveal">
              {PROSTREDI.map((e) => (
                <div className="env-card" key={e.t}>
                  <Leaf />
                  <h3>{e.t}</h3>
                  <p>{e.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Den v Aevum ---------------- */}
        <section id="den" className="solid-hard">
          <div className="wrap split">
            <div className="section-head reveal" style={{ marginBottom: 0 }}>
              <span className="eyebrow">Váš den</span>
              <h2>Jak to probíhá.</h2>
              <p className="lead">
                Modelový průběh diagnosticko-regeneračního dne. Skutečný plán vždycky sestavujeme
                podle toho, proč přijíždíte a co ukážou ranní odběry.
              </p>
            </div>
            <div className="timeline reveal">
              {DEN.map(([time, title, desc]) => (
                <div className="tl-item" key={time}>
                  <span className="tl-time">{time}</span>
                  <span className="tl-title">{title}</span>
                  <p className="tl-desc">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Programy ---------------- */}
        <section id="programy">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Programy</span>
              <h2>Tři způsoby, jak začít.</h2>
              <p className="lead">
                Můžete přijet na jeden den a zjistit, jak na tom jste. Nebo si nás nechat na celý
                rok. Přechod mezi programy je kdykoli možný a už zaplacené vyšetření se započítává.
              </p>
            </div>

            <div className="plans reveal">
              {PROGRAMY.map((p) => (
                <div className={p.featured ? 'plan featured' : 'plan'} key={p.n}>
                  {p.featured && <span className="plan-flag">Nejčastější volba</span>}
                  <h3>{p.n}</h3>
                  <div className="plan-len">{p.len}</div>
                  <div className="plan-price">
                    <small>{p.per}</small>
                    {p.price}
                  </div>
                  <ul>
                    {p.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                  <a
                    href="#kontakt"
                    className={p.featured ? 'btn btn-primary' : 'btn'}
                    onClick={(e) => go(e, 'kontakt')}
                  >
                    Mám zájem
                  </a>
                </div>
              ))}
            </div>

            <p className="note reveal">
              Uvedené ceny jsou orientační a platí pro zahájení provozu. Konečná cena vychází z
              rozsahu diagnostiky a délky pobytu — vždy ji dostanete písemně předem, bez skrytých
              položek.
            </p>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="solid">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Časté dotazy</span>
              <h2>Než se zeptáte.</h2>
            </div>
            <div className="faq reveal">
              {FAQ.map(([q, a], i) => (
                <div className={open === i ? 'faq-item open' : 'faq-item'} key={q}>
                  <button
                    className="faq-q"
                    onClick={() => setOpen(open === i ? -1 : i)}
                    aria-expanded={open === i}
                  >
                    {q}
                  </button>
                  <div className="faq-a">
                    <p>{a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Kontakt ---------------- */}
        <section id="kontakt">
          <div className="wrap contact-grid">
            <div className="reveal">
              <span className="eyebrow">Rezervace</span>
              <h2>Ozvěte se.</h2>
              <p className="lead" style={{ marginBottom: '2.4rem' }}>
                Kapacitu otevíráme postupně. Napište nám, co vás zajímá, a ozveme se do dvou
                pracovních dnů s konkrétním návrhem termínu i rozsahu.
              </p>
              <div className="contact-info">
                <div className="info-block">
                  <b>E-mail</b>
                  <a href="mailto:info@aevum.cz">info@aevum.cz</a>
                </div>
                <div className="info-block">
                  <b>Telefon</b>
                  <a href="tel:+420000000000">+420 000 000 000</a>
                </div>
                <div className="info-block">
                  <b>Kde nás najdete</b>
                  <span>Česká republika · přesná lokalita v přípravě</span>
                </div>
              </div>
            </div>

            <form className="reveal" onSubmit={submit}>
              <div className="field">
                <label htmlFor="jmeno">Jméno a příjmení</label>
                <input id="jmeno" name="jmeno" type="text" required autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="telefon">Telefon</label>
                <input id="telefon" name="telefon" type="tel" autoComplete="tel" />
              </div>
              <div className="field">
                <label htmlFor="program">Zajímá mě</label>
                <select id="program" name="program" defaultValue="Reset — tři dny">
                  <option>Signature Day — jeden den</option>
                  <option>Reset — tři dny</option>
                  <option>Longevity Program — dvanáct měsíců</option>
                  <option>Jen wellness a masáže</option>
                  <option>Firemní / partnerská spolupráce</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="zprava">Zpráva</label>
                <textarea id="zprava" name="zprava" rows="4" placeholder="Co vás k nám přivádí?" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Odeslat poptávku
              </button>
              <p className="note" style={{ marginTop: '0.4rem' }}>
                Odesláním otevřete předvyplněný e-mail ve svém poštovním klientovi. Vaše údaje
                nikam neukládáme.
              </p>
            </form>
          </div>
        </section>
      </main>

      {/* ---------------- Patička ---------------- */}
      <footer>
        <div className="foot-top">
          <a href="#top" className="brand" onClick={(e) => go(e, 'top')}>
            <Mark />
            AEVUM
          </a>
          <div className="foot-links">
            {NAV.map(([label, id]) => (
              <a key={id} href={id === '?sauna' ? '?sauna' : `#${id}`} onClick={(e) => go(e, id)}>
                {label}
              </a>
            ))}
            <a href="#faq" onClick={(e) => go(e, 'faq')}>
              Dotazy
            </a>
            <a href="#kontakt" onClick={(e) => go(e, 'kontakt')}>
              Kontakt
            </a>
          </div>
        </div>
        <p className="disclaimer">
          AEVUM je připravovaný projekt kliniky dlouhověkosti. Uvedené služby, vybavení a ceny
          představují plánovaný rozsah provozu a mohou se do otevření změnit. Nabízená péče má
          preventivní a regenerační charakter, nenahrazuje akutní ani specializovanou lékařskou
          péči a neslouží k diagnostice ani léčbě onemocnění bez indikace lékaře. O vhodnosti
          jednotlivých terapií vždy rozhoduje lékař na základě vašeho zdravotního stavu.
        </p>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} AEVUM. Všechna práva vyhrazena.</span>
          <span>Rovnováha měřitelného a nezměřitelného.</span>
        </div>
      </footer>
    </>
  )
}
