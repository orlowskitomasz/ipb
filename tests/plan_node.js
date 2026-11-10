// Uruchamia src/plan.js w Node: czyta profile (JSON, jeden na linię) ze stdin, wypisuje plany (jeden na linię)
// razem z ustaleniami walidatora (_ustalenia). Linia z kluczem "plan" → same ustalenia dla podanego planu i zmian.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = ['reguly', 'prognoza', 'strefy', 'plan', 'podpowiedzi', 'walidator'].map((m) => fs.readFileSync(path.join(__dirname, '..', 'src', m + '.js'), 'utf8')).join('\n');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + '\nthis.Plan = Plan; this.Podpowiedzi = Podpowiedzi; this.Walidator = Walidator;', ctx);
for (const linia of fs.readFileSync(0, 'utf8').split('\n').filter(Boolean)) {
  const we = JSON.parse(linia);
  if (we.plan) {   // tryb podpowiedzi: {profil, plan, zmiany} → lista ostrzeżeń i podpowiedzi po nałożeniu zmian
    console.log(JSON.stringify(ctx.Walidator.sprawdz(we.profil, ctx.Podpowiedzi.zastosuj(we.plan, we.zmiany))));
  } else {
    const plan = ctx.Plan.uloz(we, we.start_planu || '2026-11-16');
    console.log(JSON.stringify({ ...plan, _ustalenia: ctx.Walidator.sprawdz(we, plan) }));
  }
}
