// How to play next to real rooms (fake Firebase): works from the lobby, never opens in a room or mid-round, and leaves the round untouched.
// Run: node tests/howto.room.test.js
'use strict';
const { setup, until, sleep } = require('./harness');
let fails = 0; const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
(async () => {
  const H = await setup();
  try {
    const A = await H.player('A'), B = await H.player('B');
    // real lobby with the fake Firebase; auto-open is skipped by robots, so open it by hand
    for (const p of [A, B]) await p.page.click('[data-per="3"]');
    await A.page.click('#multiBtn'); await until(A.page, () => document.querySelector('#newRoomBtn') && !document.querySelector('#lobbyMsg').textContent);
    ok(await A.page.locator('#sLobby .htOpenBtn').isVisible(), 'lobby: How to play button visible');
    await A.page.click('#sLobby .htOpenBtn'); await sleep(200);
    ok(await A.page.evaluate(() => IonHowTo.isOpen()), 'lobby: demo opens');
    await A.page.keyboard.press('Escape'); await sleep(200);
    ok(await A.page.evaluate(() => document.querySelector('.screen.on').id) === 'sLobby', 'lobby: closing leaves the lobby');
    await A.page.click('#newRoomBtn'); await A.page.click('#rGo');
    await until(A.page, () => window.__ion.M); 
    await until(A.page, () => document.querySelector('.screen.on').id === 'sWait');
    ok(true, 'A made a room after opening and closing the demo');
    // in a real room: ? shows the short list and never the demo
    await A.page.click('#helpBtn'); await sleep(200);
    ok(await A.page.evaluate(() => !IonHowTo.isOpen() && document.getElementById('dHelp').open), 'in a room: ? shows the short rules list');
    ok(/keeps going/.test(await A.page.locator('#htRoomNote').innerText()), 'with the note');
    await A.page.keyboard.press('Escape'); await sleep(150);
    ok(await A.page.evaluate(() => IonHowTo.open() === false), 'in a room: open() refuses');
    await B.page.click('#multiBtn'); await until(B.page, () => document.querySelector('#rooms .room:not(:disabled)'));
    await B.page.click('#rooms .room'); await until(B.page, () => window.__ion.M);
    for (const p of [A, B]) await p.page.click('#readyBtn');
    await until(A.page, () => window.__ion.B && document.querySelectorAll('#tray [data-tile]').length === 12, null, 30000);
    const tiles = await A.page.evaluate(() => window.__ion.B.tray.join());
    await A.page.click('#helpBtn'); await sleep(200);
    ok(await A.page.evaluate(() => !IonHowTo.isOpen() && document.getElementById('dHelp').open), 'mid-round: ? shows the short list only');
    await A.page.keyboard.press('Escape'); await sleep(150);
    ok(await A.page.evaluate(() => window.__ion.B.tray.join()) === tiles && await A.page.evaluate(() => window.__ion.M != null), 'mid-round: round and hand untouched');
    for (const p of [A, B]) ok(p.errors.length === 0, p.name + ': no console errors ' + p.errors.join('|'));
  } finally { await H.close(); }
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
