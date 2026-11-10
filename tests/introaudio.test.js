// New-ion intro audio (iBond: SumZero, Charge Command, Name Drop).
// Bug: during a new-ion card the sound button did nothing, then the ion's name played 10–30 s later in the middle of play.
// Headless Chromium has no real voices, so speechSynthesis is replaced by a fake that acts like Chrome on a school network:
//  - voices load late (voiceschanged), and include an online voice ("Google US English") and a device voice
//  - an online voice needs a network round trip (REMOTE_MS) before the audio starts
//  - cancel() does not stop an online clip that is still downloading: it plays when it arrives (the suspected Chrome quirk)
//  - the engine can get stuck "paused": speak() then just waits in a queue until the engine wakes up
// The page clock is faked, so 35 s of play runs in moments. "Heard" = audio that played for more than 50 ms.
// Run: node tests/introaudio.test.js          (IA_ROOT=/path/to/other/checkout to run against another copy)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const ROOT = process.env.IA_ROOT || path.join(__dirname, '..');
const THEME = ['/home/claude/work/theme', '/home/claude/theme'].find(d => fs.existsSync(path.join(d, 'chembeats-v1.js')));
const SHOTS = process.env.IA_SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let fails = 0;
const ok = (c, n, info) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (!c && info !== undefined ? '  -> ' + JSON.stringify(info) : '')); if (!c) fails++; };

// test-only hook: reach the game's internals (same line on main and on the fix branch)
const HOOK = 'window.__ibond={T:{start,stop,goHome,levelUp,get game(){return game}},';
function server() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (rel === '/') rel = '/index.html';
      const p = path.join(ROOT, rel);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      let body = fs.readFileSync(p);
      if (rel === '/index.html') { const s = body.toString(); if (!s.includes('window.__ibond={')) throw new Error('hook line missing'); body = s.replace('window.__ibond={', HOOK); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); rsp.end(body);
    });
    srv.listen(0, () => res(srv));
  });
}

function fakeTTS(opts) {
  const M = window.__ttsModel = Object.assign({ REMOTE_MS: 12000, LOCAL_MS: 40, DUR: 700, VOICES_MS: 800, onlyRemote: false }, opts);
  const log = window.__ttsLog = [], now = () => performance.now(), L = {};
  let voices = [], queue = [], cur = null, uid = 0, paused = false; const playing = new Set();
  const V = (name, local) => ({ name, lang: 'en-US', localService: local, default: false, voiceURI: name });
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { // after the page clock is in place
    voices = M.onlyRemote ? [V('Google US English', false), V('Google UK English Female', false)] : [V('Google US English', false), V('Chrome OS US English', true), V('Chrome OS UK English', true)];
    (L.voiceschanged || []).forEach(f => f({ type: 'voiceschanged' })); if (ss.onvoiceschanged) ss.onvoiceschanged({ type: 'voiceschanged' });
  }, M.VOICES_MS));
  const fire = (u, type, extra) => { const f = u['on' + type]; if (f) try { f(Object.assign({ type, utterance: u }, extra || {})); } catch (e) { console.error(e); } };
  function begin(j) { j.state = 'play'; playing.add(j); log.push({ ev: j.u.volume === 0 ? 'start-silent' : 'start', id: j.id, text: j.u.text, t: now() }); fire(j.u, 'start'); if (j.state === 'play') j.timer = setTimeout(() => finish(j, 'end'), M.DUR); }
  function finish(j, how) {
    clearTimeout(j.timer); if (j.state === 'play') log.push({ ev: 'stop', id: j.id, how, t: now() });
    j.state = 'done'; playing.delete(j); if (cur === j) cur = null;
    fire(j.u, how === 'end' ? 'end' : 'error', how === 'end' ? {} : { error: 'interrupted' }); pump();
  }
  function pump() {
    if (paused || cur || !queue.length) return;
    const j = cur = queue.shift(), remote = j.u.voice ? !j.u.voice.localService : false;
    j.state = 'fetch'; j.remote = remote; j.timer = setTimeout(() => { if (cur === j) cur = null; begin(j); }, remote ? M.REMOTE_MS : M.LOCAL_MS);
  }
  const ss = {
    get paused() { return paused; }, get speaking() { return !!cur || playing.size > 0; }, get pending() { return queue.length > 0; },
    onvoiceschanged: null,
    getVoices() { return voices.slice(); },
    addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, removeEventListener() {},
    speak(u) { const j = { id: ++uid, u, state: 'queued' }; log.push({ ev: 'speak', id: j.id, text: u.text, voice: u.voice && u.voice.name, paused, t: now() }); queue.push(j); pump(); },
    cancel() {
      log.push({ ev: 'cancel', t: now() }); queue = [];
      [...playing].forEach(j => finish(j, 'cancel'));
      if (cur && cur.state === 'fetch') { const j = cur; cur = null; if (!j.remote) { clearTimeout(j.timer); j.state = 'done'; } /* online clip keeps downloading and plays later */ }
      pump();
    },
    pause() { paused = true; }, resume() { paused = false; pump(); }
  };
  window.__ttsCtl = { stick() { paused = true; }, unstick() { paused = false; pump(); } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => ss });
  window.SpeechSynthesisUtterance = function (text) { this.text = String(text); this.voice = null; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; };
  // spy on the beat-music volume (intro ducking)
  let cb; window.__vol = [];
  Object.defineProperty(window, 'ChemBeats', { configurable: true, get: () => cb, set(v) { cb = v; const sv = v.setVolume; v.setVolume = x => { window.__vol.push(x); return sv.call(v, x); }; } });
}

