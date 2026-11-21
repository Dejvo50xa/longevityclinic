'use strict';

const programs = {
  signature: {
    name: 'Signature Day', duration: '1 den', price: 'od 12 900 Kč', period: 'za den',
    description: 'Jednodenní návštěva s konzultací u lékaře, základním krevním panelem a regenerací. Ubytování není součástí programu.',
    audience: 'Pro zájemce o úvodní konzultaci a základní vyšetření bez vícedenního pobytu.',
    includes: ['Vstupní konzultace s lékařem', 'Základní krevní panel, InBody a klidové EKG dle vhodnosti', 'Jedna regenerační terapie a 60minutová masáž', 'Oběd a vstup do wellness', 'Písemná doporučení pro další péči'],
    outcome: 'Lékař vám vysvětlí dostupné výsledky a připraví písemná doporučení. Termín konzultace výsledků závisí na délce laboratorního zpracování.',
  },
  reset: {
    name: 'Reset', duration: '3 dny', price: 'od 44 900 Kč', period: 'za pobyt',
    description: 'Třídenní program s rozšířenou diagnostikou, fyzioterapií a regenerací. Počítáme se dvěma nocemi ubytování a plnou penzí.',
    audience: 'Pro zájemce, kteří chtějí vyšetření a regenerační péči spojit s pobytem v areálu.',
    includes: ['Rozšířená diagnostika podle individuální indikace lékaře', 'Plánovaná nabídka MRI, DEXA a zátěžového vyšetření podle vhodnosti', 'Fyzioterapie, regenerační péče a masáže', 'Dvě noci ubytování a plná penze', 'Závěrečná konzultace a osobní plán'],
    outcome: 'Lékař s vámi projde dostupné výsledky a navrhne další péči. U vyšetření s delší dobou zpracování domluví způsob předání výsledků.',
  },
  longevity: {
    name: 'Longevity', duration: '12 měsíců', price: 'od 189 000 Kč', period: 'za rok',
    description: 'Dvanáct měsíců péče se čtvrtletními konzultacemi u lékaře a pravidelnou fyzioterapií.',
    audience: 'Pro zájemce o pravidelné kontroly u stejného lékaře a průběžnou úpravu doporučení.',
    includes: ['Dva diagnostické dny během roku podle vhodnosti vyšetření', 'Průběžný kontakt s vlastním lékařem', 'Čtvrtletní kontroly a aktualizace plánu', 'Dvanáct jednotek fyzioterapie', 'Přístup k regeneračnímu zázemí podle finálních podmínek'],
    outcome: 'Při kontrolách lékař porovná výsledky s předchozími nálezy a upraví doporučení. Harmonogram programu upřesníme před otevřením.',
  },
};

const care = {
  diagnostika: {
    label: 'Diagnostika', title: 'Diagnostická vyšetření',
    description: 'Plánujeme krevní odběry, vyšetření složení těla a kondice i zobrazovací metody. Lékař vybere vhodná vyšetření podle zdravotní historie a důvodu návštěvy.',
    points: ['Konzultace zdravotní historie a vašich cílů', 'Laboratorní vyšetření dle individuální potřeby', 'Vyšetření složení těla, kondice a pohybových funkcí', 'Zobrazovací metody podle indikace a dostupnosti', 'Vysvětlení výsledků, přínosů a limitů vyšetření'],
    program: 'signature',
  },
  pohyb: {
    label: 'Fyzioterapie', title: 'Fyzioterapie a pohyb',
    description: 'Fyzioterapeut při vstupním vyšetření posoudí váš pohyb a obtíže. Podle výsledků navrhne terapii a cvičení pro běžný den.',
    points: ['Vstupní funkční vyšetření', 'Individuální fyzioterapie', 'Práce s mobilitou a dechovým stereotypem', 'Doporučení pro přiměřený silový a kondiční pohyb', 'Návazný plán pro běžný den'],
    program: 'reset',
  },
  regenerace: {
    label: 'Regenerace', title: 'Regenerační služby',
    description: 'Připravujeme sauny s ochlazovacím zázemím, masáže a odpočívárnu. Nabídku terapií a podmínky samostatného vstupu zveřejníme před otevřením.',
    points: ['Plánovaný saunový svět a ochlazovací zázemí', 'Masáže podle vhodnosti a osobních preferencí', 'Klidové prostory s výhledem do přírody', 'Prostor pro nenáročný pohyb a odpočinek', 'Výběr terapií s ohledem na zdravotní stav'],
    program: 'reset',
  },
  dlouhodoba: {
    label: 'Kontroly', title: 'Průběžné kontroly',
    description: 'V ročním programu počítáme se čtvrtletními konzultacemi. Lékař při nich porovná nové výsledky s předchozími a podle potřeby upraví další péči.',
    points: ['Průběžné konzultace s lékařem', 'Pravidelné vyhodnocení dostupných výsledků', 'Úprava doporučení pro pohyb a regeneraci', 'Navazující fyzioterapie', 'Spolupráce s vašimi stávajícími lékaři podle potřeby'],
    program: 'longevity',
  },
};

