// Prognoza Riegla i ocena celu – te same progi co reguła R12 w tests/sprawdz_plan.py.
const Prognoza = (() => {
  const sek = (t) => t.split(':').map(Number).reduce((a, x) => a * 60 + x, 0);
  const czas = (s) => { s = Math.round(s); const p = (n) => String(n).padStart(2, '0');
    return `${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; };
  const riegel = (rekordy, km) => rekordy.length
    ? Math.min(...rekordy.map((r) => sek(r.czas) * (km / r.dystans_km) ** 1.06)) : null;

  function ocena(profil) {
    const c = profil.cel;
    const pr = c.typ === 'dystans' && c.czas ? riegel(profil.rekordy || [], c.dystans_km) : null;
    if (!pr) return { status: 'realny', prognoza: null, uzasadnienie: 'Brak rekordu do prognozy – cel zostanie sprawdzony pierwszym testem.' };
    const q = sek(c.czas) / pr, proc = Math.round(100 * Math.abs(1 - q));
    if (q < 0.93) return { status: 'nierealny', prognoza: czas(pr), cel_posredni: { ...c, czas: czas(Math.ceil(pr / 60) * 60) },
      uzasadnienie: `Cel jest o ${proc}% szybszy od prognozy z rekordu. Proponowany cel pośredni: ${czas(Math.ceil(pr / 60) * 60)}.` };
    if (q < 0.98) return { status: 'ambitny', prognoza: czas(pr), uzasadnienie: `Cel jest o ${proc}% szybszy od prognozy – wymaga postępu, sprawdzą go testy pośrednie.` };
    return { status: 'realny', prognoza: czas(pr), uzasadnienie: 'Cel mieści się w prognozie z rekordu.' };
  }
  return { sek, czas, riegel, ocena };
})();
