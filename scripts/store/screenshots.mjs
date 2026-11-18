// Store screenshots (docs/store/assets): title, two runs, week card, mall. Run: node scripts/store/screenshots.mjs <out> dist-ios
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const DIST = join(process.cwd(), process.argv[3] ?? 'dist-ios');
const OUT = process.argv[2];
const PORT = 5466;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = createServer(async (req, res) => {
  let file = normalize(join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(PORT, ok));

const STAGES = 10;
const stars = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`w${i + 1}-s10`, 1]));
const save = JSON.stringify({
  version: 2, stars, bestScores: {}, coins: 1280, ownedSkins: ['kid', 'cat', 'bunny', 'robot'], skin: 'kid', tutorialDone: true, briefed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  controlsSeen: true, seenCutscenes: ['op-start', 'rescue', ...Array.from({ length: STAGES }, (_, i) => `boss-${i + 1}`)], achievements: {}, dailyStreak: { last: null, count: 0 },
  settings: { sound: false, music: false, vibration: false, reducedMotion: false }, cosmetics: { owned: [], tint: {}, trail: null, ring: null, frame: null },
  tutorialSteps: ['jump', 'slide', 'lane'],
});
const live = JSON.stringify({
  v: 1, maxDate: '2026-11-18', daily: {}, card: { week: '2026-11-16', stamps: [true, true, false, false, false, false, false] },
  history: [], goal: { week: '2026-11-16', value: 96, done: false }, owned: ['trail-sparkle', 'stamp-heart'], equipped: { trail: 'trail-sparkle', stamp: 'stamp-heart' },
  badges: [], themeSeen: {}, ledger: [],
});

const SIZES = [
  { tag: 'iphone69', viewport: { width: 440, height: 956 }, scale: 3 },
  { tag: 'ipad13', viewport: { width: 1032, height: 1376 }, scale: 2 },
  { tag: 'play-phone', viewport: { width: 360, height: 800 }, scale: 3 },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
await mkdir(OUT, { recursive: true });
const waitScreen = (page, name, timeout = 20000) => page.waitForFunction((n) => document.querySelector('.layer--screen')?.dataset.screen === n, name, { timeout });

for (const s of SIZES) {
  const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: s.scale, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([a, b]) => { localStorage.setItem('officeescape.save.v2', a); localStorage.setItem('officeescape.live.v1', b); }, [save, live]);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(2026, 10, 18, 17, 25, 0) });
  const shot = (n) => page.screenshot({ path: `${OUT}/${s.tag}-${n}.png` });
  await page.goto(`http://localhost:${PORT}/?autoplay=1`);
  await waitScreen(page, 'title');
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(3500);
  await shot('1-title');
  // the mall
  await page.getByRole('button', { name: /사원 복지몰/ }).click();
  await page.waitForTimeout(1500);
  await shot('5-mall');
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await waitScreen(page, 'title');
  // the week card
  await page.locator('.live-card, [class*=live-week], button:has-text("출근 카드")').first().click();
  await page.waitForTimeout(1500);
  await shot('4-weekcard');
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await waitScreen(page, 'title');
  // two runs: stage 3 (office floor) and stage 7 (street boss)
  for (const [n, wait, name] of [[3, 11000, '2-run'], [7, 9000, '3-run']]) {
    await page.getByRole('button', { name: /퇴근 시작/ }).click();
    await waitScreen(page, 'stages');
    const part = page.locator(`.floors__tab[data-part="${n > 5 ? 2 : 1}"]`);
    if (await part.count()) { await part.click(); await page.waitForTimeout(300); }
    await page.getByRole('button', { name: new RegExp(`^퇴근길 ${n}단계 `) }).click();
    for (let i = 0; i < 8; i += 1) {
      const skip = page.getByRole('button', { name: /컷신 건너뛰기/ });
      if (await skip.count()) await skip.first().click({ force: true, timeout: 1500 }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(wait);
    await shot(name);
    await page.goto(`http://localhost:${PORT}/?autoplay=1`);
    await waitScreen(page, 'title');
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log('done');
