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
  // Plik powstaje w przeglądarce i jest zapisywany przez nią; nic nie jest wysyłane.
  function pobierz(nazwa, typ, tresc) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tresc], { type: typ })); a.download = nazwa;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    komunikat('eksport-info', `Plik ${nazwa} zapisany przez przeglądarkę. Jeśli się nie pobrał: podgląd w oknie Claude blokuje pobieranie – otwórz aplikację z pliku albo ze swojego serwera. Plik FIT wgraj na zegarek Garmin do folderu GARMIN/NewFiles albo zaimportuj w Garmin Connect.`, 'ok');
  }
  // --- druk (PDF przez okno drukowania przeglądarki): plan z miejscem na wykonanie albo karta jednego treningu ---
  function drukuj(strony, nazwa) {
    $('druk').replaceChildren(...strony);
    komunikat('eksport-info', `${nazwa} gotowe do druku. W oknie drukowania wybierz „Zapisz jako PDF”. Jeśli okno się nie otworzyło: podgląd w oknie Claude blokuje drukowanie – otwórz aplikację z pliku albo ze swojego serwera.`, 'ok');
    try { window.print(); } catch (e) { /* podgląd bez prawa drukowania */ }
  }
  const czasKroku = (k) => (k.dystans_m ? `${k.dystans_m >= 1000 ? k.dystans_m / 1000 + ' km' : k.dystans_m + ' m'}` : k.czas_s ? (k.czas_s % 60 ? `${Math.floor(k.czas_s / 60)}:${String(k.czas_s % 60).padStart(2, '0')} min` : `${k.czas_s / 60} min`) : 'do końca');
  function tabela(naglowki, klasy, wiersze) {
    const t = el('table'), cg = el('colgroup'), th = el('thead'), tr = el('tr'), tb = el('tbody');
    for (const k of klasy) { const c = el('col'); if (k) c.className = k; cg.append(c); }
    for (const n of naglowki) tr.append(el('th', '', n));
    th.append(tr);
    for (const w of wiersze) { const r = el('tr'); for (const x of w) r.append(el('td', '', x)); tb.append(r); }
    t.append(cg, th, tb); return t;
  }
  function drukPlanu() {
    drukuj(dane.plan.tygodnie.map((t) => {
      const s = el('div', 'strona'), koniec = new Date(Date.parse(t.start + 'T00:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
      s.append(el('h2', '', `Tydzień ${t.nr} · ${krotko(t.start)}–${krotko(koniec)} · ${hm(t.dni.reduce((a, x) => a + x.min, 0))} · ${FAZA[t.faza]}`),
        tabela(['Dzień', 'Trening', 'Czas', 'Cel', 'Rozpiska i po co', 'Wykonanie'], ['dz', 'tr', 'cz', 'ce', '', 'wy'], t.dni.map((x) => [DZIEN[x.dzien], NAZWA[x.typ], x.min ? hm(x.min) : '',
          celTekst(x), [x.opis, x.po_co, x.dodatki.length ? 'Do tego: ' + x.dodatki.map((k) => DODATEK[k]).join(', ') + '.' : ''].filter(Boolean).join(' '), ''])));
      return s;
    }), 'Plan');
  }
  function drukKarty(t, x, dataDnia) {
    const s = el('div', 'strona'), kr = Eksport.kroki(x);
    const opisCelu = (c) => (c ? Eksport.celTekst({ cel_tetno: c.tetno, cel_tempo: c.tempo }) : '');
    s.append(el('h2', '', `${NAZWA[x.typ]} · ${dataDnia} · ${hm(x.min)}`), el('p', '', x.opis || ''),
      tabela(['Krok', 'Ile', 'Cel'], ['', 'cz', ''], kr.map((k, i) => (k.razy ? [`Powtórz od kroku ${k.powtorz_od + 1}`, `${k.razy} razy łącznie`, ''] : [`${i + 1}. ${k.nazwa}`, czasKroku(k), opisCelu(k.cel)]))),
      el('p', '', ''), el('p', '', `Cel dnia: ${celTekst(x) || 'wysiłek maksymalny'}.`), el('p', '', `Po co: ${x.po_co || ''} ${x.dlaczego_teraz || ''}`),
      ...(x.latwiej ? [el('p', '', `Łatwiejszy wariant: ${x.latwiej}`)] : []), el('p', '', `Tydzień ${t.nr} planu, ${FAZA[t.faza]}. Notatki po biegu (czas, dystans, średnie tętno, odczucie 1–10):`), el('div', 'pole'));
    drukuj([s], 'Karta treningu');
  }

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
  // --- trasy, mapa i pogoda (krok 7). Sieć tylko po zgodzie zapisanej w sejfie; każde połączenie trafia do dziennika na ekranie. ---
  const polaczenia = [], pogodaPamiec = new Map(), mapa = { lon: 19.4, lat: 52.0, z: 6 };
  let tr = null;                                            // otwarty dzień: { x, t, dataDnia, glowna, trasy, wybrana }
  const teraz = () => new Date().toTimeString().slice(0, 5), przec = (n, m = 1) => n.toFixed(m).replace('.', ',');
  async function pobierzSiec(url, co) {
    const host = new URL(url).host, blad = (t) => { const e = new Error(t); e.przerwij = true; return e; };
    if (!dane || !dane.siec) throw blad('mapy i pogoda są wyłączone');
    polaczenia.push(`${teraz()}  ${host}  ${co}`);
    const ster = new AbortController(), czas = setTimeout(() => ster.abort(), 15000);
    let r;
    try { r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ster.signal }); }
    catch (e) { throw blad(`brak połączenia z ${host}. Sprawdź internet; w podglądzie w oknie Claude połączenia są zablokowane – otwórz aplikację z pliku albo ze swojego serwera`); }
    finally { clearTimeout(czas); }
    if ([429, 502, 503, 504].includes(r.status)) throw blad(`serwer ${host} jest przeciążony albo niedostępny (${r.status}). Spróbuj za kilka minut`);
    return r.text();
  }
  function rysujMape() {
    const m = $('mapa'), W = m.clientWidth, H = m.clientHeight, n = 2 ** mapa.z, [cx, cy] = Trasy.naPiksele(mapa.lon, mapa.lat, mapa.z), x0 = cx - W / 2, y0 = cy - H / 2, kafle = [];
    if (!W) return;
    if (dane && dane.siec) for (let kx = Math.floor(x0 / 256); kx * 256 < x0 + W; kx++) for (let ky = Math.max(0, Math.floor(y0 / 256)); ky * 256 < y0 + H && ky < n; ky++) {
      const i = new Image(); i.alt = ''; i.draggable = false; i.referrerPolicy = 'origin';    // serwer map OSM odrzuca zapytania bez adresu strony; wysyłamy sam adres serwisu, bez ścieżki
      i.style.left = Math.round(kx * 256 - x0) + 'px'; i.style.top = Math.round(ky * 256 - y0) + 'px';
      i.onerror = () => { i.remove(); komunikat('tr-info', 'Nie udało się pobrać podkładu mapy z tile.openstreetmap.org. Serwer map wymaga otwarcia aplikacji ze strony https (nie z pliku i nie w podglądzie). Trasy i pogoda działają bez podkładu.'); };
      i.src = Trasy.urlKafla(mapa.z, ((kx % n) + n) % n, ky); kafle.push(i);
    }
    $('mapa-kafle').replaceChildren(...kafle);
    const NS = 'http://www.w3.org/2000/svg', svg = $('mapa-rys'), rys = [];
    const linia = (pts, kolor, grubosc) => { const l = document.createElementNS(NS, 'polyline'); l.setAttribute('points', pts.map((p) => { const [x, y] = Trasy.naPiksele(p[0], p[1], mapa.z); return `${(x - x0).toFixed(1)},${(y - y0).toFixed(1)}`; }).join(' '));
      l.setAttribute('fill', 'none'); l.setAttribute('stroke', kolor); l.setAttribute('stroke-width', grubosc); l.setAttribute('stroke-linejoin', 'round'); l.setAttribute('stroke-linecap', 'round'); rys.push(l); };
    const kolko = (p, kolor) => { const [x, y] = Trasy.naPiksele(p[0], p[1], mapa.z), c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x - x0); c.setAttribute('cy', y - y0); c.setAttribute('r', 6); c.setAttribute('fill', kolor); c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', 2); rys.push(c); };
    if (tr && tr.trasy.length) {
      tr.trasy.forEach((t, i) => { if (i !== tr.wybrana) linia(t.pts, '#5b6b7a', 3); });
      const w = tr.trasy[tr.wybrana]; linia(w.pts, '#ffffff', 8); linia(w.pts, '#0b57d0', 5);
      if (tr.glowna) { const s = Trasy.narastajaco(w.pts); for (const o of tr.glowna.odcinki) linia(w.pts.filter((_, i) => s[i] >= o.od && s[i] <= o.do), '#b3261e', 5); }   // szybkie odcinki na czerwono
      kolko(w.pts[0], '#1f7a3a');
    }
    svg.replaceChildren(...rys);
    $('mapa-warstwy').style.transform = '';
  }
  function dopasujMape(pts) {
    const m = $('mapa'), W = m.clientWidth - 40, H = m.clientHeight - 40, lon = pts.map((p) => p[0]), lat = pts.map((p) => p[1]);
    const a = [Math.min(...lon), Math.max(...lat)], b = [Math.max(...lon), Math.min(...lat)];
    mapa.lon = (a[0] + b[0]) / 2; mapa.lat = (a[1] + b[1]) / 2;
    for (mapa.z = 17; mapa.z > 3; mapa.z--) { const p = Trasy.naPiksele(a[0], a[1], mapa.z), q = Trasy.naPiksele(b[0], b[1], mapa.z); if (q[0] - p[0] <= W && q[1] - p[1] <= H) break; }
    rysujMape();
  }
  function stanSieci() {
    const wl = !!(dane && dane.siec);
    $('siec-stan').replaceChildren(el('strong', '', wl ? 'Mapy i pogoda: włączone. ' : 'Teraz: nic. '), wl ? 'Aplikacja łączy się z trzema serwerami wymienionymi niżej, tylko gdy otwierasz trasę dnia.' : 'Aplikacja nie łączy się z żadnym serwerem.');
    $('siec-przelacz').textContent = wl ? 'Wyłącz mapy i pogodę' : 'Włącz mapy i pogodę';
    $('siec-dziennik').textContent = 'Połączenia od otwarcia sejfu (godzina, serwer, po co):\n' + polaczenia.join('\n'); $('siec-dziennik').hidden = !polaczenia.length;
    $('trasa-zgoda').hidden = wl; $('trasa-srodek').hidden = !wl;
  }
  async function ustawSiec(wl) { dane.siec = wl; await zapiszDane(wl ? 'włączone mapy i pogoda' : 'wyłączone mapy i pogoda'); stanSieci(); if (wl) rysujMape(); else zamknijTrase(); }
  function zamknijTrase() { tr = null; $('plan-jest').append($('trasa')); $('trasa').hidden = true; $('tr-lista').replaceChildren(); $('mapa-kafle').replaceChildren(); $('mapa-rys').replaceChildren(); komunikat('tr-info', ''); komunikat('tr-pogoda', ''); }
  // Długość trasy = długość treningu (R23): czas dnia × tempo ze stref; dla akcentu także położenie części głównej (R24).
  function trasaDnia(x) {
    const t = Strefy.licz(dane.profil).tempa, lekko = t && t.E ? (t.E[0] + t.E[1]) / 2 : 390, cel = x.cel_tempo ? (x.cel_tempo.od + x.cel_tempo.do) / 2 : null;
    if (!(x.typ === 'akcent' || x.typ === 'test')) return { km: x.min * 60 / (cel || lekko), glowna: null, szacunek: !cel };
    const g = Trasy.glownaCzesc(Eksport.kroki(x), lekko, cel || lekko * 0.85);
    return g ? { km: (g.do + Math.max(0, x.min * 60 - g.czas_s) / lekko * 1000) / 1000, glowna: g, szacunek: !t } : { km: x.min * 60 / lekko, glowna: null, szacunek: true };
  }
  function otworzTrase(w, t, x, dataDnia) {
    const d = trasaDnia(x), zap = (dane.trasy || {})[dataDnia];
    tr = { x, t, dataDnia, glowna: zap ? zap.glowna : d.glowna, trasy: zap ? [{ ...zap, zapisana: true }] : [], wybrana: 0 };
    $('trasa-tytul').textContent = `Trasa i pogoda · ${DZIEN[x.dzien]} ${krotko(dataDnia)} · ${NAZWA[x.typ]} ${hm(x.min)}`;
    $('tr-km').value = (Math.round(d.km * 10) / 10).toFixed(1);
    try { $('tr-godz').value = localStorage.getItem('ipb.godzina') || '17:00'; } catch (e) { /* opcjonalne */ }
    $('tr-start').hidden = !dane.start;
    komunikat('tr-info', d.szacunek ? 'Długość policzona z czasu treningu i przybliżonego tempa (brak wyniku do wyliczenia stref tempa). Popraw ją, jeśli znasz swoje tempo.' : '', 'info'); komunikat('tr-pogoda', '');
    w.after($('trasa')); $('trasa').hidden = false; stanSieci();
    if (zap) dopasujMape(zap.pts); else { if (dane.start && mapa.z < 10) Object.assign(mapa, { lon: dane.start.lon, lat: dane.start.lat, z: 14 }); rysujMape(); }
    pokazPropozycje();
    $('trasa').scrollIntoView({ block: 'nearest' });
  }
  function pokazPropozycje() {
    $('tr-lista').replaceChildren(...tr.trasy.map((p, i) => {
      const k = el('div', 'propozycja' + (i === tr.wybrana ? ' wybrana' : '')), rz = el('div', 'rzad'), nazwa = `${NAZWA[tr.x.typ]} ${tr.dataDnia}`;
      const przycisk = (tekst, co, f) => { const b = el('button', '', tekst); b.type = 'button'; b.dataset[co] = i; b.onclick = f; rz.append(b); };
      k.append(el('strong', '', p.zapisana ? 'Trasa zapisana do tego dnia' : `Propozycja ${i + 1}`), el('span', '', p.dlaczego));
      if (tr.glowna) k.append(el('span', 'cichy', `Na mapie: zielone kółko – start, czerwone – szybkie odcinki (od ${przec(tr.glowna.od / 1000)} km). Rozgrzewka trwa tyle, ile w planie.`));
      przycisk('Pokaż na mapie', 'pokaz', () => { tr.wybrana = i; dopasujMape(p.pts); pokazPropozycje(); });
      przycisk('Plik GPX', 'gpx', () => pobierz(`${nazwa.replace(/ /g, '_')}.gpx`, 'application/gpx+xml', Trasy.gpx(nazwa, p.pts, tr.glowna)));
      przycisk('Karta trasy (PDF)', 'kartaTrasy', () => { tr.wybrana = i; dopasujMape(p.pts); pokazPropozycje(); drukTrasy(p); });
      if (p.zapisana) przycisk('Usuń zapisaną trasę', 'usunTrase', async () => { delete dane.trasy[tr.dataDnia]; await zapiszDane(`usunięta trasa na ${tr.dataDnia}`); tr.trasy = []; rysujMape(); pokazPropozycje(); });
      else przycisk('Zapisz do tego dnia', 'zapiszTrase', async () => {
        (dane.trasy = dane.trasy || {})[tr.dataDnia] = { pts: p.pts.map((q) => [+q[0].toFixed(5), +q[1].toFixed(5), Math.round(q[2] || 0)]), dlaczego: p.dlaczego, glowna: tr.glowna };
        await zapiszDane(`zapisana trasa na ${tr.dataDnia}`); tr.trasy = [{ ...dane.trasy[tr.dataDnia], zapisana: true }]; tr.wybrana = 0; rysujMape(); pokazPropozycje();
        komunikat('tr-info', 'Trasa zapisana w sejfie (zaszyfrowana, jak reszta danych).', 'ok'); });
      k.append(rz); return k;
    }));
  }
  async function szukajTras() {
    const km = Number($('tr-km').value);
    if (!(km >= 1 && km <= 60)) return komunikat('tr-info', 'Podaj długość trasy od 1 do 60 km.');
    if (mapa.z < 12) return komunikat('tr-info', 'Przybliż mapę do miejsca, z którego chcesz zacząć bieg (albo naciśnij „Moje położenie”), i dopiero wtedy szukaj.');
    const b = $('tr-szukaj'), start = [mapa.lon, mapa.lat], dzien = tr; b.disabled = true;
    const skala = km / trasaDnia(tr.x).km, g = tr.glowna && Math.abs(skala - 1) < 0.15 ? tr.glowna : null;   // po ręcznej zmianie długości położenie odcinków przestaje być wiarygodne
    try {
      const w = await Trasy.szukaj({ start, km, glowna: g, pobierz: pobierzSiec, postep: (i, n) => komunikat('tr-info', `Szukam tras: kierunek ${i} z ${n}… (serwer społecznościowy, pytamy po kolei)`, 'info') });
      if (tr !== dzien) return;
      tr.glowna = g; tr.trasy = w.trasy; tr.wybrana = 0;
      if (w.trasy.length) { komunikat('tr-info', `Znalezione trasy: ${w.trasy.length}. Każda mieści się w ±8% długości treningu. To podpowiedzi – plan działa też bez trasy.`, 'ok'); dopasujMape(w.trasy[0].pts); }
      else { komunikat('tr-info', `Nie znalazłem trasy ${przec(km)} km ±8% z tego miejsca${w.blad ? ' (' + w.blad + ')' : ''}. Przesuń start o kilkaset metrów albo zmień długość.`); rysujMape(); }
      pokazPropozycje();
    } catch (e) { komunikat('tr-info', 'Nie udało się wyznaczyć tras: ' + e.message + '.'); }
    finally { b.disabled = false; }
  }
  async function pokazPogode() {
    if (mapa.z < 8) return komunikat('tr-pogoda', 'Przybliż mapę do okolicy biegu, żeby sprawdzić pogodę.', '');
    const godz = $('tr-godz').value || '17:00', od = +godz.slice(0, 2) + +godz.slice(3) / 60, doG = od + tr.x.min / 60, url = Trasy.urlPogody(mapa.lat, mapa.lon, tr.dataDnia), dzien = tr;
    try { localStorage.setItem('ipb.godzina', godz); } catch (e) { /* opcjonalne */ }
    try {
      let z = pogodaPamiec.get(url);
      if (!z || Date.now() - z.kiedy > 3 * 3600e3) { z = { tekst: await pobierzSiec(url, 'pogoda'), kiedy: Date.now(), o: teraz() }; pogodaPamiec.set(url, z); }
      if (tr !== dzien) return;
      const p = z.tekst.trim().startsWith('{') ? Trasy.pogoda(JSON.parse(z.tekst), od, doG) : null;
      if (!p) return komunikat('tr-pogoda', 'Prognoza dla tego dnia i godzin nie jest dostępna (Open-Meteo podaje ją do ok. 15 dni naprzód).', 'info');
      const s = Trasy.slonce(mapa.lat, mapa.lon, tr.dataDnia), lok = (h) => new Date(Date.parse(tr.dataDnia + 'T00:00:00Z') + h * 3600e3), hhmm = (d) => d.toTimeString().slice(0, 5);
      const koniec = new Date(new Date(`${tr.dataDnia}T${godz}:00`).getTime() + tr.x.min * 60e3), ciemno = s.zmierzch !== null && (koniec > lok(s.zmierzch) || new Date(`${tr.dataDnia}T${godz}:00`) < lok(s.swit));
      tr.pogoda = `Pogoda ${krotko(tr.dataDnia)}, ${godz}–${hhmm(koniec)}: ${p.opis}, ${p.temp}°C (odczuwalna ${p.odczuwalna}°C), opad ${przec(p.opad_mm)} mm (szansa ${p.szansa_opadu}%), wiatr ${p.wiatr} km/h z kierunku ${p.wiatr_z}, porywy do ${p.porywy} km/h.`
        + (s.zachod !== null ? ` Zachód słońca ${hhmm(lok(s.zachod))}, ciemno od ${hhmm(lok(s.zmierzch))}.` : '') + (ciemno ? ' Część biegu wypada po ciemku – weź światło albo wybierz oświetloną trasę.' : '')
        + ` Źródło: Open-Meteo, pobrano ${z.o}. To informacja, plan się przez nią nie zmienia (reguła R25).`;
      komunikat('tr-pogoda', tr.pogoda, 'info');
    } catch (e) { komunikat('tr-pogoda', 'Nie udało się pobrać pogody: ' + e.message + '.', ''); }
  }
  function drukTrasy(p) {
    const s = el('div', 'strona'), m = $('mapa').cloneNode(true), dl = Trasy.narastajaco(p.pts), wys = p.pts.map((q) => q[2] || 0), mn = Math.min(...wys), mx = Math.max(...wys);
    m.removeAttribute('id'); for (const e of m.querySelectorAll('[id]')) e.removeAttribute('id');
    { const W = $('mapa').clientWidth, H = $('mapa').clientHeight; m.style.width = W + 'px'; m.style.height = H + 'px'; m.style.zoom = Math.min(1000 / W, 370 / H).toFixed(2); }   // na kartce mapa rośnie do ok. 100 mm wysokości
    const NS = 'http://www.w3.org/2000/svg', prof = document.createElementNS(NS, 'svg'), l = document.createElementNS(NS, 'polyline');
    prof.setAttribute('class', 'profil'); prof.setAttribute('viewBox', '0 0 1000 100'); prof.setAttribute('preserveAspectRatio', 'none');
    l.setAttribute('points', p.pts.map((q, i) => `${(dl[i] / dl[dl.length - 1] * 1000).toFixed(0)},${(95 - ((q[2] || 0) - mn) / Math.max(1, mx - mn) * 90).toFixed(1)}`).join(' ')); l.setAttribute('fill', 'none'); l.setAttribute('stroke', '#000'); l.setAttribute('stroke-width', 1.5); l.setAttribute('vector-effect', 'non-scaling-stroke'); prof.append(l);
    s.append(el('h2', '', `Trasa · ${NAZWA[tr.x.typ]} · ${tr.dataDnia} · ${hm(tr.x.min)} · ${przec(dl[dl.length - 1] / 1000)} km`), el('p', '', p.dlaczego), el('p', '', tr.x.opis || ''), ...(tr.pogoda ? [el('p', '', tr.pogoda)] : []),
      m, el('p', '', `Profil wysokości: od ${Math.round(mn)} do ${Math.round(mx)} m n.p.m.`), prof, el('p', '', 'Mapa: © OpenStreetMap contributors. Trasa: BRouter. Trasa jest podpowiedzią; długość treningu z planu ma pierwszeństwo (reguła R23).'));
    drukuj([s], 'Karta trasy');
  }

  function pokazPlan() {
    const plan = dane.plan;
    zamknijTrase();
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
          const z = el('button', '', 'Na zegarek (FIT)'); z.type = 'button'; z.dataset.fit = `${t.nr}-${x.dzien}`;
          z.onclick = () => pobierz(`${Eksport.nazwaTreningu(x, dataDnia).replace(/ /g, '_')}.fit`, 'application/octet-stream', Eksport.fit(Eksport.nazwaTreningu(x, dataDnia), Eksport.kroki(x), Math.floor(Date.now() / 1000)));
          const kt = el('button', '', 'Karta treningu (PDF)'); kt.type = 'button'; kt.dataset.karta = `${t.nr}-${x.dzien}`; kt.onclick = () => drukKarty(t, x, dataDnia);
          const mp = el('button', '', (dane.trasy || {})[dataDnia] ? 'Trasa i pogoda (zapisana)' : 'Trasa i pogoda'); mp.type = 'button'; mp.dataset.trasa = `${t.nr}-${x.dzien}`; mp.onclick = () => otworzTrase(w, t, x, dataDnia);
          const zz = el('span', 'zmiana'); zz.append(z, kt, mp); w.append(zz);
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
    stanSieci();
  }
  function zakladka(n) {
    for (const b of document.querySelectorAll('nav.zakladki button')) b.setAttribute('aria-selected', b.dataset.z === n);
    for (const d of document.querySelectorAll('[data-panel]')) d.hidden = d.dataset.panel !== n;
    if (n === 'plan') pokazPlan(); else if (n === 'dziennik') pokazDziennik(); else if (n === 'strefy') pokazStrefy(); else if (n === 'profil') pokazProfil(); else pokazZapis();
  }
  function otwarty() { widok('otwarty'); zakladka('plan'); czuwaj(); }
  function zablokuj() { zamknijTrase(); polaczenia.length = 0; pogodaPamiec.clear(); Object.assign(mapa, { lon: 19.4, lat: 52.0, z: 6 }); dek = null; dane = null; edycja = false; clearTimeout(zegar); $('haslo-otworz').value = ''; komunikat('blad-otworz', '');
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
    $('druk-plan').onclick = drukPlanu;
    $('siec-wlacz').onclick = () => ustawSiec(true);
    $('siec-przelacz').onclick = () => ustawSiec(!dane.siec);
    $('tr-zamknij').onclick = $('tr-zamknij0').onclick = zamknijTrase;
    $('tr-szukaj').onclick = szukajTras;
    $('tr-pogoda-btn').onclick = pokazPogode;
    $('tr-start').onclick = () => { Object.assign(mapa, { lon: dane.start.lon, lat: dane.start.lat, z: Math.max(mapa.z, 14) }); rysujMape(); };
    $('tr-zapamietaj').onclick = async () => { if (mapa.z < 12) return komunikat('tr-info', 'Przybliż mapę, żeby dokładnie wskazać Start.');
      dane.start = { lon: +mapa.lon.toFixed(5), lat: +mapa.lat.toFixed(5) }; await zapiszDane('zapisany punkt Start'); $('tr-start').hidden = false; komunikat('tr-info', 'Start zapisany w sejfie. To punkt orientacyjny – możesz go zmienić w każdej chwili.', 'ok'); };
    $('tr-gps').onclick = () => {
      if (!navigator.geolocation) return komunikat('tr-info', 'Ta przeglądarka nie udostępnia położenia. Ustaw start, przesuwając mapę.');
      komunikat('tr-info', 'Pytam urządzenie o położenie…', 'info');
      navigator.geolocation.getCurrentPosition((p) => { Object.assign(mapa, { lon: p.coords.longitude, lat: p.coords.latitude, z: 15 }); rysujMape(); komunikat('tr-info', 'Mapa ustawiona na Twoim położeniu. Nie zapisuję go.', 'ok'); },
        () => komunikat('tr-info', 'Nie dostałem położenia (brak zgody albo sygnału). Ustaw start, przesuwając mapę.'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    };
    for (const [id, o] of [['mapa-plus', 1], ['mapa-minus', -1]]) $(id).onclick = () => { mapa.z = Math.min(18, Math.max(3, mapa.z + o)); rysujMape(); };
    { const m = $('mapa'); let od = null;                     // przesuwanie mapy: w trakcie ruchu przesuwamy warstwy, kafelki dociągamy po puszczeniu
      m.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; od = [e.clientX, e.clientY]; m.setPointerCapture(e.pointerId); });
      m.addEventListener('pointermove', (e) => { if (od) $('mapa-warstwy').style.transform = `translate(${e.clientX - od[0]}px, ${e.clientY - od[1]}px)`; });
      const koniec = (e) => { if (!od) return; const [cx, cy] = Trasy.naPiksele(mapa.lon, mapa.lat, mapa.z), [lon, lat] = Trasy.zPikseli(cx - (e.clientX - od[0]), cy - (e.clientY - od[1]), mapa.z); od = null; mapa.lon = lon; mapa.lat = Math.max(-85, Math.min(85, lat)); rysujMape(); };
      m.addEventListener('pointerup', koniec); m.addEventListener('pointercancel', koniec); }
    $('eksport-ics').onclick = () => pobierz('plan-biegowy.ics', 'text/calendar', Eksport.ics(dane.plan, new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'));
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
    // Praca offline z serwera: service worker jest tylko w pełnej wersji strony (ma manifest), nie w pliku z dysku ani w podglądzie.
    if (document.querySelector('link[rel="manifest"]') && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(() => { $('offline-stan').textContent = 'tak – po pierwszym otwarciu strona działa bez sieci'; })
        .catch(() => { $('offline-stan').textContent = 'niedostępna na tym serwerze (wymaga https)'; });
    }
    celTyp();
    widok(koperta ? 'zamkniety' : 'start');
  }
  start();
})();
