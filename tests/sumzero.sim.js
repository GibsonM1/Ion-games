// SumZero simulation on the real game code: thousands of Build-the-name trays and long Free-build games played by a bot.
// Reports how often extra pieces appear per level, the largest trays, one-answer trays, and that Free build never gets stuck.
// Run: node tests/sumzero.sim.js
'use strict';
const { open } = require('./ibond-page');
let fails = 0;
const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };

(async () => {
  const P = await open();
  try {
    const r = await P.page.evaluate(() => {
      const T = window.__szT, SZ = window.SumZero;
      window.setTimeout = (f) => { f(); return 0; };   // run the game's delays at once
      const name = (c, a) => c.n + ' ' + a.ide;
      // ---- Build the name: trays straight from newOrder() ----
      const order = { per: {}, max: 0, maxX: 0, notUnique: 0, missing: 0, sizes: {} };
      for (let g = 0; g < 250; g++) {
        T.start('build-order-practice');
        for (let level = 1; level <= 16; level++) {
          T.game.level = level;
          for (let i = 0; i < 6; i++) {
            T.newOrder();
            const tr = T.game.tray, t = T.game.target, ions = tr.map(x => x.ion), nx = tr.filter(x => x.x).length;
            const pl = order.per[level] || (order.per[level] = { n: 0, x: 0 }); pl.n++; if (nx) pl.x++;
            order.max = Math.max(order.max, tr.length); if (nx) order.maxX = Math.max(order.maxX, tr.length);
            order.sizes[tr.length] = (order.sizes[tr.length] || 0) + 1;
            const right = SZ.compounds(ions).filter(c => name(c.cat, c.an) === name(t.cat, t.an));
            if (right.length !== 1) order.notUnique++;
            if (ions.filter(x => x.k === t.cat.k).length < t.a || ions.filter(x => x.k === t.an.k).length < t.b) order.missing++;
          }
        }
      }
      // ---- Free build: a bot that never places a wrong piece; it must always have a move ----
      function freeRun(mode, games, moves) {
        const st = { done: 0, stuck: 0, moves: 0, maxTray: 0, per: {}, ends: 0, wrongTried: 0, wrongPlaced: 0 };
        for (let g = 0; g < games; g++) {
          T.start(mode);
          for (let m = 0; m < moves; m++) {
            let G = T.game; if (!G) { st.ends++; T.start(mode); G = T.game; }
            G.paused = false; G.locked = false;
            const { cats, ans } = T.pools(G.level), box = G.cat.length + G.an.length;
            const legal = G.tray.filter(p => !SZ.wrongPiece({ mode: 'free', cat: G.cat, an: G.an, ion: p.ion, cats, ans }));
            st.maxTray = Math.max(st.maxTray, G.tray.length);
            // now and then try a wrong piece: it must bounce (stay in the tray, box unchanged)
            const wrong = G.tray.filter(p => !legal.includes(p));
            if (wrong.length && Math.random() < .1) {
              const w = wrong[0], before = box; st.wrongTried++;
              T.addToZone(w.id);
              if (!T.game || T.game.cat.length + T.game.an.length !== before || !T.game.tray.includes(w)) st.wrongPlaced++;
              continue;
            }
            if (!legal.length) { st.stuck++; document.getElementById('clearBtn').click(); continue; }
            let pick = legal[0];
            if (!box) {   // start a compound the tray can finish, if there is one
              const full = SZ.compounds(G.tray.map(p => p.ion));
              if (full.length) { const c = full[Math.floor(Math.random() * full.length)]; pick = G.tray.find(p => p.ion === c.cat); }
              else pick = legal[Math.floor(Math.random() * legal.length)];
            } else pick = legal[Math.floor(Math.random() * legal.length)];
            const lvl = G.level, hadX = G.tray.some(p => p.x), made = G.made;
            T.addToZone(pick.id); st.moves++;
            if (T.game && T.game.made > made) {
              st.done++; const pl = st.per[lvl] || (st.per[lvl] = { n: 0, x: 0 }); pl.n++; if (hadX) pl.x++;
            }
            if (mode.endsWith('timed') && T.game && Math.random() < .5) T.buildTick(Math.random() * 3000);   // time passes: ions arrive
          }
        }
        return st;
      }
      const freeP = freeRun('build-free-practice', 120, 400), freeT = freeRun('build-free-timed', 120, 400);
      return { order, freeP, freeT };
    });
    const pct = per => Object.keys(per).map(l => `${l}:${Math.round(100 * per[l].x / per[l].n)}%`).join(' ');
    const o = r.order;
    console.log('Build the name, % of trays with extra pieces by level: ' + pct(o.per));
    console.log(`Build the name, tray sizes: ${JSON.stringify(o.sizes)}; largest ${o.max} (largest with extras ${o.maxX})`);
    ok(o.notUnique === 0, `every Build-the-name tray has exactly one correct answer (${Object.values(o.per).reduce((a, b) => a + b.n, 0)} trays)`);
    ok(o.missing === 0, 'every Build-the-name tray holds all the pieces of its compound');
    ok(o.max <= 8, 'Build-the-name trays never pass 8 pieces (same as before extras)');
    for (const [k, f] of [['practice', r.freeP], ['timed', r.freeT]]) {
      console.log(`Free build ${k}: ${f.done} compounds in ${f.moves} moves, largest tray ${f.maxTray}, games ended ${f.ends}; % of compounds with extra pieces in the tray by level: ${pct(f.per)}`);
      ok(f.stuck === 0, `Free build ${k}: the bot always had a correct move (stuck ${f.stuck} times)`);
      ok(f.wrongPlaced === 0, `Free build ${k}: ${f.wrongTried} wrong pieces all bounced back`);
      ok(f.maxTray <= 8, `Free build ${k}: tray never over 8`);
    }
    ok(P.errors.length === 0, 'console clean' + (P.errors.length ? ': ' + P.errors.slice(0, 3).join(' | ') : ''));
  } finally { await P.close(); }
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
