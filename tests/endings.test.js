// Round endings: time runs out ('time'), then everyone out ('allout'). Also teacher settings limit the naming choices.
// Run: node tests/endings.test.js
'use strict';
const { setup, solution, buildGroup, lockGroup, until, sleep } = require('./harness');
let fails = 0;
const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };

(async () => {
  const H = await setup({ config: { ROUND_MS: 20000, CHALLENGE_MS: 4000, REVEAL_MS: 3000, REVIEW_MS: 3000, TEACHERS: ['garciam'] } });
  try {
    // ---- teacher sets period 3: polyatomic only, shapes on, least naming = pick ----
    const T = await H.player('teacher');
    await T.page.click('#loginBtn'); await T.page.fill('#lgUser', 'garciam'); await T.page.fill('#lgId', '12345'); await T.page.click('#lgGo');
    await until(T.page, () => !document.querySelector('#teachCard').hidden);
    await T.page.click('[data-tp="3"]');
    await T.page.uncheck('#tMono'); await T.page.uncheck('#tPoly');
    await T.page.click('#tSave');
    ok(/Turn on/.test(await T.page.textContent('#tErr')), 'teacher must keep single-atom or polyatomic on');
    await T.page.check('#tPoly'); await T.page.click('[data-ts="on"]'); await T.page.click('[data-tn="pick"]');
    await H.shot(T, 'teacher', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);
    await T.page.click('#tSave');
    await sleep(800);
    const dump = await (await fetch('http://localhost:' + H.fake.port + '/dump')).json();
    const st = dump.settings && dump.settings.ionagrams && dump.settings.ionagrams['3'];
    ok(st && st.minNaming === 'pick' && st.shapes === true && st.sets.poly && !st.sets.mono, 'settings saved: ' + JSON.stringify(st));

    // ---- two guests in period 3 ----
    const P1 = await H.player('P1'), P2 = await H.player('P2', { viewport: { width: 390, height: 844 } });
    for (const p of [P1, P2]) await p.page.click('[data-per="3"]');
    await until(P1.page, () => document.querySelector('[data-pn="off"]').disabled);
    ok(true, 'practice naming "Off" disabled by the teacher minimum');
    await P1.page.click('#multiBtn'); await until(P1.page, () => document.querySelector('#sLobby.on') && !/Connecting/.test(document.querySelector('#lobbyMsg').textContent));
    await P1.page.click('#newRoomBtn');
    ok(await P1.page.evaluate(() => document.querySelector('[data-rn="off"]').disabled && document.querySelector('[data-rn="pick"]').getAttribute('aria-pressed') === 'true'), 'new room: Off disabled, Pick chosen');
    await P1.page.click('#rGo'); await until(P1.page, () => document.querySelector('#sWait.on'));
    await P2.page.click('#multiBtn'); await until(P2.page, () => document.querySelector('#rooms .room'));
    await P2.page.click('#rooms .room'); await until(P2.page, () => document.querySelector('#sWait.on'));
    for (const p of [P1, P2]) await p.page.click('#readyBtn');
    for (const p of [P1, P2]) await until(p.page, () => window.__ion.B && window.__ion.B.phase === 'build', null, 15000);
    const b = await P1.page.evaluate(() => ({ shapes: window.__ion.B.shapes, sets: window.__ion.B.sets, pieces: document.querySelectorAll('#tray .piece').length }));
    ok(b.shapes && b.pieces === 12 && !b.sets.mono, 'room uses teacher settings: puzzle-piece tiles, polyatomic only');
    const sol = await solution(P1.page);
    const g = await buildGroup(P1.page, sol[0].tiles); await buildGroup(P1.page, sol[1].tiles, true);
    await H.shot(P1, 'play-shapes', [{ width: 390, height: 844 }, { width: 1366, height: 650 }]);
    // ---- nobody finishes: time runs out ----
    for (const p of [P1, P2]) await until(p.page, () => document.querySelector('#sReview.on'), null, 30000);
    ok(/Time is up/.test(await P1.page.textContent('#revWhy')), 'round ended by time');
    ok(await P1.page.evaluate(() => /Not locked/.test(document.querySelector('#revGroups').textContent)), 'review lists unlocked groups as "Not locked"');
    for (const p of [P1, P2]) await until(p.page, () => document.querySelector('#sResults.on'), null, 10000);
    await P1.page.click('#againBtn');
    for (const p of [P1, P2]) await until(p.page, () => document.querySelector('#sWait.on'), null, 8000);
    for (const p of [P1, P2]) await p.page.click('#readyBtn');
    for (const p of [P1, P2]) await until(p.page, () => window.__ion.B && window.__ion.B.phase === 'build' && /\|2$/.test(window.__ion.B.key), null, 15000);
    // ---- both call Done with a wrong board: everyone out ----
    for (const p of [P1, P2]) {
      const s = await solution(p.page);
      for (let i = 0; i < s.length; i++) { const gg = await buildGroup(p.page, s[i].tiles); await lockGroup(p.page, gg, s[i].pos, s[i].neg + (i === 0 ? 1 : 0), s[i].name, 'pick'); }
    }
    await P1.page.click('#doneBtn');
    await until(P1.page, () => window.__ion.B.out && window.__ion.B.phase === 'build', null, 15000);
    ok(true, 'P1 out');
    await P2.page.click('#doneBtn');
    for (const p of [P1, P2]) await until(p.page, () => document.querySelector('#sReview.on'), null, 20000);
    ok(/Everyone is out/.test(await P2.page.textContent('#revWhy')), 'round ended with everyone out');
    for (const p of H.players) ok(!p.errors.length, p.name + ': no console errors ' + (p.errors.length ? JSON.stringify(p.errors.slice(0, 3)) : ''));
  } catch (e) { console.error(e); fails++; }
  await H.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
