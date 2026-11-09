// Tests for shared/sumzero.js (SumZero wrong-piece rule + extra-piece generator). Run from the repo root: node tests/sumzero.test.js
'use strict';
const SZ = require('../shared/sumzero.js'), IONS = require('../shared/ions.js');
let fails = 0;
function t(name, cond, info) { if (cond) console.log('ok   ' + name); else { fails++; console.log('FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); } }
const eq = (name, got, want) => t(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const K = IONS.BY_KEY, I = k => K[k];
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const CFG = { DECOY_START_LEVEL: 3, DECOY_CHANCE: 0.25, DECOY_CHANCE_STEP: 0.04, DECOY_CHANCE_MAX: 0.5, MAX_TRAY: 8 };

// iBond's pools(level), ported: level 1 charges up to 2, level 2 adds 3, from level 4 one new metal/polyatomic per level
const ADV_POLY = ['HCO3', 'C2H3O2', 'ClO3', 'CN', 'CrO4', 'SCN', 'SO3', 'NO2'], TMS = Object.keys(IONS.METAL);
function makeSeq(R) {
  const sh = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const polys = sh(ADV_POLY), tms = sh(TMS.map(m => 'tm:' + m)), seq = []; let metal = R() < .5;
  while (polys.length || tms.length) { seq.push(((metal && tms.length) || !polys.length ? tms : polys).shift()); metal = !metal; }
  return seq;
}
function pools(level, seq) {
  const mc = level >= 2 ? 3 : 2, open = new Set(seq.slice(0, Math.max(0, level - 4 + 1)));
  const ok = i => i.tm ? open.has('tm:' + i.tm) : !i.poly || IONS.BASIC_POLY.includes(i.s) || open.has(i.s);
  return { cats: IONS.CATIONS.filter(i => (i.tm || i.c <= mc) && ok(i)), ans: IONS.ANIONS.filter(i => -i.c <= mc && ok(i)) };
}

// ---- lowest ratio ----
eq('lowest Al2O3, Sn(OH)4, Pb3(PO4)4, NaCl', [SZ.lowest(I('Al'), I('O')), SZ.lowest(I('Sn4'), I('OH')), SZ.lowest(I('Pb4'), I('PO4')), SZ.lowest(I('Na'), I('Cl'))], [[2, 3], [1, 4], [3, 4], [1, 1]]);

// ---- wrong piece: Build the name ----
const tgt = { cat: I('Sn4'), an: I('OH'), a: 1, b: 4 };
const ord = (cat, an, ion) => SZ.wrongPiece({ mode: 'order', cat: cat.map(I), an: an.map(I), ion: I(ion), target: tgt });
eq('order: right ions are fine', [ord([], [], 'Sn4'), ord(['Sn4'], ['OH', 'OH', 'OH'], 'OH')], [null, null]);
eq('order: ion not in the compound', [ord([], [], 'O'), ord([], [], 'Sn2'), ord(['Sn4'], [], 'NO3')].map(w => w && w.why), ['not', 'not', 'not']);
eq('order: one copy too many', [ord(['Sn4'], [], 'Sn4'), ord([], ['OH', 'OH', 'OH', 'OH'], 'OH')].map(w => w && w.why), ['extra', 'extra']);

// ---- wrong piece: Free build ----
const L1 = pools(1, []), L2 = pools(2, []), L4tin = { cats: L2.cats.concat([I('Sn2'), I('Sn4')]), ans: L2.ans };
const fr = (P, cat, an, ion) => { const w = SZ.wrongPiece({ mode: 'free', cat: cat.map(I), an: an.map(I), ion: I(ion), cats: P.cats, ans: P.ans }); return w && w.why; };
eq('free: second different cation / anion', [fr(L2, ['Ca'], [], 'Mg'), fr(L2, [], ['Cl'], 'O')], ['side', 'side']);
eq('free: first piece is always fine', [fr(L1, [], [], 'Ca'), fr(L2, [], [], 'PO4')], [null, null]);
eq('free: 2 Mg at level 1 (no 3- ions yet) is too many; level 2 is fine (Mg3N2)', [fr(L1, ['Mg'], [], 'Mg'), fr(L2, ['Mg'], [], 'Mg')], ['many', null]);
eq('free: 3 Cl needs a 3+ ion; 4 Cl needs a 4+ ion', [fr(L1, [], ['Cl', 'Cl'], 'Cl'), fr(L2, [], ['Cl', 'Cl'], 'Cl'), fr(L2, [], ['Cl', 'Cl', 'Cl'], 'Cl'), fr(L4tin, [], ['Cl', 'Cl', 'Cl'], 'Cl')], ['many', null, 'many', null]);
eq('free: Ca + Cl then a 2nd Ca (Ca2Cl4 is not smallest ratio)', fr(L2, ['Ca'], ['Cl'], 'Ca'), 'many');
eq('free: 2 Cl in the box, then Na (Na balances only 1 Cl)', fr(L2, [], ['Cl', 'Cl'], 'Na'), 'many');
eq('free: Sn4+ with OH: 4th fine, 5th too many', [fr(L4tin, ['Sn4'], ['OH', 'OH', 'OH'], 'OH'), fr(L4tin, ['Sn4'], ['OH', 'OH', 'OH', 'OH'], 'OH')], [null, 'many']);
eq('free: Al2O3 path is never wrong', [fr(L2, ['Al'], [], 'O'), fr(L2, ['Al'], ['O'], 'O'), fr(L2, ['Al'], ['O', 'O'], 'Al'), fr(L2, ['Al', 'Al'], ['O', 'O'], 'O')], [null, null, null, null]);

// brute force: a piece is wrong exactly when no neutral smallest-ratio compound (from the ions met so far) contains the new box
function canFinish(P, cat, an) {
  for (const C of P.cats) for (const A of P.ans) {
    if (cat.length && cat[0].k !== C.k || an.length && an[0].k !== A.k) continue;
    if (cat.some(i => i.k !== C.k) || an.some(i => i.k !== A.k)) continue;
    for (let x = 1; x <= 12; x++) for (let y = 1; y <= 12; y++)
      if (x * C.c === -y * A.c && gcd(x, y) === 1 && x >= cat.length && y >= an.length) return true;
  }
  return false;
}
{
  const R = seeded(11); let bad = 0, n = 0, wrongs = 0;
  for (let g = 0; g < 3000; g++) {
    const P = pools(1 + Math.floor(R() * 14), makeSeq(R)), all = P.cats.concat(P.ans);
    let cat = [], an = [];
    for (let m = 0; m < 9; m++) {
      const ion = all[Math.floor(R() * all.length)], w = SZ.wrongPiece({ mode: 'free', cat, an, ion, cats: P.cats, ans: P.ans });
      const nc = ion.c > 0 ? cat.concat([ion]) : cat, na = ion.c < 0 ? an.concat([ion]) : an;
      const truth = canFinish(P, nc, na); n++;
      if (!!w === truth) bad++;
      if (w) { wrongs++; continue; }
      cat = nc; an = na;
      const s = cat.reduce((a, i) => a + i.c, 0) + an.reduce((a, i) => a + i.c, 0);
      if (cat.length && an.length && s === 0) { cat = []; an = []; }
    }
  }
  t(`free: rule matches brute force on ${n} random moves (${wrongs} wrong)`, bad === 0, bad);
}

// ---- decoy chance ----
eq('decoy chance by level', [1, 2, 3, 4, 8, 20].map(l => +SZ.decoyChance(l, CFG).toFixed(2)), [0, 0, 0.25, 0.29, 0.45, 0.5]);

// ---- look-alikes only from what the student has met ----
const P5 = { cats: L2.cats.concat([I('Fe2'), I('Fe3')]), ans: L2.ans };
eq('look-alikes: iron(II) for iron(III); oxide for hydroxide; sulfite waits until introduced',
  [SZ.lookalikes(I('Fe3'), P5.cats).map(i => i.k), SZ.lookalikes(I('OH'), P5.ans).map(i => i.k), SZ.lookalikes(I('SO4'), P5.ans).map(i => i.k),
   SZ.lookalikes(I('SO4'), P5.ans.concat([I('SO3')])).map(i => i.k)], [['Fe2'], ['O'], ['S'], ['SO3', 'S']]);

// ---- extra pieces for Build the name: thousands of trays ----
{
  const R = seeded(5), name = (c, a) => c.n + ' ' + a.ide;
  let trays = 0, withX = 0, maxT = 0, notUnique = 0, outOfPool = 0, tooBig = 0, early = 0, extraCopy = 0, sets = 0, misc = 0;
  const per = {};
  for (let g = 0; g < 400; g++) {
    const seq = makeSeq(R);
    for (let level = 1; level <= 16; level++) {
      const P = pools(level, seq);
      for (let r = 0; r < 5; r++) {
        let cat = P.cats[Math.floor(R() * P.cats.length)], an = P.ans[Math.floor(R() * P.ans.length)];
        if (cat.k === 'NH4' && an.k === 'OH') an = I('Cl');
        const [a, b] = SZ.lowest(cat, an), target = { cat, an, a, b };
        const ext = SZ.orderExtras({ target, cats: P.cats, ans: P.ans, level, cfg: CFG, rnd: R });
        const tray = Array(a).fill(cat).concat(Array(b).fill(an), ext);
        trays++; per[level] = per[level] || [0, 0]; per[level][0]++;
        if (ext.length) { withX++; per[level][1]++; if (level < CFG.DECOY_START_LEVEL) early++; }
        if (ext.some(x => x.k === cat.k || x.k === an.k)) extraCopy++;
        const d = ext.filter(x => x.k !== cat.k && x.k !== an.k);
        if (d.length) { sets++; if (SZ.lookalikes(cat, P.cats).concat(SZ.lookalikes(an, P.ans)).includes(d[0])) misc++; }
        if (ext.some(x => !P.cats.includes(x) && !P.ans.includes(x))) outOfPool++;
        if (tray.length + 1 > CFG.MAX_TRAY) tooBig++;
        maxT = Math.max(maxT, tray.length + 1);
        const right = SZ.compounds(tray).filter(c => name(c.cat, c.an) === name(cat, an));
        if (right.length !== 1 || right[0].cat !== cat || right[0].an !== an) notUnique++;
      }
    }
  }
  console.log(`     ${trays} trays: ${withX} with extra pieces (${extraCopy} with an extra copy, ${sets} with a decoy set, ${misc} of those sets are look-alikes)`);
  console.log('     share with extras by level: ' + Object.keys(per).map(l => l + ':' + Math.round(100 * per[l][1] / per[l][0]) + '%').join(' '));
  t('no extra pieces before DECOY_START_LEVEL', early === 0, early);
  t('every Build-the-name tray has exactly one compound with the target name', notUnique === 0, notUnique);
  t('extra pieces only use ions the student has met', outOfPool === 0, outOfPool);
  t(`tray (with one single distractor) never over MAX_TRAY (max ${maxT})`, tooBig === 0, tooBig);
  t('both kinds of extras happen', extraCopy > 100 && sets > 100, { extraCopy, sets });
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
