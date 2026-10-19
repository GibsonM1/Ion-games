// ===================== CONFIG (Mr. G: change settings here) =====================
const CONFIG = {
  GAME_ID: 'ionagrams',          // name used when saving ⚛ and in the room database (also needs a GAMES entry in Code.gs)
  HAND_SIZE: 12,                 // tiles in a normal hand
  EXTRA_HAND: 10,                // tiles in an Extra time hand (that student's ⚛ are halved)
  CHALLENGE_MS: 25000,           // how long classmates check a player's compounds after they tap Done (25 s)
  REVEAL_MS: 7000,               // how long the right/wrong reveal stays on screen (7 s)
  ROUND_MS: 480000,              // longest a round can last (8 minutes)
  REVIEW_MS: 20000,              // how long each student's own review shows before the room results (20 s)
  PERIODS: ['1', '2', '3', '4', '5', '6', '7', '8'],   // class periods a guest can pick
  TEACHERS: ['gibsonm1'],         // school usernames that see Teacher settings on the start screen (needs a Roster row for that username)
  DEFAULT_SETTINGS: {            // used for a period until you save Teacher settings for it
    sets: { mono: true, poly: true, poly2: false, tm: false },  // which ions can be dealt: single-atom, the 6 basic polyatomic, more polyatomic (acetate, cyanide...), metals with Roman numerals
    minNaming: 'off',            // least naming a room can use: 'off', 'pick' (pick from 4) or 'build' (build from word tiles)
    shapes: false                // true = iBond puzzle-piece tiles (easier: the shapes show what fits)
  },
  MAX_PLAYERS: 5,                // most players in one room
  PRACTICE_SCALE: 0.5            // Practice alone earns this share of the ⚛ (0.5 = half)
};
// ===============================================================================
// Tests may override CONFIG values with window.IONAGRAMS_CONFIG (set before this file loads).
if (window.IONAGRAMS_CONFIG) Object.assign(CONFIG, window.IONAGRAMS_CONFIG);

(() => {
'use strict';
const R = window.IonRules;
const NOSND = { setMusic() {}, setSfx() {}, unlock() {}, phase() {}, intensity() {}, sfx() {} };
const SND = window.IonSound || NOSND;
const GL = window.GibsonLogin || null, GR = window.GibsonRooms || null;
const GAME_ID = CONFIG.GAME_ID;
const roomsOn = () => { try { return !!(GR && GR.on()); } catch (e) { return false; } };
const loginOn = () => { try { return !!(GL && GL.on()); } catch (e) { return false; } };
const MINUS = '−';
const NAMING = ['off', 'pick', 'build'];
const NAMING_TXT = { off: 'Off', pick: 'Pick the name', build: 'Build the name' };

// ================= HELPERS =================
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const clone = o => JSON.parse(JSON.stringify(o));
const sg = n => (n > 0 ? '+' + n : n < 0 ? MINUS + -n : '0');
const arr = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.keys(x).sort((a, b) => a - b).map(k => x[k]) : []);
const flagSet = x => new Set(Object.keys(x || {}).filter(k => x[k]).map(Number));
const nGroup = g => ({ ions: arr(g && g.ions), pos: g && g.pos != null ? +g.pos : null, neg: g && g.neg != null ? +g.neg : null, name: g && g.name != null ? String(g.name) : null });
const symHTML = s => s.replace(/(\d+)/g, '<sub>$1</sub>');
const mmss = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
let toastT;
function toast(html) { const t = $('toast'); t.innerHTML = html; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
const ELEMENTS = ['Hydrogen', 'Helium', 'Lithium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen', 'Neon', 'Sodium', 'Magnesium', 'Aluminum', 'Silicon',
  'Sulfur', 'Argon', 'Calcium', 'Titanium', 'Iron', 'Cobalt', 'Nickel', 'Copper', 'Zinc', 'Gallium', 'Krypton', 'Silver', 'Tin', 'Iodine', 'Xenon',
  'Gold', 'Mercury', 'Lead', 'Radon', 'Barium', 'Tungsten', 'Platinum', 'Uranium', 'Bismuth', 'Chromium', 'Fluorine', 'Chlorine', 'Bromine',
  'Selenium', 'Strontium', 'Potassium', 'Phosphorus', 'Manganese', 'Vanadium', 'Germanium', 'Cesium', 'Lithium', 'Scandium'];
const pickEl = (avoid) => { const ok = ELEMENTS.filter(e => !(avoid || []).includes(e)); const a = ok.length ? ok : ELEMENTS; return a[Math.floor(Math.random() * a.length)]; };

// ================= SPRITES (copied from iBond so sprites match) =================
const BUDDIES = [
  {s:'H',col:'#8E9AAF',at:0},{s:'Na',col:'#E85A4F',at:150},{s:'Cl',col:'#3AA76D',at:400},{s:'O',col:'#2BB3CF',at:800},
  {s:'Mg',col:'#B07CC6',at:1300},{s:'Ca',col:'#E08E3C',at:2000},{s:'S',col:'#D4B21C',at:3000},{s:'Al',col:'#7B8C99',at:4200},
  {s:'N',col:'#4867D6',at:5600},{s:'K',col:'#C9467A',at:7500},{s:'Br',col:'#9C4A2E',at:10000},{s:'Au',col:'#C9A227',at:13000}
];
const HATS=[{k:'',n:'No hat',at:0},{k:'shades',n:'Shades',at:300},{k:'party',n:'Party hat',at:1000},{k:'cap',n:'Cap',at:2500},{k:'crown',n:'Crown',at:6000}];
const buddyOf=s=>BUDDIES.find(b=>b.s===s)||BUDDIES[0];
const hatOf=k=>HATS.some(h=>h.k===k)?k:'';
function hatSVG(k){
  switch(k){
    case 'shades':return `<rect x="9" y="16" width="16" height="10" rx="4" fill="#1b1b1b"/><rect x="31" y="16" width="16" height="10" rx="4" fill="#1b1b1b"/><path d="M25 19h6" stroke="#1b1b1b" stroke-width="2.5"/><path d="M12 18.5h5M34 18.5h5" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`;
    case 'party':return `<path d="M17 10 L28 -13 L39 10 Z" fill="#B07CC6" stroke="#6E3F86" stroke-width="2" stroke-linejoin="round"/><path d="M21.5 1h13M25 -6h6" stroke="#F2B630" stroke-width="3"/><circle cx="28" cy="-13" r="4" fill="#F2B630"/>`;
    case 'cap':return `<path d="M7 14 Q28 -10 49 14 Z" fill="#2B59C3" stroke="#1A3B8A" stroke-width="2" stroke-linejoin="round"/><path d="M41 12 Q54 9 59 15 L43 16 Z" fill="#1A3B8A"/><circle cx="28" cy="2" r="2.5" fill="#fff"/>`;
    case 'crown':return `<path d="M12 11 L14 -6 L21 3 L28 -10 L35 3 L42 -6 L44 11 Z" fill="#F2B630" stroke="#A7790F" stroke-width="2" stroke-linejoin="round"/><circle cx="28" cy="3" r="2.6" fill="#E85A4F"/>`;
  }
  return '';
}
function sprite(sym,hat,size=52,locked=false){
  const b=buddyOf(sym),h=hatOf(hat);
  const eyes=locked||h==='shades'?'':`<ellipse cx="19" cy="22" rx="3" ry="3.6" fill="#1b1b1b"/><ellipse cx="37" cy="22" rx="3" ry="3.6" fill="#1b1b1b"/>`;
  return `<svg class="sprite" width="${size}" height="${Math.round(size*76/60)}" viewBox="-2 -16 62 76" aria-hidden="true">`+
    `<circle cx="28" cy="32" r="26" fill="${locked?'var(--line)':b.col}" stroke="rgba(0,0,0,.15)" stroke-width="3"/>${eyes}`+
    `<text x="28" y="${locked?39:45}" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="18" fill="${locked?'var(--soft)':'#fff'}">${locked?'?':b.s}</text>${locked?'':hatSVG(h)}</svg>`;
}

// ================= PIECES (iBond puzzle shapes, used when the room turns shapes on) =================
const U=30,W=84,D=12,T=16;
const chargeText=c=>R.chargeText(c);
function cationPath(n){
  let p=`M6,0 H${W}`;
  for(let i=0;i<n;i++){const y0=i*U+(U-T)/2,y1=y0+T;p+=` V${y0} L${W-D},${y0+3} V${y1-3} L${W},${y1}`}
  return p+` V${n*U} H6 Q0,${n*U} 0,${n*U-6} V6 Q0,0 6,0 Z`;
}
function anionPath(n){
  const Rr=D+W;let p=`M${D},0 H${Rr-6} Q${Rr},0 ${Rr},6 V${n*U-6} Q${Rr},${n*U} ${Rr-6},${n*U} H${D}`;
  for(let i=n-1;i>=0;i--){const y1=i*U+(U+T)/2,y0=y1-T;p+=` V${y1} L0,${y1-3} V${y0+3} L${D},${y0}`}
  return p+' V0 Z';
}
function symSVG(s,c){
  let out='',down=false;
  (s.match(/[A-Za-z]+|\d+/g)||[]).forEach(t=>{
    if(/\d/.test(t)){out+=`<tspan class="chg" dy="5">${t}</tspan>`;down=true}
    else{out+=`<tspan dy="${down?-5:0}">${t}</tspan>`;down=false}
  });
  return out+`<tspan class="chg" dy="${down?-13:-8}">${chargeText(c)}</tspan>`;
}
function pieceG(ion){
  const n=Math.abs(ion.c),cat=ion.c>0;
  const d=cat?cationPath(n):anionPath(n);
  const cx=cat?(W-D)/2:D+W/2+3,cy=n*U/2;
  const fill=cat?'var(--cat)':'var(--an)',stroke=cat?'var(--cat-deep)':'var(--an-deep)';
  const fs=ion.s.length>=5?13:ion.s.length>=3?16:19;
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`+
    `<text class="sym" style="font-size:${fs}px" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central">${symSVG(ion.s,ion.c)}</text>`;
}
function pieceSVG(ion,scale=1){
  const n=Math.abs(ion.c),w=ion.c>0?W:W+D,h=n*U;
  return `<svg width="${(w+4)*scale}" height="${(h+4)*scale}" viewBox="-2 -2 ${w+4} ${h+4}" aria-hidden="true">${pieceG(ion)}</svg>`;
}

// ================= STORAGE + IDENTITY =================
const PREFS_KEY = 'ionagrams-prefs', GUEST_KEY = 'ionagrams-guest', BOARD_KEY = 'ionagrams-board', ROOM_KEY = 'ionagrams-room';
const prefs = Object.assign({ music: false, sfx: false, guest: '', per: '', naming: 'off' }, store.get(PREFS_KEY) || {});
if (!prefs.guest) prefs.guest = pickEl();
const savePrefs = () => store.set(PREFS_KEY, prefs);
savePrefs();
const BLANK = () => ({ coins: 0, buddy: 'H', hat: '', extra: false, math: false, missed: {}, stats: { rounds: 0, wins: 0, locked: 0, correct: 0 }, paid: {}, updated: 0 });
function loadLocal(k) { const v = store.get(k); const b = BLANK(); if (v) { Object.assign(b, v); b.stats = Object.assign(BLANK().stats, v.stats || {}); } return b; }
let who = null;   // {user, first, init, period}
try { const s = loginOn() && GL.session(); if (s) who = { user: s.user, first: s.first, init: s.init, period: s.period }; } catch (e) {}
const localKey = () => (who ? 'ionagrams-stu-' + who.user : GUEST_KEY);
let save = loadLocal(localKey());
let dirty = false, syncT = 0;
function persist() {
  save.updated = Date.now();
  store.set(localKey(), save);
  if (who) { dirty = true; clearTimeout(syncT); syncT = setTimeout(() => flush(), 15000); }
}
const nameOf = r => `${r.first || '?'} ${r.init ? r.init + '.' : ''}`.trim();
const myName = () => (who ? nameOf(who) : 'Guest ' + prefs.guest);
const cleanPer = p => String(p ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
const isTeacher = () => !!(who && CONFIG.TEACHERS.map(u => String(u).toLowerCase()).includes(who.user));
let tPer = CONFIG.PERIODS[0];
function myPeriod() { if (isTeacher()) return tPer; if (who) return cleanPer(who.period) || 'guest'; return cleanPer(prefs.per); }

// ================= SOUND =================
function applySound() {
  SND.setMusic(prefs.music); SND.setSfx(prefs.sfx);
  const mb = $('musicBtn'), sb = $('sfxBtn');
  mb.classList.toggle('off', !prefs.music); mb.setAttribute('aria-pressed', prefs.music);
  mb.title = prefs.music ? 'Music: on' : 'Music: off';
  sb.classList.toggle('off', !prefs.sfx); sb.setAttribute('aria-pressed', prefs.sfx);
  sb.title = prefs.sfx ? 'Sound effects: on' : 'Sound effects: off';
}
let unlocked = false;
function unlockSound() { if (unlocked) return; unlocked = true; try { SND.unlock(); } catch (e) {} applySound(); }
document.addEventListener('pointerdown', unlockSound, { capture: true });
document.addEventListener('keydown', unlockSound, { capture: true });
const sfx = n => { try { SND.sfx(n); } catch (e) {} };
const phase = n => { try { SND.phase(n); } catch (e) {} };
$('musicBtn').addEventListener('click', () => { unlockSound(); prefs.music = !prefs.music; savePrefs(); applySound(); });
$('sfxBtn').addEventListener('click', () => { unlockSound(); prefs.sfx = !prefs.sfx; savePrefs(); applySound(); if (prefs.sfx) sfx('pick'); });

// ================= SCREENS =================
let screen = 'sStart';
function show(id) {
  if (screen !== id) window.scrollTo(0, 0);
  screen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id === 'sStart' || id === 'sLobby') phase('lobby');
}
function addCoins(n) {
  const before = save.coins; save.coins += n; if (who) save.pending = (save.pending || 0) + n;
  $('coinCount').textContent = save.coins.toLocaleString();
  BUDDIES.forEach(b => { if (b.at > before && b.at <= save.coins) toast(`${sprite(b.s, '', 26)} New atom buddy: ${b.s}`); });
  HATS.forEach(h => { if (h.at > before && h.at <= save.coins) toast(`${sprite(save.buddy, h.k, 26)} New look unlocked: ${h.n}`); });
}
const coinsUI = () => { $('coinCount').textContent = (save.coins || 0).toLocaleString(); };

// ================= TEACHER SETTINGS =================
let tset = clone(CONFIG.DEFAULT_SETTINGS), tsetUnsub = null, tsetPer = null;
function normSettings(v) {
  const d = CONFIG.DEFAULT_SETTINGS, o = clone(d);
  if (v && typeof v === 'object') {
    if (v.sets) o.sets = { mono: !!v.sets.mono, poly: !!v.sets.poly, poly2: !!v.sets.poly2, tm: !!v.sets.tm };
    if (NAMING.includes(v.minNaming)) o.minNaming = v.minNaming;
    if (v.shapes != null) o.shapes = !!v.shapes;
  }
  if (!o.sets.mono && !o.sets.poly) o.sets = clone(d.sets);
  return o;
}
function watchTeacher() {
  const p = myPeriod();
  if (!roomsOn() || !p || p === tsetPer) return;
  if (tsetUnsub) tsetUnsub();
  tsetPer = p; tset = normSettings(null);
  tsetUnsub = GR.watchSettings(GAME_ID, p, v => { tset = normSettings(v); renderStartOpts(); renderTeacher(); });
}
const minIdx = () => NAMING.indexOf(tset.minNaming);

// ================= START SCREEN =================
function tileHTML(t, o) {
  o = o || {};
  const ion = R.ion(t.k), cat = ion.c > 0, sel = B && B.sel === t.id;
  const label = `${ion.s.replace(/(\d)/g, ' $1')} ${cat ? 'positive' : 'negative'} ${Math.abs(ion.c)}`;
  if (o.shapes) {
    const tag = o.span ? 'span' : 'button';
    return `<${tag} class="piece${o.isNew ? ' new' : ''}" ${o.span ? '' : `data-tile="${t.id}" aria-pressed="${sel}"`} aria-label="${label}"${o.dis ? ' disabled' : ''}>${pieceSVG(ion, o.scale || 1)}</${tag}>`;
  }
  const inner = `<span class="sg" aria-hidden="true">${cat ? '+' : MINUS}</span><span aria-hidden="true">${symHTML(ion.s)}<sup>${chargeText(ion.c)}</sup></span>`;
  if (o.span) return `<span class="tile ${cat ? 'c' : 'a'}" role="img" aria-label="${label}">${inner}</span>`;
  return `<button class="tile ${cat ? 'c' : 'a'}${o.isNew ? ' new' : ''}" data-tile="${t.id}" aria-pressed="${sel}" aria-label="${label}"${o.dis ? ' disabled' : ''}>${inner}</button>`;
}
function renderStart() {
  coinsUI();
  $('demo').innerHTML = tileHTML({ k: 'Ca' }, { span: true }) + '<span class="arrow" aria-hidden="true">+</span>' + tileHTML({ k: 'Cl' }, { span: true }) +
    tileHTML({ k: 'Cl' }, { span: true }) + '<span class="arrow" aria-hidden="true">→</span><span class="f" aria-hidden="true"><span class="m">Ca</span><span class="x">Cl<sub>2</sub></span></span>';
  const w = $('who');
  if (who) {
    w.innerHTML = sprite(save.buddy, save.hat, 44) + `<div class="nm" style="flex:1">Logged in as ${esc(nameOf(who))}, Per ${esc(who.period)}<small>Your ⚛ save to your class account.</small></div>` +
      `<button class="btn alt" id="logoutBtn">Log out</button>`;
    $('logoutBtn').onclick = logout;
    $('perPick').hidden = true;
  } else {
    w.innerHTML = sprite(save.buddy, save.hat, 44) + `<div class="nm" style="flex:1">Playing as ${esc(myName())}<small>${loginOn() ? 'Log in to save your ⚛ to your class account.' : 'Your ⚛ save on this computer only.'}</small></div>` +
      (loginOn() ? `<button class="btn" id="loginBtn">Log in</button>` : '');
    if ($('loginBtn')) $('loginBtn').onclick = openLogin;
    const pp = $('perPick'); pp.hidden = false;
    pp.innerHTML = `<div style="font-weight:700;margin:12px 0 6px" id="perL">Your class period</div><div class="chips" role="group" aria-labelledby="perL">` +
      CONFIG.PERIODS.map(p => `<button data-per="${esc(p)}" aria-pressed="${prefs.per === p}">${esc(p)}</button>`).join('') + '</div>';
  }
  $('xtSw').setAttribute('aria-checked', !!save.extra);
  $('mathSw').setAttribute('aria-checked', !!save.math);
  const on = roomsOn();
  $('multiBtn').hidden = !on; $('multiNote').hidden = on;
  watchTeacher();
  renderStartOpts(); renderTeacher();
}
function renderStartOpts() {
  if (NAMING.indexOf(prefs.naming) < minIdx()) prefs.naming = tset.minNaming;
  $('pracNaming').innerHTML = NAMING.map((n, i) => `<button type="button" data-pn="${n}" aria-pressed="${prefs.naming === n}"${i < minIdx() ? ' disabled' : ''}>${n === 'off' ? 'Off' : n === 'pick' ? 'Pick' : 'Build'}</button>`).join('');
}
$('perPick').addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (!b) return; prefs.per = b.dataset.per; savePrefs(); renderStart(); });
$('pracNaming').addEventListener('click', e => { const b = e.target.closest('[data-pn]'); if (!b || b.disabled) return; prefs.naming = b.dataset.pn; savePrefs(); renderStartOpts(); });
$('xtSw').addEventListener('click', () => { save.extra = !save.extra; persist(); renderStart(); });
$('mathSw').addEventListener('click', () => { save.math = !save.math; persist(); renderStart(); });
$('multiBtn').addEventListener('click', () => {
  if (!myPeriod()) { toast('Pick your class period first.'); const b = document.querySelector('[data-per]'); if (b) b.focus(); return; }
  openLobby();
});
$('pracBtn').addEventListener('click', startPractice);

