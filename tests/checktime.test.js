// Oct 19 update: challenge time scales with compounds, "I'm done checking" ends it early,
// back-to-iBond link only outside rooms, tray sits beside the compounds on a Chromebook.
// Run: node tests/checktime.test.js
'use strict';
const { setup, solution, buildGroup, lockGroup, until, sleep } = require('./harness');
let fails = 0;
const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
(async () => {
  const H = await setup({ config: { CHALLENGE_BASE_MS: 30000, CHALLENGE_PER_COMPOUND_MS: 10000, CHALLENGE_MAX_MS: 90000, REVEAL_MS: 3000 } });
  try {
    const A = await H.player('A', { viewport: { width: 1366, height: 650 } }), Bp = await H.player('B');
    ok(await A.page.evaluate(() => !document.querySelector('#homeBtn').hidden && document.querySelector('#homeBtn').getAttribute('href') === '../'), 'start screen: back link to iBond home shows');
    for (const p of [A, Bp]) await p.page.click('[data-per="3"]');
    await A.page.click('#multiBtn');
    await until(A.page, () => document.querySelector('#sLobby.on') && !/Connecting/.test(document.querySelector('#lobbyMsg').textContent));
    ok(await A.page.evaluate(() => !document.querySelector('#homeBtn').hidden), 'lobby: back link shows');
    await A.page.click('#newRoomBtn'); await A.page.click('#rGo');
    await until(A.page, () => document.querySelector('#sWait.on'));
    ok(await A.page.evaluate(() => document.querySelector('#homeBtn').hidden), 'in a room: back link hidden (use Leave)');
    await Bp.page.click('#multiBtn'); await until(Bp.page, () => document.querySelector('#rooms .room'));
    await Bp.page.click('#rooms .room'); await until(Bp.page, () => document.querySelector('#sWait.on'));
    for (const p of [A, Bp]) await p.page.click('#readyBtn');
    for (const p of [A, Bp]) await until(p.page, () => window.__ion.B && window.__ion.B.phase === 'build', null, 20000);
    // layout at 1366: tray to the LEFT of the compounds and right next to them
    const geo = await A.page.evaluate(() => { const t = document.querySelector('#trayZone').getBoundingClientRect(), g = document.querySelector('#groups').firstElementChild.getBoundingClientRect(); return { tr: t.right, gl: g.left, tt: t.top, gt: g.top }; });
    ok(geo.gl > geo.tr && geo.gl - geo.tr < 40, `1366 wide: first compound slot is ${Math.round(geo.gl - geo.tr)} px from the tray`);
    await H.shot(A, 'play-1366-trayleft', [{ width: 1366, height: 650 }]);
    const sol = await solution(A.page);
    for (let i = 0; i < sol.length; i++) { const g = await buildGroup(A.page, sol[i].tiles, false); await lockGroup(A.page, g, sol[i].pos, sol[i].neg, sol[i].name, 'off'); }
    await A.page.click('#doneBtn');
    await until(Bp.page, () => document.querySelector('#chkDoneBtn'), null, 8000);
    const dur = await Bp.page.evaluate(() => { const t = document.querySelector('#chkLeft').textContent; return parseInt(t); });
    const want = Math.min(90, 30 + 10 * sol.length);
    ok(Math.abs(dur - want) <= 2, `${sol.length} compounds → about ${want} s to check (shows ${dur} s)`);
    ok(await A.page.evaluate(() => /0 of 1 finished checking/.test(document.querySelector('#checkArea').textContent)), 'caller sees 0 of 1 finished checking');
    await H.shot(Bp, 'challenge-donebtn', [{ width: 1366, height: 650 }, { width: 390, height: 844 }]);
    const t0 = Date.now();
    await Bp.page.click('#chkDoneBtn');
    await until(Bp.page, () => /got them all right|mistake/.test(document.querySelector('#checkArea h2').textContent), null, 15000);
    ok(Date.now() - t0 < 6000, `everyone done → reveal in ${((Date.now() - t0) / 1000).toFixed(1)} s instead of waiting out the clock`);
    await until(A.page, () => /You win/.test(document.querySelector('#checkArea h2').textContent), null, 8000);
    ok(true, 'caller sees the win');
  } catch (e) { console.log('FAIL ' + (e && e.message)); fails++; }
  await H.close();
  console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
