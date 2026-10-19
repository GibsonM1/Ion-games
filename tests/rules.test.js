// Tests for ionagrams/rules.js. Run from the repo root: node tests/rules.test.js
const R = require('../ionagrams/rules.js'), IONS = require('../shared/ions.js');
let fails = 0;
function t(name, cond, info) { if (cond) console.log('ok   ' + name); else { fails++; console.log('FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); } }
const eq = (name, got, want) => t(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const ALL = { mono: true, poly: true, tm: true }, M = '−';
const ionsOf = x => Array(x.a).fill(x.cat).concat(Array(x.b).fill(x.an));
const chk = (ions, pos, neg, name, naming) => R.checkGroup({ ions, pos, neg, name: name || null }, { naming: naming || 'off' });

// ---- formulas ----
eq('formula (NH4)3PO4', R.formulaText(['NH4', 'PO4', 'NH4', 'NH4']), '(NH₄)₃PO₄');
eq('formula Al2(SO4)3', R.formulaText(['SO4', 'Al', 'SO4', 'Al', 'SO4']), 'Al₂(SO₄)₃');
eq('formula NaOH', R.formulaText(['OH', 'Na']), 'NaOH');
eq('formula Ca2O2 stays unreduced', R.formulaText(['Ca', 'O', 'O', 'Ca']), 'Ca₂O₂');
eq('formula Fe2O3', R.formulaText(['O', 'Fe3', 'O', 'Fe3', 'O']), 'Fe₂O₃');
eq('formula Ca(OH)2', R.formulaText(['Ca', 'OH', 'OH']), 'Ca(OH)₂');
eq('formula mixed order', R.formulaText(['Cl', 'Na', 'Ca', 'Cl', 'Cl']), 'NaCaCl₃');
eq('formulaHTML', R.formulaHTML(['SO4', 'Al', 'SO4', 'Al', 'SO4']), '<span class="m">Al<sub>2</sub></span><span class="x">(SO<sub>4</sub>)<sub>3</sub></span>');
eq('totals Al2(SO4)3', R.totals(['Al', 'Al', 'SO4', 'SO4', 'SO4']), { pos: 6, neg: 6 });
eq('ionText', ['Ca', 'N', 'Na', 'Cl', 'SO4', 'NH4', 'Fe3'].map(R.ionText), ['Ca²⁺', 'N³⁻', 'Na⁺', 'Cl⁻', 'SO₄²⁻', 'NH₄⁺', 'Fe³⁺']);

// ---- names ----
eq('name iron(III) sulfate', R.correctName(['Fe3', 'Fe3', 'SO4', 'SO4', 'SO4']), 'iron(III) sulfate');
eq('name ammonium phosphate', R.correctName(['NH4', 'NH4', 'NH4', 'PO4']), 'ammonium phosphate');
eq('name copper(I) oxide', R.correctName(['Cu1', 'Cu1', 'O']), 'copper(I) oxide');
eq('name aluminum sulfate', R.correctName(['Al', 'Al', 'SO4', 'SO4', 'SO4']), 'aluminum sulfate');
eq('name null when mixed / one side', [R.correctName(['Na', 'Ca', 'Cl']), R.correctName(['Na'])], [null, null]);
t('sameName alt spellings + spacing', R.sameName('Aluminium  sulfate', 'aluminum sulfate') && R.sameName('sodium hydrogen carbonate', 'sodium bicarbonate')
  && R.sameName(' Iron (III)   Sulfate ', 'iron(III) sulfate') && !R.sameName('iron sulfate', 'iron(III) sulfate') && !R.sameName(null, 'x'));
eq('joinName', R.joinName(['iron', '(III)', 'sulfate']), 'iron(III) sulfate');

// ---- targets ----
const TA = R.targets(ALL), key = x => x.cat + '+' + x.an;
t('targets: no NH4+OH, all size<=5', !TA.some(x => x.cat === 'NH4' && x.an === 'OH') && TA.every(x => x.size <= 5 && x.size === x.a + x.b));
const al2so43 = TA.find(x => key(x) === 'Al+SO4');
eq('target Al2(SO4)3 numbers', al2so43, { cat: 'Al', an: 'SO4', a: 2, b: 3, size: 5, diff: 4 });
eq('target NaCl diff 1, Fe2O3 diff 4', [TA.find(x => key(x) === 'Na+Cl').diff, TA.find(x => key(x) === 'Fe3+O').diff], [1, 4]);
t('target Sn3N4 (size 7) excluded, Ca3(PO4)2 included', !TA.some(x => key(x) === 'Sn4+N') && TA.some(x => key(x) === 'Ca+PO4' && x.a === 3 && x.b === 2));
const TM = R.targets({ mono: true }), TP = R.targets({ poly: true }), TT = R.targets({ tm: true, mono: true });
t('mono set: no poly, no tm; has Zn and Ag', TM.every(x => !IONS.BY_KEY[x.cat].poly && !IONS.BY_KEY[x.cat].tm && !IONS.BY_KEY[x.an].poly) && TM.some(x => x.cat === 'Zn') && TM.some(x => x.cat === 'Ag'));
t('poly set: only NH4 + polyatomic anions', TP.length > 0 && TP.every(x => x.cat === 'NH4' && IONS.BY_KEY[x.an].poly));
t('tm+mono set: tm cations with monatomic anions', TT.some(x => x.cat === 'Fe3' && x.an === 'O') && !TT.some(x => IONS.BY_KEY[x.an].poly));
eq('sets allowing nothing fall back to mono', [R.targets({ tm: true }).length, R.targets({}).length], [TM.length, TM.length]);

// every target: valid, correct claims and name pass in every naming mode
let bad = [];
TA.forEach(x => {
  const ions = ionsOf(x), tot = R.totals(ions), name = R.correctName(ions);
  ['off', 'pick', 'build'].forEach(nm => { const r = chk(R.shuffle(ions.slice(), Math.random), tot.pos, tot.neg, name, nm); if (!r.ok) bad.push([key(x), nm, r.errors]); });
  if (tot.pos !== tot.neg || R.joinName(R.nameWords(ions)) !== name || R.checkGroup({ ions }, {}).truth.fix !== R.formulaText(ions)) bad.push(key(x));
});
t('every target (' + TA.length + ') passes checkGroup with correct claims and name', !bad.length, bad.slice(0, 5));

// ---- error codes ----
let r = chk(['Ca', 'Ca', 'O', 'O'], 4, 4);
eq('ratio Ca2O2', [r.errors, r.why], [['ratio'], ['Ca₂O₂ can be simplified to CaO. Use the smallest ratio.']]);
r = chk(['Na', 'Ca', 'Cl'], 3, 1);
eq('mixed Na+Ca+Cl (+ charge)', [r.errors, r.why[0], r.why[1]], [['mixed', 'charge'],
  'Use one kind of positive ion and one kind of negative ion. This has Na⁺ and Ca²⁺.', `Na⁺ + Ca²⁺ + Cl⁻: +1 + 2 ${M} 1 = +2, not 0.`]);
r = chk(['Na', 'Na'], 2, 0);
eq('one-side', [r.errors, r.why], [['one-side'], ['A compound needs a positive ion and a negative ion.']]);
r = chk(['Ca', 'N'], 2, 3);
eq('charge Ca2+ + N3- 1:1', [r.errors, r.why], [['charge'], [`Ca²⁺ + N³⁻: +2 ${M} 3 = ${M}1, not 0.`]]);
r = chk(['Ca', 'Ca', 'Ca', 'N'], 6, 3);
eq('charge long form', r.why, [`3 × (+2) = +6 and 1 × (${M}3) = ${M}3. +6 ${M} 3 = +3, not 0.`]);
r = chk(['Al', 'Al', 'SO4', 'SO4', 'SO4'], 4, 3);
eq('pos + neg wrong', [r.errors, r.why], [['pos', 'neg'], ['Total + charge is +6, not +4.', `Total ${M} charge is ${M}6, not ${M}3.`]]);
r = chk(['Na', 'Cl'], null, 1);
eq('blank pos is never valid', [r.ok, r.errors], [false, ['pos']]);
r = chk(['Fe3', 'Fe3', 'SO4', 'SO4', 'SO4'], 6, 6, 'iron sulfate', 'pick');
eq('name wrong', [r.errors, r.why], [['name'], ['The name is iron(III) sulfate.']]);
eq('name missing', chk(['Na', 'Cl'], 1, 1, null, 'build').errors, ['name']);
t('name not checked when naming off; alt spelling accepted', chk(['Na', 'Cl'], 1, 1, null, 'off').ok && chk(['Al', 'Cl', 'Cl', 'Cl'], 3, 3, 'Aluminium chloride', 'pick').ok);
eq('name not checked with mixed', chk(['Na', 'Ca', 'Cl', 'Cl', 'Cl'], 3, 3, 'x', 'pick').errors, ['mixed']);
eq('truth', chk(['Ca', 'N'], 2, 3).truth, { pos: 2, neg: 3, formula: 'CaN', name: 'calcium nitride', fix: 'Ca₃N₂' });
const B = R.checkBoard([{ ions: ['Na', 'Cl'], pos: 1, neg: 1 }, { ions: ['Ca', 'O', 'O', 'Ca'], pos: 4, neg: 4 }], { naming: 'off' });
eq('checkBoard', [B.ok, B.results.map(x => x.ok)], [false, [true, false]]);
t('checkBoard empty is not ok', !R.checkBoard([], {}).ok);
eq('missedKeys', R.missedKeys(B.results, [{ ions: ['Na', 'Cl'] }, { ions: ['Ca', 'O', 'O', 'Ca'] }]), ['Ca', 'O']);

// ---- name choices + tiles ----
const nc = R.nameChoices(['Fe3', 'Fe3', 'SO4', 'SO4', 'SO4'], R.rng('x'));
console.log('     sample choices iron(III) sulfate: ' + nc.join(' | '));
console.log('     sample choices Cu2O: ' + R.nameChoices(['Cu1', 'Cu1', 'O'], R.rng('y')).join(' | '));
console.log('     sample choices CaCl2: ' + R.nameChoices(['Ca', 'Cl', 'Cl'], R.rng('z')).join(' | '));
console.log('     sample tiles iron(III) sulfate: ' + R.nameTiles(['Fe3', 'Fe3', 'SO4', 'SO4', 'SO4'], R.rng('x')).join(' | '));
const posCount = [0, 0, 0, 0], probs = []; let groups = 0;
const sim = R.rng('sim');
for (let rep = 0; rep < 25; rep++) TA.forEach(x => {
  const ions = R.shuffle(ionsOf(x), sim), right = R.correctName(ions), ch = R.nameChoices(ions, sim);
  groups++;
  const i = ch.indexOf(right);
  if (i >= 0) posCount[i]++;
  if (ch.length !== 4 || i < 0 || new Set(ch.map(s => s.toLowerCase())).size !== 4 || ch.filter(s => R.sameName(s, right)).length !== 1) probs.push(ch);
  const tl = R.nameTiles(ions, sim), w = R.nameWords(ions), dec = tl.length - w.length;
  if (dec < 3 || dec > 4 || !w.every(s => tl.includes(s)) || new Set(tl).size !== tl.length || R.joinName(w) !== right) probs.push(tl);
});
const pct = posCount.map(n => Math.round((1000 * n) / groups) / 10);
t('nameChoices/nameTiles over ' + groups + ' groups: 4 distinct, exactly one right; tiles hold the name + 3-4 decoys', !probs.length, probs.slice(0, 3));
t('correct answer position ~25% each (' + pct.join('% / ') + '%)', pct.every(p => Math.abs(p - 25) <= 3), pct);
eq('nameChoices on one-side group', R.nameChoices(['Na'], sim), []);

// ---- deal ----
const sets3 = [ALL, { mono: true }, { mono: true, poly: true }, { poly: true }, { mono: true, tm: true }];
let dealBad = [], worst = 0, distinct = true;
for (let s = 0; s < 200; s++) {
  const sets = sets3[s % sets3.length], seed = 'seed' + s, goal = R.targetDiff(seed, sets, 12), seen = new Set();
  for (let u = 0; u < 5; u++) {
    const missed = u === 4 ? { Fe3: 5, PO4: 3, Al: 2, N: 4, Pb4: 3 } : u === 3 ? { Na: 9, Cl: 9 } : {};
    const h = R.deal({ seed, uid: 'u' + u, sets, size: 12, missed }), keys = h.tiles.map(x => x.k);
    const dev = Math.abs(h.diff - goal) / goal; worst = Math.max(worst, dev);
    // tiles = exactly the targets' ions; each target is a valid compound; ids h0..h11; diff matches
    const fromT = [].concat(...h.targets.map(ionsOf)).sort().join(), okT = h.targets.every(x => chk(ionsOf(x), x.b * -IONS.BY_KEY[x.an].c, x.b * -IONS.BY_KEY[x.an].c).ok);
    if (h.tiles.length !== 12 || keys.slice().sort().join() !== fromT || !okT || h.tiles.some((x, i) => x.id !== 'h' + i)
      || Math.abs(h.targets.reduce((a, x) => a + x.diff, 0) - h.diff) > 1e-9 || dev > 0.2) dealBad.push([seed, u, h.diff, goal]);
    seen.add(keys.join());
  }
  if (seen.size !== 5) distinct = false;
}
t('deal: 1000 hands exactly 12 tiles, built from valid targets, diff within ±20% of targetDiff (worst ' + Math.round(worst * 1000) / 10 + '%)', !dealBad.length, dealBad.slice(0, 5));
t('deal: different uids -> different hands', distinct);
const d1 = R.deal({ seed: 'abc', uid: 'p1', sets: ALL, size: 10, missed: { Fe3: 2 } }), d2 = R.deal({ seed: 'abc', uid: 'p1', sets: ALL, size: 10, missed: { Fe3: 2 } });
eq('deal deterministic + size 10', [JSON.stringify(d1) === JSON.stringify(d2), d1.tiles.length], [true, 10]);
eq('targetDiff deterministic', R.targetDiff('abc', ALL, 12), R.targetDiff('abc', ALL, 12));
t('deal: tiles shuffled (not in target order)', (() => { let n = 0; for (let i = 0; i < 50; i++) { const h = R.deal({ seed: 's' + i, uid: 'u', sets: ALL, size: 12 }); if (h.tiles.map(x => x.k).join() !== [].concat(...h.targets.map(ionsOf)).join()) n++; } return n >= 45; })());
// missed weighting: Fe3 shows up more for a student who missed it
const cnt = missed => { let n = 0; for (let i = 0; i < 300; i++) n += R.deal({ seed: 'w' + i, uid: 'u', sets: ALL, size: 12, missed }).tiles.filter(x => x.k === 'Fe3').length; return n; };
const c0 = cnt({}), c1 = cnt({ Fe3: 5 });
t('deal: missed ions more likely (Fe3 tiles ' + c0 + ' -> ' + c1 + ')', c1 > c0 * 1.5);

// ---- drawAt ----
const o = { seed: 'r1', uid: 'u1', sets: ALL };
eq('drawAt ids + deterministic', [R.drawAt(o, 3).map(x => x.id), JSON.stringify(R.drawAt(o, 7)) === JSON.stringify(R.drawAt({ seed: 'r1', uid: 'u1', sets: ALL }, 7))], [['d3a', 'd3b'], true]);
// stream is whole compounds: read tiles in order, close a compound each time the run is balanced
const stream = []; for (let i = 0; i < 2000; i++) stream.push(...R.drawAt(o, i).map(x => x.k));
let run = [], whole = 0, streamOk = true;
stream.forEach(k => {
  run.push(k);
  const r2 = R.checkGroup({ ions: run }, {});
  if (r2.errors.includes('mixed')) streamOk = false;
  if (!r2.errors.some(e => e === 'one-side' || e === 'mixed' || e === 'charge')) { if (r2.errors.includes('ratio')) streamOk = false; whole++; run = []; }
});
t('drawAt stream of 4000 tiles = ' + whole + ' whole lowest-ratio compounds (+' + run.length + ' tiles of the next)', streamOk && whole > 900);
// drawing out of order gives the same tiles
eq('drawAt out-of-order access', R.drawAt({ seed: 'zz', uid: 'q', sets: ALL }, 9), (() => { for (let i = 0; i < 9; i++) R.drawAt({ seed: 'zz2', uid: 'q', sets: ALL }, i); return R.drawAt({ seed: 'zz', uid: 'q', sets: ALL }, 9); })());

// ---- scoring ----
const res = [chk(['Na', 'Cl'], 1, 1), chk(['Al', 'Al', 'O', 'O', 'O'], 6, 6), chk(['Ca', 'O', 'O', 'Ca'], 4, 4)];
eq('scoreRound', R.scoreRound({ results: res, won: true, flagsRight: 1, flagsWrong: 2, extra: false }),
  { total: 69, lines: [{ label: '2 correct compounds', pts: 34 }, { label: 'Won the round', pts: 40 }, { label: 'Caught 1 mistake', pts: 15 }, { label: '2 wrong flags', pts: -20 }] });
eq('scoreRound extra time', R.scoreRound({ results: res, extra: true }).total, 17);
eq('scoreRound never below 0', R.scoreRound({ results: [], flagsWrong: 3 }).total, 0);

// ---- rng/shuffle ----
const a = R.rng('q'), b = R.rng('q');
t('rng deterministic and in [0,1)', [0, 1, 2, 3, 4].every(() => { const x = a(); return x === b() && x >= 0 && x < 1; }));

// basic vs advanced polyatomic sets (added Oct 18)
{ const R = require('../ionagrams/rules.js'), ADV = ['HCO3','C2H3O2','ClO3','CN','CrO4','SCN','SO3','NO2'];
  const a = R.targets({ mono: true, poly: true }), b = R.targets({ mono: true, poly: true, poly2: true });
  const ok = !a.some(t => ADV.includes(t.an)) && b.some(t => ADV.includes(t.an)) && a.some(t => t.cat === 'NH4');
  console.log((ok ? 'ok   ' : 'FAIL ') + 'poly = basic six only; poly2 adds the advanced ions'); if (!ok) fails++; }
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
