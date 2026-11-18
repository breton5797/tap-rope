// Play feature graphic (1024×500): the game's own title logo (captured from the app build) over the title key art.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const DIST = join(process.cwd(), 'dist-ios');
const OUT = process.argv[2];
const PORT = 5467;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let file = normalize(join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(PORT, ok));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
await page.addInitScript(() => localStorage.setItem('officeescape.save.v2', JSON.stringify({ version: 2, stars: { 'w1-s10': 1 }, bestScores: {}, coins: 0, ownedSkins: ['kid', 'cat'], skin: 'kid', tutorialDone: true, briefed: [0], controlsSeen: true, seenCutscenes: ['op-start'], achievements: {}, dailyStreak: { last: null, count: 0 }, settings: { sound: false, music: false, vibration: false, reducedMotion: true }, cosmetics: { owned: [], tint: {}, trail: null, ring: null, frame: null }, tutorialSteps: ['jump', 'slide', 'lane'] })));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => document.querySelector('.layer--screen')?.dataset.screen === 'title', null, { timeout: 20000 });
await page.waitForTimeout(2500);
// the logo block: the smallest element whose text holds both title words
const box = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.layer--screen *')].filter((e) => /칼퇴근/.test(e.textContent ?? '') && /대작전/.test(e.textContent ?? ''));
  const el = els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
  // hide the key art behind it so the logo is captured on a flat dark ground
  for (const img of document.querySelectorAll('img, [style*="background-image"]')) img.style.visibility = 'hidden';
  document.querySelector('.layer--screen').style.background = '#07090c';
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, cls: el.className };
});
console.log('logo', JSON.stringify(box));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/logo.png`, clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } });
await browser.close();
server.close();
