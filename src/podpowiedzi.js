// Ostrzeżenia i podpowiedzi do planu (docs/SPEC.md sekcja 6). Niczego nie zmieniają – tylko mówią co i dlaczego.
// Ostrzeżenie = układ ryzykowny (te same zasady co R2, R3, R16). Podpowiedź = czegoś brakuje.
const Podpowiedzi = (() => {
  const DNI = ['pn', 'wt', 'sr', 'czw', 'pt', 'sob', 'nd'];
  const NAZWA = { pn: 'poniedziałek', wt: 'wtorek', sr: 'środa', czw: 'czwartek', pt: 'piątek', sob: 'sobota', nd: 'niedziela' };
  const mocny = (d) => ['akcent', 'test', 'start'].includes(d.typ);

  // Zmiany ręczne użytkownika nakładane na plan z generatora: zamiana dwóch dni w tygodniu albo odpuszczenie biegu.
  function zastosuj(plan, zmiany) {
    for (const z of zmiany || []) {
      const t = plan.tygodnie.find((x) => x.nr === z.tydzien); if (!t) continue;
      const a = t.dni.find((d) => d.dzien === z.a);
      if (z.typ === 'zamiana') {
        const b = t.dni.find((d) => d.dzien === z.b); if (!a || !b) continue;
        const ia = t.dni.indexOf(a), ib = t.dni.indexOf(b);
        t.dni[ia] = { ...b, dzien: a.dzien }; t.dni[ib] = { ...a, dzien: b.dzien };
      } else if (z.typ === 'odpusc' && a) {
        t.dni[t.dni.indexOf(a)] = { dzien: a.dzien, typ: 'wolne', min: 0, mocne_min: 0, dodatki: [] };
      }
      t.zmieniony = true;
    }
    return plan;
  }

  function licz(profil, plan) {
    const w = [], cel = (plan.ocena_celu && plan.ocena_celu.cel_posredni) || profil.cel;
    const dlugiCel = cel.typ === 'dystans' && cel.dystans_km >= 21, zaczyna = profil.poziom === 'zaczynam';
    const dodaj = (tydzien, rodzaj, tekst, powod) => w.push({ tydzien, rodzaj, tekst, powod });
    const plaski = plan.tygodnie.flatMap((t) => t.dni.map((d) => ({ nr: t.nr, d })));

    plaski.forEach(({ nr, d }, i) => {
      const lim = profil.dni[d.dzien].max_min || 0;
      if (d.typ !== 'start' && d.min > lim) dodaj(nr, 'ostrzezenie', lim ? `${NAZWA[d.dzien]}: ${d.min} min biegu przy limicie ${lim} min` : `${NAZWA[d.dzien]}: bieg w dniu, który w wywiadzie jest wolny`,
        'Limity dni pochodzą z Twojego wywiadu. Zmień je tam, jeśli się zdezaktualizowały.');
      const nast = plaski[i + 1]; if (!nast) return;
      const para = `${NAZWA[d.dzien]} i ${NAZWA[nast.d.dzien]}`;
      if (mocny(d) && mocny(nast.d)) dodaj(nast.nr, 'ostrzezenie', `Dwa mocne dni pod rząd: ${para}`, 'Po mocnym treningu organizm potrzebuje co najmniej jednego lżejszego dnia, inaczej drugi trening wychodzi słabo i rośnie ryzyko kontuzji.');
      else if (mocny(d) && nast.d.typ === 'dlugi') dodaj(nast.nr, 'ostrzezenie', `Długi bieg dzień po mocnym treningu: ${para}`, 'Długi bieg na zmęczonych nogach to najczęstszy powód przeciążeń.');
      else if (d.typ === 'dlugi' && mocny(nast.d)) dodaj(nast.nr, 'ostrzezenie', `Mocny trening dzień po długim biegu: ${para}`, 'Po długim biegu mięśnie potrzebują dnia lżejszego.');
      if (d.dodatki.includes('plyometria') && mocny(nast.d)) dodaj(nr, 'ostrzezenie', `Skoki (plyometria) dzień przed mocnym treningiem: ${para}`, 'Skoki mocno obciążają ścięgna – nie dzień przed akcentem.');
    });

    plan.tygodnie.forEach((t, i) => {
      const ostatni = i === plan.tygodnie.length - 1, suma = t.dni.reduce((a, d) => a + d.min, 0);
      if (!suma) return;
      if (dlugiCel && !zaczyna && !ostatni && !t.dni.some((d) => d.typ === 'dlugi' || (mocny(d) && d.typ !== 'akcent' && d.min >= 90)))
        dodaj(t.nr, 'podpowiedz', 'W tym tygodniu nie ma długiego biegu', 'Przy celu od półmaratonu w górę długi bieg jest najważniejszym treningiem tygodnia.');
      if (!ostatni && !t.dni.some((d) => d.dodatki.includes('sila')))
        dodaj(t.nr, 'podpowiedz', 'W tym tygodniu nie ma ćwiczeń siłowych', 'Dwa krótkie treningi siły w tygodniu zmniejszają ryzyko kontuzji.');
      const mocne = t.dni.reduce((a, d) => a + (d.typ === 'start' ? 0 : d.mocne_min), 0);
      if (mocne > 0.25 * suma + 0.5) dodaj(t.nr, 'podpowiedz', `Dużo mocnego biegania: ${mocne} z ${suma} min`, 'Powyżej jednej czwartej czasu w mocnym tempie postęp zwykle zwalnia zamiast przyspieszać.');
      const wolne = t.dni.filter((d) => d.typ === 'wolne').length;
      if (wolne < (zaczyna ? 2 : 1)) dodaj(t.nr, 'podpowiedz', zaczyna ? 'Mniej niż dwa dni wolne w tygodniu' : 'Tydzień bez dnia wolnego', 'Forma rośnie w czasie odpoczynku. Dzień wolny to część planu.');
    });

    if (!(profil.hrmax && profil.lthr) && !zaczyna && !profil.powrot_po_przerwie && plan.tygodnie.length >= 5
      && !plan.tygodnie.slice(0, 4).some((t) => t.dni.some((d) => d.typ === 'test')))
      dodaj(null, 'podpowiedz', 'Brakuje testu tętna w pierwszych 4 tygodniach', 'Bez testu strefy tętna są tylko szacunkiem z wieku.');
    return w;
  }
  return { licz, zastosuj, DNI };
})();
