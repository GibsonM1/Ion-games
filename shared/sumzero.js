/* SumZero rules shared by iBond (index.html) and its tests (tiny, pure, no browser needed).
 * Browser: <script src="shared/sumzero.js"></script> makes window.SumZero.  Node: require('./sumzero.js').
 * Ions are the objects from the ion lists: {s, c, k, tm?, poly?}. `cats`/`ans` = the ions the student has met so far.
 *   SumZero.lowest(cat, an)          -> [a, b]: smallest whole-number ratio (Al, O -> [2, 3])
 *   SumZero.wrongPiece(o)            -> null if the piece may go in the box, else {why}
 *        why: 'not'   Build the name: this ion is not in the named compound
 *             'extra' Build the name: the box already has all of this ion that the compound needs
 *             'side'  a second, different ion on the same side of the box
 *             'many'  no compound in the smallest ratio can use this many of these ions
 *        o = {mode:'order'|'free', cat:[ions in box], an:[ions in box], ion, target:{cat,an,a,b}, cats, ans}
 *        A move that can still lead to a correct (neutral, smallest-ratio) compound is never wrong.
 *   SumZero.decoyChance(level, cfg)  -> 0..1, chance that a tray gets extra pieces at this level
 *   SumZero.lookalikes(ion, pool)    -> ions in `pool` that students mix up with `ion` (same metal, other charge;
 *                                       sulfate/sulfite/sulfide, nitrate/nitrite/nitride, hydroxide/oxide, ...)
 *   SumZero.orderExtras(o)           -> extra pieces for a Build-the-name tray ([] most of the time)
 *        o = {target:{cat,an,a,b}, cats, ans, level, cfg, rnd}
 *   SumZero.compounds(ions, cats)    -> every neutral smallest-ratio compound the pieces in `ions` can make
 */
(function () {
  'use strict';
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  function lowest(cat, an) { const p = cat.c, q = -an.c, g = gcd(p, q); return [q / g, p / g]; }
  // how many of `ion` the smallest-ratio compound with `partner` uses
  const countWith = (ion, partner) => ion.c > 0 ? lowest(ion, partner)[0] : lowest(partner, ion)[1];

  function wrongPiece(o) {
    const ion = o.ion, isCat = ion.c > 0, col = isCat ? o.cat : o.an, other = isCat ? o.an : o.cat;
    if (o.mode === 'order') {
      const t = o.target, want = isCat ? t.cat : t.an;
      if (ion.k !== want.k) return { why: 'not' };
      if (col.length >= (isCat ? t.a : t.b)) return { why: 'extra' };
      return null;
    }
    if (col.length && col[0].k !== ion.k) return { why: 'side' };
    const n = col.length + 1;
    if (other.length) {
      const p = other[0];
      if (n > countWith(ion, p) || other.length > countWith(p, ion)) return { why: 'many' };
      return null;
    }
    // nothing on the other side yet: some ion the student has met must be able to balance n of these
    const partners = isCat ? o.ans : o.cats;
    return partners.some(p => countWith(ion, p) >= n) ? null : { why: 'many' };
  }

  function decoyChance(level, cfg) {
    if (!cfg || level < cfg.DECOY_START_LEVEL) return 0;
    return Math.max(0, Math.min(cfg.DECOY_CHANCE_MAX, cfg.DECOY_CHANCE + (level - cfg.DECOY_START_LEVEL) * cfg.DECOY_CHANCE_STEP));
  }

  // look-alike ions students confuse (by key). Only used once the look-alike has been introduced.
  const LOOK = {
    OH: ['O'], O: ['OH'], SO4: ['SO3', 'S'], SO3: ['SO4', 'S'], S: ['SO4', 'SO3'],
    NO3: ['NO2', 'N'], NO2: ['NO3', 'N'], N: ['NO3', 'NO2'], PO4: ['P'], P: ['PO4'],
    CO3: ['HCO3'], HCO3: ['CO3'], ClO3: ['Cl'], Cl: ['ClO3'], CN: ['SCN'], SCN: ['CN'], CrO4: ['CO3']
  };
  function lookalikes(ion, pool) {
    if (ion.tm) return pool.filter(x => x.tm === ion.tm && x.k !== ion.k);   // iron(II) for iron(III)
    return (LOOK[ion.k] || []).map(k => pool.find(x => x.k === k)).filter(Boolean);
  }

  function orderExtras(o) {
    const t = o.target, cfg = o.cfg, R = o.rnd || Math.random;
    if (!(R() < decoyChance(o.level, cfg))) return [];
    const room = (cfg.MAX_TRAY || 8) - (t.a + t.b) - 1;   // always leave space for one single distractor
    if (room < 1) return [];
    // 1) one more copy of the ion the compound uses most of (5 OH⁻ for Sn(OH)₄)
    const big = t.a >= t.b ? (t.a > 1 ? t.cat : null) : (t.b > 1 ? t.an : null);
    // 2) a decoy set: an ion that takes the place of one of the two, in the number it would need (2 O²⁻ for SnO₂)
    const sets = [], seen = new Set([t.cat.k, t.an.k]);
    const add = (d, partner, misc) => {
      if (seen.has(d.k) || (d.k === 'NH4' && partner.k === 'OH') || (d.k === 'OH' && partner.k === 'NH4')) return;
      const n = countWith(d, partner);
      if (n <= Math.min(3, room) && (misc || n > 1)) { sets.push({ d, n, misc }); seen.add(d.k); }
    };
    lookalikes(t.cat, o.cats).forEach(d => add(d, t.an, true));
    lookalikes(t.an, o.ans).forEach(d => add(d, t.cat, true));
    if (!sets.length) {   // no look-alike yet: an ion with a different charge, so its number looks believable
      o.cats.filter(d => d.c !== t.cat.c).forEach(d => add(d, t.an, false));
      o.ans.filter(d => d.c !== t.an.c).forEach(d => add(d, t.cat, false));
    }
    const set = sets.length ? sets[Math.floor(R() * sets.length)] : null;
    let useBig = !!big, useSet = !!set;
    if (useBig && useSet) { const r = R(); if (r < 0.35) useSet = false; else if (r < 0.7 || 1 + set.n > room) useBig = false; }
    const out = [];
    if (useBig) out.push(big);
    if (useSet) for (let i = 0; i < set.n; i++) out.push(set.d);
    return out;
  }

  function compounds(ions, cats) {
    const n = {}, by = {};
    ions.forEach(i => { n[i.k] = (n[i.k] || 0) + 1; by[i.k] = i; });
    const out = [];
    Object.values(by).filter(i => i.c > 0).forEach(c => Object.values(by).filter(i => i.c < 0).forEach(a => {
      const [x, y] = lowest(c, a);
      if (n[c.k] >= x && n[a.k] >= y) out.push({ cat: c, an: a, a: x, b: y });
    }));
    return out;
  }

  const API = { lowest, countWith, wrongPiece, decoyChance, lookalikes, orderExtras, compounds };
  if (typeof window !== 'undefined') window.SumZero = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