const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
const dialog = document.querySelector('#detail-dialog');
const dialogContent = document.querySelector('#dialog-content');
const emailField = document.querySelector('#email');
const emailError = document.querySelector('#email-error');
const interestField = document.querySelector('#interest');
const form = document.querySelector('#interest-form');
const success = document.querySelector('#form-success');
let dialogTrigger = null;

function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('span').textContent = open ? 'Zavřít' : 'Menu';
  mobileNav.hidden = !open;
}

menuButton.addEventListener('click', () => setMenu(mobileNav.hidden));
mobileNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !mobileNav.hidden) {
    setMenu(false);
    menuButton.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!mobileNav.hidden && !event.target.closest('.site-header')) setMenu(false);
});
window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
  if (event.matches) setMenu(false);
});

function showDialog(content, wide = false) {
  if (!dialog.open) dialogTrigger = document.activeElement;
  dialogContent.innerHTML = content;
  dialog.classList.toggle('wide', wide);
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dialog-open');
  dialog.scrollTop = 0;
  const heading = dialog.querySelector('#dialog-title');
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

function closeDialog(restoreFocus = true) {
  dialog.close();
  if (restoreFocus && dialogTrigger?.isConnected) dialogTrigger.focus({ preventScroll: true });
}

dialog.querySelector('.dialog-close').addEventListener('click', () => closeDialog());
dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
});

function showProgram(key) {
  const program = programs[key];
  if (!program) return;
  showDialog(`
    <p class="eyebrow">Připravovaný program · 2027</p>
    <h2 id="dialog-title">${program.name}</h2>
    <p class="dialog-lead">${program.description}</p>
    <div class="dialog-facts"><div>Délka<strong>${program.duration}</strong></div><div>Orientační cena<strong>${program.price} ${program.period}</strong></div></div>
    <h3>Zaměření programu</h3><p class="dialog-lead">${program.audience}</p>
    <h3>Plánovaný obsah</h3><ul>${program.includes.map(item => `<li>${item}</li>`).join('')}</ul>
    <h3>Další péče</h3><p class="dialog-lead">${program.outcome}</p>
    <p class="dialog-note">Program je v přípravě. Rozsah a ceny se mohou změnit. Vhodnost péče vždy posuzuje lékař; výsledky ani zdravotní přínos nejsou garantované.</p>
    <div class="dialog-actions"><button class="button" type="button" data-interest="${key}">Mám zájem o ${program.name}</button><button class="text-link" type="button" data-compare>Porovnat programy</button></div>
  `);
}

function showCare(key) {
  const item = care[key];
  if (!item) return;
  showDialog(`
    <p class="eyebrow">Oblast plánované péče · ${item.label}</p>
    <h2 id="dialog-title">${item.title}</h2>
    <p class="dialog-lead">${item.description}</p>
    <h3>Plánované služby</h3><ul>${item.points.map(point => `<li>${point}</li>`).join('')}</ul>
    <p class="dialog-note">Jde o plánovaný rozsah péče. Konkrétní odborníky, služby a jejich dostupnost představíme před otevřením.</p>
    <div class="dialog-actions"><button type="button" class="button" data-program="${item.program}">Detail programu ${programs[item.program].name}</button><button type="button" class="text-link" data-interest="${key === 'regenerace' ? 'regeneration' : 'question'}">Zeptat se na péči</button></div>
  `);
}

function showComparison() {
  showDialog(`
    <p class="eyebrow">Připravované programy · 2027</p><h2 id="dialog-title">Porovnání programů</h2>
    <p class="dialog-lead">Délka, obsah a orientační ceny připravovaných programů. Konkrétní vyšetření bude navrhovat lékař.</p>
    <div class="comparison-scroll" tabindex="0" role="region" aria-label="Porovnání programů, na menším displeji lze posouvat do stran"><table class="comparison-table"><caption class="sr-only">Orientační porovnání připravovaných programů AEVUM</caption><thead><tr><th scope="col">Program</th><th scope="col">Signature Day</th><th scope="col">Reset</th><th scope="col">Longevity</th></tr></thead><tbody>
      <tr><th scope="row">Délka</th><td>1 den</td><td>3 dny</td><td>12 měsíců</td></tr>
      <tr><th scope="row">Zaměření</th><td>Základní vyšetření</td><td>Diagnostika a pobyt</td><td>Roční péče</td></tr>
      <tr><th scope="row">Diagnostika</th><td>Základní panel</td><td>Rozšířená dle indikace</td><td>Pravidelné kontroly</td></tr>
      <tr><th scope="row">Regenerace</th><td>Terapie a masáž</td><td>Během pobytu</td><td>Průběžně během roku</td></tr>
      <tr><th scope="row">Ubytování</th><td>Bez ubytování</td><td>2 noci, plná penze</td><td>Dle finální nabídky</td></tr>
      <tr><th scope="row">Orientační cena</th><td>od 12 900 Kč / den</td><td>od 44 900 Kč / pobyt</td><td>od 189 000 Kč / rok</td></tr>
      <tr><th scope="row">Podrobnosti</th><td><button type="button" class="text-link" data-program="signature">Signature Day</button></td><td><button type="button" class="text-link" data-program="reset">Reset</button></td><td><button type="button" class="text-link" data-program="longevity">Longevity</button></td></tr>
    </tbody></table></div><p class="dialog-note">Ceny i obsah jsou orientační. Přesnou nabídku obdržíte před potvrzením objednávky.</p>
  `, true);
}

