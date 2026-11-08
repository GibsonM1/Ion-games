// How to play (ionagrams/howto.js): step logic, no browser needed. Run: node tests/howto.logic.test.js
'use strict';
const L = require('../ionagrams/howto.js');
const R = require('../ionagrams/rules.js');
let fails = 0;
const ok = (c, n) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const ks = (S, g) => L.ionsOf(S, g);

// running sum text
ok(L.sumText(['Ca', 'Cl', 'Cl'], true) === '+2 −1 −1 = 0 ✓', 'sum text for CaCl2 is +2 −1 −1 = 0 ✓');
ok(L.sumText(['Ca', 'Cl']) === '+2 −1 = +1', 'sum text for Ca + Cl is +2 −1 = +1');

// judge uses the real rules
ok(L.judge(['Ca', 'Cl', 'Cl']).ok, 'CaCl2 is ok');
ok(L.judge(['Na', 'Na', 'O']).ok && L.judge(['Na', 'Cl']).ok, 'Na2O and NaCl are ok');
ok(L.judge(['Ca', 'Cl']).errors.includes('charge'), 'CaCl: charge error');
ok(L.judge(['Ca', 'Ca', 'O', 'O']).errors.includes('ratio'), 'Ca2O2: ratio error');
ok(L.judge(['Na', 'Ca', 'Cl', 'Cl', 'Cl']).errors.includes('mixed'), 'mixed cations: mixed error');
ok(L.judge(['Na']).needs === 'neg' && L.judge(['O']).needs === 'pos', 'one-sided compounds say which side is missing');
ok(L.judge(['Ca', 'Cl']).why.every(w => /[A-Za-z]/.test(w)), 'why sentences exist');

// board moves behave like the real board
let S = L.mkState(['Na', 'Na', 'O', 'Cl'], { goal: ['Na', 'Na', 'O'] });
ok(S.tray.length === 4 && S.groups.length === 0, 'try hand: 4 tiles in the tray');
ok(L.move(S, 't0', 'new') && S.groups.length === 1 && S.tray.length === 3, 'tile to a new compound');
ok(L.move(S, 't1', 'g:g1') && ks(S, S.groups[0]).join() === 'Na,Na', 'tile to a compound');
ok(!L.move(S, 't1', 'g:g1') && S.sel === null, 'moving into the same compound does nothing');
ok(L.move(S, 't1', 'tray') && S.groups[0].tiles.length === 1, 'tile back to the tray');
ok(!L.move(S, 't3', 'tray'), 'a tray tile cannot go "back" to the tray');
ok(!L.move(S, 't0', 'nowhere') && !L.move(S, 'zzz', 'new'), 'bad destination or id is refused');
L.groupOf(S, 't0').locked = true;
ok(!L.move(S, 't0', 'tray'), 'a locked compound cannot be changed');
ok(!L.move(S, 't1', 'g:g1'), 'nothing can be added to a locked compound');
S.groups[0].locked = false;
L.move(S, 't0', 'tray');
ok(S.groups.length === 0, 'an empty compound disappears');

// coach marks point at the next useful element
S = L.mkState(['Na', 'Na', 'O', 'Cl'], { goal: ['Na', 'Na', 'O'] });
const T2 = { tap: 'Tap here', then: 'Then tap here' };
let c = L.tryCoach(S, T2);
ok(c && c.key === 't:t0' && c.text === 'Tap here', 'coach starts on the first needed tile');
S.sel = 't0'; c = L.tryCoach(S, T2);
ok(c && c.key === 'drop:new', 'after a tile is picked, coach points at New compound');
L.move(S, 't0', 'new'); c = L.tryCoach(S, T2);
ok(c && c.key === 't:t1', 'next coach is the next needed tile (skips the Cl)');
S.sel = 't1'; c = L.tryCoach(S, T2);
ok(c && c.key === 'drop:g:g1', 'then the compound');
L.move(S, 't1', 'g:g1'); L.move(S, 't2', 'g:g1');
ok(L.tryCoach(S, T2) === null && L.tryMsg(S).k === 'good', 'finished: no coach, success message');
ok(/Na₂O/.test(L.tryMsg(S).t) && /\+1 \+1 −2 = 0/.test(L.tryMsg(S).t), 'success message shows formula and sum');
// a wrong tile in the compound: coach points at it, then at Put it back
S = L.mkState(['Na', 'Na', 'O', 'Cl'], { goal: ['Na', 'Na', 'O'] });
L.move(S, 't0', 'new'); L.move(S, 't1', 'g:g1'); L.move(S, 't3', 'g:g1');
c = L.tryCoach(S, T2);
ok(c && c.key === 't:t3' && c.text === 'Tap here', 'wrong Cl in the compound: coach points at it');
S.sel = 't3'; c = L.tryCoach(S, T2);
ok(c && c.key === 'drop:tray', 'picked the wrong tile: coach points at Put it back');
// any valid compound counts
S = L.mkState(['Na', 'Na', 'O', 'Cl'], { goal: ['Na', 'Na', 'O'] });
L.move(S, 't0', 'new'); L.move(S, 't3', 'g:g1');
ok(L.tryMsg(S).k === 'good' && /NaCl/.test(L.tryMsg(S).t), 'NaCl is also accepted');
// wrong tile: gentle message, no coach for it
L.move(S, 't3', 'tray'); L.move(S, 't1', 'g:g1');
ok(L.tryMsg(S).k === 'info' && /negative/.test(L.tryMsg(S).t), 'Na + Na: asks for a negative ion');
L.move(S, 't3', 'g:g1');
ok(L.tryMsg(S).k === 'warn' && /\+1 \+1 −1 = \+1/.test(L.tryMsg(S).t) && /must be 0/.test(L.tryMsg(S).t), 'Na + Na + Cl: warns with the sum');

