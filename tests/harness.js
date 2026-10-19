// Shared Playwright harness for Ionagrams tests: static server, fakebase, routing, bot helpers.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const THEME = '/home/claude/theme', ROOT = path.join(__dirname, '..');
const { start: startFake } = require(path.join(THEME, 'tests/fakebase/server.js'));
const SHIM = fs.readFileSync(path.join(THEME, 'tests/fakebase/firebase-shim.js'), 'utf8');
const SHOTS = '/tmp/claude-0/-home-claude/8c860c6d-32b4-55fb-9dec-17e57cd2c305/scratchpad/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticServer() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); rsp.end(fs.readFileSync(p));
    });
    srv.listen(0, () => res(srv));
  });
}

// fake Apps Script back end (login/load/save) so the login + ⚛ save path runs
const backend = { points: {}, saves: [] };
function api(body) {
  const b = JSON.parse(body);
  if (b.action === 'login') {
    if (b.last5 !== '12345') return { error: 'bad_login' };
    return { token: 'tok-' + b.username, hours: 168, user: { first: 'Maria', init: 'G', period: '3' }, profile: { points: backend.points[b.username] || 0, buddy: 'Na', hat: '' }, data: null };
  }
  const user = String(b.token || '').replace('tok-', '');
  if (b.action === 'load') return { profile: { points: backend.points[user] || 0, buddy: 'Na', hat: '' }, data: null };
  if (b.action === 'save') { backend.saves.push(b); backend.points[user] = (backend.points[user] || 0) + (+b.delta || 0); return { points: backend.points[user], granted: +b.delta || 0 }; }
  return { error: 'server' };
}

async function setup(opts = {}) {
  const fake = await startFake(0), web = await staticServer();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const base = 'http://localhost:' + web.address().port + '/ionagrams/index.html';
  const players = [];
  async function player(name, o = {}) {
    const ctx = await browser.newContext({ viewport: o.viewport || { width: 1366, height: 650 }, colorScheme: o.dark ? 'dark' : 'light', hasTouch: !!o.touch });
    await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('app-compat') ? SHIM : '' }));
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
    if (o.blockTheme) await ctx.route('https://gibsonm1.github.io/theme/**', r => r.abort());
    else await ctx.route('https://gibsonm1.github.io/theme/**', r => {
      const f = path.join(THEME, new URL(r.request().url()).pathname.replace('/theme/', ''));
      r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') });
    });
    await ctx.route('https://script.google.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(api(r.request().postData() || '{}')) }));
    await ctx.addInitScript(([url, cfg]) => { window.FAKEBASE_URL = url; window.IONAGRAMS_CONFIG = cfg; }, ['ws://localhost:' + fake.port, opts.config || {}]);
    const page = await ctx.newPage();
    const p = { name, ctx, page, errors: [] };
    page.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
    page.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
    await page.goto(base);
    await page.waitForFunction(() => window.__ion, null, { polling: 100 });
    players.push(p);
    return p;
  }
  async function shot(p, name, sizes) {
    sizes = sizes || [null];
    for (const sz of sizes) {
      const vp = p.page.viewportSize();
      if (sz) await p.page.setViewportSize(sz);
      await sleep(250);
      const f = path.join(SHOTS, name + (sz ? '-' + sz.width : '') + '.png');
      await p.page.screenshot({ path: f });
      if (sz) await p.page.setViewportSize(vp);
    }
  }
  async function close() { await browser.close(); await fake.close(); web.close(); }
  return { fake, base, browser, player, players, shot, close, backend };
}

// ---------- bot helpers (drive the real interface) ----------
async function until(page, fn, arg, ms = 20000) { return page.waitForFunction(fn, arg, { polling: 100, timeout: ms }); }
// a full correct grouping of the current hand (brute force over IonRules.targets)
async function solution(page) {
  return page.evaluate(() => {
    const B = window.__ion.B, R = window.IonRules, T = R.targets(B.sets);
    const ids = Object.keys(B.tiles), byK = {};
    ids.forEach(id => { (byK[B.tiles[id].k] = byK[B.tiles[id].k] || []).push(id); });
    const cnt = {}; Object.keys(byK).forEach(k => { cnt[k] = byK[k].length; });
    const out = [];
    function rec() {
      const k = Object.keys(cnt).find(x => cnt[x] > 0); if (!k) return true;
      for (const t of T) {
        if (t.cat !== k && t.an !== k) continue;
        if ((cnt[t.cat] || 0) < t.a || (cnt[t.an] || 0) < t.b) continue;
        cnt[t.cat] -= t.a; cnt[t.an] -= t.b; out.push(t);
        if (rec()) return true;
        cnt[t.cat] += t.a; cnt[t.an] += t.b; out.pop();
      }
      return false;
    }
    if (!rec()) return null;
    const used = {};
    return out.map(t => {
      const take = (k, n) => { const a = []; for (let i = 0; i < n; i++) { a.push(byK[k][used[k] = (used[k] || 0)]); used[k]++; } return a; };
      const c = R.ion(t.cat).c, n = -R.ion(t.an).c;
      return { tiles: take(t.cat, t.a).concat(take(t.an, t.b)), pos: c * t.a, neg: n * t.b, name: R.correctName(Array(t.a).fill(t.cat).concat(Array(t.b).fill(t.an))) };
    });
  });
}
// build one compound from tile ids through taps (or drags), returns group id
async function buildGroup(page, tiles, useDrag) {
  const gidBefore = await page.evaluate(() => window.__ion.B.gid);
  const tap = sel => page.locator(sel).first().click();
  const drag = async (from, to) => {
    const a = await page.locator(from).first().boundingBox(), b = await page.locator(to).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 20, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
  };
  if (useDrag) await drag(`[data-tile="${tiles[0]}"]`, '[data-drop="new"]');
  else { await tap(`[data-tile="${tiles[0]}"]`); await tap('[data-drop="new"]'); }
  const gid = 'g' + (gidBefore + 1);
  for (const t of tiles.slice(1)) {
    if (useDrag) await drag(`[data-tile="${t}"]`, `.grp[data-drop="g:${gid}"] .fm`);
    else { await tap(`[data-tile="${t}"]`); await tap(`.addhere[data-drop="g:${gid}"]`); }
  }
  return gid;
}
async function lockGroup(page, gid, pos, neg, name, naming) {
  await page.locator(`[data-lock="${gid}"]`).click();
  await page.locator('#dLock[open]').waitFor();
  await page.fill('#in-pos', String(pos)); await page.fill('#in-neg', String(neg));
  if (naming === 'pick' && name) await page.locator('#lockName label.choice', { hasText: new RegExp('^\\s*' + name.replace(/[()]/g, '\\$&') + '\\s*$') }).click();
  if (naming === 'build' && name) {
    // tap word tiles in order to make the name
    const want = await page.evaluate(gid => { const B = window.__ion.B; const g = B.groups.find(x => x.id === gid); return window.IonRules.nameWords(g.tiles.map(id => B.tiles[id].k)); }, gid);
    for (const w of want) await page.locator('#lockName .words button:not(:disabled)', { hasText: new RegExp('^' + w.replace(/[()]/g, '\\$&') + '$') }).first().click();
  }
  await page.click('#lockGo');
  await page.locator('#dLock[open]').waitFor({ state: 'detached' }).catch(() => {});
  await until(page, g => !document.querySelector('#dLock').open && window.__ion.B.groups.find(x => x.id === g).locked, gid, 5000);
}
module.exports = { setup, solution, buildGroup, lockGroup, until, sleep, SHOTS };
