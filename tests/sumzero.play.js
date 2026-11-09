// SumZero playthrough in a real browser: correct, wrong and extra ("decoy") pieces, both modes, Practice and Timed,
// tap and drag, Extra time, reduced motion, phone and Chromebook sizes. Screenshots go to OUT.
// Run: node tests/sumzero.play.js
'use strict';
const fs = require('fs');
const { open } = require('./ibond-page');
const OUT = process.env.SZ_OUT || '/mnt/user-data/outputs/sumzero-r2';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, n, info) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c || info === undefined ? '' : '  -> ' + JSON.stringify(info))); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- in-page helpers ---
const ready = page => page.evaluate(() => { const T = window.__szT; document.getElementById('intro').hidden = true; T.game.paused = false; });
// a Build-the-name tray with extra pieces and a multiplied ion (like Sn(OH)4); `want`: 'set' = has a decoy set, 'copy' = has an extra copy
async function forceOrder(page, want) {
  return page.evaluate(want => {
    const T = window.__szT, C = T.SZ_CFG; C.DECOY_CHANCE = 1; C.DECOY_CHANCE_MAX = 1;
    for (let g = 0; g < 4000; g++) {
      T.game.level = 6 + (g % 8); T.newOrder();
      const t = T.game.target, x = T.game.tray.filter(p => p.x);
      if (!x.length || Math.max(t.a, t.b) < 2) continue;
      const hasSet = x.some(p => p.ion.k !== t.cat.k && p.ion.k !== t.an.k), hasCopy = x.some(p => p.ion.k === t.cat.k || p.ion.k === t.an.k);
      if (want === 'set' && !hasSet) continue;
      if (want === 'copy' && !hasCopy) continue;
      if (want === 'big' && (T.game.tray.length < 8 || x.length < 2 || !hasSet)) continue;
      T.game.acc = 0; T.renderBuild(); break;
    }
    const t = T.game.target;
    return { name: t.cat.n + ' ' + t.an.ide, a: t.a, b: t.b, cat: t.cat.k, an: t.an.k, tray: T.game.tray.map(p => ({ id: p.id, k: p.ion.k, x: !!p.x })) };
  }, want);
}
const tap = (page, id) => page.click(`.piece[data-id="${id}"]`);
async function drag(page, id) {
  const b = await page.locator(`.piece[data-id="${id}"]`).boundingBox(), z = await page.locator('#zone').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height / 2 - 10, { steps: 3 });
  await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 8 }); await page.mouse.up();
}
const state = page => page.evaluate(() => {
  const T = window.__szT, G = T.game, f = document.querySelector('.sz-float');
  return G && { acc: G.acc, pend: G.szPend || 0, lim: G.sub === 'order' ? T.szLim() : 0, box: G.cat.length + G.an.length, tray: G.tray.length, ids: G.tray.map(p => p.id),
    msg: document.getElementById('bMsg').textContent, float: f ? f.textContent : '', bar: parseFloat(document.getElementById('bTimer').style.width) || 0, locked: G.locked, made: G.made, kind: G.kind };
});
// time stands still while we look (the rAF loop keeps running, so we read before/after and allow for elapsed time)
const freeze = page => page.evaluate(() => { const G = window.__szT.game; G.paused = true; });
const thaw = page => page.evaluate(() => { const G = window.__szT.game; G.paused = false; });

