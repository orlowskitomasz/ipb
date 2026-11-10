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
    try { return await f(); } finally { przycisk.disabled = false; przycisk.textContent = t; }
  }

  // --- wywiad ↔ profil (format: docs/FORMAT-PLANU.md) ---
  const liczba = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
  function profilZFormularza() {
    const typ = $('f-cel-typ').value;
    const rek = $('f-rek-czas').value.trim();
    return {
      rok_urodzenia: liczba('f-rok'), plec: $('f-plec').value, masa_kg: liczba('f-masa'), wzrost_cm: liczba('f-wzrost'),
      poziom: $('f-poziom').value, powrot_po_przerwie: $('f-powrot').checked,
      obciazenie: { h_tydz: liczba('f-h') ?? 0, km_tydz: liczba('f-km') ?? 0, najdluzszy_min: liczba('f-najdl') ?? 0 },
      dni: Object.fromEntries(DNI.map((d) => [d, { max_min: liczba('f-dzien-' + d) ?? 0 }])),
      rekordy: rek ? [{ dystans_km: Number($('f-rek-dyst').value), czas: rek, data: $('f-rek-data').value || null }] : [],
      hrmax: liczba('f-hrmax'), lthr: liczba('f-lthr'),
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
    ust('f-hrmax', p.hrmax); ust('f-lthr', p.lthr);
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

  // --- widoki po otwarciu ---
  const NAZWY = { '5': '5 km', '10': '10 km', '21.0975': 'półmaraton', '42.195': 'maraton' };
  function pokazProfil() {
    const p = dane.profil, o = Prognoza.ocena(p), c = p.cel;
    const cel = c.typ === 'dystans' ? `${NAZWY[c.dystans_km] || c.dystans_km + ' km'}${c.czas ? ' w ' + c.czas : ''}` : `${c.minuty} min biegu bez przerwy`;
    const wolne = DNI.filter((d) => !p.dni[d].max_min).join(', ') || 'brak';
    const wiersze = [['Rok urodzenia', p.rok_urodzenia], ['Poziom', p.poziom + (p.powrot_po_przerwie ? ', powrót po przerwie' : '')],
      ['Obciążenie', `${p.obciazenie.h_tydz} h / ${p.obciazenie.km_tydz} km na tydzień`], ['Dni wolne', wolne],
      ['Tętno maks. / próg', `${p.hrmax ?? 'nie zmierzone'} / ${p.lthr ?? 'nie zmierzone'}`], ['Cel', cel + (c.data ? ', ' + c.data : '')]];
    $('profil-dl').replaceChildren(...wiersze.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
    $('ocena-status').textContent = o.status; $('ocena-status').className = 'status ' + o.status;
    $('ocena-prognoza').textContent = o.prognoza ? `Prognoza z rekordu: ${o.prognoza}.` : '';
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
    if (n === 'profil') pokazProfil(); else pokazZapis();
  }
  function otwarty() { widok('otwarty'); zakladka('profil'); czuwaj(); }
  function zablokuj() { dek = null; dane = null; clearTimeout(zegar); $('haslo-otworz').value = ''; komunikat('blad-otworz', '');
    if (!$('pole-kod').hidden) $('przelacz-kod').click();   // zawsze wracaj do pola hasła
    widok(koperta ? 'zamkniety' : 'start'); }
  function czuwaj() { clearTimeout(zegar); if (dek) zegar = setTimeout(zablokuj, BEZCZYNNOSC_MS); }
  async function zapiszDane(co) {
    dane.historia.push({ kiedy: new Date().toISOString().slice(0, 16).replace('T', ' '), co });
    magazyn.pisz(await Sejf.zapisz(koperta, dek, dane));
  }

  // --- zdarzenia ---
  function start() {
    koperta = magazyn.czytaj();
    for (const z of ['pointerdown', 'keydown']) addEventListener(z, czuwaj, { passive: true });
    $('zablokuj').onclick = zablokuj;
    $('f-cel-typ').onchange = celTyp;
    $('zacznij').onclick = () => { $('wywiad-tytul').textContent = 'Wywiad'; widok('wywiad'); };
    $('przyklad').onclick = () => { formularzZProfilu(PRZYKLAD); komunikat('blad-wywiad', 'Wpisano dane przykładowe – zmień je na swoje.', 'ok'); };
    $('edytuj').onclick = () => { formularzZProfilu(dane.profil); $('wywiad-tytul').textContent = 'Zmiana danych'; komunikat('blad-wywiad', ''); widok('wywiad'); };

    $('form-wywiad').onsubmit = async (e) => {
      e.preventDefault();
      const p = profilZFormularza(), blad = bladProfilu(p);
      if (blad) return komunikat('blad-wywiad', blad);
      komunikat('blad-wywiad', '');
      if (dek) { dane.profil = p; await zapiszDane('zmiana danych z wywiadu'); return otwarty(); }
      window._profilRoboczy = p; $('haslo-tytul').textContent = 'Ustaw hasło do sejfu'; widok('haslo');
    };
    $('form-haslo').onsubmit = (e) => {
      e.preventDefault();
      const h = $('haslo-nowe').value;
      if (h.length < 12) return komunikat('blad-haslo', 'Hasło musi mieć co najmniej 12 znaków. Dobrze działa kilka słów, np. zdanie, które pamiętasz.');
      if (h !== $('haslo-powt').value) return komunikat('blad-haslo', 'Oba hasła muszą być takie same.');
      komunikat('blad-haslo', '');
      return zajety($('haslo-zapisz'), async () => {
        if (dek) {                                   // zmiana hasła po otwarciu kodem odzyskiwania
          magazyn.pisz(await Sejf.zmienHaslo(koperta, dek, h)); await zapiszDane('zmiana hasła'); otwarty();
        } else {
          const pierwsze = { profil: window._profilRoboczy, historia: [{ kiedy: new Date().toISOString().slice(0, 16).replace('T', ' '), co: 'założenie sejfu' }] };
          const w = await Sejf.utworz(h, pierwsze);
          delete window._profilRoboczy; dek = w.dek; dane = pierwsze; magazyn.pisz(w.koperta);
          $('kod-odz').textContent = w.kod; $('kod-potw').checked = false; $('kod-dalej').disabled = true; widok('kod');
        }
        $('haslo-nowe').value = $('haslo-powt').value = '';
      });
    };
    $('kod-potw').onchange = () => { $('kod-dalej').disabled = !$('kod-potw').checked; };
    $('kod-dalej').onclick = () => { $('kod-odz').textContent = ''; otwarty(); };

    $('form-otworz').onsubmit = (e) => {
      e.preventDefault();
      const kodem = !$('pole-kod').hidden;
      return zajety($('otworz'), async () => {
        try {
          const w = await Sejf.otworz(koperta, kodem ? $('kod-wpisz').value : $('haslo-otworz').value, kodem ? 'kod' : 'haslo');
          dek = w.dek; dane = w.dane; komunikat('blad-otworz', ''); $('haslo-otworz').value = $('kod-wpisz').value = '';
          if (kodem) { $('haslo-tytul').textContent = 'Ustaw nowe hasło'; widok('haslo'); } else otwarty();
        } catch (err) { komunikat('blad-otworz', kodem ? 'Ten kod nie otwiera sejfu. Sprawdź, czy przepisałeś go w całości.' : 'To hasło nie otwiera sejfu. Spróbuj jeszcze raz albo użyj kodu odzyskiwania.'); }
      });
    };
    $('przelacz-kod').onclick = () => { const k = $('pole-kod').hidden; $('pole-kod').hidden = !k; $('pole-haslo').hidden = k;
      $('przelacz-kod').textContent = k ? 'Wróć do hasła' : 'Nie pamiętam hasła – użyj kodu odzyskiwania'; komunikat('blad-otworz', ''); };

    for (const b of document.querySelectorAll('nav.zakladki button')) b.onclick = () => zakladka(b.dataset.z);
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
