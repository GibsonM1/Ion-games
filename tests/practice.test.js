// Practice alone: full loop (build naming), swap, pick naming, login + ⚛ save, offline-ish preview mode.
// Run: node tests/practice.test.js
'use strict';
const { setup, solution, buildGroup, lockGroup, until, sleep } = require('./harness');
let fails = 0;
const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };

(async () => {
  const H = await setup();
  try {
    // ---- phone, practice with Build the name ----
    const P = await H.player('phone', { viewport: { width: 390, height: 844 }, touch: false });
    const pg = P.page;
    await H.shot(P, 'start', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);
    await pg.click('[data-pn="build"]');
    await pg.click('#pracBtn');
    await until(pg, () => window.__ion.B && document.querySelectorAll('#tray [data-tile]').length === 12);
    ok(true, 'practice deals 12 tiles');
    const sol = await solution(pg);
    ok(sol && sol.length > 0, 'hand has a full solution (' + (sol || []).length + ' compounds)');
    // build all but the last compound with taps, last one with drag
    const gids = [];
    for (let i = 0; i < sol.length; i++) gids.push(await buildGroup(pg, sol[i].tiles, i === sol.length - 1));
    const st = await pg.evaluate(() => ({ tray: window.__ion.B.tray.length, groups: window.__ion.B.groups.length }));
    ok(st.tray === 0 && st.groups === sol.length, 'tap + drag built every compound (tray empty)');
    await H.shot(P, 'play-practice', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);
    for (let i = 0; i < sol.length; i++) {
      if (i === 0) {   // screenshot the build-name dialog once, half filled
        await pg.locator(`[data-lock="${gids[0]}"]`).click(); await pg.locator('#dLock[open]').waitFor();
        await pg.locator('#lockName .words button').first().click();
        await H.shot(P, 'lock-build', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);
        await pg.keyboard.press('Escape'); await sleep(200);
      }
      await lockGroup(pg, gids[i], sol[i].pos, sol[i].neg, sol[i].name, 'build');
    }
    ok(await pg.evaluate(() => !document.querySelector('#doneBtn').disabled), 'Done enabled when every tile is in a locked group');
    const coins0 = await pg.evaluate(() => window.__ion.save.coins);
    await pg.click('#doneBtn');
    await until(pg, () => document.querySelector('#pracCont'));
    const allOk = await pg.evaluate(() => document.querySelectorAll('#checkArea .cg.ok').length === document.querySelectorAll('#checkArea .cg').length);
    ok(allOk, 'practice reveal: every built-name compound correct');
    await H.shot(P, 'reveal-practice', [{ width: 390, height: 844 }]);
    await pg.click('#pracCont');
    await until(pg, () => document.querySelector('#sReview.on'));
    const rv = await pg.evaluate(() => ({ total: window.__ion.RV.sc.total, coins: window.__ion.save.coins, lines: window.__ion.RV.sc.lines }));
    ok(rv.total > 0 && rv.coins === coins0 + rv.total, 'practice review adds ⚛ (' + rv.total + '): ' + rv.lines.map(l => l.label + ' ' + l.pts).join('; '));
    ok(rv.lines.some(l => /Won the round/.test(l.label)) && rv.lines.some(l => /Practice/.test(l.label)), 'perfect practice board gets the win bonus, then ×½');
    await H.shot(P, 'review-practice', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);

    // ---- practice again: swap + pick naming + a wrong lock ----
    await pg.click('#revHome'); await pg.click('[data-pn="pick"]'); await pg.click('#pracBtn');
    await until(pg, () => window.__ion.B && window.__ion.B.tray.length === 12 && window.__ion.B.naming === 'pick');
    const sol2 = await solution(pg);
    const first = await pg.evaluate(keep => window.__ion.B.tray.find(id => !keep.includes(id)), sol2[0].tiles);
    await pg.click(`[data-tile="${first}"]`); await pg.click('#swapBtn');
    const sw = await pg.evaluate(() => ({ n: Object.keys(window.__ion.B.tiles).length, tray: window.__ion.B.tray.slice(-2), dc: window.__ion.B.dumpCount }));
    ok(sw.n === 13 && sw.tray.join() === 'd0a,d0b' && sw.dc === 1, 'swap 1 → get 2 (d0a, d0b)');
    const g = await buildGroup(pg, sol2[0].tiles);
    await pg.locator(`[data-lock="${g}"]`).click(); await pg.locator('#dLock[open]').waitFor();
    await H.shot(P, 'lock-pick', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);
    await pg.keyboard.press('Escape');
    await lockGroup(pg, g, sol2[0].pos, sol2[0].neg, sol2[0].name, 'pick');
    ok(await pg.evaluate(() => { const B = window.__ion.B, g = B.groups[0]; return window.IonRules.sameName(g.name, window.IonRules.correctName(g.tiles.map(id => B.tiles[id].k))); }), 'pick-name lock stores the picked name');
    // dark mode play screenshot on a fresh page
    const Dk = await H.player('dark', { viewport: { width: 390, height: 844 }, dark: true });
    await Dk.page.click('#pracBtn'); await until(Dk.page, () => window.__ion.B);
    const s3 = await solution(Dk.page);
    for (let i = 0; i < 2; i++) { const g = await buildGroup(Dk.page, s3[i].tiles); if (!i) await lockGroup(Dk.page, g, s3[i].pos, s3[i].neg, s3[i].name, 'off'); }
    await Dk.page.click(`[data-tile="${await Dk.page.evaluate(() => window.__ion.B.tray[0])}"]`);
    await H.shot(Dk, 'play-dark', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);
    await Dk.page.click('#helpBtn'); await H.shot(Dk, 'help-dark', [{ width: 390, height: 844 }]); await Dk.page.keyboard.press('Escape');

    // ---- login + ⚛ save through the fake back end ----
    const Lg = await H.player('login');
    await Lg.page.click('#loginBtn'); await Lg.page.fill('#lgUser', 'garciam'); await Lg.page.fill('#lgId', '12345');
    await H.shot(Lg, 'login', [{ width: 390, height: 844 }]);
    await Lg.page.click('#lgGo');
    await until(Lg.page, () => /Logged in as Maria G\., Per 3/.test(document.querySelector('#who').textContent));
    ok(true, 'login shows "Logged in as Maria G., Per 3"');
    await Lg.page.click('#pracBtn'); await until(Lg.page, () => window.__ion.B);
    const s4 = await solution(Lg.page);
    for (const c of s4) { const g = await buildGroup(Lg.page, c.tiles); await lockGroup(Lg.page, g, c.pos, c.neg, c.name, 'off'); }
    await Lg.page.click('#doneBtn'); await Lg.page.click('#pracCont');
    const earned = await Lg.page.evaluate(() => window.__ion.RV.sc.total);
    const bad = await Lg.page.evaluate(() => window.__ion.RV.results.filter(r => !r.ok).map(r => r.truth.formula + ': ' + r.why.join(' ')));
    if (bad.length) console.log('   wrong:', bad, JSON.stringify(s4));
    await Lg.page.evaluate(() => window.__ion.flush());
    await sleep(500);
    const last = H.backend.saves[H.backend.saves.length - 1];
    ok(last && last.game === 'ionagrams' && last.delta === earned && last.summary.Rounds === '1' && /\(100%\)/.test(last.summary.Accuracy), 'save sent delta ' + (last && last.delta) + ' with summary ' + JSON.stringify(last && last.summary));
    ok(H.backend.points.garciam === earned, 'server total matches');

    // ---- Extra time: 10 tiles, points ×½ ----
    const X = await H.player('extra', { viewport: { width: 390, height: 844 } });
    await X.page.click('#xtSw'); await X.page.click('#pracBtn');
    await until(X.page, () => window.__ion.B && window.__ion.B.tray.length === 10);
    ok(await X.page.evaluate(() => !document.querySelector('#xtStat').hidden), 'Extra time: 10 tiles and the Extra time tag shows');
    const s5 = await solution(X.page);
    for (const c of s5) { const g = await buildGroup(X.page, c.tiles); await lockGroup(X.page, g, c.pos, c.neg, c.name, 'off'); }
    await X.page.click('#doneBtn'); await X.page.click('#pracCont');
    ok(await X.page.evaluate(() => window.__ion.RV.sc.lines.some(l => /Extra time/.test(l.label))), 'Extra time line in the review');
    // ---- no internet / scripts missing: classmates hidden, practice still works ----
    const O = await H.player('offline', { blockTheme: true });
    ok(await O.page.evaluate(() => document.querySelector('#multiBtn').hidden && !document.querySelector('#multiNote').hidden && !document.querySelector('#loginBtn')), 'offline: Play with classmates hidden with a note, no login button');
    await O.page.click('#pracBtn'); await until(O.page, () => window.__ion.B && window.__ion.B.tray.length === 12);
    const s6 = await solution(O.page);
    for (const c of s6) { const g = await buildGroup(O.page, c.tiles); await lockGroup(O.page, g, c.pos, c.neg, c.name, 'off'); }
    await O.page.click('#doneBtn'); await O.page.click('#pracCont');
    ok(await O.page.evaluate(() => window.__ion.save.coins > 0), 'offline practice full loop earns ⚛ (saved locally)');
    O.errors = O.errors.filter(e => !/Failed to load resource/.test(e));
    for (const p of H.players) ok(!p.errors.length, p.name + ': no console errors ' + (p.errors.length ? JSON.stringify(p.errors.slice(0, 3)) : ''));
  } catch (e) { console.error(e); fails++; }
  await H.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
