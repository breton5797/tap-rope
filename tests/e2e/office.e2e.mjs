// Office (칼퇴근 대작전) end-to-end QA against the real builds, served the way GitHub Pages does:
// dist/ at /tap-rope/ (v8) and dist/office/ at /tap-rope/office/ on the SAME origin (shared localStorage,
// both service workers). supabase.co is blocked and every attempt is counted (must be 0 for the office).
//
// Usage (from the worktree, after `npm run build && npm run build:office`):
//   node tests/e2e/office.e2e.mjs [all|sw|campaign|reload|retry|ipad|flake|audio|heroes] [DIST]
// `playwright` is not a repo dependency and ESM ignores NODE_PATH: install it next to the repo first
// (`npm i --no-save playwright && npx playwright install chromium`).
// DIST defaults to <cwd>/dist. Screenshots: $E2E_SHOTS (default <tmp>/office-e2e-shots/). Exit code 1 on any failed check.
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const which = process.argv[2] ?? 'all';
/** set by the audio section when the build ships no sfx files (synth-only dry run) */
let SFX_ABSENT = false;
const DIST = process.argv[3] ?? join(process.cwd(), 'dist');
/** screenshots: $E2E_SHOTS, else <tmp>/office-e2e-shots/ */
const OUT = `${process.env.E2E_SHOTS ?? join(tmpdir(), 'office-e2e-shots')}/`;
await mkdir(OUT, { recursive: true });
const PORT = Number(process.env.PORT ?? 5391);
const V8 = `http://localhost:${PORT}/tap-rope/`;
const OFFICE = `${V8}office/`;
const OFFICE_KEY = 'officeescape.save.v2';
const V8_KEY = 'laserescape.save.v2';
const PHONE = { width: 390, height: 844 };
const IPAD = { width: 1024, height: 1366 };
const RESULT = /퇴근 성공|야근 확정|CLOCK OUT|OVERTIME/;

// ---------- static server (Pages layout) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, V8).pathname);
  if (!path.startsWith('/tap-rope/')) { res.writeHead(404).end(); return; }
  let file = normalize(join(DIST, path.slice('/tap-rope/'.length)));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((ok) => server.listen(PORT, ok));

// ---------- harness ----------
const browser = await chromium.launch();
const errors = [];
/** URLs the game asked for that the build does not ship (art / cutscene stills / portraits) */
const missing = new Set();
const failures = [];
let supabaseHits = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

