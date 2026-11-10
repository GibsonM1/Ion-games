// Opens iBond (index.html) in Playwright with theme files served locally and the Google back end stubbed (guest mode).
// open({viewport, reducedMotion, hook}) -> {browser, ctx, page, errors, close}. hook=true exposes internals as window.__szT
// (test copy only: the hook is added to the page source in memory, never to the file).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const ROOT = path.join(__dirname, '..');
const THEME = ['/home/claude/work/theme', '/home/claude/theme'].find(p => fs.existsSync(path.join(p, 'chembeats-v1.js')));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const HOOK = "window.__szT={get game(){return game},levelUp,showIntro,nextDrop,answer,nameOptions,formulaOptions,pickPair,win,miss,get iaGen(){return iaGen},start,newOrder,addToZone,supplyNeed,buildTick,renderBuild,renderTray,pools,mk,szX,boxNeed,szLim,szWrong,get save(){return save},SZ_CFG};\n";

function server(hook) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let u = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (u === '/') u = '/index.html';
      const p = path.join(ROOT, u);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      let body = fs.readFileSync(p);
      if (hook && u === '/index.html') { const s = body.toString(), i = s.indexOf('})();\n</script>\n'); body = s.slice(0, i) + HOOK + s.slice(i); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); rsp.end(body);
    });
    srv.listen(0, () => res(srv));
  });
}

async function open(o = {}) {
  const srv = await server(o.hook !== false);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1366, height: 650 }, reducedMotion: o.reducedMotion || 'no-preference', hasTouch: !!o.touch });
  await ctx.route('https://gibsonm1.github.io/theme/**', r => {
    const f = path.join(THEME, new URL(r.request().url()).pathname.replace('/theme/', ''));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ contentType: f.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(f, 'utf8') });
  });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
  await ctx.route('https://script.google.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.route(/firebase|gstatic\.com\/firebasejs/, r => r.abort());
  const page = await ctx.newPage(), errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:' + srv.address().port + '/index.html');
  await page.waitForSelector('[data-start="build-order-timed"]');
  return { browser, ctx, page, errors, close: async () => { await browser.close(); srv.close(); } };
}
module.exports = { open };