(async () => {
  const web = await server(), base = 'http://localhost:' + web.address().port + '/index.html';
  const browser = await chromium.launch();
  async function open(opts = {}, vp = { width: 1366, height: 650 }) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.route('https://gibsonm1.github.io/theme/**', r => {
      const f = path.join(THEME, new URL(r.request().url()).pathname.replace('/theme/', ''));
      if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      r.fulfill({ contentType: f.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(f, 'utf8') });
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/script\.google\.com|firebase|gstatic\.com\/firebasejs/, r => r.abort());
    await ctx.addInitScript(fakeTTS, opts.tts || {});
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.clock.install();
    await page.goto(base);
    await page.clock.runFor(1500);
    await page.waitForFunction(() => window.__ibond && window.__ibond.T);
    const run = ms => page.clock.runFor(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const center = async sel => ev(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    const tap = async sel => { const c = await center(sel); await page.mouse.click(c.x, c.y); };
    const now = () => ev(() => performance.now());
    const muted = () => ev(() => window.__ibond.getSave().muted);
    const introOpen = () => ev(() => !document.getElementById('intro').hidden);
    // audio heard (played > 50 ms) that started at or after time t (optionally before t2)
    const heard = (t, t2 = 1e12) => ev(([t, t2]) => {
      const L = window.__ttsLog, out = [];
      L.filter(e => e.ev === 'start' && e.t >= t && e.t < t2).forEach(s => {
        const st = L.find(e => e.ev === 'stop' && e.id === s.id), len = (st ? st.t : performance.now()) - s.t;
        if (len > 50) out.push({ text: s.text, at: Math.round(s.t), ms: Math.round(len) });
      });
      return out;
    }, [t, t2]);
    const playingNow = () => ev(() => { const L = window.__ttsLog; return L.filter(e => e.ev === 'start' && !L.some(x => x.ev === 'stop' && x.id === e.id)).map(e => e.text); });
    const vol = () => ev(() => window.__vol[window.__vol.length - 1]);
    async function openIntro(mode) {
      await ev(m => window.__ibond.T.start(m), mode); await run(300);
      for (let i = 0; i < 14; i++) {
        const st = await ev(() => ({ open: !document.getElementById('intro').hidden, spk: !document.getElementById('introSpk').hidden }));
        if (st.open && st.spk) break;
        if (st.open) await ev(() => document.getElementById('introGo').click()); else await ev(() => window.__ibond.T.levelUp());
        await run(100);
      }
      const name = await ev(() => document.getElementById('introName').textContent);
      return name;
    }
    return { ctx, page, errors, run, ev, tap, now, muted, introOpen, heard, playingNow, vol, openIntro, center };
  }

  try {
    // ---------- A: SumZero. Name read while the card is open; speaker and top-bar sound button work; close with Got it ----------
    {
      const P = await open();
      const name = await P.openIntro('build-free-practice');
      ok(await P.introOpen() && name, 'A: SumZero shows a new-ion card (' + name + ')');
      const t0 = await P.now(); await P.run(1600);
      ok((await P.heard(t0)).length > 0, 'A: the name is heard while its card is open (auto read)', await P.ev(() => window.__ttsLog));
      if (SHOTS) for (const vp of [{ width: 1366, height: 650 }, { width: 390, height: 844 }]) { await P.page.setViewportSize(vp); await P.run(300); await P.page.screenshot({ path: path.join(SHOTS, 'intro-' + vp.width + '.png') }); }
      await P.page.setViewportSize({ width: 1366, height: 650 }); await P.run(200);
      const t1 = await P.now(); await P.tap('#introSpk'); await P.run(400);
      ok((await P.heard(t1)).length > 0, 'A: tapping the card speaker is heard right away');
      // top-bar sound button, clicked with the mouse while the card is open
      const hit = await P.ev(() => { const b = document.getElementById('muteBtn').getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e && e.id; });
      ok(hit === 'muteBtn', 'A: the top-bar sound button is not covered by the card backdrop', hit);
      const hitM = await P.ev(() => { const b = document.getElementById('musicBtn').getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e && e.id; });
      ok(hitM === 'musicBtn', 'A: the top-bar music button is not covered either', hitM);
      await P.tap('#introSpk'); await P.run(80);
      const before = await P.muted(); await P.tap('#muteBtn'); await P.run(30);
      ok((await P.muted()) === !before, 'A: clicking the sound button during the card turns sound off');
      ok((await P.playingNow()).length === 0, 'A: turning sound off stops the voice at once', await P.playingNow());
      const tm = await P.now(); await P.run(1500);
      ok((await P.heard(tm)).length === 0, 'A: no voice while sound is off', await P.heard(tm));
      await P.tap('#muteBtn'); await P.run(30);
      ok((await P.muted()) === false, 'A: clicking again turns sound back on');
      await P.tap('#introGo'); await P.run(20);
      const tc = await P.now();
      ok(!(await P.introOpen()) && (await P.ev(() => !window.__ibond.T.game.paused)), 'A: Got it closes the card and the game goes on');
      ok(Math.abs((await P.vol()) - 0.1) < 1e-9, 'A: music volume is back to normal after the card', await P.vol());
      await P.run(35000);
      ok((await P.heard(tc)).length === 0, 'A: no voice in the 35 s of play after the card closed', await P.heard(tc));
      ok(P.errors.length === 0, 'A: no console errors', P.errors);
      if (process.env.IA_DEBUG) console.log(JSON.stringify(await P.ev(() => window.__ttsLog.map(e => Object.assign({}, e, { t: Math.round(e.t) })))));
      await P.ctx.close();
    }
    // ---------- B: Charge Command. Keyboard only: reach the sound button, then Escape closes the card ----------
    {
      const P = await open();
      const name = await P.openIntro('cmd-play-practice');
      ok(await P.introOpen(), 'B: Charge Command shows a new-ion card (' + name + ')');
      await P.run(1000);
      await P.ev(() => document.getElementById('introGo').focus());
      const seen = [];
      for (let i = 0; i < 4; i++) { await P.page.keyboard.press('Shift+Tab'); seen.push(await P.ev(() => document.activeElement && document.activeElement.id)); if (seen[i] === 'muteBtn') break; }
      ok(seen.includes('muteBtn'), 'B: Shift+Tab from Got it reaches the sound button within 4 presses', seen);
      if (seen.includes('muteBtn')) {
        await P.page.keyboard.press('Enter'); await P.run(30);
        ok(await P.muted(), 'B: Enter on the sound button turns sound off');
        await P.page.keyboard.press('Enter'); await P.run(30);
      }
      await P.page.keyboard.press('Escape'); await P.run(20);
      const tc = await P.now();
      ok(!(await P.introOpen()), 'B: Escape closes the card (even with focus on the sound button)');
      await P.run(35000);
      ok((await P.heard(tc)).length === 0, 'B: no voice in the 35 s of play after the card closed', await P.heard(tc));
      ok(P.errors.length === 0, 'B: no console errors', P.errors);
      await P.ctx.close();
    }
    // ---------- C: only online voices (slow network). Close with Enter on Got it; the late clip must not be heard ----------
    {
      const P = await open({ tts: { onlyRemote: true } });
      await P.openIntro('build-free-practice'); await P.run(1000);
      await P.tap('#introSpk'); await P.run(500);
      await P.ev(() => document.getElementById('introGo').focus()); await P.page.keyboard.press('Enter'); await P.run(20);
      const tc = await P.now();
      ok(!(await P.introOpen()), 'C: Enter on Got it closes the card');
      await P.run(35000);
      ok((await P.heard(tc)).length === 0, 'C: online-only voices: no late name in 35 s of play', await P.heard(tc));
      ok(Math.abs((await P.vol()) - 0.1) < 1e-9, 'C: music volume restored', await P.vol());
      await P.ctx.close();
    }
    // ---------- D: speech engine stuck "paused". The speaker still works; nothing leaks out when the engine wakes later ----------
    {
      const P = await open();
      await P.run(1000); await P.ev(() => window.__ttsCtl.stick());
      await P.openIntro('cmd-play-practice'); await P.run(800);
      const t1 = await P.now(); await P.tap('#introSpk'); await P.run(400);
      ok((await P.heard(t1)).length > 0, 'D: stuck engine: the card speaker is still heard');
      await P.tap('#introGo'); await P.run(20);
      const tc = await P.now();
      await P.run(5000); await P.ev(() => window.__ttsCtl.unstick()); await P.run(30000);
      ok((await P.heard(tc)).length === 0, 'D: no voice after close, even when the engine wakes up later', await P.heard(tc));
      await P.ctx.close();
    }
    // ---------- E: the game stops while a card is open (Home / log out / new game). Speech stops, music volume comes back ----------
    {
      const P = await open();
      await P.openIntro('build-free-practice'); await P.run(300);
      await P.ev(() => window.__ibond.T.goHome()); await P.run(20);
      const tc = await P.now();
      ok(!(await P.introOpen()), 'E: stopping the game hides the card');
      ok(Math.abs((await P.vol()) - 0.1) < 1e-9, 'E: music volume restored when the game stops during a card', await P.vol());
      await P.ev(() => window.__ibond.T.start('cmd-play-practice')); await P.run(35000);
      ok((await P.heard(tc)).length === 0, 'E: no voice after the game stopped', await P.heard(tc));
      await P.ctx.close();
    }
    // ---------- F: sound off before the card: no automatic voice; a tap on the card speaker still reads it ----------
    {
      const P = await open();
      await P.tap('#muteBtn'); await P.run(30);
      ok(await P.muted(), 'F: sound turned off on the home screen');
      const t0 = await P.now();
      await P.openIntro('build-free-practice'); await P.run(1500);
      ok((await P.ev(t => window.__ttsLog.filter(e => e.ev === 'speak' && e.t >= t).length, t0)) === 0, 'F: sound off: the card does not read the name by itself');
      const t1 = await P.now(); await P.tap('#introSpk'); await P.run(400);
      ok((await P.heard(t1)).length > 0, 'F: sound off: tapping the speaker still reads the name (the student asked for it)');
      await P.tap('#introGo'); await P.run(35000);
      await P.ctx.close();
    }
    // ---------- G: Name Drop "Say my name" (practice): tapping the card reads it; leaving stops it ----------
    {
      const P = await open();
      await P.ev(() => window.__ibond.T.start('drop-say-practice')); await P.run(1500);
      const t1 = await P.now(); await P.tap('#dropCard'); await P.run(300);
      ok((await P.heard(t1)).length > 0, 'G: Say my name: tapping the card reads the name');
      await P.tap('#dropCard'); await P.run(60);
      await P.ev(() => window.__ibond.T.goHome()); await P.run(20);
      const tc = await P.now(); ok((await P.playingNow()).length === 0, 'G: leaving the game stops the voice');
      await P.run(20000);
      ok((await P.heard(tc)).length === 0, 'G: no voice after leaving', await P.heard(tc));
      ok(P.errors.length === 0, 'G: no console errors', P.errors);
      await P.ctx.close();
    }
  } catch (e) { console.log('FAIL crashed: ' + (e.stack || e)); fails++; }
  await browser.close(); web.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
