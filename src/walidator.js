// Walidator planu: jedyne miejsce, w którym żyją reguły planu R1–R22 (opis i źródła: src/reguly.js).
// Używają go aplikacja, skill (/IPB sprawdź, /IPB oceń) i testy (tests/sprawdz_plan.py jest tylko nakładką).
// Ustalenie: {id, nazwa, poziom, tydzien, opis, dane, uzasadnienie, zrodlo, klasa, pewnosc, korekta}.
// Ustalenie mówi „plan odbiega od reguły”, nigdy „ten trening spowoduje uraz”.
const Walidator = (() => {
  const DNI = ['pn', 'wt', 'sr', 'czw', 'pt', 'sob', 'nd'];
  const NAZWA = { pn: 'poniedziałek', wt: 'wtorek', sr: 'środa', czw: 'czwartek', pt: 'piątek', sob: 'sobota', nd: 'niedziela' };
  const TYPY = new Set(['wolne', 'spokojny', 'regeneracyjny', 'marszobieg', 'dlugi', 'akcent', 'test', 'start']);
  const mocny = (d) => d.typ === 'akcent' || d.typ === 'test' || d.typ === 'start';
  const P = { DLUGI_MAX: 170, DLUGI_SYM_MAX: 180, SYM_MAX: 2, WZROST: 1.10, WZROST_MIN: 15, SKOK: 1.30, LZEJSZY: 0.88, UDZIAL_MOCNY: 0.25, STARY_WYNIK_DNI: 183 };
  const suma = (t, bezStartu) => t.dni.reduce((a, d) => a + (bezStartu && d.typ === 'start' ? 0 : d.min), 0);

  function sprawdz(profil, plan) {
    const u = [];
    const dodaj = (id, tydzien, opis, extra = {}) => { const r = REGULY[id];
      u.push({ id, nazwa: r.nazwa, poziom: extra.poziom || r.poziom, tydzien, opis, dane: extra.dane || null,
        uzasadnienie: r.uzasadnienie, zrodlo: r.zrodlo, klasa: r.klasa, pewnosc: r.pewnosc, korekta: extra.korekta || r.korekta }); };
    const tyg = plan.tygodnie || [];
    if (!tyg.length) { dodaj('R1', null, 'Plan nie ma tygodni'); return u; }

    for (const t of tyg) {                                             // R1 – format; błąd przerywa dalsze sprawdzanie
      if (!Array.isArray(t.dni) || t.dni.map((d) => d.dzien).join() !== DNI.join()) { dodaj('R1', t.nr, 'Tydzień musi mieć 7 dni w kolejności pn…nd'); return u; }
      for (const d of t.dni) {
        if (!TYPY.has(d.typ)) { dodaj('R1', t.nr, `${NAZWA[d.dzien]}: nieznany typ „${d.typ}”`); return u; }
        if (!(d.min >= 0) || !((d.mocne_min || 0) >= 0) || (d.mocne_min || 0) > d.min) { dodaj('R1', t.nr, `${NAZWA[d.dzien]}: mocne minuty poza zakresem 0…czas biegu`); return u; }
        if ((d.typ === 'wolne') !== (d.min === 0)) dodaj('R1', t.nr, `${NAZWA[d.dzien]}: „wolne” musi oznaczać 0 minut biegu`);
        if (!Array.isArray(d.dodatki)) d.dodatki = [];
      }
    }

    const zaczyna = profil.poziom === 'zaczynam', powrot = !!profil.powrot_po_przerwie;
    const h = profil.obciazenie && profil.obciazenie.h_tydz;
    const baza = h === null || h === undefined ? null : Math.round(h * 60);
    const cel = (plan.ocena_celu && plan.ocena_celu.cel_posredni) || profil.cel;
    const dlugiCel = cel.typ === 'dystans' && cel.dystans_km >= 21;
    const plaski = tyg.flatMap((t) => t.dni.map((d) => ({ nr: t.nr, d })));
    const ostatniNr = tyg[tyg.length - 1].nr;

    plaski.forEach(({ nr, d }, i) => {
      const lim = (profil.dni[d.dzien] && profil.dni[d.dzien].max_min) || 0;                // R2
      if (d.typ !== 'start' && d.min > lim) dodaj('R2', nr, lim ? `${NAZWA[d.dzien]}: ${d.min} min biegu przy limicie ${lim} min` : `${NAZWA[d.dzien]}: bieg w dniu, który w wywiadzie jest wolny`, { dane: { min: d.min, limit: lim } });
      const nast = plaski[i + 1];
      if (nast) {                                                                            // R3, R16 (skoki)
        const para = `${NAZWA[d.dzien]} i ${NAZWA[nast.d.dzien]}`;
        if (mocny(d) && mocny(nast.d)) dodaj('R3', nast.nr, `Dwa mocne dni pod rząd: ${para}`);
        else if (mocny(d) && nast.d.typ === 'dlugi') dodaj('R3', nast.nr, `Długi bieg dzień po mocnym treningu: ${para}`, { korekta: 'Przenieś długi bieg albo mocny trening o jeden dzień.' });
        else if (d.typ === 'dlugi' && mocny(nast.d)) dodaj('R3', nast.nr, `Mocny trening dzień po długim biegu: ${para}`, { korekta: 'Po długim biegu zaplanuj dzień wolny albo spokojny.' });
        if (d.dodatki.includes('plyometria') && mocny(nast.d)) dodaj('R16', nr, `Skoki (plyometria) dzień przed mocnym treningiem: ${para}`);
      }
      if (d.dodatki.includes('plyometria')) {
        if (nr === ostatniNr && cel.typ === 'dystans') dodaj('R16', nr, `${NAZWA[d.dzien]}: skoki w tygodniu startu`);
        if (zaczyna && nr <= 4) dodaj('R16', nr, `${NAZWA[d.dzien]}: skoki u początkującego w pierwszych 4 tygodniach`);
      }
      if (['spokojny', 'regeneracyjny', 'marszobieg', 'dlugi', 'akcent'].includes(d.typ) && !d.cel_tetno && !d.cel_tempo) dodaj('R17', nr, `${NAZWA[d.dzien]}: bieg bez celu tętna ani tempa`);
      if (d.typ === 'start' && profil.cel.czas && nr === ostatniNr && !d.cel_tempo) dodaj('R17', nr, `${NAZWA[d.dzien]}: start bez tempa docelowego`);
      for (const k of ['cel_tetno', 'cel_tempo']) { const z = d[k]; if (z && z.od && z.do && z.od > z.do) dodaj('R17', nr, `${NAZWA[d.dzien]}: odwrócony zakres celu`); }
    });

    let sym = 0;                                                                             // R4
    for (const { nr, d } of plaski) {
      if (d.typ !== 'dlugi') continue;
      if (d.symulacja) { sym++; if (d.min > P.DLUGI_SYM_MAX) dodaj('R4', nr, `Symulacja startu ${d.min} min (limit ${P.DLUGI_SYM_MAX})`, { dane: { min: d.min } }); }
      else if (d.min > P.DLUGI_MAX) dodaj('R4', nr, `Długi bieg ${d.min} min (limit ${P.DLUGI_MAX})`, { dane: { min: d.min } });
    }
    if (sym > P.SYM_MAX) dodaj('R4', null, `${sym} symulacje startu (limit ${P.SYM_MAX})`);

    const sumy = tyg.map((t) => suma(t));
    const sumy5 = [...sumy.slice(0, -1), suma(tyg[tyg.length - 1], true)];                   // R5: start docelowy nie liczy się
    sumy5.forEach((s, i) => {
      const poprz = [...sumy5.slice(Math.max(0, i - 3), i), ...(i < 3 && baza !== null ? [baza] : [])];
      if (!poprz.length) return;
      const ref = Math.max(...poprz), wolno = Math.max(ref * P.WZROST, ref + P.WZROST_MIN);
      if (s > wolno + 0.5) dodaj('R5', tyg[i].nr, `Tydzień ma ${s} min; z poprzednich wynika najwyżej ${Math.round(wolno)} min`,
        { dane: { min: s, odniesienie: ref }, poziom: s > Math.max(ref * P.SKOK, ref + 2 * P.WZROST_MIN) ? 'zastrzezenie' : undefined });
    });

    const lzej = sumy.map((s, i) => i > 0 && s <= P.LZEJSZY * sumy[i - 1] + 0.5);            // R6
    for (let i = 0; i + 4 < sumy.length; i++) if (!lzej.slice(i, i + 5).some(Boolean)) dodaj('R6', tyg[i].nr, `Tygodnie ${tyg[i].nr}–${tyg[i + 4].nr}: brak lżejszego tygodnia`);

    tyg.forEach((t, i) => {
      const s = sumy[i], ostatni = i === tyg.length - 1;
      const m = t.dni.reduce((a, d) => a + (d.typ === 'start' ? 0 : d.mocne_min || 0), 0);   // R7
      if (s && m > P.UDZIAL_MOCNY * s + 0.5) dodaj('R7', t.nr, `Dużo mocnego biegania: ${m} z ${s} min`, { dane: { mocne: m, razem: s } });
      const wolne = t.dni.filter((d) => d.typ === 'wolne').length;
      if (zaczyna && wolne < 2) dodaj('R8', t.nr, 'Mniej niż dwa dni wolne w tygodniu');      // R8
      else if (!zaczyna && wolne < 1 && s) dodaj('R19', t.nr, 'Tydzień bez dnia wolnego');    // R19
      if (dlugiCel && !zaczyna && !ostatni && s && !t.dni.some((d) => d.typ === 'dlugi' || ((d.typ === 'start' || d.typ === 'test') && d.min >= 90)))
        dodaj('R15', t.nr, 'W tym tygodniu nie ma długiego biegu');                           // R15
      if (!ostatni && s && !t.dni.some((d) => d.dodatki.includes('sila'))) dodaj('R18', t.nr, 'W tym tygodniu nie ma ćwiczeń siłowych');   // R18
    });

    if (zaczyna) {                                                                           // R9
      for (const { nr, d } of plaski) if (nr <= 8 && d.typ === 'akcent') dodaj('R9', nr, `${NAZWA[d.dzien]}: akcent u początkującego w pierwszych 8 tygodniach`);
      if (baza !== null && h < 1.5 && !tyg[0].dni.some((d) => d.typ === 'marszobieg')) dodaj('R9', tyg[0].nr, 'Pierwszy tydzień bez marszobiegu');
    }
    if (powrot) {                                                                            // R10
      for (const { nr, d } of plaski) if (nr <= 2 && mocny(d)) dodaj('R10', nr, `${NAZWA[d.dzien]}: mocny dzień w dwóch pierwszych tygodniach powrotu`);
      if (baza !== null && sumy[0] > baza) dodaj('R10', tyg[0].nr, `Pierwszy tydzień ma ${sumy[0]} min przy obecnym obciążeniu ${baza} min`);
    }
    if (!zaczyna && !powrot && !(profil.hrmax && profil.lthr) && !plaski.some(({ nr, d }) => nr <= 4 && d.typ === 'test'))
      dodaj('R11', null, 'Brakuje testu tętna w pierwszych 4 tygodniach');                    // R11

    const oc = plan.ocena_celu || {}, wzor = Prognoza.ocena(profil);                         // R12
    if (!['realny', 'ambitny', 'nierealny'].includes(oc.status)) dodaj('R12', null, 'Plan nie podaje oceny celu (realny, ambitny, nierealny)');
    else {
      if (wzor.prognoza && !oc.prognoza) dodaj('R12', null, 'Plan nie podaje prognozy, choć jest wynik do jej policzenia');
      if (wzor.status === 'nierealny' && (oc.status !== 'nierealny' || !oc.cel_posredni)) dodaj('R12', null, `Cel jest wyraźnie szybszy od prognozy (${wzor.prognoza}): wymagane oznaczenie „nierealny” i cel pośredni`);
      else if (wzor.status === 'ambitny' && oc.status === 'realny') dodaj('R12', null, `Cel jest szybszy od prognozy (${wzor.prognoza}): co najmniej „ambitny”`);
      else if (wzor.prognoza && wzor.status === 'realny' && oc.status === 'nierealny') dodaj('R12', null, 'Cel zgodny z prognozą oznaczony jako „nierealny”');
    }

    if (cel.typ === 'dystans') {                                                             // R13
      if (!tyg[tyg.length - 1].dni.some((d) => d.typ === 'start')) dodaj('R13', ostatniNr, 'Ostatni tydzień nie zawiera startu docelowego', { poziom: 'zastrzezenie' });
      const szczyt = Math.max(0, ...sumy.slice(0, -1)), ost = suma(tyg[tyg.length - 1], true);
      if (dlugiCel && tyg.length >= 8 && ost > 0.7 * szczyt + 0.5) dodaj('R13', ostatniNr, `Brak taperu: ostatni tydzień ${ost} min przy szczycie ${szczyt} min`, { dane: { ostatni: ost, szczyt } });
    }
    if (dlugiCel) {                                                                          // R14
      if (!(plan.bramki && plan.bramki.length)) dodaj('R14', null, 'Plan nie ma bramek decyzyjnych');
      if (!tyg.slice(0, -3).some((t) => t.dni.some((d) => d.typ === 'test' || d.typ === 'start'))) dodaj('R14', null, 'Brak sprawdzianu wcześniej niż 3 tygodnie przed celem');
    }
    const zSila = tyg.filter((t) => t.dni.some((d) => d.dodatki.includes('sila'))).length;   // R16 (siła w planie)
    if (zSila < Math.floor(0.75 * tyg.length)) dodaj('R16', null, `Siła tylko w ${zSila} z ${tyg.length} tygodni`);

    for (const { nr, d } of plaski) if (d.min && d.typ !== 'wolne' && !d.po_co) { dodaj('R21', nr, `${NAZWA[d.dzien]}: bieg bez podanego celu („po co”)`); break; }   // R21: jedno ustalenie na plan

    let z2 = 0, z3 = 0, razem = 0;                                                           // R22: opis rozkładu, czas w strefie, start pominięty
    for (const { d } of plaski) { if (d.typ === 'start') continue; razem += d.min; if (d.mocne_strefa === 3) z3 += d.mocne_min || 0; else z2 += d.mocne_min || 0; }
    if (razem) {
      const p2 = Math.round(100 * z2 / razem), p3 = Math.round(100 * z3 / razem), uklad = p3 > p2 ? 'spolaryzowany' : p2 > 20 ? 'progowy' : 'piramidalny';
      dodaj('R22', null, `Rozkład czasu w planie: ${100 - p2 - p3}% spokojnie, ${p2}% w okolicy progu, ${p3}% powyżej progu – układ ${uklad}`, { dane: { z1: 100 - p2 - p3, z2: p2, z3: p3, metoda: 'czas w strefie' } });
    }

    const r = Prognoza.ostatni(profil.rekordy || []);                                        // R20
    if (r && r.data && tyg[0].start && (Date.parse(tyg[0].start) - Date.parse(r.data)) / 864e5 > P.STARY_WYNIK_DNI)
      dodaj('R20', null, `Ostatni wynik (${r.data}) ma ponad 6 miesięcy – prognoza i tempa są mniej pewne`);
    return u;
  }
  return { sprawdz, P };
})();