// teacher panel
let tDraft = null;
function renderTeacher() {
  const c = $('teachCard');
  if (!isTeacher() || !roomsOn()) { c.hidden = true; return; }
  c.hidden = false;
  if (!tDraft || tDraft.per !== tPer || !tDraft.touched) tDraft = { per: tPer, touched: false, s: clone(tset) };
  const s = tDraft.s;
  $('tPer').innerHTML = CONFIG.PERIODS.map(p => `<button type="button" data-tp="${esc(p)}" aria-pressed="${p === tPer}">${esc(p)}</button>`).join('');
  $('tMono').checked = s.sets.mono; $('tPoly').checked = s.sets.poly; $('tPoly2').checked = !!s.sets.poly2; $('tPoly2').disabled = !s.sets.poly; $('tTm').checked = s.sets.tm;
  $('tShapes').innerHTML = [['off', false], ['on', true]].map(([t, v]) => `<button type="button" data-ts="${t}" aria-pressed="${s.shapes === v}">${t === 'on' ? 'On' : 'Off'}</button>`).join('');
  $('tNaming').innerHTML = NAMING.map(n => `<button type="button" data-tn="${n}" aria-pressed="${s.minNaming === n}">${{ off: 'Off', pick: 'Pick', build: 'Build' }[n]}</button>`).join('');
}
$('tPer').addEventListener('click', e => { const b = e.target.closest('[data-tp]'); if (!b) return; tPer = b.dataset.tp; tDraft = null; $('tErr').textContent = ''; watchTeacher(); renderStart(); });
['tMono', 'tPoly', 'tPoly2', 'tTm'].forEach(id => $(id).addEventListener('change', () => {
  const s = tDraft.s; tDraft.touched = true;
  s.sets = { mono: $('tMono').checked, poly: $('tPoly').checked, poly2: $('tPoly').checked && $('tPoly2').checked, tm: $('tTm').checked }; $('tPoly2').disabled = !s.sets.poly;
  $('tErr').textContent = s.sets.mono || s.sets.poly ? '' : 'Turn on single-atom or polyatomic ions.';
}));
$('tShapes').addEventListener('click', e => { const b = e.target.closest('[data-ts]'); if (!b) return; tDraft.touched = true; tDraft.s.shapes = b.dataset.ts === 'on'; renderTeacher(); });
$('tNaming').addEventListener('click', e => { const b = e.target.closest('[data-tn]'); if (!b) return; tDraft.touched = true; tDraft.s.minNaming = b.dataset.tn; renderTeacher(); });
$('tSave').addEventListener('click', async () => {
  const s = tDraft.s;
  if (!s.sets.mono && !s.sets.poly) { $('tErr').textContent = 'Turn on single-atom or polyatomic ions.'; return; }
  $('tErr').textContent = 'Saving…';
  try { await GR.setSettings(GAME_ID, tPer, { sets: s.sets, minNaming: s.minNaming, shapes: !!s.shapes }); tDraft.touched = false; $('tErr').textContent = ''; toast('Saved for period ' + esc(tPer) + '.'); }
  catch (e) { $('tErr').textContent = 'Could not save. Check the internet and try again.'; }
});

