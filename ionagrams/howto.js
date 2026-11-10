/* Ionagrams How to play -> window.IonHowTo. A short, skippable, interactive demo that runs fully offline (no Firebase, no network).
 * It has its own mini-board that looks like the real game (same tile / compound CSS classes) and uses IonRules (rules.js) to check what students build.
 * Loaded by index.html after rules.js and before ui.js. Hooks in other files: ui.js (one line: the top-bar ? button calls IonHowTo.help)
 * and index.html (one <script> line). The "How to play" buttons on the start and lobby screens are added by this file.
 * Opens: by itself the first time a student opens the game (HOWTO_CONFIG.AUTO_OPEN_FIRST_VISIT), from the "How to play" buttons,
 * from the ? button in the top bar, or by adding ?howto to the page address (handy for showing it on the projector).
 * Never opens inside a live room (the ? button shows the short rules list there instead), so it can never disturb a round.
 * Test: node tests/howto.logic.test.js (step logic, no browser). */

// ===================== CONFIG (Mr. G: change settings here) =====================
const HOWTO_CONFIG = {
  AUTO_OPEN_FIRST_VISIT: true,   // true = How to play opens by itself the first time a student opens Ionagrams on a computer. false = only when they tap a How to play button.
  SEEN_KEY: 'ionagrams-seenhowto', // the browser remembers "already seen" under this name. To show it again on your own computer, clear site data or open the game with ?howto at the end of the address.
  SKIP_WHEN_AUTOMATED: true,     // true = never auto-open in robot tests (Playwright). Keep true. Real students are not affected.
  ANIM_MS: 800                   // speed of the animated demo in step 2 (milliseconds per move). Bigger number = slower.
};

// ===================== TEXT (Mr. G or a translator: edit the words here) =====================
// Keep sentences short and literal. {name} words are filled in by the code. Do not remove them.
// The "why" sentences for wrong compounds come from rules.js (they are English only for now).
const HOWTO_TEXT = {
  ui: {
    title: 'How to play', openBtn: 'How to play', close: 'Close', closeTip: 'Close How to play', skip: 'Skip', skipTip: 'Skip How to play',
    back: 'Back', next: 'Next', finish: 'Finish', stepOf: 'Step {n} of {total}', pillLabel: 'Step {n}: {title}', stageLabel: 'Practice area',
    watchAgain: 'Watch again', tryIt: 'Now you try', tryAgain: 'Try again', hint: 'Hint', practiceNow: 'Practice alone now',
    roomNote: 'The round keeps going while you read this list. For the full How to play, leave the room first.',
    coachTap: 'Tap here', coachThen: 'Then tap here',
    yourTiles: 'Your tiles', newCompound: 'New compound', putHere: 'Put it here', putBack: 'Put it back here',
    swapBin: 'Swap 1 → get 2', swapPick: 'Pick a tile first', swapThis: 'Swap this tile',
    lock: 'Lock', unlock: 'Unlock', totalPos: 'Total + charge', totalNeg: 'Total − charge', cancel: 'Cancel', lockGo: 'Lock',
    lessPos: 'Less positive', morePos: 'More positive', lessNeg: 'Less negative', moreNeg: 'More negative',
    posAria: 'Total positive charge', negAria: 'Total negative charge',
    compoundN: 'Compound {n}', lockedSuffix: ', locked', allPlaced: 'All tiles placed.',
    helper: 'Helper', helperTip: 'Only in How to play. The real game does not show this.',
    positive: 'positive', negative: 'negative', tileLabel: '{sym}, {kind}, charge {n}',
    notOk: 'Not OK', correct: 'Correct', wrong: 'Wrong', doneChecking: 'I’m done checking', tapIfWrong: 'Tap if wrong', looksWrong: 'Looks wrong',
    mayaSays: 'Maya says Done!', mayaMistake: 'Maya had a mistake.', pickFirst: 'Pick a tile first.',
    caughtPts: 'You caught it!', wrongFlagPts: 'Your flag was wrong'
  },
  steps: {
    hand: { title: 'Your tiles', lines: [
      'You start with a hand of ion tiles.',
      'A square tile with + is a positive ion.',
      'A round tile with − is a negative ion.',
      'The number is the size of the charge.'] },
    group: { title: 'Make a compound', lines: [
      'A compound has one kind of\u00A0+\u00A0ion and one kind of\u00A0−\u00A0ion.',
      'Put tiles together until the charges add up to 0.',
      'The Helper row shows the total. The real game does not show it.'] },
    whynot: { title: 'Mistakes to avoid', lines: [
      'These 3 compounds are not OK.',
      'Each card tells you why.',
      'Your classmates check your compounds too.'] },
    lock: { title: 'Lock a compound', lines: [
      'When a compound is ready, tap Lock.',
      'Type the total\u00A0+\u00A0charge and the total\u00A0−\u00A0charge.',
      'Add the\u00A0+\u00A0charges. Then add the\u00A0−\u00A0charges.',
      'If names are on, you also pick the name.'] },
    swap: { title: 'Swap tiles', lines: [
      'Do you have a tile you cannot use?',
      'Swap it. You give 1 tile and get 2 new tiles.',
      'That means you have 1 more tile to use.',
      'You can swap again if you need to.'] },
    done: { title: 'Done and check', lines: [
      'Use every tile and lock every compound. Then tap Done!',
      'Everyone stops and checks your compounds.',
      'Now you are the checker. A pretend player, Maya, tapped Done!'] },
    points: { title: 'Points', lines: [
      'You earn ⚛ points in every round.',
      'Practice alone earns fewer points.',
      'Ready? Try a practice round. No one else plays.'] }
  },
  msg: {
    hand0: 'Tap a tile to learn about it.',
    handInfo: '{sym} is the {name} ion. Its charge is {charge}. It is a {kind} ion.',
    demo1: 'Ca²⁺ has charge +2. Put it in a compound.',
    demo2: 'Cl⁻ has charge −1. The total is now +2 −1 = +1. Not 0 yet.',
    demo3: 'Add one more Cl⁻. The total is +2 −1 −1 = 0. Now the charges add to 0!',
    demo4: 'The formula is CaCl₂. The small 2 means there are 2 Cl⁻ tiles.',
    try0: 'Now you try. Use Na⁺, Na⁺ and O²⁻. Tap a tile, then tap New compound. You can also drag the tile.',
    trySel: 'Now tap the compound box. You can also drag the tile there.',
    tryOne: 'Total so far: {sum}. Add a {side} ion.',
    tryBad: 'Total: {sum}. It must be 0. Add a tile, or pick one and put it back.',
    tryGood: 'Yes! {sum}. The charges add to 0. Your compound is {formula}. Tap Next.',
    sideNeg: 'negative', sidePos: 'positive',
    whynot: 'The real game does not tell you when you are wrong. Check your own work before you tap Done!',
    lock0: 'Tap Lock to try it.',
    lockPanel: 'Type only the number in the − box. The − sign is already there. Example: for −3, type 3.',
    lockBad: 'Not yet. {why}', lockNegTip: 'In the − box, type the number only. For −2, type 2.',
    lockGood: 'Locked! The real game does not check your numbers until someone taps Done. Tap Unlock to change them.',
    swap0: 'Al³⁺ needs three − tiles. You have only one. Try a swap.',
    swapSel: 'Now tap Swap. You can also drag the tile to Swap.',
    swapDone: 'You gave Al³⁺. You got Cl⁻ and K⁺. Now Mg²⁺ + Cl⁻ + Cl⁻ make MgCl₂. K⁺ still needs a negative ion. You can swap again.',
    done0: 'Tap a compound that looks wrong. This is called a flag. Then tap “I’m done checking”.',
    doneHint: 'Hint: add up the charges of each compound. They must add to 0.',
    doneFlagged: 'You flagged {n}. Tap “I’m done checking” when you are ready.',
    revCaught: 'You caught the mistake! +{pts} points.',
    revMissed: 'You did not flag the wrong compound. Its reason is on the card.',
    revFalse: 'You flagged a correct compound. That costs {pts} points. Add up the charges first.',
    revNone: 'You did not flag anything. Look at the card to see the mistake.',
    outLine: 'Maya is out. Out means Maya cannot win this round. Everyone else keeps playing.',
    winLine: 'If every compound is right, that player wins the round.'
  },
  points: {
    compound: 'Each correct compound', compoundMore: 'And {perIon} more for each tile. Example: CaCl₂ has 3 tiles. {compound} + 3 × {perIon} = {total}.',
    win: 'Win the round (every compound right)', flagRight: 'Catch a real mistake', flagWrong: 'Flag a compound that is right'
  }
};

