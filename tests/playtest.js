// Multiplayer playtest: 4 bot players against the fakebase server, driving the real interface.
// Round 1: create/join/ready, build + lock, a reload restores a board, a wrong Done -> challenge -> flags -> reveal -> out,
// the host closes its tab, another player finishes correctly -> win -> review -> results -> Play again -> round 2 starts.
// Run: node tests/playtest.js
'use strict';
const { setup, solution, buildGroup, lockGroup, until, sleep } = require('./harness');
let fails = 0;
const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const PH = { w: 390, h: 844 }, BIG = [{ width: 390, height: 844 }, { width: 1366, height: 650 }];

(async () => {
  const H = await setup({ config: { CHALLENGE_BASE_MS: 9000, CHALLENGE_PER_COMPOUND_MS: 0, REVEAL_MS: 5000, REVIEW_MS: 7000 } });
  try {
    const A = await H.player('A'), Bp = await H.player('B', { viewport: { width: 390, height: 844 } }),
      C = await H.player('C'), D = await H.player('D', { viewport: { width: 390, height: 844 } });
    const all = [A, Bp, C, D];
    for (const p of all) await p.page.click('[data-per="3"]');
    // ---- A makes a room with "Pick the name" ----
    await A.page.click('#multiBtn');
    await until(A.page, () => document.querySelector('#sLobby.on') && !/Connecting/.test(document.querySelector('#lobbyMsg').textContent));
    await A.page.click('#newRoomBtn'); await A.page.click('[data-rn="pick"]');
    await H.shot(A, 'newroom', BIG);
    await A.page.click('#rGo');
    await until(A.page, () => document.querySelector('#sWait.on'));
    ok(true, 'A created a room and is waiting');
    await Bp.page.click('#multiBtn');
    await until(Bp.page, () => document.querySelector('#rooms .room'));
    await H.shot(Bp, 'lobby', BIG);
    for (const p of [Bp, C, D]) {
      if (p !== Bp) { await p.page.click('#multiBtn'); await until(p.page, () => document.querySelector('#rooms .room:not(:disabled)')); }
      await p.page.click('#rooms .room');
      await until(p.page, () => document.querySelector('#sWait.on'));
    }
    await until(A.page, () => document.querySelectorAll('#plist li').length === 4);
    ok(true, 'B, C, D joined (4 players listed)');
    await until(A.page, () => document.querySelector('#cd .ring'));
    await H.shot(A, 'waiting', BIG);
    for (const p of all) await p.page.click('#readyBtn');
    await until(A.page, () => !document.querySelector('#cover').hidden, null, 8000).catch(() => {});
    await H.shot(D, 'countdown-321');
    for (const p of all) await until(p.page, () => window.__ion.B && window.__ion.B.phase === 'build', null, 15000);
    const info = await Promise.all(all.map(p => p.page.evaluate(() => ({ key: window.__ion.B.key, n: Object.keys(window.__ion.B.tiles).length, host: window.__ion.M.room.isHost(), naming: window.__ion.B.naming }))));
    ok(info.every(x => x.key === info[0].key && x.n === 12 && x.naming === 'pick'), 'everyone started round 1 with 12 tiles, naming pick');
    ok(info[0].host && !info[1].host, 'A is the host');

    // ---- build ----
    const sols = await Promise.all(all.map(p => solution(p.page)));
    ok(sols.every(Boolean), 'every hand has a full solution');
    const buildAll = async (p, sol, opt = {}) => {
      const gids = [];
      for (let i = 0; i < (opt.count || sol.length); i++) {
        const g = await buildGroup(p.page, sol[i].tiles, i === 1);
        gids.push(g);
        if (opt.lock !== false) await lockGroup(p.page, g, sol[i].pos + (opt.wrong === i ? 1 : 0), sol[i].neg, sol[i].name, 'pick');
      }
      return gids;
    };
    await Promise.all([buildAll(A, sols[0]), buildAll(Bp, sols[1], { wrong: 0 }), buildAll(C, sols[2], { count: 2 }), buildAll(D, sols[3], { count: 2 })]);
    ok(await Bp.page.evaluate(() => !document.querySelector('#doneBtn').disabled), 'B: Done enabled');
    await sleep(1200);
    const opp = await A.page.evaluate(() => document.querySelector('#opps').textContent);
    ok(/0 left/.test(opp), 'opponents strip shows tiles left (' + opp.replace(/\s+/g, ' ').slice(0, 80) + ')');
    await H.shot(A, 'play-multi', BIG);
    await H.shot(Bp, 'play-multi-B', [{ width: 390, height: 844 }]);

    // ---- C reloads mid-round: board comes back ----
    const before = await C.page.evaluate(() => JSON.stringify(window.__ion.B.groups.map(g => [g.tiles, g.locked, g.pos, g.neg, g.name])) + '|' + window.__ion.B.tray.join());
    await C.page.reload();
    await until(C.page, () => window.__ion && window.__ion.B && window.__ion.B.phase === 'build', null, 15000);
    const after = await C.page.evaluate(() => JSON.stringify(window.__ion.B.groups.map(g => [g.tiles, g.locked, g.pos, g.neg, g.name])) + '|' + window.__ion.B.tray.join());
    ok(before === after, 'C reloaded mid-round and the board was restored');
    await buildAll(C, sols[2].slice(2));

    // ---- B calls Done with one wrong claim ----
    await Bp.page.click('#doneBtn');
    for (const p of all) await until(p.page, () => document.querySelector('#checkArea:not([hidden]) .cg'), null, 8000);
    ok(true, 'everyone froze into the challenge');
    ok(await Bp.page.evaluate(() => /Others are checking/.test(document.querySelector('#checkArea').textContent)), 'caller sees "Others are checking your compounds."');
    await A.page.click('[data-flag="0"]'); await C.page.click('[data-flag="0"]'); await D.page.click('[data-flag="1"]');
    await sleep(600);
    await H.shot(A, 'challenge', BIG);
    await H.shot(Bp, 'challenge-caller');
    await until(A.page, () => /mistake/.test(document.querySelector('#checkArea h2').textContent), null, 15000);
    await sleep(400);
    await H.shot(A, 'reveal', BIG);
    await H.shot(D, 'reveal-D');
    const rv = await A.page.evaluate(() => document.querySelector('#checkArea').textContent);
    ok(/You caught it/.test(rv) && /Flagged by/.test(rv), 'reveal shows why, flaggers and +15 for a right flag');
    ok(/Your flag was wrong/.test(await D.page.evaluate(() => document.querySelector('#checkArea').textContent)), 'D sees −10 for a wrong flag');
    await until(Bp.page, () => window.__ion.B.out && window.__ion.B.phase === 'build' && !document.querySelector('#outBanner').hidden, null, 12000);
    ok(true, 'B is out and sees the keep-watching banner');
    await until(A.page, () => window.__ion.B.phase === 'build', null, 5000);
    ok(await A.page.evaluate(() => window.__ion.B.groups.every(g => g.locked)), 'A resumed with board unchanged');
    await H.shot(Bp, 'out-B');

    // ---- the host (A) closes its tab; C finishes correctly ----
    await A.ctx.close();
    await until(Bp.page, () => window.__ion.M.room.isHost(), null, 8000);
    ok(true, 'host left: B is the new host');
    await sleep(300);
    await C.page.click('#doneBtn');
    await until(D.page, () => document.querySelector('#checkArea:not([hidden]) .cg'), null, 8000);
    await until(C.page, () => document.querySelector('#sReview.on'), null, 30000);
    ok(true, 'new host ended the round after a correct Done (win)');
    for (const p of [Bp, D]) await until(p.page, () => document.querySelector('#sReview.on'), null, 10000);
    const rc = await C.page.evaluate(() => ({ won: window.__ion.RV.won, lines: window.__ion.RV.sc.lines.map(l => l.label + ' ' + l.pts), total: window.__ion.RV.sc.total, coins: window.__ion.save.coins }));
    ok(rc.won && rc.lines.some(l => /^Won the round 40/.test(l)) && rc.lines.some(l => /^Caught 1 mistake 15/.test(l)), 'C review: ' + rc.lines.join('; '));
    ok(rc.coins === rc.total, 'C got ⚛ ' + rc.total);
    const rd = await D.page.evaluate(() => window.__ion.RV.sc.lines.map(l => l.label + ' ' + l.pts));
    ok(rd.some(l => /^1 wrong flag -10/.test(l)), 'D review: ' + rd.join('; '));
    const rb = await Bp.page.evaluate(() => ({ lines: window.__ion.RV.sc.lines.map(l => l.label + ' ' + l.pts), missed: window.__ion.save.missed, st: window.__ion.save.stats }));
    ok(rb.lines[0].startsWith((sols[1].length - 1) + ' correct') && Object.keys(rb.missed).length === 2 && rb.st.locked === sols[1].length, 'B review: ' + rb.lines.join('; ') + ' missed ' + JSON.stringify(rb.missed));
    await H.shot(C, 'review', BIG);
    await H.shot(Bp, 'review-B');
    for (const p of [Bp, C, D]) await p.page.click('#revCont');
    for (const p of [Bp, C, D]) await until(p.page, () => document.querySelector('#sResults.on') && document.querySelectorAll('#resList li').length >= 3, null, 8000);
    await until(C.page, () => document.querySelectorAll('#resList .pt').length && ![...document.querySelectorAll('#resList .pt')].some(e => e.textContent === '…' && e.closest('li').textContent.includes('reviewing')), null, 8000).catch(() => {});
    await H.shot(C, 'results', BIG);
    await H.shot(Bp, 'results-host');
    const res = await C.page.evaluate(() => document.querySelector('#resList li').textContent);
    ok(/Winner/.test(res) && /\(you\)/.test(res), 'results: C on top as winner');
    ok(await Bp.page.evaluate(() => !document.querySelector('#againBtn').disabled) && await D.page.evaluate(() => document.querySelector('#againBtn').disabled), 'only the host can tap Play again');

    // ---- play again -> round 2 ----
    await Bp.page.click('#againBtn');
    for (const p of [Bp, C, D]) await until(p.page, () => document.querySelector('#sWait.on'), null, 8000);
    ok(true, 'Play again took everyone back to the room');
    for (const p of [Bp, C, D]) await p.page.click('#readyBtn');
    for (const p of [Bp, C, D]) await until(p.page, () => window.__ion.B && window.__ion.B.phase === 'build' && /\|2$/.test(window.__ion.B.key), null, 15000);
    const r2 = await Promise.all([Bp, C, D].map(p => p.page.evaluate(() => ({ out: window.__ion.B.out, n: window.__ion.B.tray.length, groups: window.__ion.B.groups.length }))));
    ok(r2.every(x => !x.out && x.n === 12 && x.groups === 0), 'round 2 started fresh for everyone (B no longer out)');

    for (const p of all) ok(!p.errors.length, p.name + ': no console errors ' + (p.errors.length ? JSON.stringify(p.errors.slice(0, 3)) : ''));
  } catch (e) { console.error(e); fails++; }
  await H.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