// ================= LOBBY =================
let lobbyUnsub = null, lobbyRooms = [];
async function openLobby() {
  show('sLobby');
  const p = myPeriod();
  $('lobbyH').textContent = p === 'guest' ? 'Rooms' : 'Period ' + p + ' rooms';
  $('lobbyMsg').textContent = 'Connecting…'; $('rooms').innerHTML = '';
  if (lobbyUnsub) { lobbyUnsub(); lobbyUnsub = null; }
  try { await GR.ready(); } catch (e) { $('lobbyMsg').textContent = 'Can’t reach the game server. Check the internet, or go back and tap Practice alone.'; return; }
  if (screen !== 'sLobby') return;
  $('lobbyMsg').textContent = '';
  lobbyUnsub = GR.watchLobby(GAME_ID, p, list => { lobbyRooms = list; renderLobby(); });
}
function closeLobby() { if (lobbyUnsub) { lobbyUnsub(); lobbyUnsub = null; } }
function renderLobby() {
  if (screen !== 'sLobby') return;
  const el = $('rooms');
  if (!lobbyRooms.length) { el.innerHTML = '<div class="empty">No rooms yet. Tap <b>New room</b> to make one.</div>'; return; }
  el.innerHTML = lobbyRooms.map(r => {
    const full = r.count >= r.max, playing = r.state === 'play';
    const st = playing ? '<span class="tag play">Playing</span>' : r.state === 'countdown' ? '<span class="tag go">Starting</span>' : '<span class="tag">Waiting</span>';
    const nm = NAMING_TXT[(r.settings && r.settings.naming) || 'off'];
    return `<button class="room" data-room="${esc(r.id)}"${full || playing ? ' disabled' : ''} aria-label="${esc(r.name)}, ${r.count} of ${r.max} players, ${playing ? 'playing' : full ? 'full' : 'waiting'}">` +
      `<div class="rt"><b>${esc(r.name)}</b>${st}</div>` +
      `<div class="sp">${r.players.map(p => sprite(p.buddy, p.hat, 32)).join('') || '<span class="note" style="margin:0">Empty</span>'}</div>` +
      `<div class="meta"><span>${r.count} / ${r.max}${full ? ' · Full' : ''}</span><span>Names: ${esc(nm)}</span></div></button>`;
  }).join('');
}
$('rooms').addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (b && !b.disabled) joinRoom(myPeriod(), b.dataset.room); });
$('lobbyBack').addEventListener('click', () => { closeLobby(); renderStart(); show('sStart'); });

// new room dialog
let nr = { naming: 'off', max: CONFIG.MAX_PLAYERS };
function renderNewRoom() {
  if (NAMING.indexOf(nr.naming) < minIdx()) nr.naming = tset.minNaming;
  $('rNaming').innerHTML = NAMING.map((n, i) => `<button type="button" data-rn="${n}" aria-pressed="${nr.naming === n}"${i < minIdx() ? ' disabled' : ''}>${n === 'off' ? 'Off' : n === 'pick' ? 'Pick' : 'Build'}</button>`).join('');
  $('rNamingNote').textContent = { off: 'No names. Just the charges.', pick: 'Pick each name from 4 choices.', build: 'Build each name from word tiles.' }[nr.naming] +
    (minIdx() > 0 ? ' Your teacher set the least naming.' : '');
  const mx = []; for (let i = 2; i <= CONFIG.MAX_PLAYERS; i++) mx.push(i);
  $('rMax').innerHTML = mx.map(i => `<button type="button" data-rm="${i}" aria-pressed="${nr.max === i}">${i}</button>`).join('');
  const s = tset.sets, ions = [s.mono && 'single-atom', s.poly && (s.poly2 ? 'all polyatomic' : 'basic polyatomic'), s.tm && 'metals with Roman numerals'].filter(Boolean).join(', ');
  $('rSets').textContent = `Ions: ${ions}. Tile shapes: ${tset.shapes ? 'on' : 'off'}. Set by your teacher.`;
}
$('newRoomBtn').addEventListener('click', () => { nr.max = Math.min(nr.max, CONFIG.MAX_PLAYERS); $('rErr').textContent = ''; $('rGo').disabled = false; renderNewRoom(); $('dRoom').showModal(); });
$('rNaming').addEventListener('click', e => { const b = e.target.closest('[data-rn]'); if (b && !b.disabled) { nr.naming = b.dataset.rn; renderNewRoom(); } });
$('rMax').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { nr.max = +b.dataset.rm; renderNewRoom(); } });
$('roomForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('rGo').disabled = true; $('rErr').textContent = 'Making the room…';
  const used = lobbyRooms.map(r => String(r.name || '').replace(/^Room /, ''));
  const settings = { naming: nr.naming, sets: clone(tset.sets), shapes: !!tset.shapes, size: CONFIG.HAND_SIZE };
  try {
    const id = await GR.create(GAME_ID, myPeriod(), { name: 'Room ' + pickEl(used), max: nr.max, settings });
    $('dRoom').close();
    await joinRoom(myPeriod(), id);
  } catch (err) { $('rErr').textContent = 'Couldn’t make the room. Check the internet and try again.'; $('rGo').disabled = false; }
});

// ================= ROOM =================
let M = null;   // {room, period, id, unsub, view, viewKey, reviewKey, flags:{n:Set}, ...}
const JOIN_ERR = { full: 'That room is full.', started: 'That game already started. Pick another room.', gone: 'That room is gone.', offline: 'Can’t reach the game server. Check the internet.' };
async function joinRoom(period, id, quiet) {
  if (M) return;
  // two guests with the same element name in one room would be confusing: pick a new element
  const lr = lobbyRooms.find(r => r.id === id), taken = lr ? lr.players.map(p => p.name) : [];
  if (!who && taken.includes(myName())) { prefs.guest = pickEl(taken.map(n => String(n).replace(/^Guest /, ''))); savePrefs(); }
  let room;
  try { room = await GR.join(GAME_ID, period, id, { name: myName(), buddy: save.buddy, hat: hatOf(save.hat) }); }
  catch (e) { store.del(ROOM_KEY); if (!quiet) toast(esc(JOIN_ERR[e && e.error] || JOIN_ERR.offline)); return false; }
  closeLobby();
  M = { room, period, id, view: '', viewKey: '', flags: {}, seen: {}, names: {}, count: 0, reviewKey: null, reviewUntil: 0, leaving: false };
  store.set(ROOM_KEY, { period, id });
  M.unsub = room.onChange(onSnap);
  return true;
}
function snap() { return M ? M.room.snap : null; }
const sNow = () => (GR && GR.serverNow ? GR.serverNow() : Date.now());
function onSnap(s) {
  if (!M) return;
  if (M.room.gone || !s.meta) { const was = M; endRoom(); if (!was.leaving) toast('The room closed.'); openLobby(); return; }
  const n = Object.keys(s.players || {}).length;
  Object.keys(s.players || {}).forEach(u => { const p = s.players[u]; if (p && p.name) M.names[u] = { name: p.name, buddy: p.buddy, hat: p.hat }; });
  if (n > M.count && M.count) sfx('join');
  M.count = n;
  route(true);
}
function endRoom() {
  if (!M) return;
  try { M.unsub && M.unsub(); } catch (e) {}
  M = null; store.del(ROOM_KEY); closeLock(); cancelDrag();
  $('cover').hidden = true;
  if (B && B.mode === 'multi') { B = null; store.del(BOARD_KEY); }
}
async function leaveRoom() {
  if (!M) return;
  const r = M.room; M.leaving = true; endRoom();
  try { await r.leave(); } catch (e) {}
  openLobby();
}
function confirmLeave(text) {
  return new Promise(res => {
    const d = $('dConfirm'); $('confT').textContent = text;
    const done = () => { d.removeEventListener('close', done); res(d.returnValue === 'yes'); };
    d.returnValue = 'no'; d.addEventListener('close', done); d.showModal(); $('confNo').focus();
  });
}
$('waitLeave').addEventListener('click', leaveRoom);
$('resLeave').addEventListener('click', leaveRoom);
$('playLeave').addEventListener('click', async () => {
  if (B && B.mode === 'solo') { if (await confirmLeave('Stop practicing? This hand will be lost.')) { B = null; renderStart(); show('sStart'); } return; }
  if (await confirmLeave('Leave this round? You can’t come back to it.')) leaveRoom();
});
$('againBtn').addEventListener('click', async () => {
  if (B && B.mode === 'solo') { startPractice(); return; }
  if (!M || !M.room.isHost()) return;
  $('againBtn').disabled = true;
  try { await M.room.reset(); } catch (e) { toast('Couldn’t start again. Try once more.'); }
  $('againBtn').disabled = false;
});
$('readyBtn').addEventListener('click', () => {
  if (!M) return;
  const s = snap(), me = s.players[M.room.uid], g = (s.meta && s.meta.gen) || 0;
  const on = !!(me && me.ready && (me.readyGen || 0) === g);
  M.room.ready(!on).catch(() => {});
  sfx(on ? 'unlock' : 'lock');
});
const isReady = (p, m) => !!(p && p.ready && (p.readyGen || 0) === ((m && m.gen) || 0));
function playerOrder(P) { return Object.keys(P || {}).sort((a, b) => ((+P[a].joined || 9e15) - (+P[b].joined || 9e15)) || (a < b ? -1 : 1)); }
function renderWait() {
  const s = snap(), m = s.meta, P = s.players, me = M.room.uid;
  $('waitH').textContent = m.name || 'Room';
  const ids = playerOrder(P);
  $('plist').innerHTML = ids.map((u, i) => `<li class="${u === me ? 'me' : ''}">${sprite(P[u].buddy, P[u].hat, 40)}<span class="nm">${esc(P[u].name)}${u === me ? ' (you)' : ''}${i === 0 ? ' <small class="note">host</small>' : ''}</span>` +
    `<span class="rdy ${isReady(P[u], m) ? 'on' : ''}">${isReady(P[u], m) ? '✓ Ready' : 'Not ready'}</span></li>`).join('');
  const r = isReady(P[me], m);
  $('readyBtn').setAttribute('aria-pressed', r); $('readyBtn').textContent = r ? '✓ Ready!' : 'I\'m ready';
  const st = m.settings || {};
  $('roomInfo').textContent = `Names: ${NAMING_TXT[st.naming || 'off']} · ${ids.length} / ${m.max} players`;
  waitTick(true);
}
function waitTick(force) {
  const s = snap(); if (!s || !s.meta) return;
  const m = s.meta, n = Object.keys(s.players).length, el = $('cd');
  if (m.state === 'countdown' && m.countdownEnd) {
    const total = +m.countdownMs || 15000, left = Math.max(0, m.countdownEnd - sNow()), sec = Math.ceil(left / 1000);
    const C = 2 * Math.PI * 46, frac = Math.max(0, Math.min(1, left / total));
    if (M.cdSec !== sec) { if (M.cdSec != null && sec > 0) sfx('tick'); M.cdSec = sec; force = true; }
    if (force || !el.querySelector('.ring')) el.innerHTML = `<div class="ring" aria-label="Starting in ${sec} seconds"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" stroke-width="8"/>` +
      `<circle id="ringArc" cx="50" cy="50" r="46" fill="none" stroke="var(--good)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg><div class="num">${sec}</div></div><div style="font-weight:700">Starting…</div>`;
    else { const a = $('ringArc'); if (a) a.setAttribute('stroke-dashoffset', C * (1 - frac)); }
    phase('countdown');
  } else {
    M.cdSec = null;
    if (force) el.innerHTML = `<div style="font-weight:700;font-size:20px;text-align:center">${n < 2 ? 'Waiting for 1 more player…' : 'Getting ready…'}</div>`;
    phase('lobby');
  }
}

