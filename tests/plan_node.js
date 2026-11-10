// Uruchamia src/plan.js w Node: czyta profile (JSON, jeden na linię) ze stdin, wypisuje plany (jeden na linię).
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = ['prognoza', 'plan'].map((m) => fs.readFileSync(path.join(__dirname, '..', 'src', m + '.js'), 'utf8')).join('\n');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + '\nthis.Plan = Plan;', ctx);
for (const linia of fs.readFileSync(0, 'utf8').split('\n').filter(Boolean)) {
  const profil = JSON.parse(linia);
  console.log(JSON.stringify(ctx.Plan.uloz(profil, profil.start_planu || '2026-11-16')));
}
