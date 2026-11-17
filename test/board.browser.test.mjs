import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const APP = path.resolve('app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

let server;
let base;
let browser;

before(async () => {
  server = createServer(async (req, res) => {
    const file = path.join(APP, new URL(req.url, 'http://x').pathname.replace(/\/$/, '/index.html'));
    try {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

const incident = (id, minutesAgo, extra = {}) => ({
  id,
  service: 'booking-api',
  region: 'eu-central',
  summary: `summary of ${id}`,
  severity: 'sev2',
  openedAt: new Date(Date.UTC(2026, 10, 17, 7, 0) - minutesAgo * 60_000).toISOString(),
  ...extra,
});

async function openBoard(feed) {
  const context = await browser.newContext({ locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
  const page = await context.newPage();
  const acks = [];
  await page.route('**/api/incidents**', (route) =>
    route.fulfill({ json: { updatedAt: new Date().toISOString(), incidents: feed.incidents, cursor: `c${feed.incidents.length}` } }),
  );
  await page.route('**/api/ack**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    acks.push(id);
    route.fulfill({ json: { id, ackedAt: new Date().toISOString(), receipt: `r-${id}` } });
  });
  await page.addInitScript(() => {
    window.__rowsRemoved = 0;
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.removedNodes) if (n.nodeType === 1 && n.matches?.('[data-testid="incident-row"]')) window.__rowsRemoved += 1;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(base);
  return { page, context, acks };
}

const ids = (page) => page.$$eval('[data-testid="incident-row"]', (rows) => rows.map((r) => r.dataset.id));
const boxOf = (page, selector) => page.locator(selector).boundingBox();

test('new incidents wait behind the new bar and the rows do not move', async () => {
  const feed = { incidents: [incident('INC-2', 5), incident('INC-1', 10)] };
  const { page, context } = await openBoard(feed);
  await page.waitForSelector('[data-testid="incident-row"]');
  assert.equal(await page.locator('[data-testid="loader"]').count(), 0);
  assert.equal(await page.locator('[data-testid="new-bar"]').isVisible(), false);
  const rowBefore = await boxOf(page, '[data-testid="incident-row"][data-id="INC-2"]');

  feed.incidents = [incident('INC-4', 0), incident('INC-3', 1), ...feed.incidents];
  await page.locator('[data-testid="new-bar"]').waitFor({ state: 'visible', timeout: 5000 });

  assert.equal(await page.locator('[data-testid="new-bar"]').innerText(), '2 new');
  assert.deepEqual(await ids(page), ['INC-2', 'INC-1']);
  assert.deepEqual(await boxOf(page, '[data-testid="incident-row"][data-id="INC-2"]'), rowBefore);

  await page.locator('[data-testid="new-bar"]').click();
  assert.deepEqual(await ids(page), ['INC-4', 'INC-3', 'INC-2', 'INC-1']);
  assert.equal(await page.locator('[data-testid="new-bar"]').isVisible(), false);
  await context.close();
});

test('changed incident text updates the row in place without removing it', async () => {
  const feed = { incidents: [incident('INC-1', 5)] };
  const { page, context } = await openBoard(feed);
  await page.waitForSelector('[data-testid="incident-row"]');
  feed.incidents = [incident('INC-1', 5, { summary: 'now worse', severity: 'sev1' })];
  await page.waitForFunction(() => document.querySelector('.what')?.textContent.includes('now worse'), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__rowsRemoved), 0);
  await context.close();
});

test('ack lands on the row that was aimed at while new incidents arrive', async () => {
  const feed = { incidents: [incident('INC-3', 1), incident('INC-2', 5), incident('INC-1', 10)] };
  const { page, context, acks } = await openBoard(feed);
  await page.waitForSelector('[data-testid="incident-row"]');
  const target = await boxOf(page, '[data-testid="incident-row"][data-id="INC-3"] [data-testid="ack"]');
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);

  feed.incidents = [incident('INC-4', 0), ...feed.incidents];
  await page.locator('[data-testid="new-bar"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);

  await page.locator('[data-testid="incident-row"][data-id="INC-3"] [data-testid="acked"]').waitFor({ timeout: 3000 });
  assert.deepEqual(acks, ['INC-3']);
  await page.locator('[data-testid="new-bar"]').click();
  assert.equal(await page.locator('[data-testid="incident-row"][data-id="INC-3"] [data-testid="acked"]').count(), 1);
  assert.equal(await page.locator('[data-testid="incident-row"]').first().locator('[data-testid="ack"]').count(), 1);
  await context.close();
});

test('an empty night shows the empty state, and the first incidents come straight in', async () => {
  const feed = { incidents: [] };
  const { page, context } = await openBoard(feed);
  await page.locator('[data-testid="empty"]').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.locator('[data-testid="loader"]').count(), 0);
  feed.incidents = [incident('INC-1', 0)];
  await page.waitForSelector('[data-testid="incident-row"]', { timeout: 5000 });
  assert.equal(await page.locator('[data-testid="empty"]').isVisible(), false);
  await context.close();
});