// ================= BOARD (one player's hand, groups and tray) =================
let B = null;
const gIons = g => g.tiles.map(id => B.tiles[id].k);
const groupOf = id => B.groups.find(g => g.tiles.includes(id));
const getG = gid => B.groups.find(g => g.id === gid);
const lockedTiles = () => B.groups.reduce((n, g) => n + (g.locked ? g.tiles.length : 0), 0);
const tilesLeft = () => Object.keys(B.tiles).length - lockedTiles();
const canDone = () => !!B && B.tray.length === 0 && B.groups.length > 0 && B.groups.every(g => g.locked);
function makeBoard(o) {
  const b = Object.assign({ tiles: {}, tray: [], groups: [], gid: 0, dumpCount: 0, dumped: [], sel: null, fresh: {} }, o);
  const d = R.deal({ seed: b.seed, uid: b.uid, sets: b.sets, size: b.size, missed: b.missed });
  d.tiles.forEach(t => { b.tiles[t.id] = t; });
  b.dealt = d.tiles.map(t => t.id);
  return b;
}
function newBoard(o) { const b = makeBoard(o); b.tray = b.dealt.slice(); return b; }
function boardSaveObj() {
  return { key: B.key, mode: B.mode, seed: B.seed, uid: B.uid, sets: B.sets, size: B.size, missed: B.missed, naming: B.naming, shapes: B.shapes, extra: B.extra,
    startAt: B.startAt, tray: B.tray, gid: B.gid, dumpCount: B.dumpCount, dumped: B.dumped,
    groups: B.groups.map(g => ({ id: g.id, tiles: g.tiles, locked: g.locked, pos: g.pos, neg: g.neg, name: g.name, words: g.words })) };
}
function saveBoard() { if (B && B.mode === 'multi') store.set(BOARD_KEY, boardSaveObj()); }
function restoreBoard(key) {
  const v = store.get(BOARD_KEY);
  if (!v || v.key !== key) return null;
  try {
    const b = makeBoard({ key: v.key, mode: v.mode, seed: v.seed, uid: v.uid, sets: v.sets, size: v.size, missed: v.missed || {}, naming: v.naming, shapes: v.shapes, extra: v.extra, startAt: v.startAt });
    for (let i = 0; i < (v.dumpCount | 0); i++) R.drawAt({ seed: b.seed, uid: b.uid, sets: b.sets }, i).forEach(t => { b.tiles[t.id] = t; });
    (v.dumped || []).forEach(id => { delete b.tiles[id]; });
    b.dumpCount = v.dumpCount | 0; b.dumped = v.dumped || []; b.gid = v.gid | 0;
    const placed = new Set();
    b.groups = (v.groups || []).map(g => ({ id: g.id, tiles: (g.tiles || []).filter(id => b.tiles[id] && !placed.has(id) && placed.add(id)), locked: !!g.locked,
      pos: g.pos ?? null, neg: g.neg ?? null, name: g.name ?? null, words: g.words || null })).filter(g => g.tiles.length);
    b.tray = (v.tray || []).filter(id => b.tiles[id] && !placed.has(id) && placed.add(id));
    Object.keys(b.tiles).forEach(id => { if (!placed.has(id)) b.tray.push(id); });
    return b;
  } catch (e) { return null; }
}
const editable = () => !!B && B.phase === 'build' && !B.out;
function changed() { saveBoard(); renderBoard(); pubProgress(); }
function moveTile(id, dest) {
  if (!editable() || !B.tiles[id]) return false;
  const src = groupOf(id);
  if (src && src.locked) return false;
  if (dest === 'swap') return swapTile(id);
  let to = null;
  if (dest === 'new') { to = { id: 'g' + (++B.gid), tiles: [], locked: false, pos: null, neg: null, name: null, words: null }; }
  else if (dest && dest.startsWith('g:')) { to = getG(dest.slice(2)); if (!to) return false; if (to.locked) { toast('That compound is locked. Unlock it first.'); return false; } if (to === src) { B.sel = null; renderBoard(); return false; } }
  else if (dest === 'tray') { if (!src) { B.sel = null; renderBoard(); return false; } }
  else return false;
  if (src) { src.tiles = src.tiles.filter(x => x !== id); if (!src.tiles.length) B.groups = B.groups.filter(g => g !== src); }
  else B.tray = B.tray.filter(x => x !== id);
  if (dest === 'new') B.groups.push(to);
  if (to) to.tiles.push(id); else B.tray.push(id);
  B.sel = null; sfx('place'); changed();
  return true;
}
function swapTile(id) {
  const src = groupOf(id);
  if (src) { if (src.locked) return false; src.tiles = src.tiles.filter(x => x !== id); if (!src.tiles.length) B.groups = B.groups.filter(g => g !== src); }
  else B.tray = B.tray.filter(x => x !== id);
  const gone = B.tiles[id]; delete B.tiles[id]; B.dumped.push(id);
  const got = R.drawAt({ seed: B.seed, uid: B.uid, sets: B.sets }, B.dumpCount); B.dumpCount++;
  got.forEach(t => { B.tiles[t.id] = t; B.tray.push(t.id); B.fresh[t.id] = 1; });
  B.sel = null; sfx('swap');
  toast(`Swapped ${esc(R.ionText(gone.k))} for ${got.map(t => esc(R.ionText(t.k))).join(' and ')}`);
  changed();
  return true;
}
function unlockGroup(gid) {
  const g = getG(gid); if (!g || !g.locked || !editable()) return;
  g.locked = false; sfx('unlock'); changed();
}

// ---- render ----
function groupTilesHTML(g, dis) {
  const ts = g.tiles.map(id => B.tiles[id]);
  if (!B.shapes) return ts.map(t => tileHTML(t, { dis, isNew: B.fresh[t.id] })).join('');
  const cats = ts.filter(t => R.ion(t.k).c > 0), ans = ts.filter(t => R.ion(t.k).c < 0);
  return `<div class="pcols"><div class="pcol">${cats.map(t => tileHTML(t, { shapes: true, dis, scale: 1 })).join('')}</div>` +
    `<div class="pcol an">${ans.map(t => tileHTML(t, { shapes: true, dis, scale: 1 })).join('')}</div></div>`;
}
function claimsHTML(g, naming) {
  return `<span>+${g.pos ?? '?'} / ${MINUS}${g.neg ?? '?'}</span>` + (naming !== 'off' && g.name ? `<span class="nmc">${esc(g.name)}</span>` : '');
}
function renderBoard() {
  if (!B) return;
  const ed = editable(), sel = B.sel, selG = sel ? groupOf(sel) : null, dragging = !!(drag && drag.on);
  const fk = focusKey();
  $('groups').innerHTML = B.groups.map((g, i) => {
    const drop = sel && !g.locked && selG !== g;
    return `<div class="grp${g.locked ? ' locked' : ''}${drop ? ' drop' : ''}" data-drop="g:${g.id}" role="group" aria-label="Compound ${i + 1}${g.locked ? ', locked' : ''}">` +
      `<div class="gh"><div class="fm">${R.formulaHTML(gIons(g))}</div>` +
      (g.locked ? `<button class="btn alt lockbtn" data-unlock="${g.id}"${ed ? '' : ' disabled'} aria-label="Unlock compound ${i + 1}">🔒 Unlock</button>`
        : `<button class="btn lockbtn" data-lock="${g.id}"${ed ? '' : ' disabled'}>Lock</button>`) + `</div>` +
      `<div class="tiles">${groupTilesHTML(g, g.locked || !ed)}</div>` +
      (g.locked ? `<div class="claims">${claimsHTML(g, B.naming)}</div>` : '') +
      (drop && !dragging ? `<button class="addhere" data-drop="g:${g.id}">Put it here</button>` : '') + `</div>`;
  }).join('') + (ed ? `<button class="newg${sel ? ' drop' : ''}" data-drop="new"><b aria-hidden="true">＋</b>New compound</button>` : '');
  $('tray').innerHTML = B.tray.length ? B.tray.map(id => tileHTML(B.tiles[id], { shapes: B.shapes, dis: !ed, isNew: B.fresh[id] })).join('')
    : `<div class="emptyt">All tiles placed.</div>`;
  B.fresh = {};
  $('putBack').hidden = !(sel && selG) || dragging;
  const swap = $('swapBtn'); swap.classList.toggle('drop', !!sel); swap.disabled = !ed;
  $('swapSub').textContent = sel ? 'Swap this tile' : 'Pick a tile first';
  const allLocked = B.groups.length && B.groups.every(g => g.locked);
  $('trayHint').textContent = !ed ? '' : sel ? 'Now tap a compound, New compound, or Swap.' : B.tray.length ? 'Tap a tile to pick it.' : allLocked ? 'Ready! Tap Done!' : 'Lock every compound, then tap Done!';
  $('doneBtn').disabled = !ed || !canDone() || (B.mode === 'multi' && !!B.calling);
  $('doneBtn').hidden = !!B.out;
  $('leftCount').textContent = tilesLeft();
  $('outBanner').hidden = !B.out; B.lastOut = B.out;
  document.querySelector('#sPlay .side').hidden = !!B.out;
  restoreFocus(fk);
}
function focusKey() {
  const a = document.activeElement; if (!a || !a.closest || !a.closest('#sPlay')) return null;
  for (const k of ['tile', 'lock', 'unlock', 'drop']) if (a.dataset && a.dataset[k]) return '[data-' + k + '="' + a.dataset[k] + '"]';
  return a.id ? '#' + a.id : null;
}
function restoreFocus(k) { if (!k) return; const e = document.querySelector('#sPlay ' + k) || (k.startsWith('[data-tile') ? $('tray').querySelector('button') : null); if (e && !e.disabled) e.focus({ preventScroll: true }); }