const gallery = [
  { src: '/img/clinic-concept.jpg', alt: 'Ilustrační architektonický koncept kliniky v lese', caption: 'AI ilustrace pro návrh webu. Konečná podoba kliniky zatím není potvrzená.', label: 'Architektonický koncept' },
  { src: '/img/original-overview.webp', alt: 'Původní vizualizace lesních lázní z ptačí perspektivy', caption: 'Převzato ze stávajícího webu AEVUM · vizualizace plánovaných lesních lázní.', label: 'Lesní lázně' },
  { src: '/img/original-lounge.webp', alt: 'Původní vizualizace odpočívárny s lehátky a výhledem do lesa', caption: 'Převzato ze stávajícího webu AEVUM · vizualizace plánované odpočívárny.', label: 'Odpočívárna' },
];

function showGallery() {
  const first = gallery[0];
  showDialog(`<p class="eyebrow">Prostředí v přípravě</p><h2 id="dialog-title">Vizualizace areálu</h2><p class="dialog-lead">AI koncept kliniky doplňují vizualizace lesních lázní z původního webu AEVUM. Konečnou podobu areálu zatím neznáme.</p><figure class="gallery-main"><img id="gallery-image" src="${first.src}" alt="${first.alt}"><figcaption id="gallery-caption" aria-live="polite">${first.caption}</figcaption></figure><div class="gallery-tabs" role="group" aria-label="Výběr vizualizace">${gallery.map((item, index) => `<button type="button" data-gallery="${index}" aria-pressed="${index === 0}">${item.label}</button>`).join('')}</div><a class="text-link gallery-external" href="/?sauna" target="_blank" rel="noopener noreferrer">Otevřít původní 3D prohlídku (nová karta)</a>`, true);
}

function selectInterest(value) {
  if (![...interestField.options].some(option => option.value === value)) return;
  if (dialog.open) closeDialog(false);
  if (!success.hidden) resetForm();
  interestField.value = value;
  document.querySelector('#kontakt').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  interestField.focus({ preventScroll: true });
}

function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.program) showProgram(target.dataset.program);
  if (target.dataset.care) showCare(target.dataset.care);
  if (target.hasAttribute('data-compare') || target.id === 'compare-programs') showComparison();
  if (target.dataset.interest) selectInterest(target.dataset.interest);
  if (target.id === 'open-gallery') showGallery();
  if (target.dataset.gallery !== undefined) {
    const item = gallery[Number(target.dataset.gallery)];
    if (!item) return;
    const image = document.querySelector('#gallery-image');
    image.src = item.src;
    image.alt = item.alt;
    document.querySelector('#gallery-caption').textContent = item.caption;
    dialog.querySelectorAll('[data-gallery]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
  }
  if (target.dataset.intent) {
    const key = target.dataset.intent;
    const program = programs[key];
    if (!program) return;
    document.querySelectorAll('.program-card').forEach(card => card.classList.toggle('is-selected', card.id === `program-${key}`));
    const message = document.querySelector('#selection-message');
    message.textContent = `Zvolený typ návštěvy odpovídá programu ${program.name}. Podrobnosti a orientační cenu najdete v jeho kartě.`;
    message.hidden = false;
    const selectedCard = document.querySelector(`#program-${key}`);
    selectedCard.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    selectedCard.focus({ preventScroll: true });
  }
});

emailField.addEventListener('invalid', () => {
  emailError.hidden = false;
  emailField.setAttribute('aria-invalid', 'true');
});
emailField.addEventListener('input', () => {
  emailError.hidden = true;
  emailField.removeAttribute('aria-invalid');
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const selectedLabel = interestField.selectedOptions[0].textContent;
  success.querySelector('.success-interest').textContent = `Vybraný zájem: ${selectedLabel}.`;
  form.reset();
  form.hidden = true;
  success.hidden = false;
  const heading = success.querySelector('h3');
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
});

function resetForm() {
  success.hidden = true;
  form.hidden = false;
  emailError.hidden = true;
  emailField.removeAttribute('aria-invalid');
}
document.querySelector('#reset-form').addEventListener('click', () => {
  resetForm();
  document.querySelector('#name').focus();
});
