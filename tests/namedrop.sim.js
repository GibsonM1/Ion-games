// Name drop: answer-choice count by level, where the right answer lands, and how often look-alike names slow a card.
// Run: node tests/namedrop.sim.js
'use strict';
const { open } = require('./ibond-page.js');
let fails = 0; const ok = (c, n, d) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (d ? '  ' + d : '')); if (!c) fails++; };
(async () => {
  const T = await open(); const p = T.page;
  for (const mode of ['pick', 'formula']) {
    await p.click(`[data-start="drop-${mode}-timed"]`); await p.waitForTimeout(300);
    const r = await p.evaluate(mode => {
      const g = __szT.game, out = {}; g.paused = true;
      for (const L of [1, 3, 6, 7, 10, 14]) {
        g.level = L; const pos = [0, 0, 0, 0], ns = {}; let look = 0, dup = 0, miss = 0; const N = 4000;
        for (let i = 0; i < N; i++) {
          const { cat, an } = __szT.pickPair(L), [a, b] = [0, 0];
          const rt = (c, d) => { const g2 = (x, y) => y ? g2(y, x % y) : x, m = g2(c.c, -d.c); return [-d.c / m, c.c / m]; }, [x, y] = rt(cat, an);
          const o = mode === 'pick' ? __szT.nameOptions(cat, an, x, y) : __szT.formulaOptions(cat, an, x, y);
          pos[o.opts.indexOf(o.correct)]++; ns[o.opts.length] = (ns[o.opts.length] || 0) + 1;
          if (o.look) look++; if (new Set(o.opts).size !== o.opts.length) dup++; if (o.opts.indexOf(o.correct) < 0) miss++;
        }
        out[L] = { pos, ns, look: look / N, dup, miss };
      }
      return out;
    }, mode);
    for (const L in r) {
      const x = r[L], n = +L < 7 ? 3 : 4, tot = x.pos.reduce((a, b) => a + b, 0), exp = tot / n, tol = mode === 'formula' && n === 4 ? 0.12 : 0.08;
      // a few 1-to-1 formulas (NaCl) only have 3 different wrong-looking forms, so Pick the formula may show 3 at any level (as before)
      if (mode === 'formula' && n === 4) ok(!x.ns[2] && (x.ns[4] || 0) / tot > 0.9, `${mode} level ${L}: 4 choices (3 for a few simple formulas)`, JSON.stringify(x.ns));
      else ok(Object.keys(x.ns).length === 1 && x.ns[n] === tot, `${mode} level ${L}: always ${n} choices`, JSON.stringify(x.ns));
      ok(x.pos.slice(0, n).every(c => Math.abs(c - exp) / exp < tol) && x.pos.slice(n).every(c => !c), `${mode} level ${L}: right answer lands in each spot about equally`, x.pos.join(' '));
      ok(!x.dup && !x.miss, `${mode} level ${L}: no repeated choices, right answer always present`);
      if (mode === 'pick') console.log(`     look-alike cards at level ${L}: ${Math.round(x.look * 100)}%`);
    }
    await p.click('#drop [data-home]'); await p.waitForTimeout(200);
  }
  ok(!T.errors.length, 'no console errors', T.errors.join(' | '));
  await T.close(); console.log(fails ? fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
})();