// ---- input: tap (primary) and drag (pointer) ----
let drag = null, noClick = false;
$('sPlay').addEventListener('click', e => {
  if (noClick) { noClick = false; return; }
  if (!B) return;
  const lk = e.target.closest('[data-lock]'); if (lk) { if (editable()) openLock(lk.dataset.lock); return; }
  const ul = e.target.closest('[data-unlock]'); if (ul) { unlockGroup(ul.dataset.unlock); return; }
  if (e.target.closest('#doneBtn')) { callDone(); return; }
  const t = e.target.closest('[data-tile]');
  if (t && !t.disabled && editable()) {
    const id = t.dataset.tile, g = groupOf(id);
    if (B.sel === id) { B.sel = null; renderBoard(); return; }
    if (B.sel && g && !g.locked && groupOf(B.sel) !== g) { moveTile(B.sel, 'g:' + g.id); return; }
    B.sel = id; sfx('pick'); renderBoard(); return;
  }
  const d = e.target.closest('[data-drop]');
  if (d && editable()) {
    const dest = d.dataset.drop;
    if (dest.startsWith('g:') && !B.sel) { const g = getG(dest.slice(2)); if (g && g.locked && !e.target.closest('button')) unlockGroup(g.id); return; }
    if (dest === 'swap' && !B.sel) { toast('Pick a tile first. Then tap Swap.'); return; }
    if (dest === 'new' && !B.sel) { toast('Pick a tile first. Then tap New compound.'); return; }
    if (B.sel) moveTile(B.sel, dest);
  }
});
document.addEventListener('pointerdown', e => {
  if (e.button || !editable()) return;
  const t = e.target.closest && e.target.closest('#sPlay [data-tile]');
  if (!t || t.disabled) return;
  drag = { id: t.dataset.tile, x: e.clientX, y: e.clientY, el: t, on: false, hot: null };
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.on) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return;
    if (!editable()) { drag = null; return; }
    drag.on = true; B.sel = drag.id; sfx('pick'); renderBoard();
    const src = document.querySelector(`#sPlay [data-tile="${drag.id}"]`) || drag.el;
    const g = src.cloneNode(true); g.classList.add('ghost'); g.removeAttribute('data-tile'); g.removeAttribute('aria-pressed'); g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g); drag.ghost = g;
  }
  e.preventDefault();
  drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
  const over = document.elementFromPoint(e.clientX, e.clientY), tgt = over && over.closest('[data-drop]');
  const hot = tgt ? (tgt.dataset.drop === 'tray' ? $('trayZone') : tgt.closest('.grp,.newg,.trayzone,.swap') || tgt) : null;
  if (drag.hot !== hot) { if (drag.hot) drag.hot.classList.remove('hot'); if (hot) hot.classList.add('hot'); drag.hot = hot; }
  drag.dest = tgt ? tgt.dataset.drop : null;
}, { passive: false });
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag; cancelDrag();
  if (d.on) { noClick = true; setTimeout(() => { noClick = false; }, 0); if (d.dest) moveTile(d.id, d.dest); else { B.sel = null; renderBoard(); } }
});
document.addEventListener('pointercancel', cancelDrag);
function cancelDrag() { if (!drag) return; if (drag.ghost) drag.ghost.remove(); if (drag.hot) drag.hot.classList.remove('hot'); drag = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && B && B.sel && !document.querySelector('dialog[open]')) { B.sel = null; renderBoard(); } });

// ================= LOCK DIALOG =================
let L = null;
function stepperHTML(which, v) {
  const p = which === 'pos';
  return `<div class="stepper"><button type="button" data-step="${which}" data-d="-1" aria-label="${p ? 'Less positive' : 'Less negative'}">−</button>` +
    `<label class="num ${p ? 'p' : 'n'}"><span aria-hidden="true">${p ? '+' : MINUS}</span><input id="in-${which}" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${v}" aria-label="${p ? 'Total positive charge' : 'Total negative charge'}"></label>` +
    `<button type="button" data-step="${which}" data-d="1" aria-label="${p ? 'More positive' : 'More negative'}">+</button></div>`;
}
function mathRows(ions, pos) {
  const cnt = {}; ions.forEach(k => { cnt[k] = (cnt[k] || 0) + 1; });
  return Object.keys(cnt).filter(k => (R.ion(k).c > 0) === pos).map(k => {
    const c = R.ion(k).c;
    return `<div class="mathrow">${esc(R.ionText(k))}: ${cnt[k]} × (${sg(c)}) = __</div>`;
  }).join('');
}
function openLock(gid) {
  const g = getG(gid); if (!g || !g.tiles.length) return;
  const ions = gIons(g), key = B.seed + '|' + B.uid + '|' + gid + '|' + ions.slice().sort().join(',');
  L = { gid, pos: g.pos ?? 0, neg: g.neg ?? 0, name: g.name || null, naming: B.naming, ions };
  $('lockF').innerHTML = R.formulaHTML(ions);
  $('lockPos').innerHTML = `<div class="step"><div class="lbl">Total + charge${save.math ? mathRows(ions, true) : ''}</div>${stepperHTML('pos', L.pos)}</div>`;
  $('lockNeg').innerHTML = `<div class="step"><div class="lbl">Total ${MINUS} charge${save.math ? mathRows(ions, false) : ''}</div>${stepperHTML('neg', L.neg)}</div>`;
  const nm = $('lockName');
  if (L.naming === 'pick') {
    L.choices = R.nameChoices(ions, R.rng('pick|' + key));
    nm.innerHTML = L.choices.length ? `<fieldset class="choices"><legend>Name</legend>` + L.choices.map((c, i) =>
      `<label class="choice"><input type="radio" name="lkname" value="${i}"${R.sameName(c, L.name) ? ' checked' : ''}>${esc(c)}</label>`).join('') + `</fieldset>`
      : `<p class="note">No names to pick. A compound needs a + ion and a ${MINUS} ion.</p>`;
  } else if (L.naming === 'build') {
    L.wt = R.nameTiles(ions, R.rng('build|' + key));
    L.used = [];
    if (g.words) g.words.forEach(w => { const i = L.wt.findIndex((x, j) => x === w && !L.used.includes(j)); if (i >= 0) L.used.push(i); });
    renderBuildName();
  } else nm.innerHTML = '';
  $('lockGo').disabled = false;
  $('dLock').showModal();
  setTimeout(() => { const f = $('in-pos'); if (f) f.focus(); }, 0);
}
function renderBuildName() {
  const nm = $('lockName');
  if (!L.wt.length) { nm.innerHTML = `<p class="note">No name to build. A compound needs a + ion and a ${MINUS} ion.</p>`; return; }
  const words = L.used.map(i => L.wt[i]);
  nm.innerHTML = `<div style="font-weight:700;margin-bottom:6px" id="bnL">Build the name</div>` +
    `<div class="ansline" aria-labelledby="bnL">${L.used.length ? L.used.map((i, j) => `<button type="button" class="word" data-unword="${j}" aria-label="Remove ${esc(L.wt[i])}">${esc(L.wt[i])}</button>`).join('') : '<span class="ph">Tap words below</span>'}</div>` +
    `<div class="words" style="margin-top:8px">${L.wt.map((w, i) => `<button type="button" class="word${L.used.includes(i) ? ' used' : ''}" data-word="${i}"${L.used.includes(i) ? ' disabled' : ''}>${esc(w)}</button>`).join('')}</div>` +
    `<div class="preview" aria-live="polite">${words.length ? 'Name: ' + esc(R.joinName(words)) : ''}</div>`;
}
$('dLock').addEventListener('click', e => {
  const s = e.target.closest('[data-step]');
  if (s) { const w = s.dataset.step, i = $('in-' + w); i.value = Math.max(0, Math.min(40, (parseInt(i.value, 10) || 0) + +s.dataset.d)); sfx('tick'); return; }
  const wd = e.target.closest('[data-word]'); if (wd && L) { L.used.push(+wd.dataset.word); sfx('place'); renderBuildName(); const n = $('lockName').querySelector('.words button:not(:disabled)'); if (n) n.focus(); return; }
  const uw = e.target.closest('[data-unword]'); if (uw && L) { L.used.splice(+uw.dataset.unword, 1); renderBuildName(); return; }
});
$('dLock').addEventListener('input', e => { if (e.target.matches('.stepper input')) e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); });
document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('lockForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!L || !editable()) { closeLock(); return; }
  const g = getG(L.gid); if (!g) { closeLock(); return; }
  const pos = parseInt($('in-pos').value, 10), neg = parseInt($('in-neg').value, 10);
  let name = null, words = null;
  if (L.naming === 'pick' && L.choices.length) {
    const c = $('lockName').querySelector('input[name=lkname]:checked');
    if (!c) { toast('Pick a name first.'); $('lockName').querySelector('input').focus(); return; }
    name = L.choices[+c.value];
  } else if (L.naming === 'build' && L.wt.length) {
    if (!L.used.length) { toast('Build the name first.'); return; }
    words = L.used.map(i => L.wt[i]); name = R.joinName(words);
  }
  g.pos = isNaN(pos) ? 0 : pos; g.neg = isNaN(neg) ? 0 : neg; g.name = name; g.words = words; g.locked = true;
  if (B.sel && g.tiles.includes(B.sel)) B.sel = null;
  closeLock(); sfx('lock'); changed();
  const b = document.querySelector(`[data-unlock="${g.id}"]`); if (b) b.focus();
});
function closeLock() { L = null; if ($('dLock').open) $('dLock').close(); }
$('dLock').addEventListener('close', () => { L = null; });

