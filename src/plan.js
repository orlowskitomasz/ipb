// Układanie planu (docs/SPEC.md sekcja 6). Wynik w formacie docs/FORMAT-PLANU.md,
// sprawdzany regułami R1–R16 przez tests/sprawdz_plan.py (tests/test_plan.py robi to dla 5 profili i losowych).
const Plan = (() => {
  const DNI = ['pn', 'wt', 'sr', 'czw', 'pt', 'sob', 'nd'];
  const DLUGI_MAX = 170, TYDZ_MS = 7 * 864e5;
  const data = (s) => new Date(s + 'T00:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const dzienTyg = (d) => (d.getUTCDay() + 6) % 7;                       // 0 = pn
  const ogr = (x, a, b) => Math.max(a, Math.min(b, x));
  const obok = (a, b) => (a - b + 7) % 7 === 1 || (b - a + 7) % 7 === 1;  // sąsiednie dni, także nd–pn
  const tempo = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  // Które dni są długie / mocne / lekkie. Mocny dzień nigdy obok długiego ani obok drugiego mocnego (R3).
  function role(profil, dzienCelu) {
    const lim = DNI.map((d) => profil.dni[d].max_min || 0);
    const biegowe = lim.map((m, i) => (m > 0 ? i : -1)).filter((i) => i >= 0);
    if (profil.poziom === 'zaczynam') {            // najwyżej 3 dni, możliwie daleko od siebie (R8)
      let naj = biegowe.slice(0, 3), ocena = -1;
      const k = Math.min(3, biegowe.length);
      const komb = (od, wyb) => {
        if (wyb.length === k) {
          const odst = Math.min(...wyb.map((d, j) => (wyb[(j + 1) % k] - d + 7) % 7 || 7));
          const o = odst * 1000 + wyb.reduce((a, d) => a + lim[d], 0);
          if (o > ocena) { ocena = o; naj = wyb; }
          return;
        }
        for (let i = od; i < biegowe.length; i++) komb(i + 1, [...wyb, biegowe[i]]);
      };
      komb(0, []);
      return { lim, lekkie: naj, dlugi: null, mocne: [], dzienTestu: naj[0] ?? null };
    }
    const ileMocnych = biegowe.length >= 5 ? 2 : biegowe.length >= 3 ? 1 : 0;
    const kandydaci = (dl) => biegowe.filter((d) => d !== dl && !obok(d, dl) && lim[d] >= 30);
    // długi: dzień z największym limitem, ale taki, żeby został dzień na mocny trening; nie w niedzielę, gdy start w poniedziałek
    const dlugi = [...biegowe].filter((d) => !(dzienCelu === 0 && d === 6) || biegowe.length === 1)
      .sort((a, b) => (kandydaci(b).length > 0) - (kandydaci(a).length > 0) || lim[b] - lim[a] || b - a)[0];
    const kand = kandydaci(dlugi).sort((a, b) => lim[b] - lim[a] || a - b);
    const mocne = [];
    if (ileMocnych >= 1 && kand.length) mocne.push(kand[0]);
    if (ileMocnych >= 2) { const m2 = kand.find((d) => d !== mocne[0] && !obok(d, mocne[0])); if (m2 !== undefined) mocne.push(m2); }
    mocne.sort((a, b) => a - b);
    for (const d of mocne) lim[d] = Math.min(lim[d], 75);   // dzień mocnego treningu: najwyżej 75 min, także gdy bywa lekki
    return { lim, dlugi, mocne, dzienTestu: mocne[0] ?? kand[0] ?? null,
      lekkie: biegowe.filter((d) => d !== dlugi && !mocne.includes(d)) };
  }

  // Rozdziel `ile` minut na dni proporcjonalnie do limitów, nie przekraczając ich; dni poniżej 15 min wypadają.
  function rozdziel(ile, dni, lim, wagi) {
    const wyn = Object.fromEntries(dni.map((d) => [d, 0]));
    const k = Math.max(1, Math.min(dni.length, Math.floor(ile / 15)));          // za mało minut na wszystkie dni → mniej dni, równo rozłożonych
    const wybrane = k === dni.length ? dni : k === 1 ? [dni[dni.length - 1]] : Array.from({ length: k }, (_, j) => dni[Math.round(j * (dni.length - 1) / (k - 1))]);
    let wolne = [...wybrane], reszta = ile;
    for (let p = 0; p < 4 && reszta > 0.5 && wolne.length; p++) {
      const suma = wolne.reduce((a, d) => a + (wagi ? wagi[d] : lim[d]), 0);
      const nast = [];
      let dano = 0;
      for (const d of wolne) {
        const x = Math.min(lim[d] - wyn[d], reszta * (wagi ? wagi[d] : lim[d]) / suma);
        wyn[d] += x; dano += x;
        if (wyn[d] < lim[d] - 0.5) nast.push(d);
      }
      reszta -= dano; wolne = nast;
    }
    for (const d of dni) { wyn[d] = Math.round(wyn[d]); if (wyn[d] < 15) wyn[d] = 0; }
    return wyn;
  }

  const AKCENTY = {
    baza: [['subprog', (m) => `sub-próg: ${ogr(Math.round(m / 6), 2, 6)} × 6 min „komfortowo mocno”, przerwa 1 min truchtu`],
           ['doprogu', (m) => `podbiegi: ${ogr(Math.round(m / 2), 6, 12)} × 1 min żwawo pod górę, powrót truchtem`],
           ['doprogu', (m) => `bieg z narastającą prędkością: ostatnie ${m} min coraz mocniej`]],
    rozwoj: [['prog', (m) => `odcinki progowe: ${Math.max(2, Math.round(m / 8))} × 8 min, przerwa 90 s truchtu`],
             ['vo2', (m) => `VO2max: ${ogr(Math.round(m / 3), 3, 6)} × 3 min mocno, przerwa 2–3 min truchtu`],
             ['prog', (m) => `bieg progowy ciągły ${m} min`]],
    specyficzna: [['cel', (m, t) => `tempo startowe: ${Math.max(2, Math.round(m / 9))} × 2 km w tempie celu${t ? ` (${t}/km)` : ''}, przerwa 2 min`],
                  ['cel', (m, t) => `zmienne tempo: ${Math.max(2, Math.round(m / 5))} × (1 km w tempie celu${t ? ` ${t}/km` : ''} + 1 km luźniej)`],
                  ['prog', (m) => `odcinki progowe: ${Math.max(2, Math.round(m / 8))} × 8 min, przerwa 90 s truchtu`]],
  };
  AKCENTY.taper = AKCENTY.specyficzna;
  const MARSZOBIEG = ['1 min biegu / 2 min marszu', '2 min biegu / 2 min marszu', '3 min biegu / 2 min marszu',
    '5 min biegu / 2 min marszu', '8 min biegu / 2 min marszu', '10 min biegu / 1 min marszu'];

  // Uzasadnienia jednostek: klasa B (praktyka trenerska) – opis celu, nie obietnica efektu.
  const PO_CO_RODZAJ = { lekki: 'Buduje wytrzymałość tlenową przy małym koszcie zmęczenia.', regeneracja: 'Rozluźnia nogi przed ważnym dniem.',
    subprog: 'Podnosi tempo, które da się utrzymać długo, przy umiarkowanym zmęczeniu.', prog: 'Przesuwa próg: szybsze tempo bez narastającego zakwaszenia.',
    vo2: 'Rozwija maksymalny pobór tlenu.', cel: 'Uczy tempa startowego i jego kosztu.', doprogu: 'Siła biegowa i technika bez długiego zakwaszenia.' };
  const PO_CO_TYP = { dlugi: 'Uczy organizm biec długo: mięśnie, ścięgna i gospodarka paliwem. Najważniejszy bieg tygodnia.', marszobieg: 'Przyzwyczaja ciało do biegu bez przeciążenia.',
    test: 'Mierzy obecną formę, żeby strefy i prognoza opierały się na pomiarze.', start: 'Twój cel.' };
  const DLACZEGO = { baza: 'Baza: rośnie objętość, akcenty są umiarkowane.', rozwoj: 'Rozwój: najmocniejsze bodźce planu, gdy baza już jest.',
    specyficzna: 'Faza pod start: treningi przypominają wysiłek startowy.', taper: 'Odpoczynek przed startem: mniej minut, ta sama intensywność.' };
  const LATWIEJ = { spokojny: 'Skróć o jedną trzecią albo zamień część na marsz.', dlugi: 'Skróć do dwóch trzecich i nie przyspieszaj.',
    akcent: 'Zrób połowę odcinków albo zamień na spokojny bieg tej samej długości.', test: 'Przełóż o 2–3 dni, jeśli jesteś zmęczony.',
    marszobieg: 'Wydłuż odcinki marszu.', regeneracyjny: 'Zamień na dzień wolny.' };

  function uloz(profil, dzis) {
    const ocena = Prognoza.ocena(profil, dzis);
    const cel = ocena.cel_posredni || profil.cel;
    const uwagi = [];
    const zaczyna = profil.poziom === 'zaczynam', powrot = !!profil.powrot_po_przerwie;
    const dystans = cel.typ === 'dystans', dlugiCel = dystans && cel.dystans_km >= 21;

    // --- kalendarz: plan zaczyna się w poniedziałek, ostatni tydzień zawiera cel ---
    let start = data(profil.start_planu || dzis);
    start = new Date(start.getTime() + ((7 - dzienTyg(start)) % 7) * 864e5);
    let n = !dystans ? 10 : cel.dystans_km >= 42 ? 18 : dlugiCel ? 14 : 12, dzienCelu = 6;
    if (cel.data) {
      const c = data(cel.data); dzienCelu = dzienTyg(c);
      n = Math.round((c.getTime() - dzienCelu * 864e5 - start.getTime()) / TYDZ_MS) + 1;
      if (n > 52) { start = new Date(start.getTime() + (n - 52) * TYDZ_MS); n = 52; uwagi.push('Do celu jest ponad rok – plan obejmuje ostatnie 52 tygodnie.'); }
      if (n < 2) { n = 2; uwagi.push('Data celu jest za blisko albo minęła – plan ułożony na 2 tygodnie od najbliższego poniedziałku.'); }
      else if (n < 8) uwagi.push('Do celu jest mniej niż 8 tygodni – plan podtrzymuje formę, na budowanie jest za mało czasu.');
    }

    const r = role(profil, dzienCelu), lim = r.lim;
    const limDl = r.dlugi === null ? 0 : Math.min(DLUGI_MAX, lim[r.dlugi]);
    const znanaBaza = profil.obciazenie.h_tydz !== null && profil.obciazenie.h_tydz !== undefined;
    const baza = znanaBaza ? Math.max(30, Math.round(profil.obciazenie.h_tydz * 60)) : 90;   // brak danych: jawne założenie startu, nie zgadywanie historii
    const uzyte = [...r.lekkie, ...r.mocne];
    let sufit = uzyte.reduce((a, d) => a + lim[d], 0) + limDl;
    if (zaczyna) sufit = Math.min(sufit, Math.max(baza * 2, 3 * (cel.minuty || 30)));
    const udzialDl = !dystans || cel.dystans_km < 21 ? 0.30 : cel.dystans_km >= 42 ? 0.34 : 0.36;
    const sekCelu = dystans && cel.czas ? Prognoza.sek(cel.czas) / cel.dystans_km : null;
    const tempoCelu = sekCelu ? tempo(sekCelu) : null;
    const strefy = Strefy.licz(profil, +String(dzis).slice(0, 4));
    const celTempa = sekCelu ? { cel_tempo: { od: Math.round(sekCelu * 0.98), do: Math.round(sekCelu * 1.02) } } : null;
    // cel dnia: tętno i/lub tempo (R17); „cel” = tempo startowe, a gdy cel nie ma czasu – próg
    const celDnia = (d, rodzaj) => Object.assign(d, { rodzaj }, rodzaj === 'cel' ? (celTempa || Strefy.cel('prog', strefy)) : Strefy.cel(rodzaj, strefy));
    const maraton = dystans && cel.dystans_km >= 42;
    if (!uzyte.length && r.dlugi === null) uwagi.push('W wywiadzie nie ma żadnego dnia na bieganie.');
    if (!znanaBaza) uwagi.push('Nie podano obecnego obciążenia. Założenie: start od 90 minut biegu na tydzień. Uzupełnij wywiad, żeby plan był dopasowany.');
    if (ocena.zastrzezenia && ocena.zastrzezenia.length) uwagi.push(`Prognoza ma niską pewność: ${ocena.zastrzezenia.join('; ')}.`);
    if (znanaBaza && !zaczyna && baza < 60) uwagi.push('Przy obciążeniu poniżej godziny na tydzień lepiej wybrać poziom „zaczynam” – plan ruszy wtedy od marszobiegu.');

    // --- tygodnie z testem (R11, R14) ---
    const testy = {};
    const mozna = (nr) => nr >= (zaczyna ? 9 : powrot ? 3 : 1) && nr <= n - 3 && r.dzienTestu !== null;   // początkujący: testy dopiero po 8 tygodniach
    if (!(profil.hrmax && profil.lthr) && !powrot && mozna(2)) testy[2] = 'tetno';
    for (const u of dlugiCel ? [0.35, 0.65] : [0.5]) {
      let nr = Math.round(u * n); while (nr % 4 === 0 || testy[nr]) nr++;
      if (mozna(nr)) testy[nr] = 'kontrolny';
    }
    const dystTestu = dlugiCel && r.dzienTestu !== null && lim[r.dzienTestu] >= 70 ? 10 : 5;
    const potrzeba = { tetno: 55, kontrolny: dystTestu === 10 ? 70 : 45 };
    const progTestu = dystans && cel.czas
      ? Prognoza.czas(Prognoza.sek(cel.czas) * (dystTestu / cel.dystans_km) ** 1.06).replace(/^0:/, '') : null;

    // --- tygodnie ---
    const tygodnie = [], sumy = [];
    const mieszany = zaczyna && (profil.obciazenie.h_tydz || 0) < 1.5, przelom = Math.ceil(0.7 * n);
    for (let i = 0; i < n; i++) {
      const nr = i + 1, ostatni = i === n - 1;
      const faza = i >= n - (maraton ? 3 : dlugiCel ? 2 : 1) ? 'taper' : i < 0.4 * n ? 'baza' : i < 0.7 * n ? 'rozwoj' : 'specyficzna';
      const dni = DNI.map((d) => ({ dzien: d, typ: 'wolne', min: 0, mocne_min: 0, dodatki: [] }));
      const szczyt = sumy.length ? Math.max(...sumy) : baza;
      const ust = (d, typ, min, mocne, opis) => { Object.assign(dni[d], { typ, min, mocne_min: mocne || 0 }); if (opis) dni[d].opis = opis; else delete dni[d].opis; };

      if (ostatni) {
        // tydzień celu: krótko i lekko, dzień przed startem bardzo lekko (R3, R13)
        const przed = [...uzyte, ...(r.dlugi === null ? [] : [r.dlugi])].filter((d) => !dystans || d < dzienCelu).sort((a, b) => a - b);
        let skala = 1;
        const minuty = (d) => Math.round(skala * Math.min(lim[d], dystans && dzienCelu - d === 1 ? 20 : r.mocne[0] === d && dzienCelu - d >= 3 ? 40 : 35));
        if (przed.reduce((a, d) => a + minuty(d), 0) > 0.6 * szczyt) skala = 0.6 * szczyt / przed.reduce((a, d) => a + minuty(d), 0);
        for (const d of przed) {
          const m = minuty(d); if (m < 12) continue;
          if (dystans && dzienCelu - d === 1) ust(d, 'regeneracyjny', m, 0, 'Bardzo lekki rozruch, 3–4 krótkie przebieżki.');
          else if (dystans && r.mocne[0] === d && dzienCelu - d >= 3 && !powrot && !zaczyna) ust(d, 'akcent', m, Math.round(m / 4), `Rozgrzewka, potem 3 × 3 min w tempie celu${tempoCelu ? ` (${tempoCelu}/km)` : ''}, przerwa 2 min. Bez zmęczenia.`);
          else ust(d, 'spokojny', m, 0, 'Spokojny, krótki bieg.');
        }
        if (dystans) {
          const czas = cel.czas || ocena.prognoza_do;
          ust(dzienCelu, 'start', czas ? Math.round(Prognoza.sek(czas) / 60) : Math.round(cel.dystans_km * 6.5), 0,
            `Start docelowy: ${cel.dystans_km} km${cel.czas ? ` w ${cel.czas}` : ''}${tempoCelu ? ` (${tempoCelu}/km)` : ''}.`);
          dni[dzienCelu].mocne_min = dni[dzienCelu].min;
        } else {
          // próba celu w ostatnim dniu; tydzień nie może urosnąć ponad regułę R5, więc najpierw wypadają pozostałe biegi
          const ref = Math.max(...sumy.slice(-3), ...(n <= 3 ? [baza] : []));
          const wolno = Math.floor(Math.max(ref * 1.1, ref + 15));
          const d = przed[przed.length - 1];
          const inne = () => przed.slice(0, -1).reduce((a, x) => a + dni[x].min, 0);
          for (const x of przed.slice(0, -1)) if (inne() + cel.minuty > wolno) ust(x, 'wolne', 0, 0);
          const m = d === undefined ? 0 : Math.min(lim[d], cel.minuty, wolno - inne());
          if (m >= 12) ust(d, 'spokojny', m, 0, `Cel: ${cel.minuty} min biegu bez przerwy, w tempie rozmowy.`); else if (d !== undefined) ust(d, 'wolne', 0, 0);
          if (m < cel.minuty) uwagi.push(`Na cel ${cel.minuty} min bez przerwy potrzeba więcej czasu lub dłuższego limitu dnia – w ostatnim tygodniu wychodzi ${m} min.`);
        }
      } else {
        // --- ile minut w tym tygodniu (R5, R6, R10, R13) ---
        let T;
        const ref = Math.max(...sumy.slice(-3), ...(i < 3 && (znanaBaza || !sumy.length) ? [baza] : []));   // nieznane obciążenie: odniesieniem są tylko tygodnie planu
        const lzej = i > 0 ? 0.85 * sumy[i - 1] : Infinity;                // tydzień lżejszy od poprzedniego (R6)
        // taper według dystansu (R13): maraton 3 tygodnie do 75% i 55% szczytu, półmaraton 85% i 60%, krócej 70%; intensywność i liczba treningów zostają
        if (dlugiCel && n >= 6 && i === n - 3) T = Math.min((maraton ? 0.75 : 0.85) * szczyt, lzej);
        else if (i === n - 2 && n >= 4) T = Math.min((maraton ? 0.55 : dlugiCel ? 0.6 : 0.7) * szczyt, lzej);
        else if (i % 4 === 3) T = lzej;
        else if (i === 0) T = powrot ? 0.95 * baza : baza;
        else T = Math.max(ref * 1.08, ref + 10);
        T = Math.round(Math.min(T, sufit, Math.max(ref * 1.1, ref + 15) - 1));

        const bezMocnych = powrot && i < 2;
        // start w poniedziałek: w tygodniu przed nim niedziela nie może być mocna (R3)
        const mocne = bezMocnych ? [] : r.mocne.filter((d) => !(dzienCelu === 0 && i === n - 2 && d === 6));
        const dzienTestu = testy[nr] ? r.dzienTestu : null;
        if (dzienTestu !== null && !mocne.includes(dzienTestu)) mocne.push(dzienTestu);
        const lekkie = uzyte.filter((d) => !mocne.includes(d));

        const rezerwa = r.dlugi === null ? 0 : Math.min(limDl, 20);          // długi bieg ma zawsze swoje minimum (R15)
        let reszta = T - rezerwa;
        const minMocny = {};
        for (const d of mocne) {
          const chce = Math.max(ogr(Math.round(0.15 * T), 30, 75), d === dzienTestu ? potrzeba[testy[nr]] : 0);
          minMocny[d] = Math.min(lim[d], chce, Math.max(0, reszta)); reszta -= minMocny[d];
        }
        reszta += rezerwa;
        let dl = r.dlugi === null ? 0 : Math.min(limDl, Math.max(rezerwa, Math.round(udzialDl * T)), Math.max(0, reszta));
        reszta -= dl;
        const lekkieMin = zaczyna
          ? rozdziel(reszta, lekkie, lim, Object.fromEntries(lekkie.map((d, j) => [d, j === lekkie.length - 1 ? 1.3 : 1])))
          : rozdziel(reszta, lekkie, lim);
        const zostalo = reszta - Object.values(lekkieMin).reduce((a, b) => a + b, 0);
        if (r.dlugi !== null && zostalo > 0) dl = Math.min(limDl, dl + zostalo);   // nadwyżka do długiego, reszta przepada

        if (dl < 20) dl = 0;
        for (const d of mocne) if (minMocny[d] < 20) minMocny[d] = 0;
        const budzet = 0.24 * (dl + Object.values(minMocny).reduce((a, b) => a + b, 0) + Object.values(lekkieMin).reduce((a, b) => a + b, 0));
        const ileMocnych = Object.values(minMocny).reduce((a, m) => a + 0.4 * m, 0);
        const sk = ileMocnych > budzet ? budzet / ileMocnych : 1;

        mocne.forEach((d, j) => {
          const m = minMocny[d]; if (!m) return;
          const mm = Math.floor(0.4 * m * sk);
          if (d === dzienTestu) {
            ust(d, 'test', m, mm, testy[nr] === 'tetno'
              ? 'Test 30 min: rozgrzewka 10–15 min, potem 30 min równo, najmocniej jak dasz radę utrzymać. Średnie tętno z ostatnich 20 min to Twoje tętno progowe.'
              : `Bieg kontrolny ${dystTestu} km na czas po rozgrzewce 10–15 min. Wynik aktualizuje prognozę.`);
          } else {
            const [rodzaj, wzor] = AKCENTY[faza][(i + j) % 3];
            ust(d, 'akcent', m, mm, `Rozgrzewka 10–15 min, ${wzor(Math.max(6, mm), tempoCelu)}, schłodzenie do końca czasu.`);
            celDnia(dni[d], rodzaj);
          }
        });
        if (r.dlugi !== null && dl) ust(r.dlugi, 'dlugi', dl, 0, faza === 'specyficzna' && dlugiCel
          ? 'Długi bieg spokojnie. Ćwicz jedzenie i picie tak jak na starcie.' : 'Długi bieg spokojnie, w tempie rozmowy.');
        for (const d of lekkie) {
          const m = lekkieMin[d]; if (!m) continue;
          if (zaczyna && mieszany && nr < przelom) ust(d, 'marszobieg', m, 0, `Marszobieg: ${MARSZOBIEG[Math.min(5, Math.floor(6 * i / przelom))]}, powtarzaj do końca czasu.`);
          else ust(d, 'spokojny', m, 0, 'Spokojny bieg w tempie rozmowy.');
        }
      }

      // --- cele tętna i tempa dla pozostałych biegów (R17) ---
      for (const d of dni) {
        if (d.typ === 'spokojny' || d.typ === 'dlugi' || d.typ === 'marszobieg') celDnia(d, 'lekki');
        else if (d.typ === 'regeneracyjny') celDnia(d, 'regeneracja');
        else if (d.typ === 'akcent' && !d.cel_tetno && !d.cel_tempo) celDnia(d, 'cel');
        else if (d.typ === 'start' && celTempa) Object.assign(d, celTempa);
      }

      // --- uzasadnienie każdej jednostki (R21): cel fizjologiczny, miejsce w cyklu, łatwiejszy wariant ---
      for (const d of dni) {
        if (!d.min) continue;
        d.po_co = PO_CO_TYP[d.typ] || PO_CO_RODZAJ[d.rodzaj] || PO_CO_RODZAJ.lekki;
        d.dlaczego_teraz = d.typ === 'test' ? 'Sprawdzian w tym miejscu zostawia czas na korektę celu.' : d.typ === 'start' ? 'Dzień celu.' : DLACZEGO[faza];
        if (LATWIEJ[d.typ]) d.latwiej = LATWIEJ[d.typ];
        if (d.mocne_min && d.typ !== 'start') d.mocne_strefa = d.rodzaj === 'vo2' || (d.typ === 'test' && /kontrolny/.test(d.opis || '')) ? 3 : 2;
      }

      // --- uzupełnienia (R16) ---
      const biegi = dni.map((d, j) => (d.min ? j : -1)).filter((j) => j >= 0);
      const spokojne = biegi.filter((j) => ['spokojny', 'marszobieg'].includes(dni[j].typ));
      if (!ostatni) for (const j of spokojne.slice(0, zaczyna ? 1 : 2)) dni[j].dodatki.push('sila');
      if (!ostatni && !biegi.some((j) => dni[j].dodatki.includes('sila')) && biegi.length) dni[biegi[0]].dodatki.push('sila');
      const mocnyDzien = (j) => ['akcent', 'test', 'start'].includes(dni[j].typ);
      const plyo = zaczyna ? (nr > 5 ? spokojne[0] : undefined) : biegi.find((j) => dni[j].typ === 'akcent');
      // plyometria w dniu mocnego treningu; mocne dni nigdy nie sąsiadują, więc następny dzień jest lekki
      if (!ostatni && plyo !== undefined && !(plyo < 6 && mocnyDzien(plyo + 1))) dni[plyo].dodatki.push('plyometria');
      for (const j of biegi) { if (dni[j].typ === 'start') continue; if (mocnyDzien(j)) dni[j].dodatki.unshift('rozgrzewka'); dni[j].dodatki.push('mobilnosc'); }

      sumy.push(dni.reduce((a, d) => a + d.min, 0));
      tygodnie.push({ nr, start: iso(new Date(start.getTime() + i * TYDZ_MS)), faza, dni });
    }

    const bramki = Object.entries(testy).map(([nr, rodzaj]) => rodzaj === 'tetno'
      ? { tydzien: +nr, opis: 'test 30 min', prog: 'wyznacza tętno progowe – do tego czasu strefy są szacunkiem' }
      : { tydzien: +nr, opis: `bieg kontrolny ${dystTestu} km`, prog: progTestu ? `${progTestu} lub szybciej – cel zostaje; wolniej o ponad 3% – cel do korekty` : 'wynik posłuży do prognozy' });
    return { ocena_celu: ocena, bramki, uwagi, strefy: { hrmax: strefy.tetna.hrmax, lthr: strefy.tetna.lthr }, tygodnie };
  }
  return { uloz, DNI };
})();
