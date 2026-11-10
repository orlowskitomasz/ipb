// Strefy tętna i tempa (docs/SPEC.md sekcja 4). Kilka modeli obok siebie; plan korzysta z progu (LTHR).
// Wartości zmierzone mają pierwszeństwo; brakujące są szacowane i wyraźnie oznaczane jako szacunek.
const Strefy = (() => {
  const zaokr = (x) => Math.round(x);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  // Tętno maksymalne i progowe: pomiar albo szacunek (Tanaka 2001: 208 − 0,7 × wiek; próg ≈ 90% maks.)
  function tetna(profil, rok = new Date().getFullYear()) {
    const hrmax = profil.hrmax ? { v: profil.hrmax, szacunek: false } : { v: zaokr(208 - 0.7 * (rok - profil.rok_urodzenia)), szacunek: true };
    const lthr = profil.lthr ? { v: profil.lthr, szacunek: false } : { v: zaokr(0.9 * hrmax.v), szacunek: true };
    return { hrmax, lthr };
  }

  // Tempa z ostatniego wyniku przez VDOT: ułamki VDOT odpowiadają strefom Danielsa (E 62–74%, T 83–88%, I 95–100%).
  // To przybliżenie z opublikowanych równań, nie tabele z książki.
  function tempa(profil) {
    const r = Prognoza.ostatni(profil.rekordy || []);
    if (!r) return null;
    const V = Prognoza.vdot(r.dystans_km, Prognoza.sek(r.czas)), t = (u) => Prognoza.tempoPrzy(V, u), M = Prognoza.czasVdot(V, 42.195) / 42.195;
    return { E: [t(0.74), t(0.62)], M: [M * 0.99, M * 1.02], T: [t(0.88), t(0.83)], I: [t(1.0), t(0.95)], vdot: Math.round(V * 10) / 10, zrodlo: r };
  }

  // Cel na dzień planu: zakres tętna i/lub tempa. rodzaj: lekki | regeneracja | subprog | prog | vo2 | doprogu
  function cel(rodzaj, s) {
    const L = s.tetna.lthr.v, t = s.tempa, sz = s.tetna.lthr.szacunek ? { szacunek: true } : {};
    const tempo = (z) => (z ? { cel_tempo: { od: zaokr(z[0]), do: zaokr(z[1]) } } : {});
    switch (rodzaj) {
      case 'lekki': return { cel_tetno: { do: zaokr(0.89 * L) }, ...tempo(t && t.E), ...sz };
      case 'regeneracja': return { cel_tetno: { do: zaokr(0.85 * L) }, ...sz };
      case 'subprog': return { cel_tetno: { od: zaokr(0.90 * L), do: zaokr(0.96 * L) }, ...tempo(t && [t.T[1] * 1.02, t.T[1] * 1.06]), ...sz };
      case 'prog': return { cel_tetno: { od: zaokr(0.95 * L), do: L }, ...tempo(t && t.T), ...sz };
      case 'vo2': return { cel_tetno: { od: L }, ...tempo(t && t.I), ...sz };
      default: return { cel_tetno: { do: L }, ...sz };
    }
  }

  function licz(profil, rok) {
    const tt = tetna(profil, rok), H = tt.hrmax.v, L = tt.lthr.v, S = profil.hr_spocz;
    const pasma = [['Z1 bardzo lekko', 0.5, 0.6], ['Z2 lekko', 0.6, 0.7], ['Z3 umiarkowanie', 0.7, 0.8], ['Z4 mocno', 0.8, 0.9], ['Z5 bardzo mocno', 0.9, 1]];
    const modele = [
      { nazwa: '% tętna maksymalnego', opis: `tętno maks. ${H}${tt.hrmax.szacunek ? ' (szacunek z wieku)' : ' (zmierzone)'}`, szacunek: tt.hrmax.szacunek,
        strefy: pasma.map(([n, a, b]) => [n, zaokr(a * H), zaokr(b * H)]) },
      S ? { nazwa: 'Karvonen (rezerwa tętna)', opis: `tętno spoczynkowe ${S}, maks. ${H}`, szacunek: tt.hrmax.szacunek,
        strefy: pasma.map(([n, a, b]) => [n, zaokr(S + a * (H - S)), zaokr(S + b * (H - S))]) } : null,
      { nazwa: 'Friel (% tętna progowego)', opis: `tętno progowe ${L}${tt.lthr.szacunek ? ' (szacunek: 90% maks.)' : ' (zmierzone)'} – z tego modelu korzysta plan`, szacunek: tt.lthr.szacunek,
        strefy: [['Z1 regeneracja', null, zaokr(0.85 * L) - 1], ['Z2 spokojnie', zaokr(0.85 * L), zaokr(0.89 * L)], ['Z3 umiarkowanie', zaokr(0.90 * L), zaokr(0.94 * L)],
          ['Z4 pod progiem', zaokr(0.95 * L), zaokr(0.99 * L)], ['Z5 powyżej progu', L, null]] },
    ].filter(Boolean);
    return { tetna: tt, tempa: tempa(profil), modele };
  }
  return { licz, cel, mmss };
})();
