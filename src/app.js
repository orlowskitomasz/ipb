// Interfejs kroku 1: wywiad → sejf na hasło → profil, ocena celu, podgląd tego, co jest zapisane.
(() => {
  const KLUCZ = 'ipb.sejf.v1', BEZCZYNNOSC_MS = 15 * 60 * 1000, DNI = ['pn', 'wt', 'sr', 'czw', 'pt', 'sob', 'nd'];
  const $ = (id) => document.getElementById(id);
  let dek = null, dane = null, koperta = null, pamiecTylko = false, zegar = null;

  // --- pamięć przeglądarki (gdy niedostępna: tylko pamięć karty, z ostrzeżeniem) ---
  const magazyn = {
    czytaj() { try { const s = localStorage.getItem(KLUCZ); return s ? JSON.parse(s) : null; } catch (e) { pamiecTylko = true; return koperta; } },
    pisz(k) { koperta = k; try { localStorage.setItem(KLUCZ, JSON.stringify(k)); } catch (e) { pamiecTylko = true; } },
    usun() { koperta = null; try { localStorage.removeItem(KLUCZ); } catch (e) { pamiecTylko = true; } },
  };

  function widok(nazwa) {
    for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== 'w-' + nazwa;
    const st = $('stan');
    st.className = 'stan ' + (dek ? 'otwarty' : koperta ? 'zamkniety' : 'brak');
    st.textContent = dek ? 'Sejf otwarty' : koperta ? 'Sejf zamknięty' : 'Brak sejfu';
    $('zablokuj').hidden = !dek;
    $('ostrz-pamiec').hidden = !pamiecTylko;
    window.scrollTo(0, 0);
  }
  function komunikat(id, tekst, rodzaj = 'zle') { const e = $(id); e.textContent = tekst; e.className = 'komunikat ' + rodzaj; e.hidden = !tekst; }
  async function zajety(przycisk, f) {
    przycisk.disabled = true; const t = przycisk.textContent; przycisk.textContent = 'Szyfruję…';
    try { return await f(); }
    catch (e) { $('blad-ogolny').textContent = 'Nie udało się zaszyfrować danych w tej przeglądarce (' + (e && e.message || e) + '). Otwórz stronę w aktualnej przeglądarce przez https albo z pliku.'; $('blad-ogolny').hidden = false; }
    finally { przycisk.disabled = false; przycisk.textContent = t; }
  }

  // --- wywiad ↔ profil (format: docs/FORMAT-PLANU.md) ---
  const liczba = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
  function profilZFormularza() {
    const typ = $('f-cel-typ').value;
    const rek = $('f-rek-czas').value.trim();
    return {
      rok_urodzenia: liczba('f-rok'), plec: $('f-plec').value, masa_kg: liczba('f-masa'), wzrost_cm: liczba('f-wzrost'),
      poziom: $('f-poziom').value, powrot_po_przerwie: $('f-powrot').checked,
      obciazenie: { h_tydz: liczba('f-h'), km_tydz: liczba('f-km'), najdluzszy_min: liczba('f-najdl') },   // puste pole = brak danych, nie zero
      dni: Object.fromEntries(DNI.map((d) => [d, { max_min: liczba('f-dzien-' + d) ?? 0 }])),
      rekordy: rek ? [{ dystans_km: Number($('f-rek-dyst').value), czas: rek, data: $('f-rek-data').value || null }] : [],
      hrmax: liczba('f-hrmax'), lthr: liczba('f-lthr'), hr_spocz: liczba('f-hrspocz'),
      cel: typ === 'dystans'
        ? { typ, dystans_km: Number($('f-cel-dyst').value), czas: $('f-cel-czas').value.trim() || null, data: $('f-cel-data').value || null }
        : { typ, minuty: liczba('f-cel-min') ?? 30, data: $('f-cel-data').value || null },
    };
  }
  function formularzZProfilu(p) {
    const ust = (id, v) => { $(id).value = v ?? ''; };
    ust('f-rok', p.rok_urodzenia); ust('f-plec', p.plec); ust('f-masa', p.masa_kg); ust('f-wzrost', p.wzrost_cm);
    ust('f-poziom', p.poziom); $('f-powrot').checked = !!p.powrot_po_przerwie;
    ust('f-h', p.obciazenie.h_tydz); ust('f-km', p.obciazenie.km_tydz); ust('f-najdl', p.obciazenie.najdluzszy_min);
    for (const d of DNI) ust('f-dzien-' + d, p.dni[d].max_min);
    const r = p.rekordy[0]; ust('f-rek-dyst', r ? r.dystans_km : 10); ust('f-rek-czas', r && r.czas); ust('f-rek-data', r && r.data);
    ust('f-hrmax', p.hrmax); ust('f-lthr', p.lthr); ust('f-hrspocz', p.hr_spocz);
    ust('f-cel-typ', p.cel.typ); ust('f-cel-dyst', p.cel.dystans_km ?? 10); ust('f-cel-czas', p.cel.czas); ust('f-cel-min', p.cel.minuty); ust('f-cel-data', p.cel.data);
    celTyp();
  }
  function bladProfilu(p) {
    const rok = new Date().getFullYear();
    if (!(p.rok_urodzenia >= rok - 100 && p.rok_urodzenia <= rok - 10)) return 'Podaj rok urodzenia (cztery cyfry).';
    const czasOk = (t) => /^\d{1,2}:\d{2}(:\d{2})?$/.test(t);
    if (p.rekordy[0] && !czasOk(p.rekordy[0].czas)) return 'Czas rekordu wpisz jako g:mm:ss, np. 0:47:30.';
    if (p.cel.typ === 'dystans' && p.cel.czas && !czasOk(p.cel.czas)) return 'Czas celu wpisz jako g:mm:ss, np. 3:45:00.';
    if (!Object.values(p.dni).some((d) => d.max_min > 0)) return 'Zaznacz przynajmniej jeden dzień, w którym możesz biegać (minuty większe od 0).';
    return null;
  }
  const PRZYKLAD = { rok_urodzenia: 1988, plec: 'k', masa_kg: 64, wzrost_cm: 169, poziom: 'regularnie', powrot_po_przerwie: false,
    obciazenie: { h_tydz: 3, km_tydz: 28, najdluzszy_min: 75 },
    dni: { pn: { max_min: 0 }, wt: { max_min: 60 }, sr: { max_min: 45 }, czw: { max_min: 60 }, pt: { max_min: 0 }, sob: { max_min: 45 }, nd: { max_min: 150 } },
    rekordy: [{ dystans_km: 10, czas: '0:52:30', data: '2026-10-04' }], hrmax: null, lthr: null,
    cel: { typ: 'dystans', dystans_km: 21.0975, czas: '1:55:00', data: '2027-03-21' } };
  function celTyp() { const d = $('f-cel-typ').value === 'dystans'; $('cel-dystans').hidden = !d; $('cel-czas-biegu').hidden = d; }

  // --- plan ---
  const NAZWA = { wolne: 'Wolne', spokojny: 'Spokojny bieg', regeneracyjny: 'Bardzo lekki bieg', marszobieg: 'Marszobieg', dlugi: 'Długi bieg', akcent: 'Mocny trening', test: 'Sprawdzian', start: 'Start' };
  const PO_CO = { spokojny: 'Buduje wytrzymałość bez zmęczenia.', regeneracyjny: 'Rozluźnia nogi przed ważnym dniem.', marszobieg: 'Przyzwyczaja ciało do biegu bez przeciążenia.',
    dlugi: 'Uczy organizm biec długo. Najważniejszy bieg tygodnia.', akcent: 'Podnosi tempo, które jesteś w stanie utrzymać.', test: 'Sprawdza postęp i aktualizuje prognozę.', start: 'Twój cel.' };
  const MOC = { spokojny: ['spokojnie', 'lekko'], regeneracyjny: ['bardzo lekko', 'lekko'], marszobieg: ['spokojnie', 'lekko'], dlugi: ['spokojnie', 'lekko'],
    akcent: ['mocno', 'mocno'], test: ['bardzo mocno', 'bardzo'], start: ['bardzo mocno', 'bardzo'] };
  const DODATEK = { rozgrzewka: 'rozgrzewka dynamiczna', plyometria: 'skoki (plyometria) 10 min', sila: 'siła 20–30 min', mobilnosc: 'rozciąganie po biegu' };
  const FAZA = { baza: 'baza', rozwoj: 'rozwój', specyficzna: 'pod start', taper: 'odpoczynek przed startem' };
  const DZIEN = { pn: 'pn', wt: 'wt', sr: 'śr', czw: 'czw', pt: 'pt', sob: 'sob', nd: 'nd' };
  const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`);
  const el = (tag, klasa, tekst) => { const e = document.createElement(tag); if (klasa) e.className = klasa; if (tekst !== undefined) e.textContent = tekst; return e; };
  const dzisISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const krotko = (iso) => `${+iso.slice(8)}.${iso.slice(5, 7)}`;
  const PEWNOSC = { niska: 'niska', srednia: 'średnia', wysoka: 'wysoka' };
  let pelny = false, edycja = false;
  const NA = { pn: 'poniedziałkiem', wt: 'wtorkiem', sr: 'środą', czw: 'czwartkiem', pt: 'piątkiem', sob: 'sobotą', nd: 'niedzielą' };
  async function zmien(z, co) { (dane.zmiany = dane.zmiany || []).push(z); await ulozPlan(co); pokazPlan(); }
  try { pelny = localStorage.getItem('ipb.widok') === 'pelny'; } catch (e) { /* ustawienie widoku jest opcjonalne */ }

  // Plan trzyma swój pierwszy poniedziałek: przeliczenie po teście nie przesuwa tygodni. „Od nowa” zaczyna od najbliższego.
  async function ulozPlan(co, odNowa) {
    const start = odNowa ? null : dane.profil.start_planu || (dane.plan && dane.plan.tygodnie[0].start);
    if (start) dane.profil.start_planu = start; else delete dane.profil.start_planu;
    if (odNowa) dane.zmiany = [];
    dane.plan = Podpowiedzi.zastosuj(Plan.uloz(dane.profil, dzisISO()), dane.zmiany);   // ręczne zmiany przetrwają przeliczenie
    dane.profil.start_planu = dane.plan.tygodnie[0].start;
    await zapiszDane(co);
  }
  function celTekst(x) {
    const cz = [], t = x.cel_tetno, v = x.cel_tempo;
    if (t) cz.push(t.od && t.do ? `tętno ${t.od}–${t.do}` : t.do ? `tętno do ${t.do}` : `tętno powyżej ${t.od}`);
    if (v) cz.push(`tempo ${Strefy.mmss(v.od)}–${Strefy.mmss(v.do)}/km`);
    return cz.length ? cz.join(' · ') + (x.szacunek && t ? ' (tętno to szacunek)' : '') : '';
  }
  // --- dziennik ---
  const dzienPlanu = (iso) => {
    for (const t of (dane.plan ? dane.plan.tygodnie : [])) {
      const i = Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(t.start + 'T00:00:00Z')) / 864e5);
      if (i >= 0 && i < 7) return t.dni[i];
    }
    return null;
  };
  const lthrTeraz = () => Strefy.licz(dane.profil).tetna.lthr.v;
  const opisBiegu = (w) => [hm(w.min), w.km ? `${String(w.km).replace('.', ',')} km` : '', w.hr_sr ? `śr. tętno ${w.hr_sr}` : '', w.odczucie ? `odczucie ${w.odczucie}/10` : ''].filter(Boolean).join(' · ');
  const ocenaTekst = (w) => Dziennik.ocena(w, dzienPlanu(w.data)).opis;
  async function dodajBiegi(nowe, co) {
    const dz = dane.dziennik = dane.dziennik || [];
    const swieze = nowe.filter((w) => !dz.some((x) => x.data === w.data && x.min === w.min && x.zrodlo === w.zrodlo));
    dz.push(...swieze); dz.sort((a, b) => (a.data < b.data ? 1 : -1));
    if (swieze.length) await zapiszDane(co);
    return swieze.length;
  }
  function pokazDziennik() {
    const dz = dane.dziennik || [], k = Dziennik.wskazniki(dz, lthrTeraz(), dzisISO());
    $('dz-rady').replaceChildren(...k.rady.map((r) => el('p', 'komunikat' + (r.poziom === 'uwaga' ? '' : ' info'), r.tekst)));
    const wiersz = (a, b) => [el('dt', '', a), el('dd', '', b)];
    $('dz-wsk').replaceChildren(...wiersz('Ostatnie 7 dni', `${k.obc7} pkt`), ...wiersz('Zmęczenie (średnia z 7 dni)', `${k.atl} pkt na dzień`),
      ...wiersz('Forma (średnia z 42 dni)', `${k.ctl} pkt na dzień`), ...wiersz('Ostatni tydzień do średniej z czterech', k.stosunek === null ? 'za mało danych' : String(k.stosunek).replace('.', ',')));
    const dzis = dzisISO(), tyg = (dane.plan ? dane.plan.tygodnie : []).filter((t) => t.start <= dzis).slice(-8);
    $('dz-tygodnie').replaceChildren(...(tyg.length ? tyg.map((t) => {
      const koniec = new Date(Date.parse(t.start + 'T00:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
      const plan = t.dni.reduce((a, x) => a + x.min, 0), zrob = dz.filter((w) => w.data >= t.start && w.data <= koniec).reduce((a, w) => a + w.min, 0);
      const r = el('div', 'slupek'), tor = el('span', 'tor'), i = el('i'); i.style.width = Math.min(100, plan ? 100 * zrob / plan : 0) + '%'; tor.append(i);
      r.append(el('span', '', `Tydz. ${t.nr}`), tor, el('span', '', `${hm(zrob)} z ${hm(plan)}`)); return r;
    }) : [el('p', 'cichy', 'Plan zaczyna się w najbliższy poniedziałek – porównanie pojawi się po pierwszym tygodniu.')]));
    $('dz-lista').replaceChildren(...(dz.length ? dz.slice(0, 30).map((w) => {
      const b = el('div', 'bieg'), r = el('div', 'rzad'), sel = el('select'), u = el('button', '', 'Usuń');
      sel.setAttribute('aria-label', 'Odczucie'); sel.append(new Option('odczucie…', ''), ...Array.from({ length: 10 }, (_, i) => new Option(`${i + 1}/10`, i + 1))); sel.value = w.odczucie || '';
      sel.onchange = async () => { w.odczucie = +sel.value || undefined; await zapiszDane(`dziennik: odczucie ${w.data}`); pokazDziennik(); };
      u.type = 'button'; u.dataset.usun = w.data;
      u.onclick = async () => { dane.dziennik = dz.filter((x) => x !== w); await zapiszDane(`dziennik: usunięty bieg ${w.data}`); pokazDziennik(); };
      r.append(sel, u);
      b.append(el('span', 'glowa', `${w.data} · ${opisBiegu(w)}`), el('span', 'cichy', ocenaTekst(w) + (w.zrodlo !== 'reczny' ? ` Z pliku ${w.zrodlo.toUpperCase()}.` : '')), r);
      return b;
    }) : [el('p', 'cichy', 'Jeszcze nic nie dodano.')]));
    if (!$('dz-data').value) $('dz-data').value = dzis;
  }
  async function dodajRecznie() {
    const min = liczba('dz-min'), data = $('dz-data').value;
    if (!data || !(min > 0 && min < 1500)) return komunikat('dz-info', 'Podaj datę i czas biegu w minutach.');
    const w = { data, zrodlo: 'reczny', min: Math.round(min) };
    for (const [pole, id] of [['km', 'dz-km'], ['hr_sr', 'dz-hr'], ['odczucie', 'dz-odczucie']]) { const v = liczba(id); if (v) w[pole] = v; }
    const ile = await dodajBiegi([w], `dziennik: bieg ${data}, ${w.min} min`);
    for (const id of ['dz-min', 'dz-km', 'dz-hr', 'dz-odczucie']) $(id).value = '';
    komunikat('dz-info', ile ? 'Dodano bieg.' : 'Taki bieg już jest w dzienniku.', ile ? 'ok' : 'zle'); pokazDziennik();
  }
  async function dodajPliki(pliki) {
    const nowe = [], bledy = [];
    for (const f of pliki) {
      try { nowe.push(Dziennik.zamknij(Dziennik.zPliku(f.name, await f.arrayBuffer()), lthrTeraz())); } catch (e) { bledy.push(`${f.name}: ${e.message}`); }
    }
    const ile = nowe.length ? await dodajBiegi(nowe, `dziennik: ${nowe.length} bieg(i) z pliku`) : 0;
    $('dz-plik').value = '';
    komunikat('dz-info', [ile ? `Dodano z pliku: ${ile}.` : '', nowe.length - ile ? `Pominięto już zapisane: ${nowe.length - ile}.` : '', ...bledy].filter(Boolean).join(' '), bledy.length ? 'zle' : 'ok');
    pokazDziennik();
  }

  function pokazStrefy() {
    const s = Strefy.licz(dane.profil), r = Prognoza.ostatni(dane.profil.rekordy || []);
    const wiersz = (k, v) => [el('dt', '', k), el('dd', '', v)];
    $('progi-dl').replaceChildren(
      ...wiersz('Tętno maksymalne', `${s.tetna.hrmax.v} (${s.tetna.hrmax.szacunek ? 'szacunek z wieku' : 'zmierzone'})`),
      ...wiersz('Tętno progowe', `${s.tetna.lthr.v} (${s.tetna.lthr.szacunek ? 'szacunek' : 'zmierzone'})`),
      ...wiersz('Ostatni wynik', r ? `${NAZWY[r.dystans_km] || r.dystans_km + ' km'} w ${r.czas}${r.data ? ', ' + r.data : ''} (${Prognoza.statusWyniku(r, dzisISO())})` : 'brak'),
      ...wiersz('Obecne obciążenie', dane.profil.obciazenie.h_tydz === null || dane.profil.obciazenie.h_tydz === undefined ? 'brak danych' : `${dane.profil.obciazenie.h_tydz} h na tydzień (podane w wywiadzie)`));
    $('progi-szacunek').hidden = !(s.tetna.hrmax.szacunek || s.tetna.lthr.szacunek);
    const tabela = (tytul, opis, wiersze) => {
      const k = el('div', 'karta'); k.style.cssText = 'display:flex; flex-direction:column; gap:8px';
      const t = el('table', 'strefy');
      for (const [a, b] of wiersze) { const tr = el('tr'); tr.append(el('td', '', a), el('td', '', b)); t.append(tr); }
      k.append(el('h3', '', tytul), el('p', 'cichy', opis), t); return k;
    };
    const zakres = (a, b) => (a === null ? `do ${b}` : b === null ? `od ${a}` : `${a}–${b}`);
    const karty = s.modele.map((m) => tabela(m.nazwa, m.opis, m.strefy.map(([n, a, b]) => [n, zakres(a, b)])));
    if (s.tempa) {
      const tz = (z) => `${Strefy.mmss(z[0])}–${Strefy.mmss(z[1])} /km`;
      karty.push(tabela('Tempa', `z ostatniego wyniku przez równania VDOT (VDOT ${String(s.tempa.vdot).replace('.', ',')}); to wskaźnik wyniku, nie pomiar wydolności`, [['Spokojne', tz(s.tempa.E)], ['Maraton', tz(s.tempa.M)], ['Próg', tz(s.tempa.T)], ['VO2max (odcinki 3 min)', tz(s.tempa.I)]]));
    }
    $('strefy-modele').replaceChildren(...karty);
    const testy = dane.testy || [];
    $('testy-lista').replaceChildren(...(testy.length ? testy.map((t) => el('li', '', t.rodzaj === 'tetno'
      ? `${t.data}: test 30 min – tętno progowe ${t.lthr}${t.hrmax ? ', najwyższe ' + t.hrmax : ''}`
      : `${t.data}: ${NAZWY[t.dystans_km] || t.dystans_km + ' km'} w ${t.czas}`)) : [el('li', 'cichy', 'Jeszcze nic nie wpisano.')]));
    if (!$('t-data').value) $('t-data').value = dzisISO();
  }
  async function zapiszTest() {
    const rodzaj = $('t-rodzaj').value, data = $('t-data').value || dzisISO();
    if (rodzaj === 'tetno') {
      const lthr = liczba('t-lthr'), hrmax = liczba('t-hrmax');
      if (!(lthr >= 90 && lthr <= 220)) return komunikat('t-info', 'Wpisz średnie tętno z ostatnich 20 minut testu (liczba między 90 a 220).');
      if (hrmax && hrmax < lthr) return komunikat('t-info', 'Najwyższe tętno nie może być niższe od średniego.');
      dane.profil.lthr = lthr;
      if (hrmax) dane.profil.hrmax = Math.max(hrmax, dane.profil.hrmax || 0);
      (dane.testy = dane.testy || []).push({ data, rodzaj, lthr, hrmax });
      await ulozPlan(`wynik testu 30 min: tętno progowe ${lthr}; strefy i plan przeliczone`);
    } else {
      const czas = $('t-czas').value.trim(), dystans_km = Number($('t-dyst').value);
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(czas)) return komunikat('t-info', 'Czas wpisz jako g:mm:ss, np. 0:24:30.');
      dane.profil.rekordy = [...(dane.profil.rekordy || []), { dystans_km, czas, data }];
      (dane.testy = dane.testy || []).push({ data, rodzaj, dystans_km, czas });
      await ulozPlan(`wynik biegu kontrolnego: ${dystans_km} km w ${czas}; prognoza i plan przeliczone`);
    }
    $('t-lthr').value = $('t-hrmax').value = $('t-czas').value = '';
    komunikat('t-info', 'Zapisano. Strefy, prognoza i plan są przeliczone.', 'ok');
    pokazStrefy();
  }
  function pokazPlan() {
    const plan = dane.plan;
    $('plan-brak').hidden = !!plan; $('plan-jest').hidden = !plan;
    if (!plan) return;
    const o = plan.ocena_celu, c = o.cel_posredni || dane.profil.cel;
    $('plan-cel').replaceChildren('Cel: ' + (c.typ === 'dystans' ? `${NAZWY[c.dystans_km] || c.dystans_km + ' km'}${c.czas ? ' w ' + c.czas : ''}` : `${c.minuty} min biegu bez przerwy`) + ' ', el('span', 'status ' + o.status, o.status));
    $('plan-ocena').textContent = (o.prognoza ? `Prognoza z ostatniego wyniku (dwie metody): ${o.prognoza}, pewność ${PEWNOSC[o.pewnosc] || 'niska'}. ` : '') + o.uzasadnienie;
    const uwagi = Walidator.sprawdz(dane.profil, plan);
    const uwaga = (u) => { const p = el('p', 'komunikat' + (u.poziom === 'krytyczne' || u.poziom === 'zastrzezenie' ? ' zle' : u.poziom === 'informacja' ? ' info' : ''));
      p.append(el('strong', '', u.opis), el('span', '', u.uzasadnienie + ' ' + u.korekta), el('span', 'zrodlo', `Reguła ${u.id} · źródło klasy ${u.klasa} · pewność ${PEWNOSC[u.pewnosc]}: ${u.zrodlo}`)); return p; };
    $('plan-uwagi').replaceChildren(...plan.uwagi.map((u) => el('p', 'komunikat', u)), ...uwagi.filter((u) => u.tydzien === null).map(uwaga));
    $('edycja').setAttribute('aria-pressed', edycja);
    const otwarte = new Set([...document.querySelectorAll('details.tydzien[open]')].map((d) => +d.dataset.nr));
    $('plan-bramki-tytul').hidden = $('plan-bramki').hidden = !plan.bramki.length;
    $('plan-bramki').replaceChildren(...plan.bramki.map((b) => el('li', '', `Tydzień ${b.tydzien}: ${b.opis} – ${b.prog}.`)));
    $('widok-prosty').setAttribute('aria-pressed', !pelny); $('widok-pelny').setAttribute('aria-pressed', pelny);
    const dzis = dzisISO();
    const biezacy = plan.tygodnie.findIndex((t, i) => dzis >= t.start && (i === plan.tygodnie.length - 1 || dzis < plan.tygodnie[i + 1].start));
    $('plan-tygodnie').replaceChildren(...plan.tygodnie.map((t, i) => {
      const d = el('details', 'tydzien'); d.dataset.nr = t.nr; d.open = otwarte.size ? otwarte.has(t.nr) : i === Math.max(0, biezacy);
      const moje = uwagi.filter((u) => u.tydzien === t.nr);
      const koniec = new Date(new Date(t.start + 'T00:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10);
      const s = el('summary');
      s.append(el('span', '', `Tydzień ${t.nr}`), el('span', 'cichy', `${krotko(t.start)}–${krotko(koniec)} · ${hm(t.dni.reduce((a, x) => a + x.min, 0))} · ${FAZA[t.faza]}`));
      if (moje.length) s.append(el('span', 'znak', `uwagi: ${moje.length}`));
      const gora = el('div', 'uwagi-tyg'); gora.append(...moje.map(uwaga));
      if (t.zmieniony && edycja) {
        const c = el('button', '', 'Cofnij zmiany w tym tygodniu'); c.type = 'button'; c.dataset.cofnij = t.nr;
        c.onclick = async () => { dane.zmiany = (dane.zmiany || []).filter((z) => z.tydzien !== t.nr); await ulozPlan(`cofnięte zmiany w tygodniu ${t.nr}`); pokazPlan(); };
        gora.append(c);
      }
      d.append(s, ...(gora.children.length ? [gora] : []), ...t.dni.map((x, nrDnia) => {
        const w = el('div', 'dzien' + (x.typ === 'wolne' ? ' wolne' : ''));
        const dataDnia = new Date(Date.parse(t.start + 'T00:00:00Z') + nrDnia * 864e5).toISOString().slice(0, 10);
        const wykonane = () => { for (const b of (dane.dziennik || []).filter((q) => q.data === dataDnia)) w.append(el('span', 'wykonano', `Wykonano: ${opisBiegu(b)}. ${ocenaTekst(b)}`)); };
        const nazwa = el('span', 'nazwa', NAZWA[x.typ]);
        if (MOC[x.typ]) nazwa.append(el('span', 'moc ' + MOC[x.typ][1], MOC[x.typ][0]));
        w.append(el('span', 'kto', DZIEN[x.dzien]), nazwa, el('span', 'ile', x.min ? hm(x.min) : ''));
        const dod = x.dodatki.map((k) => DODATEK[k]).join(', ');
        const sterowanie = () => {
          if (!edycja) return;
          const z = el('span', 'zmiana'), sel = el('select'); sel.dataset.zamien = `${t.nr}-${x.dzien}`; sel.setAttribute('aria-label', `Zamień ${DZIEN[x.dzien]} z innym dniem`);
          sel.append(new Option('Zamień z…', ''), ...t.dni.filter((y) => y.dzien !== x.dzien).map((y) => new Option(`${NA[y.dzien]} (${NAZWA[y.typ].toLowerCase()})`, y.dzien)));
          sel.onchange = () => sel.value && zmien({ tydzien: t.nr, typ: 'zamiana', a: x.dzien, b: sel.value }, `tydzień ${t.nr}: zamiana ${x.dzien} ↔ ${sel.value}`);
          z.append(sel);
          if (x.min) { const o = el('button', '', 'Odpuść ten bieg'); o.type = 'button'; o.dataset.odpusc = `${t.nr}-${x.dzien}`;
            o.onclick = () => zmien({ tydzien: t.nr, typ: 'odpusc', a: x.dzien }, `tydzień ${t.nr}: odpuszczony bieg (${x.dzien})`); z.append(o); }
          w.append(z);
        };
        if (x.typ === 'wolne') { if (dod) w.append(el('span', 'wiecej', 'Bez biegu: ' + dod + '.')); wykonane(); sterowanie(); return w; }
        const cel = celTekst(x);
        if (cel) w.append(el('span', 'cel', cel));
        if (pelny) {
          w.append(el('span', 'szczegoly', x.opis || ''));
          if (x.po_co) w.append(el('span', 'wiecej', `Po co: ${x.po_co} ${x.dlaczego_teraz || ''}${x.latwiej ? ' Łatwiejszy wariant: ' + x.latwiej : ''}`));
          w.append(el('span', 'wiecej', [x.mocne_min && x.typ !== 'start' ? `mocnych minut: ${x.mocne_min}` : '', dod ? 'do tego: ' + dod : ''].filter(Boolean).join(' · ')));
        } else w.append(el('span', 'wiecej', (x.po_co || PO_CO[x.typ]) + (dod ? ' Do tego: ' + dod + '.' : '')));
        wykonane(); sterowanie();
        return w;
      }));
      return d;
    }));
  }

  // --- widoki po otwarciu ---
  const NAZWY = { '5': '5 km', '10': '10 km', '21.0975': 'półmaraton', '42.195': 'maraton' };
  function pokazProfil() {
    const p = dane.profil, o = Prognoza.ocena(p), c = p.cel;
    const cel = c.typ === 'dystans' ? `${NAZWY[c.dystans_km] || c.dystans_km + ' km'}${c.czas ? ' w ' + c.czas : ''}` : `${c.minuty} min biegu bez przerwy`;
    const wolne = DNI.filter((d) => !p.dni[d].max_min).join(', ') || 'brak';
    const wiersze = [['Rok urodzenia', p.rok_urodzenia], ['Poziom', p.poziom + (p.powrot_po_przerwie ? ', powrót po przerwie' : '')],
      ['Obciążenie', p.obciazenie.h_tydz === null || p.obciazenie.h_tydz === undefined ? 'brak danych' : `${p.obciazenie.h_tydz} h / ${p.obciazenie.km_tydz ?? '?'} km na tydzień`], ['Dni wolne', wolne],
      ['Tętno maks. / próg', `${p.hrmax ?? 'nie zmierzone'} / ${p.lthr ?? 'nie zmierzone'}`], ['Cel', cel + (c.data ? ', ' + c.data : '')]];
    $('profil-dl').replaceChildren(...wiersze.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
    $('ocena-status').textContent = o.status; $('ocena-status').className = 'status ' + o.status;
    $('ocena-prognoza').textContent = o.prognoza ? `Prognoza z ostatniego wyniku: ${o.prognoza} (Riegel i VDOT${o.vdot ? ', VDOT ' + String(o.vdot).replace('.', ',') : ''}). Pewność: ${{ niska: 'niska', srednia: 'średnia' }[o.pewnosc]}${o.zastrzezenia && o.zastrzezenia.length ? ' – ' + o.zastrzezenia.join('; ') : ''}.` : '';
    $('ocena-opis').textContent = o.uzasadnienie;
    $('brak-tetna').hidden = !!(p.hrmax && p.lthr) || p.poziom === 'zaczynam';
    $('historia').textContent = dane.historia.map((h) => `${h.kiedy}  ${h.co}`).join('\n');
  }
  function pokazZapis() {
    const surowe = (() => { try { return localStorage.getItem(KLUCZ); } catch (e) { return null; } })() || JSON.stringify(koperta);
    $('surowe').textContent = surowe;
    $('jawne').textContent = JSON.stringify(dane, null, 1);
    $('alg').textContent = koperta.haslo.kdf.alg === 'argon2id'
      ? `Argon2id (pamięć ${koperta.haslo.kdf.m / 1024} MiB, ${koperta.haslo.kdf.t} przebiegi) + AES-GCM 256`
      : `PBKDF2-SHA256 (${koperta.haslo.kdf.iter} iteracji) + AES-GCM 256 – Argon2id nie zadziałał w tej przeglądarce`;
    const siec = performance.getEntriesByType('resource').map((r) => r.name).filter((n) => !n.startsWith('data:') && !n.startsWith('blob:'));
    $('siec-ile').textContent = siec.length ? `${siec.length} – lista poniżej` : '0 – strona niczego nie pobrała ani nie wysłała';
    $('siec-lista').textContent = siec.join('\n'); $('siec-lista').hidden = !siec.length;
    $('kopia-tekst').value = surowe;
  }
  function zakladka(n) {
    for (const b of document.querySelectorAll('nav.zakladki button')) b.setAttribute('aria-selected', b.dataset.z === n);
    for (const d of document.querySelectorAll('[data-panel]')) d.hidden = d.dataset.panel !== n;
    if (n === 'plan') pokazPlan(); else if (n === 'dziennik') pokazDziennik(); else if (n === 'strefy') pokazStrefy(); else if (n === 'profil') pokazProfil(); else pokazZapis();
  }
  function otwarty() { widok('otwarty'); zakladka('plan'); czuwaj(); }
  function zablokuj() { dek = null; dane = null; edycja = false; clearTimeout(zegar); $('haslo-otworz').value = ''; komunikat('blad-otworz', '');
    if (!$('pole-kod').hidden) $('przelacz-kod').click();   // zawsze wracaj do pola hasła
    widok(koperta ? 'zamkniety' : 'start'); }
  function czuwaj() { clearTimeout(zegar); if (dek) zegar = setTimeout(zablokuj, BEZCZYNNOSC_MS); }
  async function zapiszDane(co) {
    dane.historia.push({ kiedy: new Date().toISOString().slice(0, 16).replace('T', ' '), co });
    magazyn.pisz(await Sejf.zapisz(koperta, dek, dane));
  }

  // --- zdarzenia ---
  // Nie polegamy na zdarzeniu submit: w ramkach bez uprawnienia allow-forms przeglądarka go nie wysyła.
  function akcja(formId, przyciskId, f) {
    const form = $(formId);
    form.addEventListener('submit', (e) => e.preventDefault());
    $(przyciskId).addEventListener('click', f);
    form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); f(); } });
  }
  function start() {
    koperta = magazyn.czytaj();
    for (const z of ['pointerdown', 'keydown']) addEventListener(z, czuwaj, { passive: true });
    $('zablokuj').onclick = zablokuj;
    $('f-cel-typ').onchange = celTyp;
    $('zacznij').onclick = () => { $('wywiad-tytul').textContent = 'Wywiad'; widok('wywiad'); };
    $('przyklad').onclick = () => { formularzZProfilu(PRZYKLAD); komunikat('blad-wywiad', 'Wpisano dane przykładowe – zmień je na swoje.', 'ok'); };
    $('edytuj').onclick = () => { formularzZProfilu(dane.profil); $('wywiad-tytul').textContent = 'Zmiana danych'; komunikat('blad-wywiad', ''); widok('wywiad'); };

    akcja('form-wywiad', 'wywiad-dalej', async () => {
      const p = profilZFormularza(), blad = bladProfilu(p);
      if (blad) return komunikat('blad-wywiad', blad);
      komunikat('blad-wywiad', '');
      if (dek) { p.start_planu = dane.profil.start_planu; dane.profil = p; await ulozPlan('zmiana danych z wywiadu, plan przeliczony'); return otwarty(); }
      window._profilRoboczy = p; $('haslo-tytul').textContent = 'Ustaw hasło do sejfu'; widok('haslo');
    });
    akcja('form-haslo', 'haslo-zapisz', () => {
      const h = $('haslo-nowe').value;
      if (h.length < 12) return komunikat('blad-haslo', 'Hasło musi mieć co najmniej 12 znaków. Dobrze działa kilka słów, np. zdanie, które pamiętasz.');
      if (h !== $('haslo-powt').value) return komunikat('blad-haslo', 'Oba hasła muszą być takie same.');
      komunikat('blad-haslo', '');
      return zajety($('haslo-zapisz'), async () => {
        if (dek) {                                   // zmiana hasła po otwarciu kodem odzyskiwania
          magazyn.pisz(await Sejf.zmienHaslo(koperta, dek, h)); await zapiszDane('zmiana hasła'); otwarty();
        } else {
          const pierwsze = { profil: window._profilRoboczy, plan: Plan.uloz(window._profilRoboczy, dzisISO()), testy: [], zmiany: [], dziennik: [],
            historia: [{ kiedy: new Date().toISOString().slice(0, 16).replace('T', ' '), co: 'założenie sejfu i ułożenie planu' }] };
          const w = await Sejf.utworz(h, pierwsze);
          delete window._profilRoboczy; dek = w.dek; dane = pierwsze; magazyn.pisz(w.koperta);
          dane.profil.start_planu = dane.plan.tygodnie[0].start; magazyn.pisz(await Sejf.zapisz(w.koperta, dek, dane));
          $('kod-odz').textContent = w.kod; $('kod-potw').checked = false; $('kod-dalej').disabled = true; widok('kod');
        }
        $('haslo-nowe').value = $('haslo-powt').value = '';
      });
    });
    $('kod-potw').onchange = () => { $('kod-dalej').disabled = !$('kod-potw').checked; };
    $('kod-dalej').onclick = () => { $('kod-odz').textContent = ''; otwarty(); };

    akcja('form-otworz', 'otworz', () => {
      const kodem = !$('pole-kod').hidden;
      return zajety($('otworz'), async () => {
        try {
          const w = await Sejf.otworz(koperta, kodem ? $('kod-wpisz').value : $('haslo-otworz').value, kodem ? 'kod' : 'haslo');
          dek = w.dek; dane = w.dane; komunikat('blad-otworz', ''); $('haslo-otworz').value = $('kod-wpisz').value = '';
          if (kodem) { $('haslo-tytul').textContent = 'Ustaw nowe hasło'; widok('haslo'); } else otwarty();
        } catch (err) { komunikat('blad-otworz', kodem ? 'Ten kod nie otwiera sejfu. Sprawdź, czy przepisałeś go w całości.' : 'To hasło nie otwiera sejfu. Spróbuj jeszcze raz albo użyj kodu odzyskiwania.'); }
      });
    });
    $('przelacz-kod').onclick = () => { const k = $('pole-kod').hidden; $('pole-kod').hidden = !k; $('pole-haslo').hidden = k;
      $('przelacz-kod').textContent = k ? 'Wróć do hasła' : 'Nie pamiętam hasła – użyj kodu odzyskiwania'; komunikat('blad-otworz', ''); };

    for (const b of document.querySelectorAll('nav.zakladki button')) b.onclick = () => zakladka(b.dataset.z);
    for (const id of ['uloz', 'uloz2']) $(id).onclick = async () => { await ulozPlan('ułożenie planu od najbliższego poniedziałku', true); pokazPlan(); };
    akcja('form-test', 't-zapisz', zapiszTest);
    $('edycja').onclick = () => { edycja = !edycja; pokazPlan(); };
    akcja('form-bieg', 'dz-dodaj', dodajRecznie);
    $('dz-plik').onchange = () => $('dz-plik').files.length && dodajPliki([...$('dz-plik').files]);
    $('t-rodzaj').onchange = () => { const t = $('t-rodzaj').value === 'tetno'; $('t-pola-tetno').hidden = !t; $('t-pola-kontrolny').hidden = t; komunikat('t-info', ''); };
    for (const [id, v] of [['widok-prosty', false], ['widok-pelny', true]]) $(id).onclick = () => { pelny = v; try { localStorage.setItem('ipb.widok', v ? 'pelny' : 'prosty'); } catch (e) { /* opcjonalne */ } pokazPlan(); };
    $('kopiuj').onclick = async () => { try { await navigator.clipboard.writeText($('kopia-tekst').value); komunikat('kopia-info', 'Skopiowano. Wklej do pliku tekstowego i zachowaj.', 'ok'); }
      catch (e) { $('kopia-tekst').select(); komunikat('kopia-info', 'Zaznaczyłem tekst – skopiuj go ręcznie.', 'ok'); } };
    for (const id of ['usun', 'usun2']) $(id).onclick = () => { $('usun-potw').hidden = false; $('usun-potw').scrollIntoView({ block: 'center' }); };
    $('usun-nie').onclick = () => { $('usun-potw').hidden = true; };
    $('usun-tak').onclick = () => { magazyn.usun(); $('usun-potw').hidden = true; zablokuj(); };
    $('przywroc').onclick = () => {
      try { const k = JSON.parse($('przywroc-tekst').value); if (k.app !== 'ipb' || !k.haslo || !k.dane) throw 0;
        magazyn.pisz(k); $('przywroc-tekst').value = ''; komunikat('blad-przywroc', ''); zablokuj(); }
      catch (e) { komunikat('blad-przywroc', 'To nie wygląda na kopię sejfu IPB. Wklej cały tekst kopii, od { do }.'); }
    };
    celTyp();
    widok(koperta ? 'zamkniety' : 'start');
  }
  start();
})();