async function newContext(viewport = PHONE) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'allow' });
  await ctx.route(/supabase\.co/, (r) => { supabaseHits += 1; return r.abort(); });
  // quiet runs: sound off from the first frame of a fresh save is not possible, so mute WebAudio instead
  await ctx.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  // v2 missions: record every mission card / stamp that appears, and every chip change, with its time
  await ctx.addInitScript(() => {
    window.__mission = { cards: [], stamps: [], chips: [] };
    const seen = new WeakSet();
    const scan = () => {
      for (const el of document.querySelectorAll('.mission-card, .mission-stamp')) {
        if (seen.has(el)) continue;
        seen.add(el);
        const list = el.classList.contains('mission-card') ? window.__mission.cards : window.__mission.stamps;
        list.push({ t: performance.now(), text: el.textContent ?? '', ok: el.classList.contains('is-ok') });
      }
      const chip = document.querySelector('.mission-chip');
      if (chip) {
        const text = `${chip.dataset.kind}|${chip.querySelector('.mission-chip__count')?.textContent ?? ''}`;
        const last = window.__mission.chips.at(-1);
        if (!last || last.text !== text) window.__mission.chips.push({ t: performance.now(), text, done: chip.querySelectorAll('.pip.is-ok, .pip.is-miss').length });
      }
    };
    setInterval(scan, 50);
  });
  return ctx;
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page CRASHED'));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() === 404 && !(SFX_ABSENT && r.url().includes('/sfx/'))) missing.add(new URL(r.url()).pathname); });
  return page;
}
const click = (loc) => loc.first().click({ force: true });
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` });
const screenName = (page) => page.evaluate(() => document.querySelector('.layer--screen')?.dataset.screen ?? null);
const waitScreen = (page, name, timeout = 15000) =>
  page.waitForFunction((n) => document.querySelector('.layer--screen')?.dataset.screen === n, name, { timeout });
const readSave = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
const waitTitle = (page) => waitScreen(page, 'title', 20000);

/** skips every cutscene that shows up within `ms` (returns how many it skipped) */
async function skipCutscenes(page, ms = 4000, tag = '') {
  let skipped = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const skip = page.getByRole('button', { name: /컷신 건너뛰기/ });
    if (await skip.count()) {
      if (tag && skipped === 0) {
        await page.waitForTimeout(1600); // past the dissolve-in and the first caption
        await shot(page, `${tag}-cut`);
      }
      await page.waitForTimeout(600);
      // the button is rebuilt per shot and gone after the last one: a missed click just loops again
      if (await skip.first().click({ force: true, timeout: 2000 }).then(() => true, () => false)) skipped += 1;
      await page.waitForTimeout(400);
    } else await page.waitForTimeout(250);
  }
  return skipped;
}

/** stage n (1..5) from the title: 퇴근 시작! → chapter tab n → its stage node */
async function openStage(page, n) {
  await click(page.getByRole('button', { name: /퇴근 시작/ }));
  await waitScreen(page, 'stages');
  // the floor map shows every stage at once; older builds had one chapter tab per stage
  const tabs = page.locator('.chaps [role=tab]');
  if (await tabs.count()) {
    await click(tabs.nth(n - 1));
    await page.waitForTimeout(300);
  }
  await click(page.getByRole('button', { name: new RegExp(`^퇴근길 ${n}단계 `) }));
}

/** plays the running stage to its result (autoplay), shooting mid-run frames */
async function playToResult(page, tag, viewportTag = 'phone') {
  await skipCutscenes(page, 3500, `${tag}-${viewportTag}`);
  await page.waitForTimeout(9000);
  await shot(page, `${tag}-${viewportTag}-early`);
  await page.waitForTimeout(12000);
  await shot(page, `${tag}-${viewportTag}-mid`);
  await page.getByText(RESULT).first().waitFor({ timeout: 240000 });
  await page.waitForTimeout(1500);
  await skipCutscenes(page, 1500, `${tag}-${viewportTag}-after`);
  await page.getByText(RESULT).first().waitFor({ timeout: 30000 });
  await shot(page, `${tag}-${viewportTag}-result`);
  return (await page.locator('#ui').innerText()).replace(/\s+/g, ' ').slice(0, 160);
}

/** spec §3.2: mission kinds and superiors per stage (cards must name the section's superior) */
const KINDS = [['dodge', 'collect', 'finale'], ['collect', 'dodge', 'finale'], ['chase', 'dodge', 'finale'], ['dodge', 'collect', 'finale'], ['finale', 'chase', 'finale']];
const SUPERIORS = [['김대리'], ['박과장'], ['최팀장'], ['오부장'], ['한전무', '윤이사', '사장님']];
const botStamps = { dodge: [0, 0], chase: [0, 0], finale: [0, 0], collect: [0, 0] }; // [earned, total]
const resetMission = (page) => page.evaluate(() => { window.__mission = { cards: [], stamps: [], chips: [] }; });

/** the mission checks for one played stage (n = 1..5), its result card already up */
async function checkMissions(page, n, tag) {
  const m = await page.evaluate(() => window.__mission);
  const cards = m.cards.map((c) => c.text);
  check(cards.length === 3, `${tag} stage ${n}: 3 mission cards (${cards.length})`);
  const want = SUPERIORS[n - 1];
  const named = cards.every((c, k) => c.includes(want[Math.min(k, want.length - 1)]));
  check(named, `${tag} stage ${n}: cards name ${want.join('/')} — ${cards.map((c) => c.slice(0, 40)).join(' | ')}`);
  check(m.stamps.length === 3 && m.stamps.every((x) => /미션 완료!|다음 기회에/.test(x.text)), `${tag} stage ${n}: a stamp at each door + the end (${m.stamps.map((x) => (x.ok ? 'OK' : 'miss')).join(',')})`);
  const dodgeK = KINDS[n - 1].indexOf('dodge');
  if (dodgeK >= 0) {
    const counts = m.chips.filter((c) => c.text.startsWith('dodge|') && c.done === dodgeK).map((c) => Number(c.text.split('|')[1].split('/')[0]));
    check(counts.length > 2 && counts.at(-1) > counts[0], `${tag} stage ${n}: dodge chip counts up (${counts[0]}→${counts.at(-1)})`);
  }
  const slots = await page.locator('.report__stamp').count();
  const grade = (await page.locator('.report__grade b').textContent())?.trim();
  check(slots === 3 && /^[SABC]$/.test(grade ?? ''), `${tag} stage ${n}: result shows 3 stamps + grade ${grade}`);
  const ok = await page.locator('.report__stamp').evaluateAll((els) => els.map((e) => e.classList.contains('is-ok')));
  KINDS[n - 1].forEach((kind, k) => { botStamps[kind][1] += 1; if (ok[k]) botStamps[kind][0] += 1; });
}

const allStars = Object.fromEntries(['w1-s10', 'w2-s10', 'w3-s10', 'w4-s10', 'w5-s10'].map((id) => [id, 1]));
const officeSave = (extra = {}) => JSON.stringify({
  version: 2, stars: {}, bestScores: {}, coins: 0, ownedSkins: ['kid', 'cat'], skin: 'cat', tutorialDone: true, briefed: [0, 1, 2, 3, 4],
  controlsSeen: true, seenCutscenes: [], achievements: {}, dailyStreak: { last: null, count: 0 },
  settings: { sound: false, music: false, vibration: false, reducedMotion: false }, cosmetics: { owned: [], tint: {}, trail: null, ring: null, frame: null },
  tutorialSteps: ['jump', 'slide', 'lane'], ...extra,
});

// ---------- 1. v8 first, then the office on the same origin: workers and saves stay apart ----------
// ---------- 2. fresh office save: picker → 정시원 → controls → op-start → stages 1–5 → ending ----------
// (one context: the v8 worker is installed before the office is ever opened, like a returning v8 player)
if (['all', 'sw', 'campaign'].includes(which)) {
  const ctx = await newContext();
  const page = await newPage(ctx);
  await page.goto(V8);
  await waitTitle(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the v8 worker
  await waitTitle(page);
  const v8Ctl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null);
  check(v8Ctl?.endsWith('/tap-rope/sw.js') === true, `v8 page controlled by the v8 worker (${v8Ctl})`);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ marker: 'v8-save-untouched' })), V8_KEY);
  await shot(page, '00-v8-title');

  await page.goto(`${OFFICE}?autoplay=1`);
  await waitTitle(page);
  check((await page.title()) === '칼퇴근 대작전', 'office document title');
  check(/퇴근 시작/.test(await page.locator('#ui').innerText()), 'office title menu (퇴근 시작!) — not the v8 shell');
  const reg = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  check(reg.endsWith('/tap-rope/office/'), `office worker registered for its own scope (${reg})`);
  const caches = await page.evaluate(() => caches.keys());
  check(caches.some((k) => k.startsWith('office-escape-')) && caches.some((k) => k.startsWith('tap-rope-')), `both caches kept (${caches.join(', ')})`);
  await shot(page, '01-office-title');

  if (which !== 'sw') {
    await openStage(page, 1);
    await waitScreen(page, 'picker');
    check(true, 'picker shows on the first run of a fresh save');
    await page.waitForTimeout(900); // the card's pop-in
    await shot(page, '02-picker');
    await click(page.locator('.picker__pick', { hasText: '정시원' }));
    await click(page.locator('.picker__confirm')); // v2.2: a tap selects, the button hires
    await waitScreen(page, 'controls');
    await click(page.getByRole('button', { name: /^확인/ }));
    const ops = await skipCutscenes(page, 5000, '03-op-start');
    check(ops >= 1, `opening cutscene(s) played after the picker (${ops})`);
    const saved = await readSave(page, OFFICE_KEY);
    check(saved?.skin === 'cat', `choice persisted in ${OFFICE_KEY} (skin=${saved?.skin})`);
    for (let n = 1; n <= 5; n += 1) {
      if (n > 1) await resetMission(page);
      const txt = await playToResult(page, `s${n}`);
      await checkMissions(page, n, 'phone');
      console.log(`stage ${n}:`, txt);
      check(/퇴근 성공|CLOCK OUT/.test(txt), `stage ${n} cleared by autoplay`);
      if (n < 5) await click(page.getByRole('button', { name: /다음 층으로/ }));
    }
    check(/18:00:00/.test(await page.locator('#ui').innerText()), 'stage 5 result reads 칼퇴 성공! 18:00:00');
  }
  const v8Save = await page.evaluate((k) => localStorage.getItem(k), V8_KEY);
  check(v8Save === JSON.stringify({ marker: 'v8-save-untouched' }), 'v8 save untouched by the office');
  await ctx.close();
}

// ---------- 3. reload keeps the character ----------
if (['all', 'reload'].includes(which)) {
  {
    const ctx = await newContext();
    await ctx.addInitScript(([k, d]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, d); }, [OFFICE_KEY, officeSave({ stars: { 'w1-s10': 2 } })]);
    await ctx.addInitScript(() => { if (!localStorage.getItem('officeescape.stamps.v1')) localStorage.setItem('officeescape.stamps.v1', JSON.stringify({ 'w1-s10': [true, false, true] })); });
    const page = await newPage(ctx);
    await page.goto(OFFICE);
    await waitTitle(page);
    const dots = async () => {
      await click(page.getByRole('button', { name: /퇴근 시작/ }));
      await waitScreen(page, 'stages');
      return page.locator('.floors__node').first().locator('.stamp-dot').evaluateAll((els) => els.map((e) => e.classList.contains('is-ok')));
    };
    const before = await dots();
    await shot(page, '11-map-stamps');
    await page.reload();
    await waitTitle(page);
    const after = await dots();
    check(JSON.stringify(before) === '[true,false,true]' && JSON.stringify(after) === JSON.stringify(before), `map stamp dots survive a reload (${JSON.stringify(after)})`);
    await ctx.close();
  }
  const ctx = await newContext();
  await ctx.addInitScript(([k, d]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, d); }, [OFFICE_KEY, officeSave({ skin: 'kid' })]);
  const page = await newPage(ctx);
  await page.goto(OFFICE);
  await waitTitle(page);
  await click(page.getByRole('button', { name: /사원 선택/ }));
  await waitScreen(page, 'shop');
  await click(page.getByRole('button', { name: /정시원 선택/ }));
  await page.waitForTimeout(400);
  await page.reload();
  await waitTitle(page);
  check((await readSave(page, OFFICE_KEY))?.skin === 'cat', 'character survives a reload');
  await click(page.getByRole('button', { name: /사원 선택/ }));
  await waitScreen(page, 'shop');
  await shot(page, '10-character-room');
  check(/정시원/.test(await page.locator('.shop__name').innerText()), 'character room shows 정시원 on duty');
  await ctx.close();
}

// ---------- 4. fail stage 3 once (no input), retry: fresh run, clock back to the stage start ----------
if (['all', 'retry'].includes(which)) {
  const ctx = await newContext();
  await ctx.addInitScript(([k, d]) => localStorage.setItem(k, d), [OFFICE_KEY, officeSave({ stars: { 'w1-s10': 1, 'w2-s10': 1 }, seenCutscenes: ['op-start', 'boss-1', 'boss-2', 'boss-3'] })]);
  const page = await newPage(ctx);
  await page.goto(OFFICE);
  await waitTitle(page);
  await openStage(page, 3);
  await skipCutscenes(page, 2500);
  await page.waitForTimeout(4500);
  await shot(page, '20-stage3-start-clock');
  await page.getByText(/야근 확정|OVERTIME/).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(800);
  await shot(page, '21-fail-stamp');
  check(/내일은 꼭/.test(await page.locator('#ui').innerText()), 'fail card offers 내일은 꼭…!');
  await click(page.getByRole('button', { name: /내일은 꼭/ }));
  await page.waitForTimeout(4200); // short countdown, then the run starts again
  await shot(page, '22-retry-clock');
  check(await page.locator('.hud').isVisible(), 'retry starts a new run (HUD up)');
  const chipAfter = await page.evaluate(() => ({
    count: document.querySelector('.mission-chip__count')?.textContent ?? '',
    done: document.querySelectorAll('.mission-chip .pip.is-ok, .mission-chip .pip.is-miss').length,
  }));
  check(chipAfter.done === 0 && /^[01]\/|따돌리는/.test(chipAfter.count), `retry resets the mission chip and stamps (${chipAfter.count}, ${chipAfter.done} stamped)`);
  console.log('visual check: 20-stage3-start-clock.png and 22-retry-clock.png must both show 17:42');
  await ctx.close();
}

// ---------- 5. iPad: every stage mid-run + the stage 5 result ----------
if (['all', 'ipad'].includes(which)) {
  for (let n = 1; n <= 5; n += 1) {
    const ctx = await newContext(IPAD);
    const stars = Object.fromEntries(Object.entries(allStars).slice(0, n - 1));
    await ctx.addInitScript(([k, d]) => localStorage.setItem(k, d), [OFFICE_KEY, officeSave({ stars })]);
    const page = await newPage(ctx);
    await page.goto(`${OFFICE}?autoplay=1`);
    await waitTitle(page);
    await openStage(page, n);
    const txt = await playToResult(page, `s${n}`, 'ipad');
    await checkMissions(page, n, 'iPad');
    check(/퇴근 성공|CLOCK OUT/.test(txt), `iPad stage ${n} cleared by autoplay`);
    await ctx.close();
  }
}

// ---------- 6. picker auto-advance flake hunt: 10 fresh saves, no click after the picker opens ----------
if (['all', 'flake'].includes(which)) {
  let advanced = 0;
  for (let i = 0; i < 10; i += 1) {
    const ctx = await newContext();
    const page = await newPage(ctx);
    await page.goto(OFFICE);
    await waitTitle(page);
    await page.evaluate(() => {
      window.__events = [];
      for (const t of ['click', 'pointerdown', 'pointerup', 'keydown', 'blur', 'pagehide', 'visibilitychange']) {
        window.addEventListener(t, (e) => window.__events.push(`${Math.round(performance.now())} ${t} ${e.target?.className ?? 'window'} trusted=${e.isTrusted}`), true);
      }
    });
    await openStage(page, 1);
    await waitScreen(page, 'picker');
    await page.waitForTimeout(6000);
    const s = await screenName(page);
    if (s !== 'picker') {
      advanced += 1;
      console.log(`flake run ${i}: left the picker for ${s}; events:`, await page.evaluate(() => window.__events));
    }
    await ctx.close();
  }
  check(advanced === 0, `picker never advances without a click (${advanced}/10 runs advanced)`);
}

// ---------- 8. v2.2 four hires: picker cards + star bars, each hire clears stage 1, HUD hearts, save kept ----------
const HIRES = [['kid', '칼퇴준', 3], ['cat', '정시원', 2], ['bunny', '고도약', 3], ['robot', '유행운', 4]];
if (['all', 'heroes'].includes(which)) {
  for (const [id, name, hearts] of HIRES) {
    const ctx = await newContext();
    const page = await newPage(ctx);
    await page.goto(`${OFFICE}?autoplay=1`);
    await waitTitle(page);
    await openStage(page, 1);
    await waitScreen(page, 'picker');
    await page.waitForTimeout(900);
    const cards = await page.locator('.picker__pick').evaluateAll((els) => els.map((e) => ({
      name: e.querySelector('.skin__name')?.textContent ?? '',
      rows: e.querySelectorAll('.hero-stars__row').length,
      pips: [...e.querySelectorAll('.hero-stars__row')].map((r) => r.querySelectorAll('.hero-stars__pip.is-on').length).join(''),
      role: e.querySelector('.hero-card__role')?.textContent ?? '',
      quote: e.querySelector('.hero-card__quote')?.textContent ?? '',
    })));
    if (id === 'kid') {
      check(cards.length === 4 && cards.every((c) => c.rows === 5 && c.role && c.quote), `picker: 4 cards with role, 5 star bars and a catchphrase (${cards.map((c) => `${c.name} ${c.pips}`).join(' / ')})`);
      await shot(page, 'h0-picker');
    }
    await click(page.locator('.picker__pick', { hasText: name }));
    await page.waitForTimeout(400);
    if (id === 'robot') await shot(page, 'h0-picker-robot');
    check((await page.locator('.picker__pick.is-selected .skin__name').textContent()) === name, `${name}: selected card`);
    await click(page.locator('.picker__confirm'));
    await waitScreen(page, 'controls');
    await click(page.getByRole('button', { name: /^확인/ }));
    await skipCutscenes(page, 5000);
    const hud = await page.waitForFunction(() => {
      const n = document.querySelectorAll('[aria-label^="방탄 "] .heart').length;
      return n > 0 ? n : null;
    }, null, { timeout: 20000 }).then((h) => h.jsonValue());
    check(hud === hearts, `${name}: HUD hearts ${hud} (want ${hearts})`);
    const txt = await playToResult(page, `h-${id}`);
    check(/퇴근 성공|CLOCK OUT/.test(txt), `${name}: stage 1 cleared by autoplay`);
    check((await page.locator('.report__hero').innerText().catch(() => '')).includes(name), `${name}: result card shows the hire`);
    const saved = await readSave(page, OFFICE_KEY);
    check(saved?.skin === id && ['kid', 'cat', 'bunny', 'robot'].every((k) => saved.ownedSkins.includes(k)), `${name}: save skin=${saved?.skin}, owns all four`);
    await page.goto(OFFICE);
    await waitTitle(page);
    check((await readSave(page, OFFICE_KEY))?.skin === id, `${name}: choice survives a reload`);
    if (id === 'robot') {
      await click(page.getByRole('button', { name: /사원 선택/ }));
      await waitScreen(page, 'shop');
      // past the screen-in fade (a capture during it looks washed out); the room must settle fully opaque
      const settled = await page.waitForFunction(() => {
        const el = document.querySelector('.screen--shop');
        return el && el.getAnimations({ subtree: false }).every((x) => x.playState === 'finished') && getComputedStyle(el).opacity === '1';
      }, null, { timeout: 5000 }).then(() => true, () => false);
      check(settled, '사원 선택 room settles fully opaque after its screen-in transition');
      const room = await page.locator('.screen--shop .skin').evaluateAll((els) => els.map((e) => e.querySelectorAll('.hero-stars__row').length));
      check(room.length === 4 && room.every((n) => n === 5), `사원 선택 room shows the same 4 cards with star bars (${room.join(',')})`);
      await shot(page, 'h5-room');
    }
    await ctx.close();
  }
}

// ---------- 7. office v2.1 audio: sampled sfx on actions / pickups / stamps, gesture-gated loading, synth fallback ----------
const SFX = ['jump1', 'jump2', 'jump3', 'land', 'slide', 'lane', 'pick-coin', 'pick-shield', 'pick-slow', 'pick-heart', 'pick-item',
  'pick-item-done', 'perfect', 'stamp', 'mission-ok', 'mission-miss'];
/** records sample plays (by file name, with playbackRate), synth voice starts, sfx fetches and the first gesture */
const AUDIO_SPY = () => {
  const abName = new WeakMap();
  const bufName = new WeakMap();
  const a = (window.__audio = { plays: [], synth: 0, fetches: [], gestureAt: null, durations: {} });
  const gesture = () => { if (a.gestureAt === null) a.gestureAt = performance.now(); };
  addEventListener('pointerdown', gesture, true);
  addEventListener('keydown', gesture, true);
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = String(input && input.url ? input.url : input);
    const m = /\/sfx\/([\w-]+)\.(ogg|m4a)/.exec(url);
    if (m) a.fetches.push({ name: m[1], ext: m[2], t: performance.now() });
    const res = await origFetch.call(this, input, init);
    if (m) {
      const read = res.arrayBuffer.bind(res);
      res.arrayBuffer = async () => { const b = await read(); abName.set(b, m[1]); return b; };
    }
    return res;
  };
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (ab, ...rest) {
    const name = abName.get(ab);
    return decode.call(this, ab, ...rest).then((buf) => { if (name) { bufName.set(buf, name); a.durations[name] = buf.duration; } return buf; });
  };
  const startBuf = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const name = this.buffer ? bufName.get(this.buffer) : undefined;
    if (name) a.plays.push({ name, rate: this.playbackRate.value, t: performance.now() });
    else a.synth += 1;
    return startBuf.apply(this, args);
  };
  const startOsc = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) { a.synth += 1; return startOsc.apply(this, args); };
};

async function audioRun(blockSfx, stages) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/supabase\.co/, (r) => { supabaseHits += 1; return r.abort(); });
  if (blockSfx) await ctx.route(/\/sfx\//, (r) => r.abort());
  const sound = officeSave({ stars: {}, settings: { sound: true, music: false, vibration: false, reducedMotion: false } });
  await ctx.addInitScript(([k, d]) => localStorage.setItem(k, d), [OFFICE_KEY, sound]);
  await ctx.addInitScript(AUDIO_SPY);
  const page = await newPage(ctx);
  await page.goto(`${OFFICE}?autoplay=1`);
  await waitTitle(page);
  await page.waitForTimeout(1500);
  const beforeGesture = await page.evaluate(() => window.__audio.fetches.length);
  await openStage(page, 1);
  const results = [];
  for (let n = 1; n <= stages; n += 1) {
    await resetMission(page);
    await page.evaluate(() => { window.__audio.plays = []; });
    results.push(await playToResult(page, `a${n}${blockSfx ? '-blocked' : ''}`));
    const audio = await page.evaluate(() => window.__audio);
    results.push(audio);
    if (n < stages) await click(page.getByRole('button', { name: /다음 층으로/ }));
  }
  await ctx.close();
  return { beforeGesture, results };
}

if (['all', 'audio'].includes(which)) {
  const probe = await (await fetch(`${OFFICE}sfx/jump1.ogg`).catch(() => null))?.status;
  SFX_ABSENT = probe !== 200;
  if (SFX_ABSENT) console.log('SKIP  sample assertions: this build ships no sfx files (synth-only dry run)');
  else {
    // every file of the contract, in both formats
    const bad = [];
    for (const n of SFX) for (const ext of ['ogg', 'm4a']) {
      const st = (await fetch(`${OFFICE}sfx/${n}.${ext}`)).status;
      if (st !== 200) bad.push(`${n}.${ext}=${st}`);
    }
    check(bad.length === 0, `all ${SFX.length} sfx files serve in .ogg and .m4a${bad.length ? ` (${bad.join(', ')})` : ''}`);
    const { beforeGesture, results } = await audioRun(false, 2);
    check(beforeGesture === 0, `no sfx request before the first gesture (${beforeGesture})`);
    const s1 = results[1];
    const s2 = results[3];
    const firstFetch = Math.min(...s1.fetches.map((f) => f.t));
    check(s1.gestureAt !== null && firstFetch >= s1.gestureAt, 'sfx load only after the first user gesture');
    const count = (a, name) => a.plays.filter((p) => p.name === name).length;
    const names = (a) => [...new Set(a.plays.map((p) => p.name))].sort().join(',');
    console.log('stage 1 samples:', names(s1), '| stage 2 samples:', names(s2), '| synth voices:', s1.synth);
    console.log('decoded durations (s):', ['jump1', 'jump3', 'pick-item'].map((n) => `${n}=${(s2.durations[n] ?? NaN).toFixed(3)}`).join(' '),
      '| formats fetched:', [...new Set(s1.fetches.map((f) => f.ext))].join(','));
    check(count(s1, 'jump1') > 0, `jump1 on jumps (${count(s1, 'jump1')})`);
    check(count(s2, 'jump2') > 0, `jump2 on 2단 jumps, stage 2 (${count(s2, 'jump2')})`);
    check(count(s1, 'lane') > 0, `lane on lane changes (${count(s1, 'lane')})`);
    check(count(s1, 'slide') > 0, `slide on slides (${count(s1, 'slide')})`);
    const items = [...s1.plays, ...s2.plays].filter((p) => p.name === 'pick-item').map((p) => p.rate);
    const coins = count(s1, 'pick-coin') + count(s2, 'pick-coin');
    check(coins + items.length > 0, `pickups sampled (pick-coin ${coins}, pick-item ${items.length})`);
    if (items.length > 1) check(Math.max(...items) > Math.min(...items) && items[0] <= items[items.length - 1], `pick-item pitch rises (${items.map((r) => r.toFixed(2)).join(' → ')})`);
    else console.log('NOTE  fewer than 2 mission items collected by the bot: pitch rise not observable this run');
    const verdicts = (a) => count(a, 'mission-ok') + count(a, 'mission-miss');
    check(count(s1, 'stamp') >= 3 && verdicts(s1) >= 3, `stamp + mission-ok/miss at each door and the end (stamp ${count(s1, 'stamp')}, verdicts ${verdicts(s1)})`);
  }
  // fallback: every sfx file blocked → the synth voices play and nothing breaks
  const errs = errors.length;
  const { results: fb } = await audioRun(true, 1);
  check(fb[1].plays.length === 0 && fb[1].synth > 50, `sfx blocked: synth fallback plays (${fb[1].synth} synth voices, ${fb[1].plays.length} samples)`);
  // the blocked sfx requests log "Failed to load resource" (expected); anything else is a real error
  const fresh = errors.splice(errs);
  const blockedLoads = fresh.filter((e) => /Failed to load resource: net::ERR_FAILED/.test(e));
  const other = fresh.filter((e) => !blockedLoads.includes(e));
  errors.push(...other);
  check(other.length === 0 && blockedLoads.length <= SFX.length * 2, `sfx blocked: no page errors (${blockedLoads.length} expected aborted loads, ${other.length} other)`);
}

console.log('bot stamps (earned/total):', JSON.stringify(botStamps));
check(missing.size === 0, `every requested file ships (${missing.size} missing${missing.size ? `: ${[...missing].sort().join(', ')}` : ''})`);
check(supabaseHits === 0, `no requests to supabase.co (${supabaseHits})`);
console.log('errors:', errors.length ? errors : 'none');
if (errors.length) failures.push('page errors');
await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join(' | ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
