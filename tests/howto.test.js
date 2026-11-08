// How to play (ionagrams/howto.js) in a real browser: auto-open once, both input methods (tap and drag), every step, entry points, safety.
// Run: node tests/howto.test.js     (needs Playwright + Chromium; the theme files come from THEME or a nearby ../theme checkout)
// Screenshots go to HOWTO_SHOTS (default: a temp folder).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..');
const THEME = [process.env.THEME, path.join(ROOT, '../theme'), path.join(ROOT, '../../theme'), '/home/claude/work/theme', '/home/claude/theme'].find(p => p && fs.existsSync(path.join(p, 'login-v1.js')));
const SHOTS = process.env.HOWTO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'howto-shots-'));
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };

function staticServer() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); rsp.end(fs.readFileSync(p));
    });
    srv.listen(0, () => res(srv));
  });
}
const WIDE = { width: 1366, height: 650 }, PHONE = { width: 390, height: 844 };

(async () => {
  const web = await staticServer(), browser = await chromium.launch();
  const base = 'http://localhost:' + web.address().port + '/ionagrams/index.html';
  // a fresh browser context = a student who has never opened the game. Everything outside the game is stubbed: no network is needed.
  async function open(o = {}) {
    const ctx = await browser.newContext({ viewport: o.viewport || WIDE, hasTouch: !!o.touch, isMobile: !!o.touch, reducedMotion: o.reduced ? 'reduce' : 'no-preference', colorScheme: o.dark ? 'dark' : 'light' });
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
    await ctx.route(/gstatic\.com\/firebasejs|firebaseio\.com|script\.google\.com/, r => r.abort());
    await ctx.route('https://gibsonm1.github.io/theme/**', r => {
      const f = THEME && path.join(THEME, new URL(r.request().url()).pathname.replace('/theme/', ''));
      if (f && fs.existsSync(f)) r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); else r.abort();
    });
    if (o.blockStorage) await ctx.addInitScript(() => { const t = () => { throw new Error('blocked'); }; Storage.prototype.getItem = t; Storage.prototype.setItem = t; Storage.prototype.removeItem = t; });
    await ctx.addInitScript(auto => { window.IONHOWTO_CONFIG = auto ? { SKIP_WHEN_AUTOMATED: false } : { AUTO_OPEN_FIRST_VISIT: false }; }, !!o.auto);
    const pg = await ctx.newPage(), errors = [];
    pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await pg.goto(base + (o.query || ''));
    await pg.waitForFunction(() => window.__ion && window.IonHowTo, null, { polling: 100 });
    return { ctx, pg, errors };
  }
  const shot = (P, name) => P.pg.screenshot({ path: path.join(SHOTS, name + '.png') });
  const isOpen = P => P.pg.evaluate(() => window.IonHowTo.isOpen() && document.getElementById('htDlg').open);
  const tap = (P, sel) => P.pg.locator(sel).first().click();
  const msg = P => P.pg.locator('#htMsg').innerText();
  const stageText = P => P.pg.locator('#htStage').innerText();
  const goStep = async (P, n) => { await tap(P, `.ht-pill[data-ht-go="${n - 1}"]`); await sleep(120); };
  async function drag(P, from, to) {
    const a = await P.pg.locator(from).first().boundingBox(), b = await P.pg.locator(to).first().boundingBox();
    await P.pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await P.pg.mouse.down();
    await P.pg.mouse.move(a.x + a.width / 2 + 14, a.y + a.height / 2 + 14, { steps: 3 });
    await P.pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await P.pg.mouse.up(); await sleep(80);
  }
  const noOverflow = async (P, name) => {
    const r = await P.pg.evaluate(() => { const b = document.querySelector('.ht-body'), d = document.getElementById('htDlg'); const r = d.getBoundingClientRect();
      return { scroll: b.scrollHeight - b.clientHeight, h: d.scrollWidth - d.clientWidth, inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; });
    ok(r.scroll <= 1 && r.h <= 0 && r.inView, name + ': fits without scrolling (' + JSON.stringify(r) + ')');
  };
  const tileIds = P => P.pg.evaluate(() => [...document.querySelectorAll('#htStage .ht-tray [data-ht-tile]')].map(b => b.getAttribute('aria-label')));

  // ---------- A. first visit: opens by itself, once ----------
  let P = await open({ auto: true });
  await P.pg.waitForFunction(() => window.IonHowTo.isOpen(), null, { timeout: 4000 });
  ok(await isOpen(P), 'first visit: How to play opens by itself');
  ok(await P.pg.evaluate(() => localStorage.getItem('ionagrams-seenhowto')) === '1', 'it remembers (ionagrams-seenhowto)');
  ok(await P.pg.locator('#htNext').evaluate(e => e === document.activeElement), 'focus starts on Next');
  await shot(P, 'w-0-first-visit');
  await P.pg.keyboard.press('Escape'); await sleep(150);
  ok(!(await isOpen(P)), 'Escape closes it');
  ok(await P.pg.evaluate(() => document.querySelector('.screen.on').id) === 'sStart', 'still on the start screen');
  await P.pg.reload(); await P.pg.waitForFunction(() => window.IonHowTo); await sleep(1300);
  ok(!(await isOpen(P)), 'second visit: does not open by itself');
  ok(await P.pg.locator('#sStart .htOpenBtn').isVisible(), 'start screen has a How to play button');
  await tap(P, '#sStart .htOpenBtn'); await sleep(150);
  ok(await isOpen(P), 'the start-screen button opens it');
  ok(await P.pg.locator('.ht-pill:not(:disabled)').count() === 7, 'opened again: every step can be picked');
  await P.pg.keyboard.press('Escape'); await sleep(150);
  ok(await P.pg.evaluate(() => document.activeElement.classList.contains('htOpenBtn')), 'closing returns focus to the button');
  await P.pg.click('#helpBtn'); await sleep(150);
  ok(await isOpen(P), 'the ? button in the top bar opens it');
  ok(await P.pg.locator('#helpBtn').getAttribute('aria-label') === 'How to play' && !!(await P.pg.locator('#helpBtn').getAttribute('title')), 'the ? button has a label and tooltip');
  await P.ctx.close();

  // a student whose browser blocks storage still gets a working page (the demo opens, nothing crashes)
  P = await open({ auto: true, blockStorage: true });
  await P.pg.waitForFunction(() => window.IonHowTo.isOpen(), null, { timeout: 4000 });
  await tap(P, '#htNext'); await tap(P, '#htX'); await sleep(100);
  ok(!(await isOpen(P)) && P.errors.length === 0, 'storage blocked: it still opens and closes, no errors (' + P.errors.join(' | ') + ')');
  await P.ctx.close();

  // ---------- B. the steps, tap method ----------
  P = await open({ query: '?howto' });
  await P.pg.waitForSelector('#htDlg[open]');
  ok(await P.pg.locator('.ht-pill:not(:disabled)').count() === 1, 'first time: only step 1 can be picked');
  ok(await P.pg.locator('#htSkip').isVisible() && await P.pg.locator('#htBack').isDisabled(), 'step 1: Skip shown, Back off');
  await noOverflow(P, 'step 1 (1366x650)'); await shot(P, 'w-1-hand');
  await tap(P, '[data-ht-tile="t1"]');
  ok(/Ca²⁺ is the calcium ion\. Its charge is \+2\. It is a positive ion\./.test(await stageText(P)), 'step 1: tapping Ca shows its name and charge');
  await tap(P, '[data-ht-tile="t3"]');
  ok(/chloride ion.*−1.*negative/s.test(await stageText(P)), 'step 1: tapping Cl shows a negative ion');
  await shot(P, 'w-1-hand-tapped');
  await tap(P, '#htNext'); await sleep(100);
  ok(/Step 2 of 7/.test(await P.pg.locator('#htStepOf').innerText()), 'Next goes to step 2');
  // the animated demo
  await P.pg.waitForFunction(() => /CaCl\u2082|CaCl2/.test(document.getElementById('htStage').innerText) && /formula is CaCl₂/.test(document.getElementById('htMsg').innerText), null, { timeout: 9000 });
  ok(/\+2 −1 −1 = 0 ✓/.test(await stageText(P)), 'step 2 demo: running sum ends at +2 −1 −1 = 0 ✓');
  ok(/Helper/i.test(await stageText(P)), 'step 2: the sum row is labeled Helper');
  await noOverflow(P, 'step 2 watch (1366x650)'); await shot(P, 'w-2-watch');
  await tap(P, '[data-ht-act="watch"]'); await sleep(1300);
  ok(/\+2 = \+2|\+2$/m.test(await stageText(P)) || (await stageText(P)).includes('+2'), 'Watch again restarts the demo (partial sum showing)');
  await shot(P, 'w-2-watch-mid');
  await tap(P, '[data-ht-act="try"]'); await sleep(100);
  ok((await tileIds(P)).length === 4 && /Now you try/.test(await msg(P)), 'Now you try: 4 tiles, instructions');
  ok(await P.pg.locator('[data-k="t:t0"].ht-coach').count() === 1 && await P.pg.locator('.ht-coach').first().getAttribute('data-coach') === 'Tap here', 'coach mark on the first tile');
  await noOverflow(P, 'step 2 try (1366x650)'); await shot(P, 'w-2-try');
  // tap method: tile, then New compound
  await tap(P, '[data-ht-tile="t0"]');
  ok(await P.pg.locator('[data-k="drop:new"].ht-coach').count() === 1, 'after picking a tile the coach mark moves to New compound');
  await shot(P, 'w-2-try-picked');
  await tap(P, '[data-ht-drop="new"]');
  ok(await P.pg.locator('#htStage .grp').count() === 1, 'tap method: New compound makes a compound');
  await tap(P, '[data-ht-tile="t1"]'); await tap(P, '.addhere[data-ht-drop="g:g1"]');   // second Na
  ok(/Add a negative ion/.test(await msg(P)), 'Na + Na: asks for a negative ion');
  await tap(P, '[data-ht-tile="t3"]'); await tap(P, '.addhere[data-ht-drop="g:g1"]');   // the Cl on purpose: the wrong tile
  ok(/must be 0/.test(await msg(P)) && /warn/.test(await P.pg.locator('#htMsg').getAttribute('class')), 'a wrong tile gets a gentle "must be 0" message (no red failure)');
  ok(/\+1 \+1 −1 = \+1/.test(await stageText(P)), 'the Helper row shows +1 +1 −1 = +1');
  await shot(P, 'w-2-try-wrong');
  await tap(P, '[data-ht-tile="t3"]'); await tap(P, '.addhere[data-ht-drop="tray"]');
  ok((await tileIds(P)).length === 2, 'Put it back here returns the tile');
  await tap(P, '[data-ht-tile="t2"]'); await tap(P, '.addhere[data-ht-drop="g:g1"]');
  ok(/Yes!.*Na₂O/.test(await msg(P)), 'tap method: Na, Na, O makes Na₂O and says Yes');
  await noOverflow(P, 'step 2 success (1366x650)'); await shot(P, 'w-2-try-done');
  // drag method
  await tap(P, '[data-ht-act="reset"]'); await sleep(80);
  await drag(P, '[data-ht-tile="t0"]', '[data-ht-drop="new"]');
  ok(await P.pg.locator('#htStage .grp').count() === 1, 'drag method: dragging a tile onto New compound makes a compound');
  await drag(P, '[data-ht-tile="t1"]', '.grp[data-ht-drop="g:g1"] .fm');
  await drag(P, '[data-ht-tile="t2"]', '.grp[data-ht-drop="g:g1"] .tiles');
  ok(/Yes!.*Na₂O/.test(await msg(P)), 'drag method: Na, Na, O makes Na₂O and says Yes');
  await drag(P, '.grp [data-ht-tile="t2"]', '.ht-traybox');
  ok((await tileIds(P)).length === 2, 'drag method: dragging a tile back to the tray works');
  ok(!(await P.pg.evaluate(() => !!document.querySelector('.ht-ghost'))), 'no drag ghost is left behind');
  // step 3
  await tap(P, '#htNext'); await sleep(100);
  ok(await P.pg.locator('.ht-cards .cg').count() === 3, 'step 3: three wrong compounds');
  const t3 = await stageText(P);
  ok(/not 0/.test(t3) && /smallest ratio/.test(t3) && /one kind of/.test(t3), 'step 3: charges, ratio and mixed-ion reasons');
  ok(/nothing tells you|does not tell you/.test(await msg(P)), 'step 3: says clearly that the real game does not tell you when you are wrong');
  await noOverflow(P, 'step 3 (1366x650)'); await shot(P, 'w-3-whynot');
  // step 4: lock
  await tap(P, '#htNext'); await sleep(100);
  ok(await P.pg.locator('[data-k="act:lock"].ht-coach').count() === 1, 'step 4: coach mark on Lock');
  await noOverflow(P, 'step 4 (1366x650)'); await shot(P, 'w-4-lock');
  await tap(P, '[data-ht-act="lock"]'); await sleep(100);
  ok(await P.pg.locator('#ht-in-pos').evaluate(e => e === document.activeElement), 'Lock opens the totals panel with focus on the + box');
  await noOverflow(P, 'step 4 panel (1366x650)'); await shot(P, 'w-4-panel');
  await tap(P, '#htLockForm button[type=submit]'); await sleep(100);
  ok(/Not yet\. Total \+ charge is \+2, not 0\./.test(await msg(P)) && await P.pg.locator('#htLockForm').count() === 1, 'wrong totals: friendly "Not yet" with the reason, panel stays');
  await shot(P, 'w-4-panel-wrong');
  await tap(P, '[data-ht-step="pos"][data-d="1"]'); await tap(P, '[data-ht-step="pos"][data-d="1"]');
  await P.pg.fill('#ht-in-neg', '2');
  await P.pg.keyboard.press('Enter'); await sleep(100);
  ok(/Locked!/.test(await msg(P)) && /\+2 \/ −2/.test(await stageText(P)) && await P.pg.locator('[data-ht-act="unlock"]').count() === 1, 'right totals (typed + stepper, Enter to lock): locked, claims +2 / −2 shown');
  ok(/does not check/.test(await msg(P)), 'step 4: says nothing is checked until Done');
  await shot(P, 'w-4-locked');
  await tap(P, '[data-ht-act="unlock"]'); await sleep(60);
  ok(await P.pg.locator('[data-ht-act="lock"]').count() === 1, 'Unlock goes back');
  // step 5: swap (tap)
  await tap(P, '#htNext'); await sleep(100);
  ok((await tileIds(P)).length === 3 && await P.pg.locator('[data-k="t:t2"].ht-coach').count() === 1, 'step 5: 3 tiles, coach on Al');
  await noOverflow(P, 'step 5 (1366x650)'); await shot(P, 'w-5-swap');
  await tap(P, '[data-ht-tile="t2"]');
  ok(await P.pg.locator('[data-k="drop:swap"].ht-coach').count() === 1, 'step 5: coach moves to Swap');
  await tap(P, '[data-ht-drop="swap"]'); await sleep(80);
  let tl = await tileIds(P);
  ok(tl.length === 4 && /Mg|Cl|K/.test(tl.join()) && !/Al/.test(tl.join()) && /gave Al³⁺/.test(await msg(P)), 'tap method: gave 1, got 2 (4 tiles now)');
  await shot(P, 'w-5-swapped');
  await tap(P, '[data-ht-act="reset"]'); await sleep(60);
  await drag(P, '[data-ht-tile="t2"]', '[data-ht-drop="swap"]');
  tl = await tileIds(P);
  ok(tl.length === 4 && !/Al/.test(tl.join()), 'drag method: swap works too');
  // step 6
  await tap(P, '#htNext'); await sleep(100);
  await noOverflow(P, 'step 6 (1366x650)'); await shot(P, 'w-6-challenge');
  await tap(P, '[data-ht-act="hint"]');
  ok(/add up the charges/i.test(await msg(P)), 'step 6: hint button');
  await tap(P, '[data-ht-act="flag"][data-i="1"]');
  ok(await P.pg.locator('[data-ht-act="flag"][data-i="1"]').getAttribute('aria-pressed') === 'true' && /Looks wrong/.test(await stageText(P)) && /flagged 1/.test(await msg(P)), 'flagging marks the compound (icon + words, not only color)');
  await shot(P, 'w-6-flagged');
  await tap(P, '[data-ht-act="check"]'); await sleep(80);
  const t6 = await stageText(P);
  ok(/Maya had a mistake/.test(t6) && /Maya is out/.test(t6) && /wins the round/.test(t6) && /Correct/.test(t6) && /Wrong/.test(t6) && /\+15/.test(t6), 'reveal: verdict, what "out" means, who wins, +15 for the catch');
  ok(/caught the mistake/.test(await msg(P)), 'reveal message for catching it');
  await noOverflow(P, 'step 6 reveal (1366x650)'); await shot(P, 'w-6-reveal');
  await tap(P, '[data-ht-act="reset"]'); await tap(P, '[data-ht-act="flag"][data-i="0"]'); await tap(P, '[data-ht-act="check"]'); await sleep(60);
  ok(/costs 10 points/.test(await msg(P)) && /−10/.test(await stageText(P)), 'flagging a correct compound: friendly −10 explanation');
  await tap(P, '[data-ht-act="reset"]'); await tap(P, '[data-ht-act="check"]'); await sleep(60);
  ok(/did not flag anything/.test(await msg(P)), "not answering is handled: shows the answer anyway");
  // step 7
  await tap(P, '#htNext'); await sleep(100);
  ok(/Step 7 of 7/.test(await P.pg.locator('#htStepOf').innerText()) && await P.pg.locator('#htSkip').isHidden() && (await P.pg.locator('#htNext').innerText()) === 'Finish', 'step 7: Finish replaces Next');
  const t7 = await stageText(P);
  ok(/\+10/.test(t7) && /2 more/.test(t7) && /= 16/.test(t7) && /\+40/.test(t7) && /\+15/.test(t7) && /−10/.test(t7), 'step 7: points match rules.js (10, 2 per tile, 40, 15, −10)');
  await noOverflow(P, 'step 7 (1366x650)'); await shot(P, 'w-7-points');
  // every step reachable by number; skip closes
  await goStep(P, 3);
  ok(/Step 3 of 7/.test(await P.pg.locator('#htStepOf').innerText()), 'a finished step can be picked from the step numbers');
  await tap(P, '#htSkip'); await sleep(100);
  ok(!(await isOpen(P)), 'Skip closes');
  ok(P.errors.length === 0, 'no console errors or warnings (' + P.errors.join(' | ') + ')');
  await P.ctx.close();

  // ---------- B2. keyboard only (Tab / Enter): build a compound ----------
  P = await open({ query: '?howto' });
  await P.pg.waitForSelector('#htDlg[open]'); await P.pg.keyboard.press('Enter'); await P.pg.waitForFunction(() => /Step 2/.test(document.getElementById('htStepOf').innerText));   // Enter on Next (it has focus)
  await P.pg.locator('[data-ht-act="try"]').focus(); await P.pg.keyboard.press('Enter'); await sleep(80);
  await P.pg.locator('[data-ht-tile="t0"]').focus(); await P.pg.keyboard.press('Enter'); await sleep(50);
  ok(await P.pg.evaluate(() => document.activeElement.dataset.k) === 't:t0' && await P.pg.locator('[data-ht-tile="t0"]').getAttribute('aria-pressed') === 'true', 'keyboard: Enter picks the tile and focus stays on it');
  await P.pg.locator('[data-ht-drop="new"]').focus(); await P.pg.keyboard.press('Space'); await sleep(50);
  ok(await P.pg.locator('#htStage .grp').count() === 1, 'keyboard: Space on New compound makes a compound');
  await P.pg.locator('[data-ht-tile="t1"]').focus(); await P.pg.keyboard.press('Enter');
  await P.pg.locator('.addhere[data-ht-drop="g:g1"]').focus(); await P.pg.keyboard.press('Enter');
  await P.pg.locator('[data-ht-tile="t2"]').focus(); await P.pg.keyboard.press('Enter');
  await P.pg.locator('.addhere[data-ht-drop="g:g1"]').focus(); await P.pg.keyboard.press('Enter'); await sleep(50);
  ok(/Yes!.*Na₂O/.test(await msg(P)), 'keyboard: Na, Na, O makes Na₂O');
  // Tab never leaves the demo while it is open
  for (let i = 0; i < 45; i++) { await P.pg.keyboard.press('Tab'); if (!(await P.pg.evaluate(() => !!document.activeElement.closest('#htDlg') || document.activeElement === document.body))) { ok(false, 'Tab left the demo'); break; } }
  ok(true, 'Tab stays inside the demo');
  await P.ctx.close();

  // ---------- C. Practice alone now, from the last step ----------
  P = await open({ query: '?howto' });
  await P.pg.waitForSelector('#htDlg[open]');
  for (let i = 0; i < 6; i++) { await tap(P, '#htNext'); await sleep(60); }
  await tap(P, '[data-ht-act="practice"]'); await sleep(250);
  ok(!(await isOpen(P)) && await P.pg.evaluate(() => document.querySelector('.screen.on').id === 'sPlay' && window.__ion.B && window.__ion.B.mode === 'solo'), 'Practice alone now: closes and starts practice');
  ok(await P.pg.locator('#tray [data-tile]').count() === 12, 'practice dealt 12 tiles');
  // opening in the middle of practice must not disturb the board
  await P.pg.locator('#tray [data-tile]').first().click();
  const before = await P.pg.evaluate(() => ({ sel: window.__ion.B.sel, tray: window.__ion.B.tray.length, groups: window.__ion.B.groups.length, seed: window.__ion.B.seed }));
  await P.pg.click('#helpBtn'); await sleep(150);
  ok(await isOpen(P), 'the ? button works in the middle of practice');
  await tap(P, '#htNext'); await tap(P, '#htNext');
  await P.pg.keyboard.press('Escape'); await sleep(150);
  const after = await P.pg.evaluate(() => ({ sel: window.__ion.B.sel, tray: window.__ion.B.tray.length, groups: window.__ion.B.groups.length, seed: window.__ion.B.seed }));
  ok(JSON.stringify(before) === JSON.stringify(after), 'closing returns exactly to the practice board (same hand, same picked tile)');
  ok(await P.pg.evaluate(() => document.activeElement && document.activeElement.id === 'helpBtn'), 'focus returns to the ? button');
  await P.pg.locator('#tray [data-tile]').nth(1).click();   // the board still works
  await P.pg.locator('#groups [data-drop="new"]').click();
  ok(await P.pg.evaluate(() => window.__ion.B.groups.length) === 1, 'the practice board still works after the demo');
  ok(P.errors.length === 0, 'no console errors in practice flow (' + P.errors.join(' | ') + ')');
  await P.ctx.close();

  // ---------- D. inside a room: only the short list, nothing opens over the round ----------
  P = await open({ query: '?x' });
  await P.pg.evaluate(() => { window.__ion = { M: { room: {} }, B: null }; });
  ok(await P.pg.evaluate(() => window.IonHowTo.open() === false) && !(await isOpen(P)), 'in a room: open() refuses');
  await P.pg.click('#helpBtn'); await sleep(150);
  ok(!(await isOpen(P)) && await P.pg.evaluate(() => document.getElementById('dHelp').open), 'in a room: the ? button shows the short rules list instead');
  ok(/keeps going/.test(await P.pg.locator('#htRoomNote').innerText()), 'the list says the round keeps going');
  await P.pg.keyboard.press('Escape'); await sleep(100);
  ok(!(await P.pg.evaluate(() => document.getElementById('dHelp').open)), 'and it closes');
  await P.ctx.close();
  // a room opening while the demo is open closes the demo
  P = await open({ query: '?howto' });
  await P.pg.waitForSelector('#htDlg[open]');
  await P.pg.evaluate(() => { window.__ion = { M: { room: {} }, B: null }; });
  await P.pg.waitForFunction(() => !window.IonHowTo.isOpen(), null, { timeout: 3000 });
  ok(!(await isOpen(P)), 'if a room opens behind it, the demo gets out of the way');
  await P.ctx.close();

  // ---------- E. lobby button ----------
  P = await open({ query: '?x' });
  await P.pg.evaluate(() => { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'sLobby')); });
  ok(await P.pg.locator('#sLobby .htOpenBtn').isVisible(), 'the lobby has a How to play button');
  await tap(P, '#sLobby .htOpenBtn'); await sleep(150);
  ok(await isOpen(P), 'the lobby button opens it');
  await tap(P, '#htX'); await sleep(100);
  ok(!(await isOpen(P)) && await P.pg.evaluate(() => document.querySelector('.screen.on').id) === 'sLobby', 'closing leaves the lobby as it was');
  await P.ctx.close();

  // ---------- F. phone: touch taps, a touch drag, everything fits ----------
  P = await open({ query: '?howto', viewport: PHONE, touch: true });
  await P.pg.waitForSelector('#htDlg[open]');
  await noOverflow(P, 'phone step 1'); await shot(P, 'm-1-hand');
  await tap(P, '#htNext'); await P.pg.waitForFunction(() => /formula is CaCl₂/.test(document.getElementById('htMsg').innerText), null, { timeout: 9000 });
  await noOverflow(P, 'phone step 2 watch'); await shot(P, 'm-2-watch');
  await tap(P, '[data-ht-act="try"]'); await sleep(80);
  await noOverflow(P, 'phone step 2 try'); await shot(P, 'm-2-try');
  for (const [tile, dest] of [['t0', '[data-ht-drop="new"]'], ['t1', '.addhere[data-ht-drop="g:g1"]'], ['t2', '.addhere[data-ht-drop="g:g1"]']]) { await P.pg.locator(`[data-ht-tile="${tile}"]`).tap(); await P.pg.locator(dest).tap(); }
  ok(/Yes!.*Na₂O/.test(await msg(P)), 'phone: touch taps build Na₂O');
  await noOverflow(P, 'phone step 2 success'); await shot(P, 'm-2-try-done');
  // real touch drag through the browser's touch events
  await tap(P, '[data-ht-act="reset"]'); await sleep(80);
  const cdp = await P.ctx.newCDPSession(P.pg);
  async function touchDrag(from, to) {
    const a = await P.pg.locator(from).first().boundingBox(), b = await P.pg.locator(to).first().boundingBox();
    const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y) }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x + a.width / 2, a.y + a.height / 2) });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + a.width / 2 + (b.x + b.width / 2 - a.x - a.width / 2) * i / 8, a.y + a.height / 2 + (b.y + b.height / 2 - a.y - a.height / 2) * i / 8) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(100);
  }
  await touchDrag('[data-ht-tile="t0"]', '[data-ht-drop="new"]');
  ok(await P.pg.locator('#htStage .grp').count() === 1, 'phone: a touch drag onto New compound works');
  await tap(P, '#htNext');
  await noOverflow(P, 'phone step 3'); await shot(P, 'm-3-whynot');
  await tap(P, '#htNext'); await noOverflow(P, 'phone step 4'); await shot(P, 'm-4-lock');
  await tap(P, '[data-ht-act="lock"]'); await noOverflow(P, 'phone step 4 panel'); await shot(P, 'm-4-panel');
  await P.pg.fill('#ht-in-pos', '2'); await P.pg.fill('#ht-in-neg', '2'); await tap(P, '#htLockForm button[type=submit]'); await sleep(80);
  await shot(P, 'm-4-locked');
  await tap(P, '#htNext'); await noOverflow(P, 'phone step 5'); await shot(P, 'm-5-swap');
  await tap(P, '[data-ht-tile="t2"]'); await tap(P, '[data-ht-drop="swap"]'); await noOverflow(P, 'phone step 5 swapped'); await shot(P, 'm-5-swapped');
  await tap(P, '#htNext'); await noOverflow(P, 'phone step 6'); await shot(P, 'm-6-challenge');
  await tap(P, '[data-ht-act="flag"][data-i="1"]'); await tap(P, '[data-ht-act="check"]'); await sleep(80);
  await noOverflow(P, 'phone step 6 reveal'); await shot(P, 'm-6-reveal');
  await tap(P, '#htNext'); await noOverflow(P, 'phone step 7'); await shot(P, 'm-7-points');
  const sizes = await P.pg.evaluate(() => [...document.querySelectorAll('#htDlg button:not(:disabled), #htDlg .stepper button')].filter(b => b.offsetParent && !b.closest('.ht-cards')).map(b => { const r = b.getBoundingClientRect(); return [b.textContent.trim().slice(0, 12), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => h < 47.5 || w < 47.5));
  ok(sizes.length === 0, 'phone: every button in the demo is at least 48 px (' + JSON.stringify(sizes) + ')');
  ok(P.errors.length === 0, 'phone: no console errors (' + P.errors.join(' | ') + ')');
  await P.ctx.close();

  // ---------- G. dark mode and reduced motion ----------
  P = await open({ query: '?howto', dark: true });
  await P.pg.waitForSelector('#htDlg[open]'); await tap(P, '#htNext'); await P.pg.waitForFunction(() => /formula is CaCl₂/.test(document.getElementById('htMsg').innerText), null, { timeout: 9000 });
  await shot(P, 'w-dark-2-watch'); await goStep(P, 1); await tap(P, '#htNext');
  await P.ctx.close();
  P = await open({ query: '?howto', reduced: true });
  await P.pg.waitForSelector('#htDlg[open]'); await tap(P, '#htNext'); await sleep(150);
  ok(/formula is CaCl₂/.test(await msg(P)) && /\+2 −1 −1 = 0 ✓/.test(await stageText(P)), 'reduced motion: step 2 shows the finished compound at once (no waiting)');
  await tap(P, '[data-ht-act="try"]'); await tap(P, '[data-ht-tile="t0"]'); await tap(P, '[data-ht-drop="new"]');
  ok(await P.pg.locator('#htStage .grp').count() === 1, 'reduced motion: the practice still works');
  ok(P.errors.length === 0, 'reduced motion: no console errors');
  await P.ctx.close();

  await browser.close(); web.close();
  console.log(fails ? fails + ' FAILED' : 'all passed', ' (screenshots: ' + SHOTS + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
