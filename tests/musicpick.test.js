// Tests for shared/musicpick.js (music pools) and a check of the pools Mr. G edits. Run from the repo root: node tests/musicpick.test.js
'use strict';
const fs = require('fs'), path = require('path');
const MP = require('../shared/musicpick.js');
let fails = 0;
function t(name, cond, info) { if (cond) console.log('ok   ' + name); else { fails++; console.log('FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); } }
const eq = (name, got, want) => t(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

// ---- tiny pools ----
eq('empty pool -> null', [MP.pick([], null, null), MP.pick(null, null, null), MP.pick(undefined, ['a'], 'a')], [null, null, null]);
eq('one-entry pool -> that entry', MP.pick(['a'], null, null), 'a');
eq('one-entry pool, same as last -> still that entry', MP.pick(['a'], null, 'a'), 'a');
eq('a plain string works as a one-entry pool', MP.pick('a', null, null), 'a');

// ---- never repeats the last pick ----
for (const n of [2, 3, 4]) {
  const pool = 'abcd'.slice(0, n).split(''), rnd = seeded(7 + n);
  let bad = 0, last = null;
  for (let i = 0; i < 2000; i++) { const p = MP.pick(pool, null, last, rnd); if (p === last || pool.indexOf(p) < 0) bad++; last = p; }
  t('never repeats the last pick (pool of ' + n + ', 2000 starts in a row)', bad === 0, bad);
}
t('last not in the pool: any entry can come up', (() => { const r = seeded(5); return new Set(Array.from({ length: 200 }, () => MP.pick(['a', 'b', 'c'], null, 'zzz', r))).size === 3; })());
eq('duplicates in a pool are ignored (a,a -> one entry, so it must repeat)', MP.pick(['a', 'a'], null, 'a'), 'a');
eq('rnd edge values stay inside the pool', [MP.pick(['a', 'b', 'c'], null, null, () => 0), MP.pick(['a', 'b', 'c'], null, null, () => 0.999999)], ['a', 'c']);

// ---- filtering by available tracks ----
const CB = { tracks: () => [{ id: 'a', name: 'A', bpm: 90 }, { id: 'c', name: 'C', bpm: 100 }] };
eq('available() reads ChemBeats.tracks()', MP.available(CB), ['a', 'c']);
eq('available() is [] for a missing / broken ChemBeats', [MP.available(null), MP.available({}), MP.available({ tracks() { throw new Error('x'); } })], [[], [], []]);
eq('filter keeps only available tracks, in pool order', MP.filter(['c', 'b', 'a', 'd'], ['a', 'c']), ['c', 'a']);
eq('filter with no available list keeps everything', MP.filter(['c', 'b'], null), ['c', 'b']);
eq('filter with nothing available -> empty', MP.filter(['c', 'b'], []), []);
{
  const av = MP.available(CB); let bad = 0, last = null;
  for (let i = 0; i < 500; i++) { const p = MP.pick(['a', 'b', 'c', 'd'], av, last); if (p === last || (p !== 'a' && p !== 'c')) bad++; last = p; }
  t('pick only returns available tracks and still avoids repeats', bad === 0, bad);
  eq('pool shrinks to one available track -> that track, even if it was last', MP.pick(['a', 'b'], av, 'a'), 'a');
  eq('no pool track available -> null', MP.pick(['b', 'd'], av, null), null);
}

// ---- roughly uniform ----
for (const n of [2, 3, 4]) {
  const pool = 'abcd'.slice(0, n).split(''), N = 20000, rnd = seeded(99 + n), count = {}; let last = null;
  for (let i = 0; i < N; i++) { last = MP.pick(pool, null, last, rnd); count[last] = (count[last] || 0) + 1; }
  const lo = Math.min(...pool.map(k => count[k])), hi = Math.max(...pool.map(k => count[k]));
  t('roughly uniform over ' + N + ' picks (pool of ' + n + '): ' + pool.map(k => k + ' ' + count[k]).join(', '), lo > N / n * 0.9 && hi < N / n * 1.1);
}
{ // with Math.random as well
  const N = 20000, count = { a: 0, b: 0, c: 0 }; let last = null;
  for (let i = 0; i < N; i++) { last = MP.pick(['a', 'b', 'c'], null, last); count[last]++; }
  t('roughly uniform with Math.random', Math.min(...Object.values(count)) > N / 3 * 0.9);
}

// ---- the real pools (typos here mean silent music) ----
const ALL14 = ['jersey', 'rage', 'drill', 'trap16', 'boombap', 'boombap-up', 'bounce', 'stutter', 'bateria', 'enredo', 'quintal', 'partido', 'roda', 'crush'];
const root = path.join(__dirname, '..');
const cfgText = /const MUSIC_CFG = (\{[\s\S]*?\n\});/.exec(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
t('found MUSIC_CFG in index.html', !!cfgText);
const IB = new Function('return ' + cfgText[1])();
const IG = require('../ionagrams/music.js').CONFIG.BEATS;
const pools = { 'iBond HOME': IB.HOME, 'iBond BUILD': IB.BUILD, 'iBond DROP': IB.DROP, 'iBond TYPE': IB.TYPE, 'Ionagrams lobby': IG.lobby, 'Ionagrams build': IG.build, 'Ionagrams review': IG.review };
for (const [name, p] of Object.entries(pools)) {
  t(name + ': 2-4 distinct tracks, all real ids (' + p.join(', ') + ')', Array.isArray(p) && p.length >= 2 && p.length <= 4 && new Set(p).size === p.length && p.every(id => ALL14.includes(id)), p);
}
const used = new Set(Object.values(pools).flat());
t('every one of the 14 tracks is in at least one pool', ALL14.every(id => used.has(id)), ALL14.filter(id => !used.has(id)));
const longText = [IB.TYPE, IB.BUILD];
t('rage and drill are not in the type-the-name or Bond pools', longText.every(p => !p.includes('rage') && !p.includes('drill')));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
