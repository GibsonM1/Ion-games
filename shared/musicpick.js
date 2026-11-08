/* Music pool helper shared by iBond and Ionagrams (tiny, pure, no browser needed).
 * Browser: <script src="shared/musicpick.js"></script> makes window.MusicPick.  Node: require('./musicpick.js').
 *   MusicPick.available(ChemBeats)       -> ids of the tracks that actually loaded (ChemBeats.tracks())
 *   MusicPick.filter(pool, available)    -> the pool without duplicates, keeping only available tracks
 *   MusicPick.pick(pool, available, last, rnd) -> one track id, never `last` when 2+ tracks are left; null if none
 * `available` = null skips the filter. `rnd` = a function returning 0 to <1 (default Math.random). */
(function (root) {
  'use strict';
  function available(CB) {
    try { return CB && CB.tracks ? CB.tracks().map(t => t && t.id).filter(Boolean) : []; } catch (e) { return []; }
  }
  function filter(pool, avail) {
    const out = [];
    [].concat(pool || []).forEach(id => { if (id && out.indexOf(id) < 0 && (!avail || avail.indexOf(id) >= 0)) out.push(id); });
    return out;
  }
  function pick(pool, avail, last, rnd) {
    const p = filter(pool, avail);
    if (p.length < 2) return p.length ? p[0] : null;
    const c = p.filter(id => id !== last), list = c.length ? c : p;
    return list[Math.min(list.length - 1, Math.floor((rnd || Math.random)() * list.length))];
  }
  const API = { available, filter, pick };
  if (typeof window !== 'undefined') window.MusicPick = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