(function () {
'use strict';
const isBrowser = typeof document !== 'undefined';
const R = isBrowser ? window.IonRules : require('./rules.js');
const CFG = Object.assign({}, HOWTO_CONFIG, (isBrowser && window.IONHOWTO_CONFIG) || {});
const TXT = (function merge(a, b) {            // window.IONHOWTO_TEXT can replace any text (for a translation)
  if (!b || typeof b !== 'object') return a;
  const o = {}; Object.keys(a).forEach(k => { o[k] = a[k]; });
  Object.keys(b).forEach(k => { o[k] = (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k]; });
  return o;
})(HOWTO_TEXT, isBrowser && window.IONHOWTO_TEXT);
const tx = (path, v) => {
  let x = TXT; path.split('.').forEach(p => { x = x == null ? x : x[p]; });
  if (typeof x === 'string') return v ? x.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : x;
  return x == null ? path : x;
};
const MINUS = '−';
const sg = n => (n > 0 ? '+' + n : n < 0 ? MINUS + -n : '0');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const symHTML = s => s.replace(/(\d+)/g, '<sub>$1</sub>');
const ORDER = ['hand', 'group', 'whynot', 'lock', 'swap', 'done', 'points'];

// ===================== STEP LOGIC (no DOM; tested in node) =====================
const sumText = (ions, mark) => {
  const c = ions.map(k => R.ion(k).c), t = c.reduce((a, b) => a + b, 0);
  return c.map(sg).join(' ') + ' = ' + sg(t) + (mark ? (t === 0 ? ' ✓' : '') : '');
};
function judge(ions) {                          // the real rules, with the totals filled in so only the build itself is judged
  const tt = R.totals(ions), r = R.checkGroup({ ions, pos: tt.pos, neg: tt.neg }, { naming: 'off' });
  return { ok: r.ok, errors: r.errors, why: r.why, formula: R.formulaText(ions), sum: sumText(ions, true), pos: tt.pos, neg: tt.neg, needs: tt.pos === 0 ? 'pos' : tt.neg === 0 ? 'neg' : null };
}
function mkState(hand, extra) {
  const S = Object.assign({ tiles: {}, tray: [], groups: [], gid: 0, n: 0, sel: null, fresh: {}, msg: null }, extra || {});
  hand.forEach(k => addTile(S, k));
  return S;
}
function addTile(S, k) { const id = 't' + (S.n++); S.tiles[id] = { id, k }; S.tray.push(id); return id; }
const groupOf = (S, id) => S.groups.find(g => g.tiles.includes(id));
const getG = (S, gid) => S.groups.find(g => g.id === gid);
const ionsOf = (S, g) => g.tiles.map(id => S.tiles[id].k);
function move(S, id, dest) {                    // same moves as the real board: to a new compound, to a compound, back to the tray
  if (!S.tiles[id]) return false;
  const src = groupOf(S, id); if (src && src.locked) return false;
  let to = null;
  if (dest === 'new') to = { id: 'g' + (++S.gid), tiles: [], locked: false, pos: null, neg: null };
  else if (dest && dest.startsWith('g:')) { to = getG(S, dest.slice(2)); if (!to || to.locked || to === src) { S.sel = null; return false; } }
  else if (dest === 'tray') { if (!src) { S.sel = null; return false; } }
  else return false;
  if (src) { src.tiles = src.tiles.filter(x => x !== id); if (!src.tiles.length) S.groups = S.groups.filter(g => g !== src); }
  else S.tray = S.tray.filter(x => x !== id);
  if (dest === 'new') S.groups.push(to);
  if (to) { to.tiles.push(id); S.fresh[id] = 1; } else S.tray.push(id);
  S.sel = null; return true;
}
function swap(S, id, draw) {                    // give 1 tile, get 2
  const src = groupOf(S, id);
  if (src) { src.tiles = src.tiles.filter(x => x !== id); if (!src.tiles.length) S.groups = S.groups.filter(g => g !== src); }
  else S.tray = S.tray.filter(x => x !== id);
  const gone = S.tiles[id].k; delete S.tiles[id];
  const got = draw.map(k => { const nid = addTile(S, k); S.fresh[nid] = 1; return k; });
  S.sel = null; return { gone, got };
}
// step 2 "try it": which element to point at next
function tryCoach(S, tx2) {
  const g = S.groups[0], inG = g ? ionsOf(S, g) : [];
  if (g && judge(inG).ok) return null;
  const rem = S.goal.slice(), extra = [];
  if (g) g.tiles.forEach(id => { const i = rem.indexOf(S.tiles[id].k); if (i >= 0) rem.splice(i, 1); else extra.push(id); });
  if (S.sel) return { key: extra.includes(S.sel) ? 'drop:tray' : g ? 'drop:g:' + g.id : 'drop:new', text: tx2.then };   // a wrong tile goes back; a right tile goes in
  if (extra.length) return { key: 't:' + extra[0], text: tx2.tap };                                                   // point at the wrong tile first
  const id = rem.length && S.tray.find(i => rem.includes(S.tiles[i].k));
  return id ? { key: 't:' + id, text: tx2.tap } : null;
}
function tryMsg(S) {                            // what to tell the student about the compound they are building
  const g = S.groups[0];
  if (!g) return { k: 'info', t: S.sel ? tx('msg.trySel') : tx('msg.try0') };
  const j = judge(ionsOf(S, g));
  if (j.ok) return { k: 'good', t: tx('msg.tryGood', { sum: j.sum, formula: j.formula }) };
  if (j.needs) return { k: 'info', t: tx('msg.tryOne', { sum: sumText(ionsOf(S, g)), side: tx(j.needs === 'pos' ? 'msg.sidePos' : 'msg.sideNeg') }) };
  if (j.errors.includes('charge')) return { k: 'warn', t: tx('msg.tryBad', { sum: sumText(ionsOf(S, g)) }) };
  return { k: 'warn', t: j.why.join(' ') };
}
function checkLock(ions, pos, neg) {            // step 4: are the typed totals right? (the real game never checks until Done)
  const r = R.checkGroup({ ions, pos, neg }, { naming: 'off' });
  const keep = r.errors.map((c, i) => (c === 'pos' || c === 'neg' ? i : -1)).filter(i => i >= 0);
  return { ok: !keep.length, why: keep.map(i => r.why[i]), codes: keep.map(i => r.errors[i]), truth: r.truth };
}
const MAYA = [['Na', 'Na', 'O'], ['Ca', 'Cl']];  // step 6: the caller's board; the second compound is wrong
function mayaBoard() { return MAYA.map(ions => { const t = R.totals(ions); return { ions, pos: t.pos, neg: t.neg, name: null }; }); }
function reveal(flags) {                        // flags: Set of compound numbers the student flagged
  const res = R.checkBoard(mayaBoard(), { naming: 'off' }).results;
  let caught = 0, wrongFlags = 0;
  flags.forEach(i => { if (res[i]) { if (res[i].ok) wrongFlags++; else caught++; } });
  return { results: res, caught, wrongFlags, ok: res.every(r => r.ok) };
}
const LOGIC = { sumText, judge, mkState, move, swap, groupOf, getG, ionsOf, tryCoach, tryMsg, checkLock, mayaBoard, reveal, ORDER, TXT, tx };
if (!isBrowser) { module.exports = LOGIC; return; }

// ===================== DIALOG + STYLE (browser only) =====================
const $ = id => document.getElementById(id);
const REDUCED = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const CSS = `
/* ===== HOWTO CSS (all classes start with ht-) ===== */
#htDlg{width:min(1000px,calc(100vw - 16px));max-width:none;height:min(640px,calc(100dvh - 16px));max-height:calc(100dvh - 16px);overflow:hidden}
#htDlg[open]{display:flex;flex-direction:column}
.ht-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:8px 12px 8px 16px;border-bottom:2px solid var(--line)}
.ht-head h2{font-size:26px;margin:0}
.ht-stepof{font-weight:700;color:var(--soft);font-size:16px;flex:1;white-space:nowrap;order:1}
.ht-x{padding:6px 14px;min-height:48px;order:2}
.ht-pills{display:flex;gap:4px;flex:1 1 100%;order:3}
.ht-pill{flex:1 1 0;min-width:0;min-height:48px;border-radius:12px;border:2px solid var(--ink);background:var(--surface);font-family:"Baloo 2","Trebuchet MS",sans-serif;font-weight:800;font-size:19px;padding:0 2px;line-height:1}
.ht-pill[aria-current="step"]{background:var(--ink);color:var(--paper)}
.ht-pill:disabled{border-style:dashed;border-color:var(--line);color:var(--soft);opacity:1}
.ht-pill .ck{font-size:.75em;margin-right:2px}
@media (min-width:860px){.ht-head{flex-wrap:nowrap}.ht-stepof{flex:none}.ht-pills{order:2;flex:1;max-width:520px;margin:0 auto 0 8px}.ht-x{order:3}}
.ht-body{flex:1;min-height:0;overflow:auto;display:grid;gap:8px 20px;padding:10px 16px 8px;align-content:start;
  grid-template-columns:1fr;grid-template-areas:"text" "stage" "msg"}
@media (min-width:760px){.ht-body{grid-template-columns:minmax(250px,330px) minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:"text stage" "msg stage"}}
.ht-text{grid-area:text}
.ht-text h3{font-size:27px;margin:0 0 6px}
.ht-text p{margin:0 0 6px;font-size:18px;line-height:1.35}
.ht-stage{grid-area:stage;min-width:0;display:flex;flex-direction:column;gap:10px;padding:30px 12px 12px;border-radius:18px;background:color-mix(in srgb,var(--paper) 75%,var(--surface));border:2px solid var(--line);align-self:start}
.ht-msg{grid-area:msg;border:2px solid var(--line);border-radius:14px;padding:8px 12px;font-weight:700;font-size:17px;line-height:1.3;display:flex;gap:10px;align-items:flex-start;min-height:60px;align-self:start;background:var(--surface)}
.ht-msg:empty{visibility:hidden}
.ht-msg.good{border-color:var(--good)} .ht-msg.warn{border-color:var(--gold);border-style:dashed}
.ht-mi{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:800;background:var(--ink);color:var(--paper)}
.ht-msg.good .ht-mi{background:var(--good);color:#fff} .ht-msg.warn .ht-mi{background:var(--gold);color:#17323A}
.ht-foot{display:flex;align-items:center;gap:8px;padding:8px 16px 10px;border-top:2px solid var(--line)}
.ht-foot .sp{flex:1}
.ht-foot .btn{min-width:96px}
.ht-groups{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.ht-groups .grp{min-height:104px}
.ht-groups .newg{min-height:84px}
.ht-groups .tcol{min-height:50px;padding:2px;gap:3px}
.ht-groups .tcol .tile{min-height:48px}
.ht-traybox{background:var(--surface);border:3px solid var(--line);border-radius:20px;padding:8px 10px 10px}
.ht-traybox.hot{border-color:var(--gold);border-style:solid;background:color-mix(in srgb,var(--gold) 14%,var(--surface))}
.ht-th{display:flex;align-items:center;gap:8px;margin-bottom:31px;min-height:26px;font-family:"Baloo 2",sans-serif;font-size:19px}
.ht-tray{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;min-height:56px;padding:3px}
.ht-tray .emptyt{color:var(--soft);font-size:15px;padding:12px 4px}
.ht-traybox .swap{width:100%;margin-top:8px}
.ht-actions{display:flex;flex-wrap:wrap;gap:8px}
.ht-sum{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:16px;background:var(--paper);border-radius:10px;padding:3px 10px;align-self:flex-start;flex-wrap:wrap}
.ht-tag{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border:2px solid var(--soft);border-radius:999px;padding:0 7px;color:var(--soft)}
.ht-coach{outline:4px dashed var(--gold)!important;outline-offset:3px;position:relative}
.ht-coach::after{content:attr(data-coach);position:absolute;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);background:var(--gold);color:#17323A;font:700 14px/1 "Atkinson Hyperlegible",sans-serif;padding:6px 10px;border-radius:999px;white-space:nowrap;pointer-events:none;z-index:3;animation:ht-bob 1s ease-in-out infinite alternate}
@keyframes ht-bob{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-4px)}}
.ht-coach.addhere::after,.ht-coach.swap::after{left:auto;right:10px;bottom:auto;top:50%;transform:translateY(-50%);animation:none}
.ht-ghost{position:fixed;pointer-events:none;z-index:50;opacity:.92;transform:translate(-50%,-50%) scale(1.08);box-shadow:0 6px 10px rgba(0,0,0,.3)}
.ht-info{display:flex;align-items:center;gap:14px;min-height:84px;border:2px dashed var(--line);border-radius:16px;padding:8px 14px;font-weight:700;font-size:18px;line-height:1.3}
.ht-info.on{border-style:solid;border-color:var(--ink);background:var(--surface)}
.ht-info .tile{flex:none}
.ht-cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.ht-cards .cg{min-height:0;gap:5px;padding:10px}
.ht-cards .cg .fm{font-size:28px}
.ht-cards .tile{min-width:38px;min-height:34px;font-size:16px;padding:2px 6px 1px 10px;border-radius:8px}
.ht-cards .tile.a{border-radius:16px}
.ht-cards .tile .sg{font-size:10px;top:1px;left:3px}
.ht-row{display:flex;flex-wrap:wrap;gap:4px}
.ht-cards .why{font-size:15px}
.ht-cards .ht-sum{font-size:14px}
.ht-h2{font-family:"Baloo 2","Trebuchet MS",sans-serif;font-weight:800;font-size:25px;line-height:1.15}
.ht-chk .tbar{margin:6px 0 10px}
.ht-chk .cgroups{margin-top:6px}
.ht-chk .cg{min-height:0}
.ht-verdict{font-weight:700;font-size:17px;margin:2px 0 0}
.ht-lock{padding:0}
.ht-lock .dlg{padding:6px 4px 4px}
.ht-lock .bigf{font-size:36px}
.ht-pts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.ht-pts li{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;background:var(--surface);border:2px solid var(--line);border-radius:14px;padding:6px 12px;min-height:50px;font-weight:700;line-height:1.25}
.ht-pts .ic{font-size:22px;text-align:center}
.ht-pts small{display:block;font-weight:400;font-size:15px;color:var(--soft)}
.ht-sum2{font-weight:700;font-size:15px}
.ht-pts .pts{font-size:18px;padding:2px 10px}
.ht-note{margin:0;font-weight:700;font-size:16px}
.ht-cta{align-self:flex-start}
@media (max-width:759px){
  #htDlg{height:calc(100dvh - 16px)}
  .ht-body{grid-template-areas:"text" "msg" "stage";gap:5px;padding:6px 12px 4px}
  .ht-head{padding:6px 6px 6px 12px;gap:4px 10px}
  .ht-pills{gap:2px}
  .ht-head h2{font-size:23px}
  .ht-text h3{font-size:22px;margin-bottom:3px}
  .ht-text p{font-size:16px;margin-bottom:2px;line-height:1.3}
  .ht-msg{min-height:0;padding:6px 10px;font-size:16px}
  .ht-stage{padding:28px 8px 6px;gap:6px}
  .ht-th{margin-bottom:6px;min-height:22px}
  .ht-groups{grid-template-columns:1fr;gap:8px}
  .ht-groups .grp{min-height:0;padding:6px 8px 8px;gap:4px}
  .ht-groups .grp .fm{font-size:24px}
  .ht-groups .grp .gh{min-height:26px}
  .ht-groups .grp{padding:4px 8px 6px}
  .ht-groups .newg{min-height:48px;flex-direction:row;gap:8px;font-size:16px}
  .ht-groups .tcol{border:0;padding:0;min-height:48px}
  .ht-groups .newg b{font-size:24px}
  .ht-cards{grid-template-columns:1fr;gap:8px}
  .ht-cards .cg{display:grid;grid-template-columns:auto 1fr;column-gap:10px;padding:6px 10px}
  .ht-cards .cg .verd{grid-column:1}.ht-cards .cg .fm{grid-column:2;font-size:24px}
  .ht-cards .cg .ht-row{display:none}
  .ht-cards .cg .ht-sum2{grid-column:1/-1}
  .ht-cards .cg .why{grid-column:1/-1}
  .ht-chk .cgroups{grid-template-columns:1fr 1fr;gap:8px}
  .ht-chk .cg{padding:8px 10px;gap:2px}.ht-chk .cg .fm{font-size:26px}
  .ht-chk .ht-h2{font-size:21px}
  .ht-verdict{font-size:15px}
  .ht-pts li{min-height:44px;padding:4px 10px;gap:8px}
  .ht-foot{padding:6px 12px 8px}
  .ht-foot .btn{min-width:80px;padding-left:12px;padding-right:12px}
}
/* ===== end HOWTO CSS ===== */`;

let dlg = null, stage = null, STEP = null, S = null, cur = 0, maxReached = 0, isOpen = false, lastFocus = null, timers = [], watch = 0;
let drag = null, noClick = false;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
let seenMem = false;
const seen = () => seenMem || store.get(CFG.SEEN_KEY) === '1';
const markSeen = () => { seenMem = true; store.set(CFG.SEEN_KEY, '1'); };
const inRoom = () => { try { return !!(window.__ion && window.__ion.M); } catch (e) { return false; } };
const activeScreen = () => { const s = document.querySelector('.screen.on'); return s ? s.id : ''; };

// ---- small html pieces (same markup and classes as the real tiles and compounds) ----
const tileLabel = k => { const i = R.ion(k); return tx('ui.tileLabel', { sym: i.s.replace(/(\d)/g, ' $1'), kind: tx(i.c > 0 ? 'ui.positive' : 'ui.negative'), n: Math.abs(i.c) }); };
const tileInner = k => { const i = R.ion(k), cat = i.c > 0; return `<span class="sg" aria-hidden="true">${cat ? '+' : MINUS}</span><span aria-hidden="true">${symHTML(i.s)}<sup>${R.chargeText(i.c)}</sup></span>`; };
const tileSpan = k => `<span class="tile ${R.ion(k).c > 0 ? 'c' : 'a'}" role="img" aria-label="${esc(tileLabel(k))}">${tileInner(k)}</span>`;
function tileBtn(id, dis) {
  const k = S.tiles[id].k, cat = R.ion(k).c > 0;
  return `<button type="button" class="tile ${cat ? 'c' : 'a'}${S.fresh[id] ? ' new' : ''}" data-ht-tile="${id}" data-k="t:${id}" aria-pressed="${S.sel === id}" aria-label="${esc(tileLabel(k))}"${dis ? ' disabled' : ''}>${tileInner(k)}</button>`;
}
const sumRow = (ions, mark) => `<div class="ht-sum" title="${esc(tx('ui.helperTip'))}"><span class="ht-tag">${esc(tx('ui.helper'))}</span><span>${esc(sumText(ions, mark))}</span></div>`;
// same two columns as the real game: + ions stack on the left, − ions on the right
function colsHTML(g, dis) {
  const col = pos => g.tiles.filter(id => (R.ion(S.tiles[id].k).c > 0) === pos).map(id => tileBtn(id, dis)).join('');
  return `<div class="tcols"><div class="tcol" data-ph="+">${col(true)}</div><div class="tcol an" data-ph="${MINUS}">${col(false)}</div></div>`;
}
function grpHTML(g, i, o) {
  const ions = ionsOf(S, g), drop = S.sel && !g.locked && groupOf(S, S.sel) !== g, dragging = !!(drag && drag.on);
  return `<div class="grp${g.locked ? ' locked' : ''}${drop ? ' drop' : ''}" data-ht-drop="g:${g.id}" role="group" aria-label="${esc(tx('ui.compoundN', { n: i + 1 }) + (g.locked ? tx('ui.lockedSuffix') : ''))}">` +
    `<div class="gh"><div class="fm">${R.formulaHTML(ions)}</div>` +
    (o.lock ? (g.locked ? `<button type="button" class="btn alt lockbtn" data-ht-act="unlock" data-k="act:unlock"><span aria-hidden="true">🔒</span> ${esc(tx('ui.unlock'))}</button>`
      : `<button type="button" class="btn lockbtn" data-ht-act="lock" data-k="act:lock">${esc(tx('ui.lock'))}</button>`) : '') + `</div>` +
    `<div class="tiles">${colsHTML(g, o.dis || g.locked)}</div>` +
    (g.locked ? `<div class="claims"><span>+${g.pos} / ${MINUS}${g.neg}</span></div>` : '') +
    (o.sum && !g.locked ? sumRow(ions, true) : '') +
    (drop && !dragging ? `<button type="button" class="addhere" data-ht-drop="g:${g.id}" data-k="drop:g:${g.id}">${esc(tx('ui.putHere'))}</button>` : '') + `</div>`;
}
function groupsHTML(o) {
  return `<div class="ht-groups">${S.groups.map((g, i) => grpHTML(g, i, o)).join('')}` +
    (o.newg ? `<button type="button" class="newg${S.sel ? ' drop' : ''}" data-ht-drop="new" data-k="drop:new"><b aria-hidden="true">＋</b>${esc(tx('ui.newCompound'))}</button>` : '') + `</div>`;
}
function trayHTML(o) {
  const inG = S.sel && groupOf(S, S.sel), dragging = !!(drag && drag.on);
  return `<div class="ht-traybox"${o.drop ? ' data-ht-drop="tray"' : ''}><div class="ht-th"><b>${esc(tx('ui.yourTiles'))}</b></div>` +
    `<div class="ht-tray">${S.tray.length ? S.tray.map(id => tileBtn(id, o.dis)).join('') : `<div class="emptyt">${esc(tx('ui.allPlaced'))}</div>`}</div>` +
    (o.drop && inG && !dragging ? `<button type="button" class="addhere" data-ht-drop="tray" data-k="drop:tray" style="width:100%;margin-top:6px">${esc(tx('ui.putBack'))}</button>` : '') +
    (o.swap ? `<button type="button" class="swap" data-ht-drop="swap" data-k="drop:swap"><span>${esc(tx('ui.swapBin'))}<small>${esc(S.sel ? tx('ui.swapThis') : tx('ui.swapPick'))}</small></span></button>` : '') + `</div>`;
}
const btn = (act, label, cls) => `<button type="button" class="btn ${cls || 'alt'}" data-ht-act="${act}" data-k="act:${act}">${esc(label)}</button>`;
const claimsHTML = g => `<span>+${g.pos} / ${MINUS}${g.neg}</span>`;
const hotOf = tgt => tgt && (tgt.closest('.grp,.newg,.ht-traybox,.swap') || tgt);

// ---- the 7 steps ----
const tc = () => ({ tap: tx('ui.coachTap'), then: tx('ui.coachThen') });
const say = m => { if (m) S.msg = m; paintMsg(); };
function reset2(mode) {                          // step 2 state for "try it" (or the watch mode)
  S = mkState(mode === 'watch' ? ['Ca', 'Cl', 'Cl'] : ['Na', 'Na', 'O', 'Cl'], { mode, goal: ['Na', 'Na', 'O'], finished: false });
  S.msg = mode === 'watch' ? null : tryMsg(S);
}
const STEPS = {
  hand: {
    init() { S = mkState(['Na', 'Ca', 'Al', 'Cl', 'O', 'N']); S.msg = { k: 'info', t: tx('msg.hand0') }; },
    html() {
      let info = `<div class="ht-info" aria-live="polite">${esc(tx('msg.hand0'))}</div>`;
      if (S.sel) {
        const k = S.tiles[S.sel].k, i = R.ion(k);
        info = `<div class="ht-info on" aria-live="polite">${tileSpan(k)}<span>${esc(tx('msg.handInfo', { sym: R.ionText(k), name: i.c > 0 ? i.n : i.ide, charge: sg(i.c), kind: tx(i.c > 0 ? 'ui.positive' : 'ui.negative') }))}</span></div>`;
      }
      return trayHTML({ drop: false }) + info;
    },
    tap(id) { S.sel = S.sel === id ? null : id; S.touched = true; },
    coach: () => (S.touched ? null : { key: 't:' + S.tray[0], text: tc().tap })
  },
  group: {
    drag: true,
    init() { reset2('try'); },
    enter() { playDemo(); },
    html() {
      const watching = S.mode === 'watch';
      return groupsHTML({ newg: !watching, sum: true, dis: watching }) + trayHTML({ drop: !watching, dis: watching }) +
        `<div class="ht-actions">${btn('watch', tx('ui.watchAgain'))}${watching ? btn('try', tx('ui.tryIt'), 'go') : btn('reset', tx('ui.tryAgain'))}</div>`;
    },
    tap(id) {
      const g = groupOf(S, id);
      if (S.sel === id) { S.sel = null; return; }
      if (S.sel && g && !g.locked && groupOf(S, S.sel) !== g) { this.drop(S.sel, 'g:' + g.id); return; }
      S.sel = id;
    },
    drop(id, dest) { move(S, id, dest); },
    msg() { return S.mode === 'watch' ? S.msg : tryMsg(S); },
    coach: () => (S.mode === 'try' ? tryCoach(S, tc()) : null),
    act(a) {
      if (a === 'watch') playDemo();
      else if (a === 'try') { clearTimers(); reset2('try'); }
      else if (a === 'reset') reset2('try');
    }
  },
  whynot: {
    init() { S = mkState([]); S.msg = { k: 'warn', t: tx('msg.whynot') }; },
    html() {
      return `<div class="ht-cards">` + [['Ca', 'Cl'], ['Ca', 'Ca', 'O', 'O'], ['Na', 'Ca', 'Cl', 'Cl', 'Cl']].map(ions => {
        const j = judge(ions);
        return `<div class="cg no"><div class="verd no"><span aria-hidden="true">✗</span> ${esc(tx('ui.notOk'))}</div><div class="fm">${R.formulaHTML(ions)}</div>` +
          `<div class="ht-row">${ions.map(tileSpan).join('')}</div><div class="ht-sum2">${esc(sumText(ions, false))}</div><ul class="why">${j.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
      }).join('') + `</div>`;
    }
  },
  lock: {
    init() {
      S = mkState(['Ca', 'Cl', 'Cl'], { mode: 'pre', pos: 0, neg: 0 });
      move(S, 't0', 'new'); move(S, 't1', 'g:g1'); move(S, 't2', 'g:g1'); S.fresh = {};
      S.msg = { k: 'info', t: tx('msg.lock0') };
    },
    html() {
      if (S.mode !== 'panel') return groupsHTML({ lock: true, dis: true });
      const g = S.groups[0], ions = ionsOf(S, g);
      const stepper = w => { const p = w === 'pos'; return `<div class="stepper"><button type="button" data-ht-step="${w}" data-d="-1" aria-label="${esc(tx(p ? 'ui.lessPos' : 'ui.lessNeg'))}">−</button>` +
        `<label class="num ${p ? 'p' : 'n'}"><span aria-hidden="true">${p ? '+' : MINUS}</span><input id="ht-in-${w}" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${S[w]}" aria-label="${esc(tx(p ? 'ui.posAria' : 'ui.negAria'))}"></label>` +
        `<button type="button" data-ht-step="${w}" data-d="1" aria-label="${esc(tx(p ? 'ui.morePos' : 'ui.moreNeg'))}">+</button></div>`; };
      return `<form class="dlg ht-lock" id="htLockForm" novalidate><div class="bigf">${R.formulaHTML(ions)}</div>` +
        `<div class="step"><div class="lbl">${esc(tx('ui.totalPos'))}</div>${stepper('pos')}</div><div class="step"><div class="lbl">${esc(tx('ui.totalNeg'))}</div>${stepper('neg')}</div>` +
        `<div class="dfoot"><button type="button" class="btn alt" data-ht-act="lockcancel" data-k="act:lockcancel">${esc(tx('ui.cancel'))}</button><button type="submit" class="btn go" data-k="act:lockgo"><span aria-hidden="true">🔒</span> ${esc(tx('ui.lockGo'))}</button></div></form>`;
    },
    coach: () => (S.mode === 'pre' ? { key: 'act:lock', text: tc().tap } : null),
    act(a) {
      const g = S.groups[0];
      if (a === 'lock') { S.mode = 'panel'; say({ k: 'info', t: tx('msg.lockPanel') }); S.focusIn = 'pos'; }
      else if (a === 'lockcancel') { S.mode = g.locked ? 'locked' : 'pre'; say({ k: 'info', t: tx('msg.lock0') }); }
      else if (a === 'unlock') { g.locked = false; S.mode = 'pre'; say({ k: 'info', t: tx('msg.lock0') }); }
    },
    submit() {
      const g = S.groups[0], pos = parseInt($('ht-in-pos').value, 10) || 0, neg = parseInt($('ht-in-neg').value, 10) || 0;
      S.pos = pos; S.neg = neg;
      const r = checkLock(ionsOf(S, g), pos, neg);
      if (!r.ok) { say({ k: 'warn', t: tx('msg.lockBad', { why: r.why.join(' ') }) + (r.codes.includes('neg') ? ' ' + tx('msg.lockNegTip') : '') }); return; }
      g.locked = true; g.pos = pos; g.neg = neg; S.mode = 'locked'; S.focusIn = 'unlock';
      say({ k: 'good', t: tx('msg.lockGood') });
    }
  },
  swap: {
    drag: true,
    init() { S = mkState(['Mg', 'Cl', 'Al'], { swapped: false }); S.msg = { k: 'info', t: tx('msg.swap0') }; },
    html() {
      return trayHTML({ drop: true, swap: !S.swapped, dis: false }) + (S.swapped ? `<div class="ht-actions">${btn('reset', tx('ui.tryAgain'))}</div>` : '');
    },
    tap(id) { S.sel = S.sel === id ? null : id; },
    drop(id, dest) {
      if (dest === 'swap') { const r = swap(S, id, ['Cl', 'K']); S.swapped = true; S.msg = { k: 'good', t: tx('msg.swapDone') }; return; }
      move(S, id, dest);
    },
    msg() { return S.swapped ? S.msg : { k: 'info', t: S.sel ? tx('msg.swapSel') : tx('msg.swap0') }; },
    coach() {
      if (S.swapped) return null;
      if (S.sel) return { key: 'drop:swap', text: tc().then };
      const id = S.tray.find(i => S.tiles[i].k === 'Al');
      return id ? { key: 't:' + id, text: tc().tap } : null;
    },
    act(a) { if (a === 'reset') STEPS.swap.init(); }
  },
  done: {
    init() { S = { phase: 'challenge', flags: new Set(), hint: false, msg: { k: 'info', t: tx('msg.done0') } }; },
    html() {
      const board = mayaBoard();
      if (S.phase === 'challenge') {
        return `<div class="ht-chk"><div class="ht-h2">${esc(tx('ui.mayaSays'))}</div><div class="tbar" aria-hidden="true"><i style="width:68%"></i></div><div class="cgroups">` +
          board.map((g, i) => `<button type="button" class="cg" data-ht-act="flag" data-i="${i}" data-k="flag:${i}" aria-pressed="${S.flags.has(i)}"><div class="fm">${R.formulaHTML(g.ions)}</div>` +
            `<div class="cl">${claimsHTML(g)}</div><div class="fl">${S.flags.has(i) ? '<span aria-hidden="true">⚑</span> ' + esc(tx('ui.looksWrong')) : esc(tx('ui.tapIfWrong'))}</div></button>`).join('') +
          `</div><div class="chkdone"><button type="button" class="btn" data-ht-act="check" data-k="act:check">${esc(tx('ui.doneChecking'))}</button>${btn('hint', tx('ui.hint'))}</div></div>`;
      }
      const rv = reveal(S.flags);
      return `<div class="ht-chk"><div class="ht-h2">${esc(tx('ui.mayaMistake'))}</div><p class="ht-verdict">${esc(tx('msg.outLine'))}<br>${esc(tx('msg.winLine'))}</p><div class="cgroups">` +
        board.map((g, i) => { const r = rv.results[i], f = S.flags.has(i);
          return `<div class="cg ${r.ok ? 'ok' : 'no'}"><div class="verd ${r.ok ? 'ok' : 'no'}"><span aria-hidden="true">${r.ok ? '✓' : '✗'}</span> ${esc(tx(r.ok ? 'ui.correct' : 'ui.wrong'))}</div><div class="fm">${R.formulaHTML(g.ions)}</div><div class="cl">${claimsHTML(g)}</div>` +
            (r.ok ? '' : `<ul class="why">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`) +
            (f ? (r.ok ? `<div><span class="pts n">${MINUS}${Math.abs(R.PTS.flagWrong)}</span> ${esc(tx('ui.wrongFlagPts'))}</div>` : `<div><span class="pts p">+${R.PTS.flagRight}</span> ${esc(tx('ui.caughtPts'))}</div>`) : '') + `</div>`; }).join('') +
        `</div><div class="ht-actions" style="margin-top:6px">${btn('reset', tx('ui.tryAgain'))}</div></div>`;
    },
    act(a, el) {
      if (a === 'flag') { const i = +el.dataset.i; if (S.flags.has(i)) S.flags.delete(i); else S.flags.add(i); say({ k: 'info', t: S.flags.size ? tx('msg.doneFlagged', { n: S.flags.size }) : tx('msg.done0') }); }
      else if (a === 'hint') say({ k: 'info', t: tx('msg.doneHint') });
      else if (a === 'check') {
        S.phase = 'reveal'; const rv = reveal(S.flags), parts = [];
        if (rv.caught) parts.push(tx('msg.revCaught', { pts: R.PTS.flagRight }));
        if (rv.wrongFlags) parts.push(tx('msg.revFalse', { pts: Math.abs(R.PTS.flagWrong) }));
        if (!rv.caught && !rv.wrongFlags) parts.push(tx('msg.revNone'));
        else if (!rv.caught) parts.push(tx('msg.revMissed'));
        say({ k: rv.caught ? 'good' : 'info', t: parts.join(' ') });
      } else if (a === 'reset') STEPS.done.init();
    }
  },
  points: {
    init() { S = { msg: null }; },
    html() {
      const P = R.PTS, ex = P.compound + 3 * P.perIon;
      const row = (ic, label, val, cls, more) => `<li><span class="ic" aria-hidden="true">${ic}</span><span>${esc(label)}${more ? `<small>${esc(more)}</small>` : ''}</span><b class="pts ${cls}">${val}</b></li>`;
      return `<ul class="ht-pts">` +
        row('✓', tx('points.compound'), '+' + P.compound, 'p', tx('points.compoundMore', { compound: P.compound, perIon: P.perIon, total: ex })) +
        row('★', tx('points.win'), '+' + P.win, 'p') + row('⚑', tx('points.flagRight'), '+' + P.flagRight, 'p') + row('✗', tx('points.flagWrong'), MINUS + Math.abs(P.flagWrong), 'n') + `</ul>` +
        (activeScreen() === 'sStart' && $('pracBtn') ? `<button type="button" class="btn big go ht-cta" data-ht-act="practice" data-k="act:practice">${esc(tx('ui.practiceNow'))}</button>` : '');
    },
    act(a) { if (a === 'practice') { lastFocus = null; close(); const b = $('pracBtn'); if (b) b.click(); } }
  }
};

// ---- the animated demo in step 2 ----
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function playDemo() {
  clearTimers(); reset2('watch');
  const my = S, ids = S.tray.slice(), M = tx('msg.demo1');
  const after = (ms, fn) => timers.push(setTimeout(() => { if (S === my && isOpen) fn(); }, ms));
  const place = id => move(S, id, S.groups.length ? 'g:' + S.groups[0].id : 'new');
  const msgs = ['msg.demo1', 'msg.demo2', 'msg.demo3'];
  if (REDUCED()) {                                // no motion: show the finished compound at once
    ids.forEach(place); S.finished = true; S.msg = { k: 'good', t: tx('msg.demo3') + ' ' + tx('msg.demo4') };
    render(); return;
  }
  render(); say({ k: 'info', t: M });
  let at = 700;
  ids.forEach((id, i) => {
    after(at, () => { S.sel = id; render(); }); at += CFG.ANIM_MS * 0.5;
    after(at, () => { place(id); S.msg = { k: i === 2 ? 'good' : 'info', t: tx(msgs[i]) }; render(); }); at += CFG.ANIM_MS;
  });
  after(at + 300, () => { S.finished = true; S.msg = { k: 'good', t: tx('msg.demo3') + ' ' + tx('msg.demo4') }; render(); });
}

// ---- drawing ----
const fkey = () => { const a = document.activeElement; return (a && a.closest && a.closest('#htStage') && a.dataset && a.dataset.k) || null; };
function refocus(k) {
  if (!k) return;
  let e = stage.querySelector('[data-k="' + k + '"]');
  if (!e || e.disabled) e = stage.querySelector('.ht-tray [data-ht-tile]:not(:disabled)') || stage.querySelector('button:not(:disabled)');
  if (e) e.focus({ preventScroll: true });
}
const ICON = { info: 'i', good: '✓', warn: '!' };
function paintMsg() {
  const el = $('htMsg'), m = (STEP && STEP.msg && STEP.msg()) || S.msg, html = m ? `<span class="ht-mi" aria-hidden="true">${ICON[m.k] || 'i'}</span><span>${esc(m.t)}</span>` : '';
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  el.className = 'ht-msg' + (m ? ' ' + m.k : '');
}
function render() {
  const fk = fkey();
  stage.innerHTML = STEP.html();
  const c = STEP.coach && STEP.coach();
  if (c) { const e = stage.querySelector('[data-k="' + c.key + '"]'); if (e) { e.classList.add('ht-coach'); e.setAttribute('data-coach', c.text); } }
  S.fresh = {};
  paintMsg();
  if (S.focusIn) { const e = stage.querySelector(S.focusIn === 'unlock' ? '[data-ht-act="unlock"]' : '#ht-in-' + S.focusIn); S.focusIn = null; if (e) { e.focus({ preventScroll: true }); return; } }
  refocus(fk);
}
function head() {
  const total = ORDER.length, id = ORDER[cur], title = tx('steps.' + id + '.title');
  $('htStepOf').textContent = tx('ui.stepOf', { n: cur + 1, total });
  $('htTitle').textContent = title;
  $('htLines').innerHTML = tx('steps.' + id + '.lines').map(l => `<p>${esc(l)}</p>`).join('');
  $('htPills').innerHTML = ORDER.map((sid, i) => {
    const label = tx('ui.pillLabel', { n: i + 1, title: tx('steps.' + sid + '.title') }), here = i === cur, done = i < cur;
    return `<button type="button" class="ht-pill${done ? ' done' : ''}" data-ht-go="${i}" aria-label="${esc(label)}" title="${esc(label)}"${here ? ' aria-current="step"' : ''}${i > maxReached ? ' disabled' : ''}>` +
      `${done ? '<span class="ck" aria-hidden="true">✓</span>' : ''}${i + 1}</button>`;
  }).join('');
  $('htBack').disabled = cur === 0;
  $('htSkip').hidden = cur === total - 1;
  $('htNext').textContent = cur === total - 1 ? tx('ui.finish') : tx('ui.next');
  $('htAnn').textContent = tx('ui.stepOf', { n: cur + 1, total }) + ': ' + title;
}
function go(n) {
  n = Math.max(0, Math.min(ORDER.length - 1, n));
  clearTimers(); cancelDrag();
  cur = n; maxReached = Math.max(maxReached, n); STEP = STEPS[ORDER[n]];
  STEP.init(); head(); render();
  if (STEP.enter) STEP.enter();
}
const afterChange = () => { render(); };

// ---- input: tap (primary) and drag (pointer), same as the real board ----
function tapTile(id) {
  if (!S.tiles[id]) return;
  STEP.tap ? STEP.tap(id) : (S.sel = S.sel === id ? null : id);
  afterChange();
}
function dropOn(id, dest) { if (STEP.drop) STEP.drop(id, dest); S.sel = null; afterChange(); }
function tapDrop(dest) {
  if (S.mode === 'watch') return;
  if (!S.sel) { if (STEP.drop) say({ k: 'info', t: tx('ui.pickFirst') }); return; }
  dropOn(S.sel, dest);
}
function cancelDrag() { if (!drag) return; if (drag.ghost) drag.ghost.remove(); if (drag.hot) drag.hot.classList.remove('hot'); drag = null; }
function wire() {
  dlg.addEventListener('click', e => {
    if (noClick) { noClick = false; return; }
    const go1 = e.target.closest('[data-ht-go]'); if (go1) { if (!go1.disabled) go(+go1.dataset.htGo); return; }
    const st = e.target.closest('[data-ht-step]');
    if (st) { const i = $('ht-in-' + st.dataset.htStep); if (i) { i.value = Math.max(0, Math.min(40, (parseInt(i.value, 10) || 0) + +st.dataset.d)); S[st.dataset.htStep] = +i.value; } return; }
    const a = e.target.closest('[data-ht-act]'); if (a) { if (STEP.act) STEP.act(a.dataset.htAct, a); afterChange(); return; }
    const t = e.target.closest('[data-ht-tile]'); if (t && !t.disabled) { tapTile(t.dataset.htTile); return; }
    const d = e.target.closest('[data-ht-drop]'); if (d && STEP.drop) tapDrop(d.dataset.htDrop);
  });
  dlg.addEventListener('input', e => { if (e.target.matches('.stepper input')) { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); S[e.target.id.replace('ht-in-', '')] = +e.target.value; } });
  dlg.addEventListener('submit', e => { e.preventDefault(); if (STEP.submit) { STEP.submit(); afterChange(); } });
  dlg.addEventListener('pointerdown', e => {
    if (e.button || !STEP || !STEP.drag || (S.mode === 'watch')) return;
    const b = e.target.closest('[data-ht-tile]'); if (!b || b.disabled) return;
    drag = { id: b.dataset.htTile, x: e.clientX, y: e.clientY, on: false, hot: null, dest: null };
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return;
      drag.on = true; S.sel = drag.id; render();
      const src = stage.querySelector('[data-ht-tile="' + drag.id + '"]'); if (!src) { drag = null; return; }
      const g = src.cloneNode(true); g.classList.add('ht-ghost'); g.removeAttribute('data-ht-tile'); g.removeAttribute('data-k'); g.removeAttribute('aria-pressed'); g.setAttribute('aria-hidden', 'true');
      dlg.appendChild(g); drag.ghost = g;
    }
    e.preventDefault();
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
    const over = document.elementFromPoint(e.clientX, e.clientY), tgt = over && over.closest && over.closest('#htStage [data-ht-drop]'), hot = hotOf(tgt);
    if (drag.hot !== hot) { if (drag.hot) drag.hot.classList.remove('hot'); if (hot) hot.classList.add('hot'); drag.hot = hot; }
    drag.dest = tgt ? tgt.dataset.htDrop : null;
  }, { passive: false });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; cancelDrag();
    if (d.on) { noClick = true; setTimeout(() => { noClick = false; }, 0); if (d.dest) dropOn(d.id, d.dest); else { S.sel = null; render(); } }
  });
  document.addEventListener('pointercancel', cancelDrag);
  $('htNext').addEventListener('click', () => { if (cur === ORDER.length - 1) close(); else go(cur + 1); });
  $('htBack').addEventListener('click', () => go(cur - 1));
  $('htSkip').addEventListener('click', close);
  $('htX').addEventListener('click', close);
  dlg.addEventListener('close', onClosed);
}