// ================= MULTIPLAYER ROUND =================
let pubT = 0, pubLast = '';
function pubProgress(now) {
  if (!M || !B || B.mode !== 'multi') return;
  const v = { left: tilesLeft(), groups: B.groups.length, locked: B.groups.filter(g => g.locked).length };
  const j = JSON.stringify(v); if (j === pubLast) return;
  clearTimeout(pubT);
  const go = () => { if (!M) return; pubLast = j; M.room.set('progress/' + M.room.uid, v).catch(() => { pubLast = ''; }); };
  if (now) go(); else pubT = setTimeout(go, 700);
}
function nextN(d) { let n = 0; Object.keys(d.verdict || {}).forEach(k => { if ((d.verdict || {})[k]) n = Math.max(n, +k); }); return n + 1; }
async function callDone() {
  if (!B || !canDone() || !editable()) return;
  if (B.mode === 'solo') { practiceDone(); return; }
  if (!M || B.calling) return;
  const s = snap(), d = s.data || {};
  if (d.done || d.over) return;
  B.calling = true; renderBoard();
  const me = M.room.uid;
  const board = { groups: B.groups.map(g => ({ ions: gIons(g), pos: g.pos, neg: g.neg, name: g.name || null })), at: sNow() };
  try {
    await M.room.set('boards/' + me, board);
    const n = nextN(d);
    const r = await M.room.txn('done', cur => (cur ? undefined : { uid: me, n, at: sNow(), endsAt: sNow() + CONFIG.CHALLENGE_MS }));
    if (r.committed && r.value && r.value.uid === me) sfx('done');
    else toast('Someone else called Done first.');
  } catch (e) { toast('Couldn’t reach the room. Try Done again.'); }
  if (B) { B.calling = false; renderBoard(); }
}
// verdict for the current Done: from the host's write, or computed here (everyone gets the same answer)
function doneCheck(d, m) {
  const done = d.done, bd = d.boards && d.boards[done.uid];
  if (!bd) return null;
  const groups = arr(bd.groups).map(nGroup), chk = R.checkBoard(groups, { naming: (m.settings && m.settings.naming) || 'off' });
  return { groups, results: chk.results, ok: chk.ok };
}
const hostDid = {};
function hostOnce(k, fn) { const t = hostDid[k]; if (t && Date.now() - t < 3000) return; hostDid[k] = Date.now(); Promise.resolve().then(fn).catch(() => {}); }
// Host duties. Safe to run in any browser at any time: every write checks the state first.
function hostTick() {
  if (!M || !M.room.isHost()) return;
  const s = snap(), m = s.meta, d = s.data || {}, r = M.room, key = M.id + '|' + (m && m.round);
  if (!m || m.state !== 'play' || d.over) return;
  const now = sNow(); if (now < m.startAt) return;
  const done = d.done;
  if (done) {
    if (now < done.endsAt) return;
    const v = d.verdict && d.verdict[done.n], chk = v ? null : doneCheck(d, m);
    const ok = v ? !!v.ok : chk ? chk.ok : null;
    if (ok == null) return;
    if (!v) hostOnce(key + 'v' + done.n, () => r.set('verdict/' + done.n, { uid: done.uid, ok }));
    if (!ok && !(d.out && d.out[done.uid])) hostOnce(key + 'o' + done.n, () => r.set('out/' + done.uid, true));
    if (now >= done.endsAt + CONFIG.REVEAL_MS) {
      if (ok) hostOnce(key + 'w' + done.n, () => r.set('over', { at: now, winner: done.uid, why: 'win' }));
      else if (d.out && d.out[done.uid]) hostOnce(key + 'r' + done.n, () => r.remove('done'));
    }
    return;
  }
  if (now >= m.startAt + CONFIG.ROUND_MS) { hostOnce(key + 't', () => r.set('over', { at: now, winner: null, why: 'time' })); return; }
  const inPlay = Object.keys(m.roster || {}).filter(u => s.players[u] && !(d.out && d.out[u]));
  if (!inPlay.length) hostOnce(key + 'a', () => r.set('over', { at: now, winner: null, why: 'allout' }));
}
function setupRoundBoard(m) {
  const key = M.id + '|' + m.round;
  if (B && B.key === key) return;
  const st = m.settings || {};
  B = restoreBoard(key) || newBoard({
    key, mode: 'multi', seed: m.seed, uid: M.room.uid, sets: st.sets || CONFIG.DEFAULT_SETTINGS.sets, size: save.extra ? CONFIG.EXTRA_HAND : (st.size || CONFIG.HAND_SIZE),
    missed: clone(save.missed || {}), naming: st.naming || 'off', shapes: !!st.shapes, extra: !!save.extra, startAt: m.startAt
  });
  B.phase = 'pre'; B.reviewed = false;
  pubLast = ''; saveBoard();
}
// decide what this player sees; full = re-render even if the view didn't change
function route(full) {
  if (!M) return;
  const s = snap(), m = s.meta, d = s.data || {}, me = M.room.uid, now = sNow();
  if (!m) return;
  let view, vkey;
  if (m.state !== 'play') {
    if (M.view === 'review' && Date.now() < M.reviewUntil) return;   // finish reading the review first
    if (B && B.mode === 'multi') { B = null; store.del(BOARD_KEY); }
    view = 'wait'; vkey = 'wait';
  } else {
    if (!(m.roster && m.roster[me])) { endRoom(); toast('This game started without you.'); openLobby(); return; }
    setupRoundBoard(m);
    B.out = !!(d.out && d.out[me]);
    if (d.over) {
      if (M.reviewKey !== B.key) { view = 'review'; }
      else view = M.view === 'review' && Date.now() < M.reviewUntil ? 'review' : 'results';
      vkey = view + B.key;
    } else if (now < m.startAt) { view = 'pre'; vkey = 'pre' + B.key; }
    else if (d.done) { view = 'check'; vkey = 'check' + B.key + '|' + d.done.n + '|' + (now < d.done.endsAt ? 'c' : 'r'); }
    else { view = 'build'; vkey = 'build' + B.key; }
  }
  const enter = vkey !== M.viewKey;
  M.view = view; M.viewKey = vkey;
  if (view !== 'pre') $('cover').hidden = true;
  if (view === 'wait') { if (enter || full) { show('sWait'); renderWait(); } else waitTick(false); return; }
  if (view === 'review') { if (enter) startReview(); else if (full) renderReviewSave(); return; }
  if (view === 'results') { if (enter || full) renderResults(); return; }
  // play screen views
  if (enter) { closeLockIfFrozen(view); cancelDrag(); }
  B.phase = view === 'build' ? 'build' : view === 'check' ? 'check' : 'pre';
  if (enter) {
    show('sPlay'); renderPlayHUD(); if (view !== 'pre') window.scrollTo(0, 0);
    $('buildArea').hidden = view === 'check'; $('checkArea').hidden = view !== 'check';
    if (view === 'check') renderCheck(); else renderBoard();
    if (view === 'build') { phase('build'); pubProgress(true); }
  } else if (full) {   // a room update: refresh only what changed, so taps in progress aren't lost
    renderPlayHUD();
    if (view === 'check') renderCheck(true); else if (B.out !== B.lastOut) renderBoard();
  }
  if (view === 'pre') {
    const sec = Math.ceil((m.startAt - now) / 1000);
    $('cover').hidden = false;
    if (M.preSec !== sec) { M.preSec = sec; $('coverN').innerHTML = `${Math.max(1, sec)}<small>Get ready…</small>`; sfx('tick'); }
    phase('countdown');
  }
  tickPlay();
}
function closeLockIfFrozen(view) { if (view !== 'build') { closeLock(); if (B) B.sel = null; } }
// opponents strip, timer and music intensity
function renderPlayHUD() {
  $('xtStat').hidden = !B.extra;
  const ns = $('namingStat'); ns.hidden = B.naming === 'off'; ns.innerHTML = `<small>Names</small>${B.naming === 'pick' ? 'Pick' : 'Build'}`;
  if (!M || B.mode !== 'multi') { $('opps').innerHTML = ''; $('opps').hidden = true; return; }
  const s = snap(), m = s.meta, d = s.data || {}, P = s.players, me = M.room.uid;
  const ids = Object.keys(m.roster || {}).filter(u => u !== me).sort((a, b) => ((P[a] && +P[a].joined) || 9e15) - ((P[b] && +P[b].joined) || 9e15));
  $('opps').hidden = !ids.length;
  $('opps').innerHTML = ids.map(u => {
    const here = P[u], p = here || M.names[u], pr = (d.progress || {})[u], out = d.out && d.out[u], res = (d.results || {})[u];
    const nm = (p && p.name) || (res && res.name) || 'Player';
    const left = pr ? pr.left : '?';
    return `<div class="opp${out ? ' out' : ''}">${sprite(p ? p.buddy : 'H', p ? p.hat : '', 30)}<span class="nm">${esc(nm)}<span class="lf">${left} left</span></span>` +
      (out ? '<span class="badge">Out</span>' : !here ? '<span class="badge gone">Left</span>' : '') + `</div>`;
  }).join('');
}
function tickPlay() {
  if (!B) return;
  if (B.mode === 'solo') { if (B.phase !== 'build') return; $('timeLeft').textContent = mmss(Date.now() - B.startAt); $('timeStat').classList.remove('low'); SND.intensity(1 - tilesLeft() / B.size); return; }
  const s = snap(); if (!s || !s.meta) return;
  const m = s.meta, d = s.data || {}, now = sNow(), left = m.startAt + CONFIG.ROUND_MS - now;
  $('timeLeft').textContent = mmss(Math.min(CONFIG.ROUND_MS, left));
  $('timeStat').classList.toggle('low', left < 60000);
  if (B.phase === 'build') {
    let minLeft = tilesLeft();
    Object.keys(d.progress || {}).forEach(u => { const p = d.progress[u]; if (p && !(d.out && d.out[u]) && p.left != null) minLeft = Math.min(minLeft, +p.left); });
    SND.intensity(Math.max(1 - minLeft / B.size, (now - m.startAt) / CONFIG.ROUND_MS));
  }
  if (B.phase === 'check' && d.done) {
    const bar = $('chkBar');
    if (bar) bar.style.width = Math.max(0, Math.min(100, (d.done.endsAt - now) / CONFIG.CHALLENGE_MS * 100)) + '%';
    const tl = $('chkLeft'); if (tl) tl.textContent = Math.max(0, Math.ceil((d.done.endsAt - now) / 1000)) + ' s';
    const rl = $('revLeft'), rs = Math.ceil((d.done.endsAt + CONFIG.REVEAL_MS - now) / 1000);
    if (rl) rl.textContent = rs > 0 ? (B.out || M.revOk ? '' : '(Back to building in ' + rs + ' s)') : '';
  }
}

// ================= CHALLENGE + REVEAL =================
function pname(u) {
  const s = snap(); if (!s) return 'Player';
  const p = s.players[u], r = (s.data.results || {})[u], c = M.names[u];
  return (p && p.name) || (r && r.name) || (c && c.name) || 'A player';
}
function renderCheck(update) {
  const s = snap(), m = s.meta, d = s.data || {}, done = d.done, me = M.room.uid, now = sNow();
  const el = $('checkArea'), chk = doneCheck(d, m);
  if (!chk) { el.innerHTML = '<p class="lead">Loading the compounds…</p>'; M.chkShown = ''; return; }
  const mine = done.uid === me, cn = mine ? 'You' : esc(pname(done.uid)), naming = (m.settings && m.settings.naming) || 'off';
  const n = done.n, fk = B.key + '|' + n, allFlags = (d.flags && d.flags[n]) || {};
  // flag buttons stay put while others flag (re-drawing them could swallow a tap)
  if (update && !mine && now < done.endsAt && M.chkShown === 'c' + fk) return;
  M.chkShown = (now < done.endsAt ? 'c' : 'r') + fk;
  if (!M.flags[fk]) M.flags[fk] = flagSet(allFlags[me]);
  const myF = M.flags[fk];
  const claim = g => `<div class="cl">${claimsHTML(g, naming)}</div>`;
  if (now < done.endsAt) {
    phase('challenge');
    const counts = chk.groups.map((g, i) => Object.keys(allFlags).filter(u => flagSet(allFlags[u]).has(i)).length);
    el.innerHTML = `<div class="chk-h"><h2>${mine ? 'Others are checking your compounds.' : cn + ' says Done!'}</h2><div class="stat"><small>Time</small><span id="chkLeft"></span></div></div>` +
      `<p style="margin:0">${mine ? 'Wait for the check.' : 'Is every compound right? Tap any that looks wrong.'}</p><div class="tbar"><i id="chkBar"></i></div>` +
      `<div class="cgroups">${chk.groups.map((g, i) => mine
        ? `<div class="cg"><div class="fm">${R.formulaHTML(g.ions)}</div>${claim(g)}<div class="fl">${counts[i] ? '⚑ ' + plural(counts[i], 'flag') : ''}</div></div>`
        : `<button class="cg" data-flag="${i}" aria-pressed="${myF.has(i)}"><div class="fm">${R.formulaHTML(g.ions)}</div>${claim(g)}<div class="fl">${myF.has(i) ? '⚑ Looks wrong' : 'Tap if wrong'}</div></button>`).join('')}</div>`;
  } else {
    phase('reveal');
    const res = chk.results, ok = chk.ok; M.revOk = ok;
    const flaggers = i => Object.keys(allFlags).filter(u => flagSet(allFlags[u]).has(i));
    el.innerHTML = `<div class="chk-h"><h2>${ok ? (mine ? 'All correct! You win!' : cn + ' got them all right!') : (mine ? 'You had a mistake.' : cn + ' had a mistake.')}</h2></div>` +
      `<p class="lead" style="margin-top:0">${ok ? 'The round is over.' : mine ? 'You’re out this round. Keep watching.' : cn + ' is out. Everyone else, keep going!'} <span class="note" id="revLeft"></span></p>` +
      `<div class="cgroups">${chk.groups.map((g, i) => {
        const r = res[i], f = flaggers(i), iF = myF.has(i);
        return `<div class="cg ${r.ok ? 'ok' : 'no'}"><div class="verd ${r.ok ? 'ok' : 'no'}">${r.ok ? '✓ Correct' : '✗ Wrong'}</div>` +
          `<div class="fm">${R.formulaHTML(g.ions)}</div>${claim(g)}` +
          (r.ok ? '' : `<ul class="why">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`) +
          (f.length ? `<div class="flaggers">⚑ Flagged by ${f.map(u => esc(u === me ? 'you' : pname(u))).join(', ')}</div>` : '') +
          (iF ? (r.ok ? `<div><span class="pts n">${MINUS}10</span> Your flag was wrong</div>` : `<div><span class="pts p">+15</span> You caught it!</div>`) : '') + `</div>`;
      }).join('')}</div>`;
    const k = 'r' + B.key + n;
    if (!M.seen[k]) {
      M.seen[k] = 1;
      if (mine) sfx(ok ? 'win' : 'rotten'); else sfx(ok ? 'bad' : 'good');
    }
  }
  tickPlay();
}
$('checkArea').addEventListener('click', e => {
  const b = e.target.closest('[data-flag]'); if (!b || !M) return;
  const d = snap().data || {}, done = d.done; if (!done || done.uid === M.room.uid || sNow() >= done.endsAt) return;
  const fk = B.key + '|' + done.n, i = +b.dataset.flag, f = M.flags[fk] || (M.flags[fk] = new Set());
  if (f.has(i)) f.delete(i); else f.add(i);
  sfx('flag');
  const o = {}; f.forEach(x => { o[x] = true; });
  M.room.set('flags/' + done.n + '/' + M.room.uid, f.size ? o : null).catch(() => {});
  b.setAttribute('aria-pressed', f.has(i)); b.querySelector('.fl').textContent = f.has(i) ? '⚑ Looks wrong' : 'Tap if wrong';
});

