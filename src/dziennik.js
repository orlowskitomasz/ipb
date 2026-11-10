// Dziennik: odczyt plików z zegarka (FIT, TCX, GPX), ocena biegu, obciążenie (docs/SPEC.md sekcje 6, 7, 10).
// Z pliku zostaje tylko data, czas, dystans i tętno. Współrzędne trasy, numer zegarka i dane profilu nie są zapisywane.
const Dziennik = (() => {
  const FIT_EPOKA = 631065600;                      // 1989-12-31 UTC w sekundach Unix
  const dataLokalna = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // --- FIT: nagłówek, definicje, rekordy (20) i sesja (18); pola deweloperskie pomijane ---
  function czytajFIT(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 14 || String.fromCharCode(...u8.subarray(8, 12)) !== '.FIT') throw new Error('To nie jest plik FIT.');
    let p = u8[0];
    const koniec = Math.min(u8.length, p + dv.getUint32(4, true));
    const def = {}, probki = [], sesja = {};
    let ostTs = 0;
    const liczba = (poz, roz, le) => {
      const v = roz === 1 ? u8[poz] : roz === 2 ? dv.getUint16(poz, le) : roz === 4 ? dv.getUint32(poz, le) : null;
      return v === null || v === (roz === 1 ? 0xFF : roz === 2 ? 0xFFFF : 0xFFFFFFFF) ? null : v;
    };
    while (p < koniec) {
      const h = u8[p++];
      if (!(h & 0x80) && (h & 0x40)) {                // definicja
        const le = u8[p + 1] === 0, globalny = dv.getUint16(p + 2, le), n = u8[p + 4];
        const pola = []; p += 5;
        for (let i = 0; i < n; i++, p += 3) pola.push({ nr: u8[p], roz: u8[p + 1] });
        let dev = 0;
        if (h & 0x20) { const nd = u8[p++]; for (let i = 0; i < nd; i++, p += 3) dev += u8[p + 1]; }
        def[h & 0x0F] = { le, globalny, pola, dev };
        continue;
      }
      const skompr = !!(h & 0x80), d = def[skompr ? (h >> 5) & 3 : h & 0x0F];
      if (!d) throw new Error('Plik FIT jest uszkodzony.');
      const w = {};
      for (const f of d.pola) { if (d.globalny === 20 || d.globalny === 18) w[f.nr] = liczba(p, f.roz, d.le); p += f.roz; }
      p += d.dev;
      if (skompr) { const o = h & 0x1F; ostTs = (ostTs & ~31) + o + (o < (ostTs & 31) ? 32 : 0); w[253] = ostTs; }
      else if (w[253]) ostTs = w[253];
      if (d.globalny === 20 && w[253]) probki.push({ t: w[253], hr: w[3] ?? null, m: w[5] === null || w[5] === undefined ? null : w[5] / 100 });
      if (d.globalny === 18) Object.assign(sesja, { start: w[2], czas: w[8] ?? w[7], dystans: w[9], hr_sr: w[16], hr_max: w[17] });
    }
    if (!probki.length && !sesja.czas) throw new Error('W pliku FIT nie ma zapisu biegu.');
    const t0 = sesja.start || probki[0].t;
    return wpis(new Date((t0 + FIT_EPOKA) * 1000), probki.map((x) => ({ t: x.t - t0, hr: x.hr, m: x.m })),
      { sek: sesja.czas ? sesja.czas / 1000 : null, m: sesja.dystans ? sesja.dystans / 100 : null, hr_sr: sesja.hr_sr, hr_max: sesja.hr_max }, 'fit');
  }

  // --- TCX i GPX: proste czytanie znaczników (działa też poza przeglądarką); współrzędne służą tylko do policzenia dystansu ---
  const znacznik = (blok, nazwa) => { const m = blok.match(new RegExp(`<(?:\\w+:)?${nazwa}[^>]*>\\s*([^<]+?)\\s*<`)); return m ? m[1] : null; };
  function czytajTCX(tekst) {
    const pkt = [...tekst.matchAll(/<Trackpoint>([\s\S]*?)<\/Trackpoint>/g)].map((m) => m[1]);
    if (!pkt.length) throw new Error('W pliku TCX nie ma zapisu biegu.');
    const t0 = Date.parse(znacznik(pkt[0], 'Time'));
    return wpis(new Date(t0), pkt.map((b) => {
      const hr = b.match(/<HeartRateBpm[^>]*>\s*<Value>\s*(\d+)/), m = znacznik(b, 'DistanceMeters');
      return { t: (Date.parse(znacznik(b, 'Time')) - t0) / 1000, hr: hr ? +hr[1] : null, m: m === null ? null : +m };
    }), {}, 'tcx');
  }
  function czytajGPX(tekst) {
    const pkt = [...tekst.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g)];
    if (!pkt.length) throw new Error('W pliku GPX nie ma zapisu biegu.');
    const rad = Math.PI / 180;
    let t0 = null, m = 0, ost = null;
    const probki = pkt.map(([, atr, b]) => {
      const lat = +atr.match(/lat="([-\d.]+)"/)[1], lon = +atr.match(/lon="([-\d.]+)"/)[1], czas = znacznik(b, 'time');
      if (!czas) throw new Error('Plik GPX nie ma czasu przy punktach – to trasa, nie zapis biegu.');
      if (ost) {                                     // odległość po kuli (haversine)
        const a = Math.sin((lat - ost.lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(ost.lat * rad) * Math.sin((lon - ost.lon) * rad / 2) ** 2;
        m += 2 * 6371000 * Math.asin(Math.sqrt(a));
      }
      ost = { lat, lon }; t0 = t0 ?? Date.parse(czas);
      const hr = znacznik(b, 'hr');
      return { t: (Date.parse(czas) - t0) / 1000, hr: hr ? +hr : null, m };
    });
    return wpis(new Date(t0), probki, {}, 'gpx');
  }

  // Podsumowanie biegu. Czas ruchu: przerwy dłuższe niż 10 s nie liczą się (gdy plik nie podaje czasu sam).
  function wpis(start, probki, gotowe, zrodlo) {
    let sek = 0;
    const hr = [];                                   // [sekundy, tętno] – do stref; tylko to zostaje z przebiegu
    for (let i = 1; i < probki.length; i++) {
      const dt = probki[i].t - probki[i - 1].t; if (dt <= 0) continue;
      const krok = Math.min(dt, 10); sek += krok;
      if (probki[i].hr) hr.push([krok, probki[i].hr]);
    }
    const zHr = hr.reduce((a, [k]) => a + k, 0);
    const ostM = [...probki].reverse().find((x) => x.m !== null && x.m !== undefined);
    const m = gotowe.m ?? (ostM ? ostM.m : null);
    return { data: dataLokalna(start), zrodlo, min: Math.round((gotowe.sek ?? sek) / 60), km: m ? Math.round(m / 10) / 100 : null,
      hr_sr: gotowe.hr_sr ?? (zHr ? Math.round(hr.reduce((a, [k, v]) => a + k * v, 0) / zHr) : null),
      hr_max: gotowe.hr_max ?? (hr.length ? Math.max(...hr.map(([, v]) => v)) : null), _hr: hr };
  }

  function zPliku(nazwa, bufor) {
    const u8 = new Uint8Array(bufor), roz = nazwa.toLowerCase().split('.').pop();
    if (roz === 'fit') return czytajFIT(u8);
    const tekst = new TextDecoder().decode(u8);
    if (roz === 'tcx' || tekst.includes('<TrainingCenterDatabase')) return czytajTCX(tekst);
    if (roz === 'gpx' || tekst.includes('<gpx')) return czytajGPX(tekst);
    throw new Error('Nieznany rodzaj pliku. Obsługiwane: FIT, TCX, GPX.');
  }

  // Minuty „mocne” (od 95% tętna progowego w górę) z przebiegu tętna; po policzeniu przebieg nie jest już potrzebny.
  function zamknij(w, lthr) {
    const { _hr, ...reszta } = w;
    if (_hr && _hr.length) reszta.mocne_min = Math.round(_hr.reduce((a, [k, v]) => a + (v >= 0.95 * lthr ? k : 0), 0) / 60);
    return reszta;
  }

  // --- ocena biegu 0–10: połowa za czas zgodny z planem, połowa za właściwą intensywność ---
  function ocena(w, dzien) {
    if (!dzien || dzien.typ === 'wolne' || !dzien.min) return { pkt: null, opis: 'Bieg poza planem.' };
    const odch = Math.abs(w.min - dzien.min) / dzien.min;
    const zaCzas = 5 * Math.max(0, 1 - odch / 0.5);
    const mocny = ['akcent', 'test', 'start'].includes(dzien.typ);
    let zaMoc = null, uwaga = '';
    if (!mocny && w.hr_sr && dzien.cel_tetno && dzien.cel_tetno.do) {
      const ponad = w.hr_sr - dzien.cel_tetno.do;
      zaMoc = ponad <= 0 ? 5 : Math.max(0, 5 - ponad / 2);
      if (ponad > 0) uwaga = `Średnie tętno ${w.hr_sr} było o ${ponad} powyżej celu (${dzien.cel_tetno.do}) – następny spokojny bieg zacznij wolniej.`;
    } else if (mocny && w.mocne_min !== undefined && dzien.mocne_min && dzien.typ !== 'start') {
      const q = w.mocne_min / dzien.mocne_min;
      zaMoc = q >= 0.8 && q <= 1.4 ? 5 : q < 0.8 ? 5 * q / 0.8 : Math.max(2, 5 - (q - 1.4) * 5);
      if (q < 0.8) uwaga = `Mocnych minut wyszło ${w.mocne_min} z planowanych ${dzien.mocne_min}.`;
      else if (q > 1.4) uwaga = `Mocnych minut wyszło ${w.mocne_min} przy planie ${dzien.mocne_min} – to więcej, niż trzeba.`;
    } else if (w.odczucie) {
      zaMoc = mocny ? (w.odczucie >= 6 ? 5 : 3) : (w.odczucie <= 5 ? 5 : Math.max(1, 5 - (w.odczucie - 5) * 1.5));
      if (!mocny && w.odczucie > 5) uwaga = `Spokojny bieg z odczuciem ${w.odczucie}/10 – to za ciężko jak na ten dzień.`;
    }
    const pkt = Math.round(zaMoc === null ? zaCzas * 2 : zaCzas + zaMoc);
    const czas = odch <= 0.1 ? 'Czas zgodny z planem.' : `Czas ${w.min} min przy planie ${dzien.min} min.`;
    return { pkt, opis: `${czas} ${uwaga || (zaMoc === null ? 'Bez tętna i odczucia oceniam tylko czas.' : 'Intensywność zgodna z planem.')}`.trim() };
  }

  // --- obciążenie biegu: minuty × (intensywność)² (jak hrTSS). Intensywność z tętna, a gdy go nie ma – z odczucia. ---
  function obciazenie(w, lthr) {
    const IF = w.hr_sr ? w.hr_sr / lthr : w.odczucie ? 0.5 + 0.05 * w.odczucie : 0.75;
    return Math.round(w.min / 60 * IF * IF * 100);
  }

  // Wskaźniki na dziś: zmęczenie (7 dni), forma (42 dni), stosunek ostatnich 7 dni do średniej z 28 (ACWR) i rada.
  function wskazniki(dziennik, lthr, dzis) {
    const dzien = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5), d0 = dzien(dzis);
    const obc = {}; let pierwszy = d0;
    for (const w of dziennik) { const d = dzien(w.data); if (d > d0) continue; obc[d] = (obc[d] || 0) + obciazenie(w, lthr); pierwszy = Math.min(pierwszy, d); }
    let atl = 0, ctl = 0;
    for (let d = pierwszy; d <= d0; d++) { const x = obc[d] || 0; atl += (x - atl) / 7; ctl += (x - ctl) / 42; }
    const suma = (n) => { let s = 0; for (let d = d0 - n + 1; d <= d0; d++) s += obc[d] || 0; return s; };
    const s7 = suma(7), s28 = suma(28), dni = d0 - pierwszy + 1;
    const acwr = s28 > 0 && dni >= 21 ? s7 / (s28 / 4) : null;
    const tydz = dziennik.filter((w) => dzien(w.data) > d0 - 7 && dzien(w.data) <= d0);
    const rady = [];
    if (!dziennik.length) rady.push({ poziom: 'info', tekst: 'Dziennik jest pusty. Dodaj pierwszy bieg, a pojawi się tu obciążenie.' });
    else if (dni < 21) rady.push({ poziom: 'info', tekst: `Za mało danych na ocenę przeciążenia: jest ${dni} dni, potrzeba 3 tygodni.` });
    else if (acwr > 1.5) rady.push({ poziom: 'zle', tekst: 'Ostatni tydzień był o ponad połowę cięższy niż średnia z czterech tygodni. Najbliższy mocny trening zamień na spokojny bieg i dodaj dzień wolny.' });
    else if (acwr > 1.3) rady.push({ poziom: 'uwaga', tekst: 'Obciążenie rośnie szybko. Trzymaj się planu, nie dokładaj nic ponad niego.' });
    else if (acwr < 0.6 && s28 > 0) rady.push({ poziom: 'uwaga', tekst: 'Ostatni tydzień był dużo lżejszy niż poprzednie. Po przerwie wracaj stopniowo, nie nadrabiaj zaległych biegów.' });
    else rady.push({ poziom: 'ok', tekst: 'Obciążenie rośnie w bezpiecznym tempie.' });
    if (tydz.filter((w) => w.odczucie >= 8).length >= 2) rady.push({ poziom: 'uwaga', tekst: 'Dwa biegi w tym tygodniu oceniłeś na 8/10 lub wyżej. Jeśli to były spokojne biegi, zrób dzień wolny.' });
    return { atl: Math.round(atl), ctl: Math.round(ctl), tsb: Math.round(ctl - atl), acwr: acwr === null ? null : Math.round(acwr * 100) / 100, obc7: s7, dni, rady };
  }
  return { zPliku, zamknij, ocena, obciazenie, wskazniki, czytajFIT, czytajTCX, czytajGPX };
})();