// ---- open / close ----
function build() {
  if (dlg) return;
  const st = document.createElement('style'); st.id = 'htStyle'; st.textContent = CSS; document.head.appendChild(st);
  dlg = document.createElement('dialog'); dlg.id = 'htDlg'; dlg.setAttribute('aria-labelledby', 'htH');
  dlg.innerHTML = `<div class="ht-head"><h2 id="htH">${esc(tx('ui.title'))}</h2><span class="ht-stepof" id="htStepOf"></span>` +
    `<button type="button" class="btn alt ht-x" id="htX" aria-label="${esc(tx('ui.closeTip'))}" title="${esc(tx('ui.closeTip'))}"><span aria-hidden="true">✕</span> ${esc(tx('ui.close'))}</button>` +
    `<div class="ht-pills" id="htPills" role="group" aria-label="${esc(tx('ui.title'))}"></div></div>` +
    `<div class="ht-body"><div class="ht-text"><h3 id="htTitle"></h3><div id="htLines"></div></div><div class="ht-stage" id="htStage" role="group" aria-label="${esc(tx('ui.stageLabel'))}"></div>` +
    `<div class="ht-msg" id="htMsg" role="status" aria-live="polite"></div></div>` +
    `<div class="ht-foot"><button type="button" class="linkbtn" id="htSkip" title="${esc(tx('ui.skipTip'))}">${esc(tx('ui.skip'))}</button><span class="sp"></span>` +
    `<button type="button" class="btn alt" id="htBack">${esc(tx('ui.back'))}</button><button type="button" class="btn go" id="htNext"></button></div>` +
    `<span class="sr" id="htAnn" role="status" aria-live="polite"></span>`;
  document.body.appendChild(dlg);
  stage = $('htStage');
  wire();
}
function open(source) {
  if (isOpen || inRoom()) return false;
  build();
  lastFocus = document.activeElement;
  maxReached = seen() ? ORDER.length - 1 : 0;      // first time: forward one step at a time. Later: every step can be picked.
  markSeen();
  isOpen = true;
  dlg.showModal();
  go(0);
  $('htNext').focus({ preventScroll: true });
  clearInterval(watch); watch = setInterval(() => { if (inRoom()) close(); }, 500);   // safety: if a room opens behind this, get out of the way
  return true;
}
function close() { if (dlg && dlg.open) dlg.close(); else onClosed(); }
function onClosed() {
  if (!isOpen && !drag) return;
  isOpen = false; clearTimers(); cancelDrag(); clearInterval(watch);
  const f = lastFocus; lastFocus = null;
  if (f && f.focus && document.contains(f)) { try { f.focus({ preventScroll: true }); } catch (e) {} }
}
function quickRules() {                          // inside a room: only the short list, with a note that the round keeps going
  const d = $('dHelp'); if (!d) return;
  if (!$('htRoomNote')) { const p = document.createElement('p'); p.className = 'note'; p.id = 'htRoomNote'; p.textContent = tx('ui.roomNote'); const b = Array.from(d.querySelectorAll('button[data-close]')).pop(); b ? b.parentNode.insertBefore(p, b) : d.appendChild(p); }
  $('htRoomNote').hidden = false;
  d.showModal();
}
function help(o) {
  if (o && o.inRoom || inRoom()) { quickRules(); return; }
  const d = $('dHelp'); if (d) { const n = $('htRoomNote'); if (n) n.hidden = true; }
  open('help');
}

// ---- entry points ----
function addButtons() {
  const mk = () => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn alt htOpenBtn'; b.innerHTML = `<span aria-hidden="true">?</span> ${esc(tx('ui.openBtn'))}`; b.addEventListener('click', () => open('button')); return b; };
  const demo = $('demo'); if (demo && demo.parentNode) { const row = document.createElement('div'); row.className = 'row'; row.appendChild(mk()); demo.parentNode.insertBefore(row, demo.nextSibling); }
  const nr = $('newRoomBtn'); if (nr && nr.parentNode) nr.parentNode.insertBefore(mk(), nr);
}
function autoOpen() {
  if (/[?&]howto\b/.test(location.search)) { open('url'); return; }
  if (!CFG.AUTO_OPEN_FIRST_VISIT || (CFG.SKIP_WHEN_AUTOMATED && navigator.webdriver)) return;
  if (seen() || store.get('ionagrams-room') || inRoom() || activeScreen() !== 'sStart') return;
  open('auto');
}
addButtons();
setTimeout(autoOpen, 700);
window.IonHowTo = { open, close, help, isOpen: () => isOpen, config: CFG, text: TXT, _logic: LOGIC };
})();
