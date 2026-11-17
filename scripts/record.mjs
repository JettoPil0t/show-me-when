import { chromium } from 'playwright';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [url, outDir = 'recordings', name = 'recording'] = process.argv.slice(2);
if (!url) throw new Error('usage: node scripts/record.mjs <board url> [out dir] [name]');

const VIEWPORT = { width: 1280, height: 720 };
const LOCALE = 'pl-PL';
const TIME_ZONE = 'Europe/Warsaw';

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  locale: LOCALE,
  timezoneId: TIME_ZONE,
  recordVideo: { dir: outDir, size: VIEWPORT },
});

await context.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.id = 'recording-cursor';
    Object.assign(dot.style, {
      position: 'fixed', width: '18px', height: '18px', marginLeft: '-9px', marginTop: '-9px',
      borderRadius: '50%', border: '3px solid #d0021b', background: 'rgba(208,2,27,.25)',
      pointerEvents: 'none', zIndex: 99999, left: '-50px', top: '-50px', transition: 'transform .1s',
    });
    document.body.append(dot);
    document.addEventListener('mousemove', (e) => { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; }, true);
    document.addEventListener('mousedown', () => { dot.style.transform = 'scale(.6)'; }, true);
    document.addEventListener('mouseup', () => { dot.style.transform = ''; }, true);
  });
});

const started = Date.now();
const page = await context.newPage();
const events = [];
const at = () => {
  const s = Math.floor((Date.now() - started) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const note = (event, data = {}) => {
  const entry = { at: at(), ms: Date.now() - started, utc: new Date().toISOString(), event, ...data };
  events.push(entry);
  console.log(JSON.stringify(entry));
};

page.on('console', (msg) => {
  const text = msg.text();
  if (text.startsWith('ack ')) {
    const [, id, ackedAt, receipt] = text.split(' ');
    note('ack-reply', { id, ackedAt, receipt });
  }
});
page.on('pageerror', (err) => note('page-error', { message: err.message }));

const rowIds = () => page.$$eval('[data-testid="incident-row"]', (rows) => rows.map((r) => r.dataset.id));

note('open-board', { url });
await page.goto(url);
await page.waitForSelector('[data-testid="incident-row"]');
await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
const sha = await page.getAttribute('meta[name="build"]', 'content');
note('board-loaded', { sha, rows: await rowIds() });

await page.mouse.move(640, 600);
await page.waitForTimeout(2500);

const boardState = () => page.evaluate(() => {
  const bar = document.querySelector('[data-testid="new-bar"]');
  return `${document.querySelector('[data-testid="incident-row"]')?.dataset.id}|${bar && !bar.hidden ? bar.textContent : ''}`;
});
const waitForArrival = async (state) => page.waitForFunction((was) => {
  const bar = document.querySelector('[data-testid="new-bar"]');
  return `${document.querySelector('[data-testid="incident-row"]')?.dataset.id}|${bar && !bar.hidden ? bar.textContent : ''}` !== was;
}, state, { timeout: 60000, polling: 20 });
const newBarText = () => page.evaluate(() => {
  const bar = document.querySelector('[data-testid="new-bar"]');
  return bar && !bar.hidden ? bar.textContent : null;
});

await waitForArrival(await boardState());
note('watch-board-arrival', { rows: await rowIds(), newBar: await newBarText() });
await page.waitForTimeout(2500);

const target = page.locator('[data-testid="incident-row"]').first();
const intended = await target.getAttribute('data-id');
const box = await target.locator('[data-testid="ack"]').boundingBox();
const x = box.x + box.width / 2;
const y = box.y + box.height / 2;
await page.mouse.move(640, 600);
await page.mouse.move(x, y, { steps: 25 });
note('aim-ack', { intended, x: Math.round(x), y: Math.round(y) });

await waitForArrival(await boardState());
const shifted = await rowIds();
note('arrival-while-aiming', { top: shifted[0], intendedNowAt: shifted.indexOf(intended), newBar: await newBarText() });
await page.waitForTimeout(150);
const underCursor = await page.evaluate(([cx, cy]) => document.elementFromPoint(cx, cy)?.closest('[data-testid="incident-row"]')?.dataset.id ?? null, [x, y]);
note('click', { intended, underCursor });
await page.mouse.click(x, y);

await page.waitForFunction(() => document.querySelector('[data-testid="acked"]'), null, { timeout: 15000 });
const ackedRows = await page.$$eval('[data-testid="acked"]', (marks) => marks.map((m) => m.closest('[data-testid="incident-row"]').dataset.id));
note('acked-on-board', { ackedRows, intendedStillOpen: !ackedRows.includes(intended) });
await page.waitForTimeout(2500);
if (await newBarText()) {
  const bar = await page.locator('[data-testid="new-bar"]').boundingBox();
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2, { steps: 20 });
  note('new-bar-click', { newBar: await newBarText() });
  await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.waitForTimeout(300);
  note('new-bar-applied', { rows: await rowIds() });
}
await page.mouse.move(640, 700, { steps: 10 });
await page.waitForTimeout(5000);
note('end', { rows: await rowIds() });

const video = page.video();
await context.close();
await browser.close();
const file = path.join(outDir, `${name}.webm`);
await rename(await video.path(), file);
await writeFile(path.join(outDir, `${name}.events.json`), JSON.stringify({ url, sha, locale: LOCALE, timeZone: TIME_ZONE, events }, null, 2));
console.log(`video: ${file}`);
