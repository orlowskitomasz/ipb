// Prognoza wyniku dwiema metodami i ocena celu (reguła R12, źródła w src/reguly.js).
// Riegel 1981: T2 = T1 × (D2/D1)^1,06. Daniels i Gilbert 1979: VDOT z równań kosztu tlenowego i udziału VO2max.
// VDOT to wskaźnik wyniku, nie pomiar VO2max.
const Prognoza = (() => {
  const sek = (t) => t.split(':').map(Number).reduce((a, x) => a * 60 + x, 0);
  const czas = (s) => { s = Math.round(s); const p = (n) => String(n).padStart(2, '0');
    return `${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; };
  // Liczy się ostatni wynik (najnowsza data), nie najlepszy w życiu: sprawdzian ma zmieniać prognozę w obie strony.
  const ostatni = (rekordy) => rekordy.reduce((n, r) => (!n || (r.data || '') > (n.data || '') ? r : n), null);
  const riegel = (rekordy, km) => { const r = ostatni(rekordy); return r ? sek(r.czas) * (km / r.dystans_km) ** 1.06 : null; };

  // --- Daniels i Gilbert: v w m/min, t w minutach ---
  const koszt = (v) => -4.60 + 0.182258 * v + 0.000104 * v * v;
  const udzial = (t) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  const vdot = (km, s) => koszt(km * 1000 / (s / 60)) / udzial(s / 60);
  function czasVdot(V, km) {                          // sekundy na dystansie przy danym VDOT (bisekcja; VDOT maleje z czasem)
    let a = km * 120, b = km * 900;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (vdot(km, m) > V) a = m; else b = m; }
    return (a + b) / 2;
  }
  function tempoPrzy(V, u) {                          // s/km przy ułamku u wartości VDOT (odwrócenie równania kosztu)
    const A = 0.000104, B = 0.182258, C = -(4.60 + u * V);
    return 60000 / ((-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A));
  }

  // Obie prognozy na dystans; przedział od szybszej do wolniejszej.
  function prognozy(rekordy, km) {
    const r = ostatni(rekordy || []); if (!r) return null;
    const t1 = sek(r.czas), R = t1 * (km / r.dystans_km) ** 1.06, V = vdot(r.dystans_km, t1), D = czasVdot(V, km);
    return { riegel: R, daniels: D, vdot: Math.round(V * 10) / 10, od: Math.min(R, D), do: Math.max(R, D), wynik: r };
  }

  // Status wyniku względem dnia „dzis”: brak | aktualny | nieaktualny (ponad 6 miesięcy) | bez daty.
  function statusWyniku(r, dzis) {
    if (!r) return 'brak';
    if (!r.data) return 'bez daty';
    return dzis && (Date.parse(dzis) - Date.parse(r.data)) / 864e5 > 183 ? 'nieaktualny' : 'aktualny';
  }

  // Ocena celu: status, prognoza jako przedział z dwóch metod, pewność i zastrzeżenia. Niczego nie zmyśla: bez wyniku nie ma prognozy.
  function ocena(profil, dzis) {
    const c = profil.cel, r = ostatni(profil.rekordy || []), st = statusWyniku(r, dzis);
    const p = c.typ === 'dystans' && c.czas ? prognozy(profil.rekordy, c.dystans_km) : null;
    if (!p) return { status: 'realny', prognoza: null, pewnosc: 'niska', zastrzezenia: r ? [] : ['Brak wyniku: cel nie jest oceniony, a plan nie podaje temp.'],
      uzasadnienie: 'Brak wyniku do prognozy – cel zostanie sprawdzony pierwszym sprawdzianem.' };
    const zastrzezenia = [];
    if (st === 'nieaktualny') zastrzezenia.push('Ostatni wynik ma ponad 6 miesięcy – prognoza może nie odpowiadać obecnej formie.');
    if (st === 'bez daty') zastrzezenia.push('Ostatni wynik nie ma daty – nie wiadomo, czy jest aktualny.');
    if (c.dystans_km >= 42 && p.wynik.dystans_km < 21.5) zastrzezenia.push('Prognoza maratonu z krótszego dystansu bywa u amatorów zbyt optymistyczna.');
    const wspolne = { prognoza: `${czas(p.od)}–${czas(p.do)}`, prognoza_od: Math.round(p.od), prognoza_do: Math.round(p.do), vdot: p.vdot,
      metody: ['Riegel', 'VDOT (Daniels–Gilbert)'], pewnosc: st === 'aktualny' ? 'srednia' : 'niska', zastrzezenia };
    const metody = `Riegel ${czas(p.riegel)}, VDOT ${p.vdot} → ${czas(p.daniels)}.`;
    const q = sek(c.czas) / p.od, proc = Math.round(100 * Math.abs(1 - q));     // porównanie z szybszą z prognoz
    const srodek = czas(Math.ceil(p.od / 60) * 60);                              // cel pośredni: szybsza prognoza zaokrąglona w górę do minuty
    if (q < 0.93) return { status: 'nierealny', ...wspolne, cel_posredni: { ...c, czas: srodek },
      uzasadnienie: `Cel jest o ${proc}% szybszy od szybszej z dwóch prognoz. ${metody} Proponowany cel pośredni: ${srodek}.` };
    if (q < 0.98) return { status: 'ambitny', ...wspolne, uzasadnienie: `Cel jest o ${proc}% szybszy od prognozy – wymaga postępu, sprawdzą go sprawdziany. ${metody}` };
    return { status: 'realny', ...wspolne, uzasadnienie: `Cel mieści się w prognozie. ${metody}` };
  }
  return { sek, czas, riegel, ostatni, vdot, czasVdot, tempoPrzy, prognozy, statusWyniku, ocena };
})();