async function orderRun(P, timed, label, shots) {
  const { page } = P;
  await sleep(1500);
  await page.evaluate(m => window.__szT.start(m), timed ? 'build-order-timed' : 'build-order-practice'); await ready(page);
  // ---- decoy set tray ----
  const o = await forceOrder(page, shots ? 'big' : 'set');
  const xs = o.tray.filter(p => p.x), notIn = o.tray.find(p => p.k !== o.cat && p.k !== o.an && !p.x), decoy = xs.find(p => p.k !== o.cat && p.k !== o.an) || xs[0];
  console.log(`     ${label}: ${o.name} (${o.a}:${o.b}), tray ${o.tray.map(p => p.k + (p.x ? '*' : '')).join(' ')}`);
  ok(xs.length > 0, `${label}: tray has extra pieces`);
  if (shots) {
    await page.screenshot({ path: `${OUT}/decoy-tray-${shots}.png` });
    // extras take the place of plain distractors, so the tray is never bigger than before (8 pieces) and the page is no wider
    const fit = await page.evaluate(() => { const T = window.__szT, d = document.documentElement, sw = d.scrollWidth, ids = T.game.tray, keep = T.game.tray;
      T.game.tray = keep.filter(p => !p.x); T.renderTray(); const sw0 = d.scrollWidth; T.game.tray = keep; T.renderTray(); return { n: ids.length, sw, sw0 }; });
    ok(fit.n <= 8 && fit.sw <= fit.sw0, `${label}: ${fit.n}-piece tray with extras, no wider than without (${fit.sw} vs ${fit.sw0} px)`, fit);
  }
  // ---- wrong piece by tap: not in the compound ----
  let s0 = await state(page);
  if (notIn) {
    await tap(page, notIn.id); await sleep(450);
    let s1 = await state(page);
    ok(s1.box === 0 && s1.ids.includes(notIn.id), `${label}: tapped wrong piece bounces back to the tray`);
    ok(/You need/.test(s1.msg) && /Not in this compound/.test(s1.float), `${label}: wrong piece says why ("${s1.float}")`, s1);
    if (timed) {
      ok(s1.acc - s0.acc >= 2900 && s1.acc - s0.acc < 4500, `${label}: tap wrong piece costs about 3 s (${Math.round(s1.acc - s0.acc)} ms)`);
      ok(/−3 s/.test(s1.float), `${label}: floater shows −3 s`, s1.float);
      ok(s1.bar < s0.bar - 5, `${label}: yellow bar jumped down (${s0.bar.toFixed(1)}% -> ${s1.bar.toFixed(1)}%)`);
    } else ok(!/−/.test(s1.float), `${label}: Practice shows the reason but no time`, s1.float);
  }
  // ---- placing a decoy (extra piece) by drag is also a wrong piece ----
  s0 = await state(page);
  const decoyIsCopy = decoy.k === o.cat || decoy.k === o.an;
  if (!decoyIsCopy) {
    await drag(page, decoy.id); await sleep(450);
    const s1 = await state(page);
    ok(s1.box === 0 && s1.ids.includes(decoy.id), `${label}: dragged decoy bounces back`);
    if (timed) ok(s1.acc - s0.acc >= 2900 && s1.acc - s0.acc < 4500, `${label}: drag decoy costs the same as tap (${Math.round(s1.acc - s0.acc)} ms)`);
    if (shots && timed) {
      // fresh floater for the screenshot, captured while it is fully visible
      await page.evaluate(() => { document.querySelectorAll('.sz-float').forEach(f => f.remove()); });
      await tap(page, decoy.id); await sleep(220);
      await page.screenshot({ path: `${OUT}/penalty-floater-${shots}.png` });
      const r = await page.evaluate(() => { const f = document.querySelector('.sz-float').getBoundingClientRect(), b = document.getElementById('bTimerWrap').getBoundingClientRect(); return { fl: f.left, fr: f.right, ft: f.top, bb: b.bottom, vw: document.documentElement.clientWidth }; });
      ok(r.fl >= 0 && r.fr <= r.vw && r.ft >= r.bb && r.ft - r.bb < 30, `${label}: floater sits just under the bar, on screen`, r);
    }
  }
  // ---- correct pieces: alternate tap and drag, then extras fade ----
  await page.evaluate(() => { window.__szT.game.acc = 0; });
  const need = [...Array(o.a).fill(o.cat), ...Array(o.b).fill(o.an)];
  const pool = o.tray.filter(p => p.k === o.cat || p.k === o.an);
  for (let i = 0; i < need.length; i++) {
    const s = await state(page), p = pool.find(q => q.k === need[i] && s.ids.includes(q.id));
    if (i % 2) await drag(page, p.id); else await tap(page, p.id);
    pool.splice(pool.indexOf(p), 1);
  }
  await sleep(150);
  const sDone = await state(page);
  ok(sDone.locked && sDone.made === 1, `${label}: correct compound completes (${o.name})`, sDone);
  const faded = await page.evaluate(() => [...document.querySelectorAll('#tray .piece')].map(b => getComputedStyle(b).opacity));
  await sleep(500);
  const fadedLate = await page.evaluate(() => [...document.querySelectorAll('#tray .piece.sz-out')].map(b => +getComputedStyle(b).opacity));
  ok(fadedLate.length > 0 && fadedLate.every(v => v === 0), `${label}: tray pieces fade out after the compound (${faded.length} pieces)`);
  await sleep(1000);
  const sNext = await state(page);
  ok(!sNext.locked && sNext.box === 0 && sNext.tray >= 5, `${label}: next compound comes with a fresh tray`);
  // ---- an extra copy of the multiplied ion: the copy beyond the number needed is wrong ----
  const c = await forceOrder(page, 'copy');
  const bigK = c.a >= c.b ? c.cat : c.an, bigN = Math.max(c.a, c.b);
  const copies = c.tray.filter(p => p.k === bigK);
  ok(copies.length === bigN + 1, `${label}: extra-copy tray has ${bigN}+1 of the multiplied ion (${c.name})`);
  for (let i = 0; i < bigN; i++) await tap(page, copies[i].id);
  const sb = await state(page);
  await tap(page, copies[bigN].id); await sleep(450);
  const sa = await state(page);
  ok(sa.box === sb.box && /enough/.test(sa.float), `${label}: one copy too many bounces ("${sa.float}")`, sa);
  if (timed) ok(sa.acc - sb.acc >= 2900, `${label}: extra copy costs time`);
  return o;
}