// ================= PERSONAL REVIEW + RESULTS =================
let RV = null;   // review of the current round
function computeReview() {
  const locked = B.groups.filter(g => g.locked), lg = locked.map(g => ({ ions: gIons(g), pos: g.pos, neg: g.neg, name: g.name }));
  const results = R.checkBoard(lg, { naming: B.naming }).results;
  let fr = 0, fw = 0, won = false, why = '', winner = null;
  if (B.mode === 'multi') {
    const s = snap(), d = s.data || {}, me = M.room.uid, over = d.over || {}, naming = (s.meta.settings && s.meta.settings.naming) || 'off';
    Object.keys(d.verdict || {}).forEach(n => {
      const v = d.verdict[n]; if (!v || v.uid === me) return;
      const bd = d.boards && d.boards[v.uid]; if (!bd) return;
      const res = R.checkBoard(arr(bd.groups).map(nGroup), { naming }).results;
      flagSet(d.flags && d.flags[n] && d.flags[n][me]).forEach(i => { if (res[i]) { if (res[i].ok) fw++; else fr++; } });
    });
    winner = over.winner || null; won = winner === me;
    why = over.why === 'win' ? (won ? 'You won the round!' : esc(pname(winner)) + ' won the round.') : over.why === 'time' ? 'Time is up.' : 'Everyone is out.';
  } else {
    won = results.length > 0 && results.every(r => r.ok);
    why = won ? 'Perfect board!' : 'Practice round done.';
  }
  const sc = R.scoreRound({ results, won, flagsRight: fr, flagsWrong: fw, extra: B.extra });
  if (B.mode === 'solo') {
    const t = Math.round(sc.total * CONFIG.PRACTICE_SCALE);
    if (t !== sc.total) sc.lines.push({ label: 'Practice ' + (CONFIG.PRACTICE_SCALE === 0.5 ? '×½' : '×' + CONFIG.PRACTICE_SCALE), pts: t - sc.total });
    sc.total = t;
  }
  return { key: B.key, mode: B.mode, results, locked, unlocked: B.groups.filter(g => !g.locked), tray: B.tray.slice(), won, why, sc,
    correct: results.filter(r => r.ok).length, missed: R.missedKeys(results, lg) };
}
function award(rv) {
  if (save.paid && save.paid[rv.key]) return;
  save.paid = save.paid || {}; save.paid[rv.key] = Date.now();
  const ks = Object.keys(save.paid); if (ks.length > 30) ks.sort((a, b) => save.paid[a] - save.paid[b]).slice(0, ks.length - 30).forEach(k => delete save.paid[k]);
  const st = save.stats; st.rounds++; if (rv.won && rv.mode === 'multi') st.wins++; st.locked += rv.results.length; st.correct += rv.correct;
  rv.missed.forEach(k => { save.missed[k] = (save.missed[k] || 0) + 1; });
  const mk = Object.keys(save.missed); if (mk.length > 40) mk.sort((a, b) => save.missed[a] - save.missed[b]).slice(0, mk.length - 40).forEach(k => delete save.missed[k]);
  if (rv.sc.total > 0) addCoins(rv.sc.total);
  persist(); if (who) { clearTimeout(syncT); syncT = setTimeout(() => flush(), 1500); }
}
function startReview() {
  RV = computeReview();
  award(RV);
  if (B.mode === 'multi') {
    M.reviewKey = B.key; M.reviewUntil = Date.now() + CONFIG.REVIEW_MS;
    M.room.set('results/' + M.room.uid, { name: myName(), pts: RV.sc.total, correct: RV.correct, locked: RV.results.length, won: RV.won }).catch(() => {});
    clearTimeout(M.revT); M.revT = setTimeout(() => { if (M) { M.reviewUntil = 0; route(true); } }, CONFIG.REVIEW_MS + 50);
  }
  phase(RV.won ? 'win' : 'review');
  if (RV.won && B.mode === 'solo') sfx('win');
  renderReview(); show('sReview');
}
function renderReview() {
  $('revWhy').innerHTML = RV.why;
  $('revGroups').innerHTML = RV.locked.map((g, i) => {
    const r = RV.results[i], ions = gIons(g);
    return `<div class="cg ${r.ok ? 'ok' : 'no'}"><div class="verd ${r.ok ? 'ok' : 'no'}">${r.ok ? '✓ Correct' : '✗ Wrong'}</div><div class="fm">${R.formulaHTML(ions)}</div>` +
      `<div class="cl">${claimsHTML(g, B.naming)}</div>` + (r.ok ? '' : `<ul class="why">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` + (r.truth.fix && r.truth.fix !== r.truth.formula ? `<div class="note" style="margin:0">Right formula: <b>${esc(r.truth.fix)}</b>${r.truth.name ? ' (' + esc(r.truth.name) + ')' : ''}</div>` : '')) + `</div>`;
  }).join('') + RV.unlocked.map(g => `<div class="cg"><div class="verd">Not locked</div><div class="fm">${R.formulaHTML(gIons(g))}</div><div class="note" style="margin:0">Lock a compound to earn ⚛ for it.</div></div>`).join('');
  $('revUnused').innerHTML = RV.tray.length ? 'Not used: ' + RV.tray.map(id => esc(R.ionText(B.tiles[id].k))).join(', ') : '';
  $('revTotal').textContent = RV.sc.total;
  $('revLines').innerHTML = RV.sc.lines.map(l => `<li><span>${esc(l.label)}</span><span>${l.pts > 0 ? '+' : l.pts < 0 ? MINUS : ''}${Math.abs(l.pts)}</span></li>`).join('');
  renderReviewSave();
  $('revBtns').innerHTML = RV.mode === 'multi' ? `<button class="btn big go" id="revCont" style="flex:1">Continue</button>`
    : `<button class="btn alt big" id="revHome" style="flex:1">Back</button><button class="btn big go" id="revAgain" style="flex:1">Practice again</button>`;
  if ($('revCont')) $('revCont').onclick = () => { if (M) { M.reviewUntil = 0; route(true); } };
  if ($('revAgain')) $('revAgain').onclick = startPractice;
  if ($('revHome')) $('revHome').onclick = () => { B = null; renderStart(); show('sStart'); };
}
function renderReviewSave() {
  $('revSave').textContent = RV ? (who ? (loginOn() ? 'Your ⚛ are saving to your class account.' : '') : 'Guest: your ⚛ are saved on this computer.') : '';
}
function renderResults() {
  show('sResults'); phase('review');
  const s = snap(), m = s.meta, d = s.data || {}, P = s.players, me = M.room.uid, over = d.over || {}, res = d.results || {};
  $('resWhy').innerHTML = over.why === 'win' ? `${esc(over.winner === me ? 'You' : pname(over.winner))} won the round!` : over.why === 'time' ? 'Time is up.' : 'Everyone is out.';
  const ids = [...new Set(Object.keys(m.roster || {}).concat(Object.keys(res)))];
  const rows = ids.map(u => ({ u, r: res[u], p: P[u] || M.names[u] })).sort((a, b) => ((b.r ? b.r.pts : -1) - (a.r ? a.r.pts : -1)));
  let rank = 0, prev = null;
  $('resList').innerHTML = rows.map((x, i) => {
    const pts = x.r ? x.r.pts : null; if (pts !== prev) { rank = i + 1; prev = pts; }
    const nm = (x.r && x.r.name) || (x.p && x.p.name) || 'Player';
    const sub = x.r ? `${x.r.correct} of ${x.r.locked} correct${x.r.won ? ' · 👑 Winner' : ''}${(d.out || {})[x.u] ? ' · Out' : ''}` : P[x.u] ? 'Still reviewing…' : 'Left the room';
    return `<li class="${x.r && x.r.won ? 'win' : ''}${x.u === me ? ' me' : ''}"><span class="rk">${pts == null ? '' : rank}</span>${sprite(x.p ? x.p.buddy : 'H', x.p ? x.p.hat : '', 38)}` +
      `<span class="nm">${esc(nm)}${x.u === me ? ' (you)' : ''}<small>${sub}</small></span><span class="pt">${pts == null ? '…' : '⚛ ' + pts}</span></li>`;
  }).join('');
  const host = M.room.isHost(), hid = playerOrder(P)[0];
  $('againBtn').hidden = false; $('againBtn').disabled = !host || Object.keys(P).length < 1;
  $('resNote').textContent = host ? 'Play again takes everyone back to the room.' : `Waiting for ${hid ? pname(hid) : 'the host'} to tap Play again.`;
}

