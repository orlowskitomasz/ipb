// Ręczne zmiany użytkownika w planie (zamiana dni, odpuszczenie biegu). Ocena układu po zmianach: src/walidator.js.
const Podpowiedzi = (() => {

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

  return { zastosuj };
})();