async function freeRun(P, timed, label) {
  const { page } = P;
  await sleep(1500);   // let the last game's 1.4 s "next compound" step finish first
  await page.evaluate(m => window.__szT.start(m), timed ? 'build-free-timed' : 'build-free-practice'); await ready(page);
  // a known tray: Ca²⁺, Mg²⁺, Cl⁻ x3 (one Cl marked extra), Na⁺
  const ids = await page.evaluate(() => {
    const T = window.__szT, G = T.game, by = k => T.pools(G.level).cats.concat(T.pools(G.level).ans).find(i => i.k === k);
    G.level = 2; G.acc = 0; G.cat = []; G.an = [];
    G.tray = ['Ca', 'Mg', 'Cl', 'Cl', 'Cl', 'Na'].map(k => T.mk(by(k))); T.szX(G.tray[4]); T.renderBuild();
    return G.tray.map(p => p.id);
  });
  const [ca, mg, cl1, cl2, clX, na] = ids;
  await tap(page, ca); await sleep(80);
  let s0 = await state(page);
  ok(s0.box === 1, `${label}: tap Ca²⁺ goes in`);
  await drag(page, mg); await sleep(450);
  let s1 = await state(page);
  ok(s1.box === 1 && /One kind per side/.test(s1.float), `${label}: dragged 2nd cation bounces with a reason ("${s1.float}")`, s1);
  if (timed) ok(s1.acc - s0.acc >= 1400 && s1.acc - s0.acc < 3000, `${label}: wrong piece brings the next ion ~1.5 s sooner (${Math.round(s1.acc - s0.acc)} ms)`);
  else ok(!/−/.test(s1.float), `${label}: Practice loses no time`, s1.float);
  await tap(page, cl1); await sleep(60);
  // the 2nd Cl is fine (CaCl2). A 3rd would be too many — check by the rule on the page
  const third = await page.evaluate(() => { const T = window.__szT, G = T.game, i = G.tray.find(p => p.ion.k === 'Cl').ion; G.an.push(i); const w = T.szWrong(i); G.an.pop(); return w && w.cue; });
  ok(third === 'Too many for the smallest ratio', `${label}: a 3rd Cl⁻ with Ca²⁺ would be wrong ("${third}")`);
  await drag(page, cl2); await sleep(150);
  const sD = await state(page);
  ok(sD.made === 1, `${label}: CaCl₂ completes (tap + drag)`, sD);
  await sleep(500);
  const gone = await page.evaluate(id => { const b = document.querySelector(`#tray .piece[data-id="${id}"]`); return !b || +getComputedStyle(b).opacity === 0; }, clX);
  const kept = await page.evaluate(ids => ids.filter(id => document.querySelector(`#tray .piece[data-id="${id}"]`)).length, [mg, na]);
  ok(gone, `${label}: the extra Cl⁻ fades out after the compound`);
  ok(kept === 2, `${label}: regular pieces stay in the tray`);
  // penalty can't push time into a weird state: pile up penalties, the bar stays 0..100 and the next ion arrives normally
  if (timed) {
    await sleep(1200);
    const r = await page.evaluate(async () => {
      const T = window.__szT, G = T.game, by = k => T.pools(G.level).cats.find(i => i.k === k);
      G.cat = [by('Ca')]; G.an = []; G.tray = [T.mk(by('Mg')), T.mk(by('Na')), T.mk(by('Ca'))]; T.renderBuild(); G.acc = 0;
      const t0 = G.tray.length; for (let i = 0; i < 6; i++) T.addToZone(G.tray[0].id);
      await new Promise(r => setTimeout(r, 700));
      return { acc: G.acc, tray: G.tray.length, t0, bar: parseFloat(document.getElementById('bTimer').style.width) };
    });
    ok(r.tray > r.t0 && r.acc >= 0 && r.bar >= 0 && r.bar <= 100, `${label}: piled-up penalties just bring the next ion (tray ${r.t0}->${r.tray}, bar ${r.bar.toFixed(0)}%)`, r);
  }
}