// ================= PRACTICE ALONE =================
function startPractice() {
  if (M) return;
  const naming = NAMING.indexOf(prefs.naming) < minIdx() ? tset.minNaming : prefs.naming;
  const seed = Math.random().toString(36).slice(2, 12);
  B = newBoard({ key: 'solo|' + seed, mode: 'solo', seed, uid: 'me', sets: tset.sets, size: save.extra ? CONFIG.EXTRA_HAND : CONFIG.HAND_SIZE,
    missed: clone(save.missed || {}), naming, shapes: !!tset.shapes, extra: !!save.extra, startAt: Date.now() });
  B.phase = 'build';
  $('cover').hidden = true; $('buildArea').hidden = false; $('checkArea').hidden = true;
  $('timeStat').querySelector('small').textContent = 'Time';
  show('sPlay'); renderPlayHUD(); renderBoard(); phase('build');
}
function practiceDone() {
  B.phase = 'check'; sfx('done');
  const lg = B.groups.map(g => ({ ions: gIons(g), pos: g.pos, neg: g.neg, name: g.name }));
  const chk = R.checkBoard(lg, { naming: B.naming });
  phase('reveal'); setTimeout(() => sfx(chk.ok ? 'good' : 'bad'), 400);
  $('buildArea').hidden = true; $('checkArea').hidden = false;
  $('checkArea').innerHTML = `<div class="chk-h"><h2>${chk.ok ? 'All correct!' : 'Some compounds need a fix.'}</h2><button class="btn big go" id="pracCont">Continue</button></div>` +
    `<div class="cgroups">${lg.map((g, i) => { const r = chk.results[i]; return `<div class="cg ${r.ok ? 'ok' : 'no'}"><div class="verd ${r.ok ? 'ok' : 'no'}">${r.ok ? '✓ Correct' : '✗ Wrong'}</div>` +
      `<div class="fm">${R.formulaHTML(g.ions)}</div><div class="cl">${claimsHTML(g, B.naming)}</div>${r.ok ? '' : `<ul class="why">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`}</div>`; }).join('')}</div>`;
  $('pracCont').onclick = () => startReview();
  $('pracCont').focus();
}

// ================= ACCOUNTS (shared login, same pattern as iBond) =================
const NET = { on: loginOn() };
const call = (action, body = {}) => (GL ? GL.call(action, body, GAME_ID) : Promise.reject({ error: 'offline' }));
const errText = e => { const k = e && e.error; return k === 'bad_login' ? 'That username and number don\'t match. Check both, or ask your teacher.' :
  k === 'wait' ? 'Too many tries. Wait 10 minutes, or ask your teacher.' :
  k === 'bad_code' ? 'This link is missing the class code. Use the game link your teacher shared.' :
  k === 'busy' ? 'The class list is busy. Try again in a minute.' :
  k === 'bad_token' ? 'You were logged out. Log in again to keep your ⚛.' : 'Couldn’t reach the class list. Check the internet and try again.'; };
function summaryOf(sv) {
  const st = sv.stats || {}, l = +st.locked || 0, c = +st.correct || 0;
  return {
    'Rounds': String(+st.rounds || 0), 'Wins': String(+st.wins || 0),
    'Accuracy': l ? `${c} / ${l} (${Math.round(c / l * 100)}%)` : '',
    'Most missed': Object.entries(sv.missed || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${R.ion(k) ? R.ionText(k) : k} (${n})`).join(', '),
    'Extra time': sv.extra ? 'On' : ''
  };
}
let flushing = null;
async function flush() {
  clearTimeout(syncT);
  if (!who || !dirty || !NET.on) return;
  if (flushing) { await flushing; if (dirty) return flush(); return; }
  dirty = false;
  // points go up in numbered batches; a batch that may have arrived is resent with the same id, never re-counted
  if (!save.inflight) save.inflight = { sid: Math.random().toString(36).slice(2, 12), amt: save.pending || 0 };
  const sent = save.inflight.amt, mine = localKey();
  const data = JSON.parse(JSON.stringify(save)); ['pending', 'coins', 'inflight'].forEach(k => delete data[k]);
  const sid = save.inflight.sid;
  flushing = call('save', { sid, delta: sent, profile: { buddy: save.buddy, hat: save.hat }, data, summary: summaryOf(save) }).then(r => {
    if (localKey() !== mine) return;              // logged out while this was sending
    save.pending = Math.max(0, (save.pending || 0) - sent); save.inflight = null;
    save.coins = (+r.points || 0) + save.pending; // the sheet keeps the running total, shared by every game in the suite
    store.set(localKey(), save); coinsUI();
  }).catch(e => {
    if (e && e.error === 'bad_token') return;     // login ran out: points wait on this computer until they log in again
    dirty = true; syncT = setTimeout(() => flush(), 20000);
  }).finally(() => { flushing = null; });
  await flushing;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('online', () => { if (who && (save.pending || save.inflight)) { dirty = true; flush(); } });

let login = { step: 'form', err: '', user: '', id: '', pick: null };
function openLogin() { login = { step: 'form', err: '', user: '', id: '', pick: null }; renderLogin(); $('dLogin').showModal(); }
function renderLogin() {
  const Lb = $('loginBody'), st = login;
  if (st.step === 'form') {
    Lb.innerHTML = `<div class="dh"><h2 id="loginH">Log in</h2><button type="button" class="xbtn" id="lgX" aria-label="Close">✕</button></div>` +
      `<div class="field"><label for="lgUser">School username</label><input id="lgUser" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="64" aria-describedby="lgHint">` +
      `<span class="note" id="lgHint" style="margin:0">The first part of your school email, before the @</span></div>` +
      `<div class="field"><label for="lgId">Last 5 digits of your student number</label><div class="row" style="flex-wrap:nowrap"><input id="lgId" type="${st.show ? 'text' : 'password'}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="5" placeholder="•••••">` +
      `<button class="btn alt" id="lgShow" aria-pressed="${!!st.show}" style="flex:none">${st.show ? 'Hide' : 'Show'}</button></div></div>` +
      `<p class="err" id="lgErr" aria-live="polite">${esc(st.err)}</p>` +
      `<div class="dfoot"><button class="btn alt" id="lgCancel">Cancel</button><button class="btn" id="lgGo">Log in</button></div>` +
      `<p class="note" style="margin:0">Playing as a guest saves your ⚛ on this computer only.</p>`;
    const iu = $('lgUser'), ii = $('lgId');
    iu.value = st.user; ii.value = st.id; setTimeout(() => (st.user ? ii : iu).focus(), 0);
    iu.addEventListener('input', () => { st.user = iu.value; });
    ii.addEventListener('input', () => { ii.value = ii.value.replace(/\D/g, '').slice(0, 5); st.id = ii.value; });
    iu.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ii.focus(); } });
    ii.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } });
    $('lgShow').addEventListener('click', () => { st.show = !st.show; renderLogin(); setTimeout(() => $('lgId').focus(), 0); });
    $('lgGo').addEventListener('click', doLogin);
    $('lgX').onclick = $('lgCancel').onclick = () => $('dLogin').close();
    return;
  }
  if (st.step === 'carry') {
    Lb.innerHTML = `<div class="dh"><h2 id="loginH">Welcome, ${esc(st.pick.first)}!</h2></div><p style="margin:0">You have ${save.coins.toLocaleString()} ⚛ as a guest on this computer. Bring them into your account?</p>` +
      `<div class="dfoot"><button class="btn alt" id="lgFresh">Start fresh</button><button class="btn" id="lgBring">Bring them</button></div>`;
    $('lgBring').addEventListener('click', () => {
      const g = Object.assign(BLANK(), clone(save)); g.pending = g.coins;
      store.set(GUEST_KEY, Object.assign(BLANK(), { extra: save.extra, math: save.math }));
      finishLogin(st.pick, g);
    });
    $('lgFresh').addEventListener('click', () => finishLogin(st.pick, BLANK()));
  }
}
const lgErr = m => { login.err = m; const p = $('lgErr'); if (p) p.textContent = m; };
function merged(r, user) {
  const cached = loadLocal('ionagrams-stu-' + user);
  const remote = r.data ? Object.assign(BLANK(), r.data) : null;
  let sv = remote && (remote.updated || 0) >= (cached.updated || 0) ? remote : (cached.updated ? cached : remote);
  if (!sv) return null;
  sv.stats = Object.assign(BLANK().stats, sv.stats || {});
  sv.pending = cached.pending || 0; sv.inflight = cached.inflight || null;
  sv.coins = (r.profile ? +r.profile.points || 0 : 0) + sv.pending;
  if (r.profile) { if (r.profile.buddy) sv.buddy = r.profile.buddy; if (r.profile.hat != null) sv.hat = r.profile.hat; }
  return sv;
}
let loggingIn = false;
async function doLogin() {
  const user = GL.normUser(login.user), id = login.id;
  if (!user) { lgErr('Type your school username.'); $('lgUser').focus(); return; }
  if (!/^\d{5}$/.test(id)) { lgErr('Enter all 5 digits.'); $('lgId').focus(); return; }
  $('lgGo').disabled = true; lgErr('Checking…');
  let r;
  loggingIn = true;
  try { r = await GL.login(user, id, GAME_ID); } catch (e) { loggingIn = false; $('lgGo').disabled = false; lgErr(errText(e)); return; }
  loggingIn = false;
  const s = GL.session(), m = { user: s.user, first: s.first, init: s.init, period: s.period };
  const sv = merged(r, m.user);
  if (sv || (r.profile && +r.profile.points)) {
    finishLogin(m, sv || Object.assign(BLANK(), { coins: +r.profile.points || 0, buddy: r.profile.buddy || 'H', hat: r.profile.hat || '' }));
    return;
  }
  if (save.coins > 0) { login = { step: 'carry', pick: m }; renderLogin(); return; }
  finishLogin(m, BLANK());
}
function finishLogin(m, data) {
  who = { user: m.user, first: String(m.first), init: String(m.init || ''), period: String(m.period) };
  save = data; persist(); dirty = true; flush();
  if ($('dLogin').open) $('dLogin').close();
  tsetPer = null; renderStart(); toast(`Welcome, ${esc(who.first)}!`);
}
async function logout() {
  await flush();
  who = null; GL.logout();
  save = loadLocal(GUEST_KEY); tsetPer = null; renderStart(); toast('Logged out. Playing as guest.');
}
async function syncFromServer() {
  if (!who || !NET.on) return;
  const me = who.user;
  try {
    const r = await call('load');
    if (!who || who.user !== me) return;
    const sv = merged(r, me);
    if (sv) { save = sv; store.set(localKey(), save); }
    if (screen === 'sStart') renderStart(); else coinsUI();
    if (save.pending || save.inflight) { dirty = true; flush(); }
  } catch (e) {}
}
window.addEventListener('gibson-session', e => {
  if (loggingIn) return;
  const s = e.detail, nw = s ? { user: s.user, first: s.first, init: s.init, period: s.period } : null;
  if ((nw && nw.user) === (who && who.user)) return;
  const lost = !!who && !nw;
  store.set(localKey(), save);
  who = nw; save = loadLocal(localKey()); tsetPer = null;
  if (screen === 'sStart') renderStart(); else coinsUI();
  if (lost) toast('You were logged out. Log in again to keep your ⚛.');
  if (who) syncFromServer();
});

// ================= WIRING + BOOT =================
$('helpBtn').addEventListener('click', () => $('dHelp').showModal());
setInterval(() => {
  try {
    if (M) { hostTick(); route(false); }
    else if (B && B.mode === 'solo' && screen === 'sPlay') tickPlay();
  } catch (e) { console.error(e); }
}, 250);
renderStart(); applySound();
if (NET.on) setTimeout(syncFromServer, 0);
// came back after a reload in the middle of a room: rejoin it
(async () => {
  const r = store.get(ROOM_KEY);
  if (!r || !roomsOn() || !r.id) return;
  toast('Rejoining your room…');
  const ok = await joinRoom(r.period, r.id, true);
  if (!ok) toast('Your last room has ended.');
})();
// read-only hooks for automated tests
window.__ion = { get B() { return B; }, get M() { return M; }, get save() { return save; }, get RV() { return RV; }, CONFIG, flush };
})();
