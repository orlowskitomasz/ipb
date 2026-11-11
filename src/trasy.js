// Trasy, pogoda i mapa (krok 7 budowy; docs/SPEC.md sekcja 9, reguły R23–R25).
// Jedyny moduł, który łączy się z internetem, i tylko z trzema serwerami z listy HOSTY.
// Wysyłane są wyłącznie współrzędne: punkty trasy (BRouter), obszar zaokrąglony do 0,1° i data (Open-Meteo), numery kafelków (OpenStreetMap).
const Trasy = (() => {
  const HOSTY = { trasa: 'https://brouter.de', pogoda: 'https://api.open-meteo.com', mapa: 'https://tile.openstreetmap.org' };
  const RAD = Math.PI / 180, R_ZIEMI = 6371000, TOLERANCJA = 0.08;

  // --- geometria; punkt = [lon, lat, wysokość] ---
  function odl(a, b) {
    const df = (b[1] - a[1]) * RAD, dl = (b[0] - a[0]) * RAD, s = Math.sin(df / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dl / 2) ** 2;
    return 2 * R_ZIEMI * Math.asin(Math.sqrt(s));
  }
  function przesun(p, kierunek, m) {
    const d = m / R_ZIEMI, f1 = p[1] * RAD, l1 = p[0] * RAD, k = kierunek * RAD;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(k));
    return [(l1 + Math.atan2(Math.sin(k) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2))) / RAD, f2 / RAD];
  }
  function narastajaco(pts) { const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + odl(pts[i - 1], pts[i])); return s; }
  const kratka = (p, m) => `${Math.round(p[1] * 111320 / m)}:${Math.round(p[0] * 111320 * Math.cos(p[1] * RAD) / m)}`;
  const STRONY = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function kierunek(a, b) {
    const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD), x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD);
    return STRONY[Math.round(((Math.atan2(y, x) / RAD + 360) % 360) / 45) % 8];
  }

  // --- BRouter: odpowiedź → punkty z opisem (skrzyżowania w punktach, rodzaj drogi na odcinkach) ---
  const urlTrasy = (punkty) => `${HOSTY.trasa}/brouter?lonlats=${punkty.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join('|')}&profile=trekking&alternativeidx=0&format=geojson`;
  const tagi = (t) => Object.fromEntries(String(t || '').split(' ').filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
  const PRZEJSCIA = ['uncontrolled', 'zebra', 'marked', 'unmarked', 'island', 'yes'];
  function wagaWezla(n) {
    if (n.highway === 'traffic_signals' || n.crossing === 'traffic_signals') return 2;
    if (n.railway === 'level_crossing' || n.railway === 'crossing') return 1.5;
    if (n.estimated_crossing_class !== undefined) return +n.estimated_crossing_class >= 1 ? 2 : 1;
    if (n.highway === 'crossing' || PRZEJSCIA.includes(n.crossing)) return 1;
    return 0;
  }
  const wagaDrogi = (w) => (w.footway === 'crossing' || w.cycleway === 'crossing' || w.path === 'crossing' ? (w.crossing === 'traffic_signals' ? 2 : 1) : 0);
  const SCIEZKI = ['footway', 'cycleway', 'path', 'pedestrian', 'track', 'bridleway'], GLOWNE = ['primary', 'secondary', 'trunk', 'primary_link', 'secondary_link', 'trunk_link'];
  function czytajBrouter(json) {
    const f = json && json.features && json.features[0];
    if (!f || !f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length < 2) throw new Error('serwer tras zwrócił odpowiedź bez trasy');
    const pts = f.geometry.coordinates.map((c) => [c[0], c[1], c[2] || 0]), s = narastajaco(pts), dl = s[s.length - 1];
    const skrz = new Array(pts.length).fill(0), droga = new Array(pts.length).fill(null);     // droga[i] opisuje odcinek i → i+1
    const m = f.properties && f.properties.messages;
    let maTagi = false, maOtoczenie = false;
    if (m && m.length > 1) {
      const k = Object.fromEntries(m[0].map((n, i) => [n, i]));
      maTagi = k.NodeTags !== undefined;
      const suma = m.slice(1).reduce((a, w) => a + (+w[k.Distance] || 0), 0) || 1;
      let przed = 0, j = 0;
      for (const w of m.slice(1)) {
        const po = przed + (+w[k.Distance] || 0) * dl / suma, wt = tagi(w[k.WayTags]), nt = tagi(k.NodeTags !== undefined ? w[k.NodeTags] : '');
        const zielen = Math.max(+wt.estimated_forest_class || 0, +wt.estimated_river_class || 0) >= 3, miasto = Math.max(+wt.estimated_town_class || 0, +wt.estimated_noise_class || 0) >= 4;
        if (wt.estimated_forest_class !== undefined || wt.estimated_town_class !== undefined) maOtoczenie = true;
        const opis = { sciezka: SCIEZKI.includes(wt.highway), glowna: GLOWNE.includes(wt.highway), schody: wt.highway === 'steps', zielen, miasto };
        const pierwszy = j;
        while (j < pts.length - 1 && (s[j] + s[j + 1]) / 2 <= po) droga[j++] = opis;
        const tu = Math.min(pts.length - 1, j);
        // węzeł z tagami: najbliższy punkt geometrii w oknie ±40 punktów wokół miejsca wynikającego z dystansu
        const wn = wagaWezla(nt), wd = wagaDrogi(wt);
        if (wn) {
          const cel = [+w[k.Longitude] / 1e6, +w[k.Latitude] / 1e6]; let naj = tu, d0 = Infinity;
          for (let i = Math.max(0, tu - 40); i <= Math.min(pts.length - 1, tu + 40); i++) { const d = odl(pts[i], cel); if (d < d0) { d0 = d; naj = i; } }
          skrz[naj] = Math.max(skrz[naj], wn);
        }
        if (wd) { const sr = Math.min(pts.length - 1, Math.round((pierwszy + tu) / 2)); skrz[sr] = Math.max(skrz[sr], wd); }
        przed = po;
      }
      for (let i = 0; i < pts.length - 1; i++) if (!droga[i]) droga[i] = droga[i - 1] || null;
    }
    return { pts, skrz, droga, maTagi, maOtoczenie };
  }

  // --- sprzątanie i miary ---
  // Ślepa odnoga: trasa dobiega do punktu pośredniego i wraca tą samą drogą (do 1,2 km w jedną stronę) – wycinamy przed liczeniem długości.
  function wytnijOdnogi(t) {
    const { pts } = t, s = narastajaco(pts), zostaw = new Array(pts.length).fill(true);
    const wPoblizu = (d) => { let j = 1; while (j < s.length - 1 && s[j] < d) j++; const u = s[j] > s[j - 1] ? (d - s[j - 1]) / (s[j] - s[j - 1]) : 0; return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * u, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * u]; };
    for (let i = 0; i < pts.length - 2; i++) {
      let j = -1;
      for (let x = i + 2; x < pts.length && s[x] - s[i] <= 2400; x++) if (s[x] - s[i] > 60 && odl(pts[i], pts[x]) < 20) j = x;
      if (j < 0) continue;
      const d = s[j] - s[i];
      if (odl(wPoblizu(s[i] + d / 4), wPoblizu(s[i] + 3 * d / 4)) > 25) continue;        // prawdziwa mała pętla, nie odnoga
      for (let x = i + 1; x <= j; x++) zostaw[x] = false;
      i = j;
    }
    const f = (a) => a.filter((_, i) => zostaw[i]);
    return { ...t, pts: f(pts), skrz: f(t.skrz), droga: f(t.droga) };
  }
  function probki(pts, co) {                                  // punkty co `co` metrów po trasie
    const s = narastajaco(pts), w = []; let j = 0;
    for (let d = 0; d <= s[s.length - 1]; d += co) {
      while (j < pts.length - 2 && s[j + 1] < d) j++;
      const u = s[j + 1] > s[j] ? (d - s[j]) / (s[j + 1] - s[j]) : 0;
      w.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u]);
    }
    return w;
  }
  function powtorzenia(pts) {                                 // udział trasy biegnący drugi raz tą samą drogą
    const p = probki(pts, 20), siatka = new Map();
    p.forEach((q, i) => { const k = kratka(q, 20); if (!siatka.has(k)) siatka.set(k, []); siatka.get(k).push(i); });
    let ile = 0;
    p.forEach((q, i) => {
      const y = Math.round(q[1] * 111320 / 20), x = Math.round(q[0] * 111320 * Math.cos(q[1] * RAD) / 20);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of siatka.get(`${y + a}:${x + b}`) || []) if (Math.abs(o - i) * 20 >= 300 && odl(q, p[o]) < 20) { ile++; return; }
    });
    return p.length ? ile / p.length : 0;
  }
  // Miary całej trasy i części głównej (odcinki, test, tempo), jeśli podano jej położenie w metrach od startu.
  function miary(t, glowna) {
    const { pts } = t, s = narastajaco(pts), dl = s[s.length - 1];
    let gora = 0, m = { sciezka: 0, glowna: 0, zielen: 0, miasto: 0 }, schody = 0, opisane = 0, ulG = 0, dlG = 0, minG = Infinity, maxG = -Infinity;
    const wG = (i) => glowna && s[i] >= glowna.od && s[i] <= glowna.do;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = s[i + 1] - s[i], o = t.droga[i];
      if (pts[i + 1][2] > pts[i][2]) gora += pts[i + 1][2] - pts[i][2];
      if (o) { opisane += d; for (const k in m) if (o[k]) m[k] += d; if (o.schody && !(t.droga[i - 1] && t.droga[i - 1].schody)) schody++; }
      if (wG(i)) { dlG += d; if (o && !o.sciezka) ulG += d; minG = Math.min(minG, pts[i][2]); maxG = Math.max(maxG, pts[i][2]); }
    }
    // dwa oznaczenia bliżej niż 30 m po trasie to jedno skrzyżowanie (zostaje wyższa waga)
    const lista = []; t.skrz.forEach((w, i) => { if (!w) return; const p = lista[lista.length - 1]; if (p && s[i] - p.m < 30) p.w = Math.max(p.w, w); else lista.push({ m: s[i], w }); });
    const wGl = lista.filter((x) => glowna && x.m >= glowna.od && x.m <= glowna.do);
    const u = (x) => (opisane ? x / opisane : 0);
    return { dl, gora: Math.round(gora), skrzyzowania: lista.length, wagaSkrz: lista.reduce((a, x) => a + x.w, 0), sciezki: u(m.sciezka), glowne: u(m.glowna), zielen: u(m.zielen), miasto: u(m.miasto), schody,
      powt: powtorzenia(pts), glowna: glowna ? { skrzyzowania: wGl.length, waga: wGl.reduce((a, x) => a + x.w, 0), roznica: dlG ? Math.round(maxG - minG) : 0, ulice: dlG ? ulG / dlG : 0 } : null };
  }
  function ocena(t, m, cel) {                                  // start 100 pkt, kary; wagi z planowania tras, do strojenia
    const km = m.dl / 1000, odch = Math.abs(m.dl - cel) / cel; let p = 100;
    if (odch > 0.04) p -= (odch - 0.04) * 220;
    p -= (m.gora / km) * (m.glowna ? 2.4 : 1.2);
    p -= (1 - m.sciezki) * 12 + m.glowne * 28 + m.schody * 8;
    if (t.maTagi) p -= (m.wagaSkrz / km) * 9;
    p -= m.powt * 32;
    if (m.glowna) p -= m.glowna.waga * 12 + m.glowna.roznica * 2.5 + m.glowna.ulice * 30;
    if (t.maOtoczenie) p -= m.miasto * 28 + (1 - m.zielen) * 14;
    return Math.round(p);
  }
  function dlaczego(t, m, start) {
    const w = [`${(m.dl / 1000).toFixed(1).replace('.', ',')} km`];
    w.push(t.maTagi ? `skrzyżowania i przejścia: ${m.skrzyzowania}${m.glowna ? ` (w części głównej: ${m.glowna.skrzyzowania})` : ''}` : 'brak danych o skrzyżowaniach');
    if (t.maOtoczenie) w.push(`zieleń ${Math.round(m.zielen * 100)}%`);
    w.push(m.powt < 0.05 ? 'pętla bez powtórzeń' : `${Math.round(m.powt * 100)}% tą samą drogą`, `${m.gora} m w górę`, `${Math.round(m.sciezki * 100)}% ścieżkami`);
    const d = odl(start, t.pts[0]); if (d > 150) w.push(`początek ${(d / 1000).toFixed(1).replace('.', ',')} km na ${kierunek(start, t.pts[0])} od Startu`);
    return w.join(' · ');
  }
  const odwroc = (t) => { const pts = [...t.pts].reverse(), skrz = [...t.skrz].reverse(), droga = t.droga.slice(0, -1).reverse(); droga.push(null); return { ...t, pts, skrz, droga }; };

  // --- szukanie: pętle w 8 kierunkach (pięciokąt i trójkąt na przemian), zapasowo tam i z powrotem ---
  const OBWOD = { kolo: 10 * Math.sin(36 * RAD), trojkat: 2 + 2 * Math.sin(50 * RAD) };
  function ksztalt(rodzaj, start, kier, r) {
    if (rodzaj === 'trojkat') return [start, przesun(start, kier - 50, r), przesun(start, kier + 50, r), start];
    if (rodzaj === 'powrot') return [start, przesun(start, kier, r), start];
    const c = przesun(start, kier, r);
    return [start, ...[1, 2, 3, 4].map((i) => przesun(c, kier + 180 + 72 * i, r)), start];
  }
  // pobierz(url, co) → tekst odpowiedzi; rzuca błąd przy braku sieci. Zapytania idą po kolei – to serwer społecznościowy.
  async function szukaj({ start, km, glowna, pobierz, postep }) {
    const cel = km * 1000, pamiec = new Map(), znalezione = []; let blad = '';
    const trasa = async (punkty) => {
      const url = urlTrasy(punkty);
      if (!pamiec.has(url)) {
        const tekst = await pobierz(url, 'trasa');
        if (!tekst.trim().startsWith('{')) throw new Error('serwer tras: ' + tekst.trim().slice(0, 160));
        pamiec.set(url, wytnijOdnogi(czytajBrouter(JSON.parse(tekst))));
      }
      return pamiec.get(url);
    };
    const proba = async (rodzaj, kier) => {
      let r = cel / (1.3 * (rodzaj === 'powrot' ? 2 : OBWOD[rodzaj])), naj = null;
      for (let i = 0; i < 3; i++) {
        let t; try { t = await trasa(ksztalt(rodzaj, start, kier, r)); } catch (e) { if (e.przerwij) throw e; blad = e.message; break; }   // brak drogi w tym kierunku: następny kierunek
        const dl = narastajaco(t.pts).pop(), odch = Math.abs(dl - cel) / cel;
        if (!naj || odch < naj.odch) naj = { t, odch };
        if (odch <= 0.04 || dl < 50) break;
        r *= cel / dl;
      }
      if (naj && naj.odch <= TOLERANCJA) znalezione.push({ ...naj.t, tam_i_z_powrotem: rodzaj === 'powrot' });   // R23: poza ±8% trasa nie trafia na listę
    };
    for (let i = 0; i < 8; i++) { if (postep) postep(i + 1, 8); await proba(i % 2 ? 'trojkat' : 'kolo', i * 45); }
    const petle = () => znalezione.filter((t) => !t.tam_i_z_powrotem && powtorzenia(t.pts) < 0.35).length;
    if (petle() < 2) for (const k of [0, 60, 300]) await proba('powrot', k);
    const oceniona = (t) => { const m = miary(t, glowna); return { ...t, miary: m, punkty: ocena(t, m, cel) }; };
    let lista = znalezione.map((t) => {
      const a = oceniona(t); if (!glowna) return a;
      const b = oceniona(odwroc(t)); return b.punkty > a.punkty ? b : a;                     // od kierunku zależy, gdzie wypadną odcinki
    }).sort((a, b) => b.punkty - a.punkty);
    const kratki = (t) => new Set(probki(t.pts, 40).map((p) => kratka(p, 60)));
    const wynik = [];
    for (const t of lista) {
      const k = kratki(t);
      if (wynik.some((w) => { const kw = kratki(w); let wsp = 0; for (const x of k) if (kw.has(x)) wsp++; return wsp / Math.min(k.size, kw.size) >= 0.8; })) continue;
      wynik.push({ ...t, dlaczego: dlaczego(t, t.miary, start) + (t.tam_i_z_powrotem ? ' · tam i z powrotem (zapas – za mało dobrych pętli)' : '') });
      if (wynik.length === 3) break;
    }
    return { trasy: wynik, blad };
  }

  // --- trening na trasie: gdzie w metrach wypada część główna i każdy szybki odcinek ---
  function glownaCzesc(kroki, tempoLekko, tempoMocno) {
    const dlKroku = (k) => (k.dystans_m ? k.dystans_m : (k.czas_s || 0) / (k.rola === 'praca' ? tempoMocno : tempoLekko) * 1000);
    const rozwin = []; kroki.forEach((k) => { if (k.razy) { const blok = rozwin.slice(k.powtorz_od); for (let i = 1; i < k.razy; i++) rozwin.push(...blok); } else rozwin.push(k); });
    if (!rozwin.some((k) => k.rola === 'rozgrzewka')) return null;
    let m = 0, czas = 0, czasDo = 0; const odcinki = [];
    for (const k of rozwin) {
      const d = dlKroku(k); czas += k.czas_s || d * (k.rola === 'praca' ? tempoMocno : tempoLekko) / 1000;
      if (k.rola === 'praca' && d > 0) { odcinki.push({ od: Math.round(m), do: Math.round(m + d) }); czasDo = czas; }
      m += d;
    }
    return odcinki.length ? { od: odcinki[0].od, do: odcinki[odcinki.length - 1].do, odcinki, czas_s: Math.round(czasDo) } : null;
  }
  function punktNa(pts, m) { const s = narastajaco(pts); let i = 0; while (i < s.length - 1 && s[i] < m) i++; return pts[i]; }

  // --- GPX 1.1: cały trening jako ślad, znaczniki startu i odcinków ---
  const xml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function gpx(nazwa, pts, glowna) {
    const wpt = (p, n) => `<wpt lat="${p[1].toFixed(6)}" lon="${p[0].toFixed(6)}"><name>${xml(n)}</name></wpt>`;
    const zn = [wpt(pts[0], 'Start')];
    if (glowna) glowna.odcinki.forEach((o, i) => zn.push(wpt(punktNa(pts, o.od), `Start ${i + 1}`), wpt(punktNa(pts, o.do), `Koniec ${i + 1}`)));
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="IPB" xmlns="http://www.topografix.com/GPX/1/1">\n${zn.join('\n')}\n<trk><name>${xml(nazwa)}</name><trkseg>\n`
      + pts.map((p) => `<trkpt lat="${p[1].toFixed(6)}" lon="${p[0].toFixed(6)}"><ele>${Math.round(p[2] || 0)}</ele></trkpt>`).join('\n') + '\n</trkseg></trk>\n</gpx>\n';
  }

  // --- pogoda: Open-Meteo dla godzin biegu; obszar zaokrąglony do 0,1° (ok. 10 km) ---
  const urlPogody = (lat, lon, data) => `${HOSTY.pogoda}/v1/forecast?latitude=${lat.toFixed(1)}&longitude=${lon.toFixed(1)}&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,is_day&timezone=auto&start_date=${data}&end_date=${data}`;
  const KODY = [[95, 'burza'], [71, 'śnieg'], [51, 'deszcz'], [45, 'mgła'], [3, 'pochmurno'], [1, 'częściowe zachmurzenie'], [0, 'bezchmurnie']];
  const opisKodu = (k) => (k >= 85 && k <= 86 ? 'śnieg' : k >= 80 && k <= 82 ? 'deszcz' : KODY.find(([od]) => k >= od)[1]);
  const GROZA = (k) => (k >= 95 ? 5 : (k >= 71 && k <= 77) || k === 85 || k === 86 ? 4 : k >= 51 ? 3 : k >= 45 ? 2 : k >= 1 ? 1 : 0);
  function pogoda(json, godzOd, godzDo) {                     // godziny lokalne miejsca biegu, np. 17 i 18.5
    const h = json && json.hourly; if (!h || !h.time || !h.time.length) return null;
    const idx = h.time.map((t, i) => [+t.slice(11, 13), i]).filter(([g]) => g >= Math.floor(godzOd) && g <= Math.floor(godzDo - 0.01)).map(([, i]) => i);
    if (!idx.length) return null;
    const sr = (k) => idx.reduce((a, i) => a + (h[k][i] ?? 0), 0) / idx.length, max = (k) => Math.max(...idx.map((i) => h[k][i] ?? 0));
    let x = 0, y = 0; for (const i of idx) { x += h.wind_speed_10m[i] * Math.sin(h.wind_direction_10m[i] * RAD); y += h.wind_speed_10m[i] * Math.cos(h.wind_direction_10m[i] * RAD); }   // wiatr uśredniany wektorowo
    const kod = idx.map((i) => h.weather_code[i]).sort((a, b) => GROZA(b) - GROZA(a))[0];
    return { temp: Math.round(sr('temperature_2m')), odczuwalna: Math.round(sr('apparent_temperature')), opad_mm: Math.round(idx.reduce((a, i) => a + (h.precipitation[i] || 0), 0) * 10) / 10,
      szansa_opadu: max('precipitation_probability'), wiatr: Math.round(Math.hypot(x, y) / idx.length), wiatr_z: STRONY[Math.round(((Math.atan2(x, y) / RAD + 360) % 360) / 45) % 8],
      porywy: Math.round(max('wind_gusts_10m')), opis: opisKodu(kod), noc: idx.some((i) => h.is_day[i] === 0) };
  }
  // Wschód, zachód i zmierzch cywilny (słońce 6° pod horyzontem), przybliżenie NOAA; wynik w godzinach UTC albo null (dzień lub noc polarna).
  function slonce(lat, lon, data) {
    const d = new Date(data + 'T00:00:00Z'), n = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5), g = 2 * Math.PI / 365 * (n - 1 + 0.5);
    const rownanie = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dekl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const kat = (zenit) => { const c = (Math.cos(zenit * RAD) - Math.sin(lat * RAD) * Math.sin(dekl)) / (Math.cos(lat * RAD) * Math.cos(dekl)); return Math.abs(c) > 1 ? null : Math.acos(c) / RAD; };
    const poludnie = (720 - 4 * lon - rownanie) / 60, h = kat(90.833), z = kat(96);
    return { wschod: h === null ? null : poludnie - h / 15, zachod: h === null ? null : poludnie + h / 15, swit: z === null ? null : poludnie - z / 15, zmierzch: z === null ? null : poludnie + z / 15 };
  }

  // --- mapa: położenie w pikselach świata (odwzorowanie kafelków OSM) ---
  const naPiksele = (lon, lat, z) => { const n = 256 * 2 ** z, s = Math.sin(lat * RAD); return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
  const zPikseli = (x, y, z) => { const n = 256 * 2 ** z; return [x / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) / RAD]; };
  const urlKafla = (z, x, y) => `${HOSTY.mapa}/${z}/${x}/${y}.png`;

  return { HOSTY, TOLERANCJA, odl, przesun, narastajaco, czytajBrouter, wytnijOdnogi, powtorzenia, miary, ocena, szukaj, glownaCzesc, punktNa, gpx, urlTrasy, urlPogody, pogoda, slonce, naPiksele, zPikseli, urlKafla, ksztalt };
})();