(async () => {
  // ---------- Chromebook ----------
  let P = await open();
  try {
    await orderRun(P, false, 'Build the name, Practice');
    await orderRun(P, true, 'Build the name, Timed', '1366x650');
    await freeRun(P, false, 'Free build, Practice');
    await freeRun(P, true, 'Free build, Timed');
    await sleep(1500);
    // time runs out because of a penalty: normal "Time" miss, bar at 0, never negative
    await P.page.evaluate(() => window.__szT.start('build-order-timed')); await ready(P.page);
    const o = await forceOrder(P.page, 'set');
    await P.page.evaluate(() => { const G = window.__szT.game; G.acc = window.__szT.szLim() - 800; });
    const wrongId = o.tray.find(p => p.k !== o.cat && p.k !== o.an).id;
    await tap(P.page, wrongId); await sleep(500);
    const s = await state(P.page);
    ok(s.locked && /Time/.test(s.msg) && s.bar === 0 && s.acc <= s.lim, 'penalty past the end: normal time-out, bar at 0', s);
    // Extra time: smaller penalty
    await sleep(2300);   // let the time-out's 2.2 s answer display finish first
    await P.page.evaluate(() => { window.__szT.save.el = true; window.__szT.start('build-order-timed'); }); await ready(P.page);
    const e = await forceOrder(P.page, 'set'); const s0 = await state(P.page);
    await tap(P.page, e.tray.find(p => p.k !== e.cat && p.k !== e.an).id); await sleep(450);
    const s1 = await state(P.page);
    ok(/−1\.9 s/.test(s1.float) && s1.acc - s0.acc >= 1800 && s1.acc - s0.acc < 3300, `Extra time: penalty is 3/1.6 = 1.9 s ("${s1.float}", ${Math.round(s1.acc - s0.acc)} ms)`);
    await P.page.evaluate(() => { window.__szT.save.el = false; });
    ok(P.errors.length === 0, 'Chromebook: console clean' + (P.errors.length ? ': ' + P.errors.slice(0, 3).join(' | ') : ''));
  } finally { await P.close(); }

  // ---------- phone ----------
  P = await open({ viewport: { width: 390, height: 844 }, touch: true });
  try {
    await orderRun(P, true, 'Phone, Build the name, Timed', '390x844');
    ok(P.errors.length === 0, 'Phone: console clean' + (P.errors.length ? ': ' + P.errors.slice(0, 3).join(' | ') : ''));
  } finally { await P.close(); }

  // ---------- reduced motion: the bar jumps at once ----------
  P = await open({ reducedMotion: 'reduce' });
  try {
    await P.page.evaluate(() => window.__szT.start('build-order-timed')); await ready(P.page);
    const o = await forceOrder(P.page, 'set');
    const r = await P.page.evaluate(id => {
      const T = window.__szT, G = T.game; G.acc = 1000; T.addToZone(id); const a0 = G.acc;
      T.buildTick(16); return { acc: G.acc - a0, pend: G.szPend };
    }, o.tray.find(p => p.k !== o.cat && p.k !== o.an).id);
    ok(r.pend === 0 && r.acc >= 3016 - 1 && r.acc < 3100, 'reduced motion: the whole penalty lands in one frame', r);
    ok(P.errors.length === 0, 'reduced motion: console clean');
  } finally { await P.close(); }

  console.log(fails ? `\n${fails} FAILED` : `\nall passed  (screenshots: ${OUT})`);
  process.exit(fails ? 1 : 0);
})();