// swap: give 1, get 2
S = L.mkState(['Mg', 'Cl', 'Al']);
const r = L.swap(S, 't2', ['Cl', 'K']);
ok(r.gone === 'Al' && S.tray.length === 4 && !S.tiles.t2 && S.tray.map(i => S.tiles[i].k).sort().join() === 'Cl,Cl,K,Mg', 'swap Al3+ -> Cl- and K+ (4 tiles left, 1 more than before... 3 - 1 + 2)');

// lock: only the typed totals are judged
ok(L.checkLock(['Ca', 'Cl', 'Cl'], 2, 2).ok, 'lock: +2 and 2 is right');
let k = L.checkLock(['Ca', 'Cl', 'Cl'], 0, 0);
ok(!k.ok && k.why.length === 2 && /Total \+ charge is \+2/.test(k.why[0]) && /Total − charge is −2/.test(k.why[1]), 'lock: 0 and 0 explains both totals');
ok(!L.checkLock(['Ca', 'Cl', 'Cl'], 2, 1).ok && L.checkLock(['Ca', 'Cl', 'Cl'], 2, 1).codes.join() === 'neg', 'lock: wrong − total is not ok (code neg)');

// challenge: Maya's second compound is the wrong one
const b = L.mayaBoard();
ok(b.length === 2 && b.every(g => g.pos != null && g.neg != null), "Maya's board has two locked compounds");
let v = L.reveal(new Set([1]));
ok(v.caught === 1 && v.wrongFlags === 0 && !v.ok && v.results[0].ok && !v.results[1].ok, 'flag the wrong one: caught');
v = L.reveal(new Set([0]));
ok(v.caught === 0 && v.wrongFlags === 1, 'flag the right one: wrong flag');
v = L.reveal(new Set());
ok(v.caught === 0 && v.wrongFlags === 0, 'no flags: nothing caught');
v = L.reveal(new Set([0, 1]));
ok(v.caught === 1 && v.wrongFlags === 1, 'flag both: one of each');

// text: every step has a title and lines, and every key the code uses exists (a missing key would show its path)
L.ORDER.forEach(id => ok(typeof L.tx('steps.' + id + '.title') === 'string' && !/^steps\./.test(L.tx('steps.' + id + '.title')) && L.tx('steps.' + id + '.lines').length > 0, 'text for step ' + id));
const fs = require('fs'), src = fs.readFileSync(__dirname + '/../ionagrams/howto.js', 'utf8');
const keys = new Set(); let m; const re = /\btx\('((?:ui|msg|points|steps)\.[\w.]+)'/g;
while ((m = re.exec(src))) keys.add(m[1]);
const missing = [...keys].filter(x => /^steps\./.test(x) ? false : /^(ui|msg|points)\./.test(x) && L.tx(x) === x);
ok(missing.length === 0, 'every text key used in the code exists in HOWTO_TEXT' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''));
// text length: short sentences (at most 16 words each)
const long = []; const chk = (x, p) => x.split(/(?<=[.!?])\s+/).forEach(sn => { if (sn.split(/\s+/).length > 16) long.push(p + ': ' + sn.slice(0, 30)); });
(function walk(o, p) { Object.keys(o).forEach(k => { const x = o[k]; if (typeof x === 'string') chk(x, p + k); else if (Array.isArray(x)) x.forEach((s2, i) => chk(s2, p + k + i)); else walk(x, p + k + '.'); }); })(L.TXT, '');
ok(long.length === 0, 'no long sentences in the text' + (long.length ? ' (' + long.join('; ') + ')' : ''));

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
