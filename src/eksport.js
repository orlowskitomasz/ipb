// Eksport planu: kalendarz (ICS) i trening strukturalny na zegarek (FIT). Krok 5 budowy.
// Zgodnie z docs/METODYKA.md sekcja 8 eksport przenosi cel dnia (tętno lub tempo) i uzasadnienie, nie same minuty.
// Pliki powstają w przeglądarce; nic nie jest wysyłane.
const Eksport = (() => {
  const NAZWA = { spokojny: 'Spokojny bieg', regeneracyjny: 'Bardzo lekki bieg', marszobieg: 'Marszobieg', dlugi: 'Długi bieg', akcent: 'Mocny trening', test: 'Sprawdzian', start: 'Start' };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const celTekst = (d) => [d.cel_tetno ? (d.cel_tetno.od && d.cel_tetno.do ? `tętno ${d.cel_tetno.od}–${d.cel_tetno.do}` : d.cel_tetno.do ? `tętno do ${d.cel_tetno.do}` : `tętno powyżej ${d.cel_tetno.od}`) : '',
    d.cel_tempo ? `tempo ${mmss(d.cel_tempo.od)}–${mmss(d.cel_tempo.do)}/km` : ''].filter(Boolean).join(', ');

  // --- kroki treningu: rozgrzewka, odcinki z powtórzeniami, schłodzenie ---
  const ROZGRZEWKA_S = 12 * 60;
  function kroki(d) {
    const lekko = d.cel_tetno && d.cel_tetno.do && !d.cel_tetno.od ? { tetno: d.cel_tetno } : null;
    const cel = d.cel_tempo && (d.rodzaj === 'cel' || d.typ === 'start') ? { tempo: d.cel_tempo } : d.cel_tetno ? { tetno: d.cel_tetno } : d.cel_tempo ? { tempo: d.cel_tempo } : null;
    const krok = (nazwa, rola, ile, c) => ({ nazwa, rola, ...(ile.m ? { dystans_m: ile.m } : ile.s ? { czas_s: ile.s } : { otwarty: true }), cel: c || null });
    if (d.typ === 'start') return [krok('Start', 'praca', {}, cel)];
    const q = d.interwaly;
    if (d.typ === 'marszobieg' && q) return [krok('Bieg', 'praca', { s: q.praca_s }, lekko), krok('Marsz', 'przerwa', { s: q.przerwa_s }), { powtorz_od: 0, razy: q.n }];
    if (!(d.typ === 'akcent' || d.typ === 'test') || !d.min) return [krok(NAZWA[d.typ] || 'Bieg', 'praca', { s: d.min * 60 }, cel)];
    const praca = q ? (q.praca_m ? { m: q.praca_m } : { s: q.praca_s }) : { s: Math.max(60, (d.mocne_min || 10) * 60) };
    const k = [krok('Rozgrzewka', 'rozgrzewka', { s: Math.min(ROZGRZEWKA_S, Math.round(d.min * 60 / 3)) })];
    k.push(krok(d.typ === 'test' ? 'Sprawdzian' : 'Odcinek', 'praca', praca, d.typ === 'test' ? null : cel));
    if (q && q.n > 1) {
      k.push(krok('Przerwa', 'przerwa', q.przerwa_m ? { m: q.przerwa_m } : { s: q.przerwa_s || 60 }));
      k.push({ powtorz_od: 1, razy: q.n });
    }
    k.push(krok('Schłodzenie', 'schlodzenie', {}));            // do końca czasu: krok otwarty, kończy go biegacz
    return k;
  }

  // --- ICS: jedno wydarzenie całodniowe na każdy bieg ---
  const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const zawin = (linia) => { const w = []; let x = linia; while (x.length > 60) { w.push(x.slice(0, 60)); x = ' ' + x.slice(60); } w.push(x); return w.join('\r\n'); };  // 60 znaków ≤ 75 bajtów także z polskimi literami
  const dzienPlus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  function ics(plan, stempel) {
    const w = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IPB//Indywidualny Plan Biegowy//PL', 'CALSCALE:GREGORIAN'];
    for (const t of plan.tygodnie) t.dni.forEach((d, i) => {
      if (!d.min) return;
      const opis = [d.opis, celTekst(d) ? `Cel: ${celTekst(d)}.` : '', d.po_co ? `Po co: ${d.po_co}` : '', d.dlaczego_teraz || '', d.latwiej ? `Łatwiejszy wariant: ${d.latwiej}` : ''].filter(Boolean).join('\n');
      w.push('BEGIN:VEVENT', `UID:ipb-${dzienPlus(t.start, i)}@ipb.local`, `DTSTAMP:${stempel}`, `DTSTART;VALUE=DATE:${dzienPlus(t.start, i)}`, `DTEND;VALUE=DATE:${dzienPlus(t.start, i + 1)}`,
        zawin(`SUMMARY:${esc(`${NAZWA[d.typ]} ${d.min} min`)}`), zawin(`DESCRIPTION:${esc(opis)}`), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    });
    w.push('END:VCALENDAR');
    return w.join('\r\n') + '\r\n';
  }

  // --- FIT: plik treningu (file_id, workout, workout_step) ---
  const CRC_T = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
  function crc16(bajty, od, ile) {
    let c = 0;
    for (let i = od; i < od + ile; i++) for (const p of [bajty[i] & 0xF, bajty[i] >> 4]) { const t = CRC_T[c & 0xF]; c = ((c >> 4) & 0x0FFF) ^ t ^ CRC_T[p]; }
    return c;
  }
  const ascii = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^\x20-\x7e]/g, '');   // nazwy na zegarku bez polskich znaków
  function fit(nazwa, lista, terazUnix) {
    const b = [];
    const u8 = (v) => b.push(v & 0xFF), u16 = (v) => b.push(v & 0xFF, (v >> 8) & 0xFF), u32 = (v) => { v = v >>> 0; b.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, v >>> 24); };
    const str = (t, n) => { const s = ascii(t).slice(0, n - 1); for (let i = 0; i < n; i++) b.push(i < s.length ? s.charCodeAt(i) : 0); };
    const def = (lok, glob, pola) => { u8(0x40 | lok); u8(0); u8(0); u16(glob); u8(pola.length); for (const [nr, roz, typ] of pola) { u8(nr); u8(roz); u8(typ); } };
    const BRAK = 0xFFFFFFFF, ROLA = { praca: 0, przerwa: 1, rozgrzewka: 2, schlodzenie: 3 };
    for (let i = 0; i < 14; i++) b.push(0);                                   // miejsce na nagłówek
    def(0, 0, [[0, 1, 0x00], [1, 2, 0x84], [2, 2, 0x84], [3, 4, 0x8C], [4, 4, 0x86]]);            // file_id
    u8(0); u8(5); u16(255); u16(0); u32(1); u32(terazUnix - 631065600);                           // typ 5 = trening; producent 255 = własny; bez numeru urządzenia
    def(1, 26, [[4, 1, 0x00], [6, 2, 0x84], [8, 24, 0x07]]);                                      // workout: sport, liczba kroków, nazwa
    u8(1); u8(1); u16(lista.length); str(nazwa, 24);
    def(2, 27, [[254, 2, 0x84], [0, 16, 0x07], [1, 1, 0x00], [2, 4, 0x86], [3, 1, 0x00], [4, 4, 0x86], [5, 4, 0x86], [6, 4, 0x86], [7, 1, 0x00]]);
    lista.forEach((k, i) => {
      u8(2); u16(i);
      if (k.razy) { str('', 16); u8(6); u32(k.powtorz_od); u8(0xFF); u32(k.razy); u32(BRAK); u32(BRAK); u8(0xFF); return; }   // powtórz od kroku N, k.razy razy
      str(k.nazwa, 16);
      if (k.dystans_m) { u8(1); u32(k.dystans_m * 100); } else if (k.czas_s) { u8(0); u32(k.czas_s * 1000); } else { u8(5); u32(BRAK); }   // dystans w cm, czas w ms, otwarty
      const c = k.cel;
      if (c && c.tetno) { const g = c.tetno.do || c.tetno.od + 25, d = c.tetno.od || Math.max(60, g - 30); u8(1); u32(0); u32(d + 100); u32(g + 100); }   // tętno własne: uderzenia + 100
      else if (c && c.tempo) { u8(0); u32(0); u32(Math.round(1e6 / c.tempo.do)); u32(Math.round(1e6 / c.tempo.od)); }                                // prędkość w mm/s: od wolniejszej
      else { u8(2); u32(BRAK); u32(BRAK); u32(BRAK); }
      u8(ROLA[k.rola]);
    });
    const dane = b.length - 14;
    const n = [14, 0x20, 2100 & 0xFF, 2100 >> 8, dane & 0xFF, (dane >> 8) & 0xFF, (dane >> 16) & 0xFF, dane >>> 24, 0x2E, 0x46, 0x49, 0x54];   // „.FIT”
    n.forEach((v, i) => { b[i] = v; });
    const cn = crc16(b, 0, 12); b[12] = cn & 0xFF; b[13] = cn >> 8;
    const cp = crc16(b, 0, b.length); b.push(cp & 0xFF, cp >> 8);
    return new Uint8Array(b);
  }
  const KROTKO = { spokojny: 'Spokojny', regeneracyjny: 'Lekki', marszobieg: 'Marszobieg', dlugi: 'Dlugi', akcent: 'Akcent', test: 'Sprawdzian', start: 'Start' };
  const nazwaTreningu = (d, data) => `${data.slice(5)} ${KROTKO[d.typ] || 'Bieg'} ${d.min}min`;   // do 23 znaków: tyle mieści pole nazwy
  return { kroki, ics, fit, crc16, nazwaTreningu, celTekst };
})();
