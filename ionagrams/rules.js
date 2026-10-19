/* Ionagrams rules -> IonRules. Pure game logic (no DOM): compounds, formulas, names, answer choices,
 * checking, dealing, draw pile, scoring. Deterministic given seeds. API: ionagrams/CONTRACT.md.
 * Browser: load ../shared/ions.js first (window.IONS) -> window.IonRules.  Node: require('./rules.js').
 * Tests: node tests/rules.test.js
 * Extras beyond the contract: ionText(k) 'SO₄²⁻', chargeText(c) '2+', nameWords(ions), checkGroup result
 * also has count (ion count, used by scoreRound) and truth.fix (correct lowest-ratio formula or null). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../shared/ions.js'));
  else root.IonRules = factory(root.IONS);
})(typeof window !== 'undefined' ? window : globalThis, function (IONS) {
  'use strict';
  const BY = IONS.BY_KEY, ROM = IONS.ROM, M = '−', SUB = '₀₁₂₃₄₅₆₇₈₉', SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const PFX = ['', 'mono', 'di', 'tri', 'tetra', 'penta'];
  const PTS = { compound: 10, perIon: 2, win: 40, flagRight: 15, flagWrong: -10, extraScale: 0.5 };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const sub = s => String(s).replace(/\d/g, d => SUB[d]);
  const ion = k => BY[k];
  const chargeText = c => (Math.abs(c) > 1 ? Math.abs(c) : '') + (c > 0 ? '+' : M);
  const ionText = k => { const i = BY[k]; return sub(i.s) + (Math.abs(i.c) > 1 ? SUP[Math.abs(i.c)] : '') + (i.c > 0 ? '⁺' : '⁻'); };
  const sg = x => (x > 0 ? '+' + x : x < 0 ? M + -x : '0');           // signed number, real minus
  const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const setsKey = s => ['mono', 'poly', 'poly2', 'tm'].map(x => (s && s[x] ? 1 : 0)).join('');

  function rng(seed) {                                    // xmur3 string hash -> mulberry32
    const s = String(seed); let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    let a = (h ^ (h >>> 16)) >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  // ---- groups and formulas ----
  function parse(ions) {                                  // distinct kinds in first-appearance order + counts + totals
    const cat = [], an = [], cnt = {}; let pos = 0, neg = 0;
    (ions || []).forEach(k => {
      const i = BY[k]; if (!i) return;
      if (!cnt[k]) { cnt[k] = 0; (i.c > 0 ? cat : an).push(k); }
      cnt[k]++; if (i.c > 0) pos += i.c; else neg -= i.c;
    });
    return { cat, an, cnt, pos, neg };
  }
  function part(k, n, html) {
    const i = BY[k], sym = html ? i.s.replace(/\d+/g, '<sub>$&</sub>') : sub(i.s);
    if (n < 2) return sym;
    return (i.poly ? '(' + sym + ')' : sym) + (html ? '<sub>' + n + '</sub>' : sub(n));
  }
  function formulaText(ions) { const p = parse(ions); return p.cat.concat(p.an).map(k => part(k, p.cnt[k])).join(''); }
  function formulaHTML(ions) {
    const p = parse(ions), w = (cls, k) => '<span class="' + cls + '">' + part(k, p.cnt[k], true) + '</span>';
    return p.cat.map(k => w('m', k)).join('') + p.an.map(k => w('x', k)).join('');
  }
  function totals(ions) { const p = parse(ions); return { pos: p.pos, neg: p.neg }; }
  const rep = (k, n) => Array(n).fill(k);
  const ionsOf = t => rep(t.cat, t.a).concat(rep(t.an, t.b));

  // first cation + first anion with lowest-ratio counts (null if a side is missing)
  function pair(ions) {
    const p = parse(ions); if (!p.cat.length || !p.an.length) return null;
    const c = BY[p.cat[0]], n = BY[p.an[0]], g = gcd(c.c, -n.c);
    return { c, n, a: -n.c / g, b: c.c / g, p };
  }

  // ---- targets ----
  const TC = {};
  function targets(sets) {
    const key = setsKey(sets); if (TC[key]) return TC[key];
    const s = sets || {}, out = [];
    const P = i => s.poly && (s.poly2 || IONS.BASIC_POLY.includes(i.k));   // poly2 = the advanced polyatomic ions too
    IONS.CATIONS.forEach(c => {
      if (!(c.tm ? s.tm : c.poly ? P(c) : s.mono)) return;
      IONS.ANIONS.forEach(n => {
        if (!(n.poly ? P(n) : s.mono) || (c.k === 'NH4' && n.k === 'OH')) return;
        const g = gcd(c.c, -n.c), a = -n.c / g, b = c.c / g, size = a + b;
        if (size > 5) return;
        const diff = 1 + (c.poly || n.poly ? 1 : 0) + (c.tm ? 1 : 0) + 0.5 * (size - 2) + (c.c >= 3 || n.c <= -3 ? 0.5 : 0);
        out.push(Object.freeze({ cat: c.k, an: n.k, a, b, size, diff }));
      });
    });
    return (TC[key] = out.length ? Object.freeze(out) : targets({ mono: true }));
  }

  // ---- dealing ----
  function buildHand(T, w, size, rand) {                  // random whole compounds filling exactly `size` tiles
    const hand = []; let r = size, d = 0;
    while (r > 0) {
      const c = []; let tot = 0;
      for (let i = 0; i < T.length; i++) { const s = T[i].size; if (s <= r && r - s !== 1) { c.push(i); tot += w[i]; } }
      if (!c.length) return null;
      let x = rand() * tot, j = 0;
      while (j < c.length - 1 && (x -= w[c[j]]) >= 0) j++;
      const t = T[c[j]]; hand.push(t); r -= t.size; d += t.diff;
    }
    return { hand, diff: d };
  }
  function targetDiff(seed, sets, size) {                 // room-wide goal: mean of 9 unweighted hands
    const T = targets(sets), rand = rng('diff|' + seed + '|' + setsKey(sets) + '|' + size), w = T.map(() => 1);
    let s = 0, n = 0;
    for (let i = 0; i < 9; i++) { const h = buildHand(T, w, size, rand); if (h) { s += h.diff; n++; } }
    return n ? Math.round((s / n) * 100) / 100 : 0;
  }
  function deal(o) {
    const size = o.size || 12, T = targets(o.sets), m = o.missed || {}, rand = rng(o.seed + '|' + o.uid);
    const w = T.map(t => 1 + Math.min(3, (+m[t.cat] || 0) + (+m[t.an] || 0)));   // missed ions up to 4x as likely
    const goal = targetDiff(o.seed, o.sets, size);
    let best = null;
    for (let i = 0; i < 48; i++) {
      const h = buildHand(T, w, size, rand);
      if (h && (!best || Math.abs(h.diff - goal) < Math.abs(best.diff - goal))) best = h;
    }
    if (!best) return { tiles: [], targets: [], diff: 0 };
    const keys = shuffle([].concat(...best.hand.map(ionsOf)), rand);
    return { tiles: keys.map((k, i) => ({ id: 'h' + i, k })), targets: best.hand.slice(), diff: best.diff };
  }
  let DRAW = {}, nDraw = 0;
  function drawAt(o, n) {                                 // private draw pile: whole compounds, 2 tiles per swap
    const key = o.seed + '|' + o.uid + '|' + setsKey(o.sets), T = targets(o.sets);
    let s = DRAW[key];
    if (!s) { if (++nDraw > 40) { DRAW = {}; nDraw = 1; } s = DRAW[key] = { rand: rng('draw|' + o.seed + '|' + o.uid), q: [] }; }
    while (s.q.length < 2 * n + 2) s.q.push(...shuffle(ionsOf(T[Math.floor(s.rand() * T.length)]), s.rand));
    return [{ id: 'd' + n + 'a', k: s.q[2 * n] }, { id: 'd' + n + 'b', k: s.q[2 * n + 1] }];
  }

  // ---- names ----
  const ALTS = [];
  IONS.CATIONS.concat(IONS.ANIONS).forEach(i => (i.alt || []).forEach(a =>
    ALTS.push([new RegExp('(^| )' + a + '(?=$| |\\()', 'g'), '$1' + (i.c > 0 ? i.n : i.ide)])));
  function norm(s) {
    let x = String(s).toLowerCase().replace(/\s+/g, ' ').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').trim();
    ALTS.forEach(([re, to]) => { x = x.replace(re, to); });
    return x;
  }
  const sameName = (a, b) => a != null && b != null && norm(a) === norm(b);
  const joinName = words => (words || []).filter(Boolean).reduce((s, w) => (s ? s + (w[0] === '(' ? '' : ' ') + w : w), '');
  function correctName(ions) { const p = parse(ions); return p.cat.length === 1 && p.an.length === 1 ? BY[p.cat[0]].n + ' ' + BY[p.an[0]].ide : null; }
  const words = pr => (pr.c.tm ? [IONS.METAL[pr.c.tm], '(' + ROM[pr.c.c] + ')', pr.n.ide] : [pr.c.n, pr.n.ide]);
  function nameWords(ions) { const pr = pair(ions); return pr ? words(pr) : []; }
  function wrongRom(pr) {                                 // other real charge of the metal, subscript-as-numeral mistakes
    const c = pr.c, r = IONS.CATIONS.filter(x => x.tm === c.tm).map(x => x.c).concat(pr.a, pr.b, -pr.n.c);
    let v = r.filter((x, i) => x >= 1 && x <= 4 && x !== c.c && r.indexOf(x) === i);
    if (!v.length) v = [c.c + 1 <= 4 ? c.c + 1 : c.c - 1];
    return v.map(x => '(' + ROM[x] + ')');
  }
  function prefixed(pr) {                                 // molecular-style prefixes: "calcium dichloride"
    const cw = pr.c.tm ? IONS.METAL[pr.c.tm] : pr.c.n, aw = (PFX[pr.a > 1 ? (pr.b > 1 ? pr.b : 0) : pr.b] + pr.n.ide).replace('monoo', 'mono');
    return [(pr.a > 1 ? PFX[pr.a] : '') + cw, aw];
  }
  const swaps = ide => { const m = ide.match(/^(.*?)(ide|ate|ite)$/); return m ? ['ide', 'ate', 'ite'].filter(e => e !== m[2]).map(e => m[1] + e) : [ide + 's']; };
  function pickRR(S, out, max, same) {                    // round-robin over shuffled sources, skipping repeats
    for (let r = 0; out.length < max && r < 8; r++)
      S.forEach(s => { const v = s[r]; if (out.length < max && v != null && !out.some(x => same(x, v))) out.push(v); });
    return out;
  }
  function nameChoices(ions, rand) {
    const pr = pair(ions); if (!pr) return [];
    rand = rand || Math.random;
    const { c, n } = pr, cn = c.n, ide = n.ide, S = [], pf = prefixed(pr);
    S.push((IONS.NAME_TRAPS[n.k] || []).map(t => cn + ' ' + t));
    if (!n.poly) S.push([cn + ' ' + n.n]);
    S.push([pf[0] + ' ' + pf[1]]);
    if (c.tm) { const m = IONS.METAL[c.tm]; S.push([m + ' ' + ide]); S.push(wrongRom(pr).map(r => m + r + ' ' + ide)); }
    else if (!c.poly) S.push([cn + '(' + ROM[c.c] + ') ' + ide]);
    S.push((IONS.CAT_TRAPS[c.k] || []).map(t => t + ' ' + ide));
    const out = pickRR(shuffle(S.filter(s => s.length).map(s => shuffle(s.slice(), rand)), rand), [cn + ' ' + ide], 4, sameName);
    pickRR([swaps(ide).map(e => cn + ' ' + e)], out, 4, sameName);
    return shuffle(out, rand);
  }
  function nameTiles(ions, rand) {
    const pr = pair(ions); if (!pr) return [];
    rand = rand || Math.random;
    const { c, n } = pr, right = words(pr), one = a => a.filter(w => !/ /.test(w));
    const S = shuffle([one(IONS.NAME_TRAPS[n.k] || []), n.poly ? [] : [n.n], [prefixed(pr)[1]], one(IONS.CAT_TRAPS[c.k] || [])]
      .filter(s => s.length).map(s => shuffle(s.slice(), rand)), rand);
    const rom = c.tm ? wrongRom(pr) : c.poly ? [] : ['(' + ROM[c.c] + ')'];
    if (rom.length) S.unshift(shuffle(rom, rand));         // a numeral decoy always comes first
    const max = right.length + 3 + (rand() < 0.5 ? 1 : 0), out = right.slice(), same = (a, b) => a === b;
    pickRR(S, out, max, same); pickRR([swaps(n.ide)], out, max, same);
    return shuffle(out, rand);
  }

  // ---- checking ----
  function chargeWhy(p) {
    const ks = p.cat.concat(p.an), end = ' = ' + sg(p.pos - p.neg) + ', not 0.';
    if (ks.every(k => p.cnt[k] === 1))
      return ks.map(ionText).join(' + ') + ': ' + ks.map((k, i) => { const c = BY[k].c; return i ? (c > 0 ? ' + ' : ' ' + M + ' ') + Math.abs(c) : sg(c); }).join('') + end;
    return list(ks.map(k => p.cnt[k] + ' × (' + sg(BY[k].c) + ') = ' + sg(BY[k].c * p.cnt[k]))) + '. ' + sg(p.pos) + ' ' + M + ' ' + p.neg + end;
  }
  function checkGroup(g, opt) {
    g = g || {};
    const naming = (opt && opt.naming) || 'off', ions = g.ions || [], p = parse(ions), errors = [], why = [];
    const add = (c, s) => { errors.push(c); why.push(s); };
    const oneSide = !p.cat.length || !p.an.length, mixed = p.cat.length > 1 || p.an.length > 1, single = !oneSide && !mixed;
    const cat = BY[p.cat[0]], an = BY[p.an[0]];
    let fix = null;
    if (single) { const gg = gcd(cat.c, -an.c); fix = formulaText(rep(cat.k, -an.c / gg).concat(rep(an.k, cat.c / gg))); }
    if (oneSide) add('one-side', 'A compound needs a positive ion and a negative ion.');
    if (mixed) add('mixed', 'Use one kind of positive ion and one kind of negative ion. This has ' +
      list((p.cat.length > 1 ? p.cat : []).concat(p.an.length > 1 ? p.an : []).map(ionText)) + '.');
    if (!oneSide && p.pos !== p.neg) add('charge', chargeWhy(p));
    else if (single && gcd(p.cnt[cat.k], p.cnt[an.k]) > 1) add('ratio', formulaText(ions) + ' can be simplified to ' + fix + '. Use the smallest ratio.');
    if (g.pos == null || +g.pos !== p.pos) add('pos', 'Total + charge is ' + sg(p.pos) + ', not ' + (g.pos == null ? 'blank' : sg(+g.pos)) + '.');
    if (g.neg == null || +g.neg !== p.neg) add('neg', 'Total ' + M + ' charge is ' + sg(-p.neg) + ', not ' + (g.neg == null ? 'blank' : sg(-g.neg)) + '.');
    const name = single ? cat.n + ' ' + an.ide : null;
    if (naming !== 'off' && single && !sameName(g.name, name)) add('name', 'The name is ' + name + '.');
    return { ok: !errors.length, errors, why, count: ions.length, truth: { pos: p.pos, neg: p.neg, formula: formulaText(ions), name, fix } };
  }
  function checkBoard(groups, opt) {
    const results = (groups || []).map(g => checkGroup(g, opt));
    return { ok: results.length > 0 && results.every(r => r.ok), results };
  }

  // ---- scoring ----
  function scoreRound(o) {
    const good = (o.results || []).filter(r => r && r.ok), lines = [], s = n => (n === 1 ? '' : 's');
    let total = 0;
    const L = (label, pts) => { lines.push({ label, pts }); total += pts; };
    L(good.length + ' correct compound' + s(good.length), good.reduce((t, r) => t + PTS.compound + PTS.perIon * (r.count || 0), 0));
    if (o.won) L('Won the round', PTS.win);
    const fr = o.flagsRight | 0, fw = o.flagsWrong | 0;
    if (fr) L('Caught ' + fr + ' mistake' + s(fr), fr * PTS.flagRight);
    if (fw) L(fw + ' wrong flag' + s(fw), fw * PTS.flagWrong);
    if (o.extra) L('Extra time ×½', Math.round(total * PTS.extraScale) - total);
    if (total < 0) L('Score can’t go below 0', -total);
    return { total, lines };
  }
  function missedKeys(results, groups) {
    const out = [];
    (results || []).forEach((r, i) => { if (r && !r.ok && groups && groups[i]) (groups[i].ions || []).forEach(k => { if (BY[k] && out.indexOf(k) < 0) out.push(k); }); });
    return out;
  }

  return { PTS, rng, shuffle, ion, ionText, chargeText, targets, deal, targetDiff, drawAt, formulaText, formulaHTML, totals,
    correctName, nameWords, nameChoices, nameTiles, joinName, sameName, checkGroup, checkBoard, scoreRound, missedKeys };
});
