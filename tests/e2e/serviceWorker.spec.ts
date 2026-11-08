// The service worker (public/sw.js) with the real worker running. The other specs block it (see playwright.config.ts),
// so this file is the only place its caches are checked. INV-PERF-04: covers and the shell have their own caches,
// each capped, so the device does not accumulate files forever.
import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, stubApi } from './fixtures';

test.use({ serviceWorkers: 'allow' });

const COVERS = 'aurastream-covers-v1';
const SHELL = 'aurastream-v1';
const COVER_LIMIT = 400;

async function waitForWorker(page: Page) {
  // The app registers the worker only once it is mounted, which needs a signed-in user (the stubs provide one)
  await fakeYouTube(page);
  await stubApi(page, {});
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first load is not controlled yet: a reload hands the page to the worker
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

const cacheKeys = (page: Page, name: string) =>
  page.evaluate(async (cacheName) => {
    const cache = await caches.open(cacheName);
    return (await cache.keys()).map((request) => new URL(request.url).pathname + new URL(request.url).search);
  }, name);

test('INV-PERF-04: o service worker controla a página e guarda a casca na sua cache', async ({ page }) => {
  await waitForWorker(page);
  const shell = await cacheKeys(page, SHELL);
  expect(shell).toContain('/index.html');
});

test('INV-PERF-04: capas vão para a cache de capas, não para a da casca', async ({ page }) => {
  await waitForWorker(page);
  // icon.svg is served by the app itself, and the worker treats .svg as a cover
  await page.evaluate(() => fetch('/icon.svg?cover=1').then((response) => response.text()));
  expect(await cacheKeys(page, COVERS)).toContain('/icon.svg?cover=1');
  expect(await cacheKeys(page, SHELL)).not.toContain('/icon.svg?cover=1');
});

test('INV-PERF-04: a cache de capas não passa do limite; sai o mais antigo', async ({ page }) => {
  await waitForWorker(page);
  const total = COVER_LIMIT + 20;
  // Sequential in batches, so the worker stores them in order and the oldest ones are the first
  await page.evaluate(async (count) => {
    for (let start = 0; start < count; start += 20) {
      await Promise.all(
        Array.from({ length: Math.min(20, count - start) }, (_, k) => fetch(`/icon.svg?n=${start + k}`).then((r) => r.text()))
      );
    }
  }, total);
  // The worker writes after answering, so wait until the cache has settled on its last state
  await expect.poll(async () => (await cacheKeys(page, COVERS)).includes(`/icon.svg?n=${total - 1}`)).toBe(true);
  await expect.poll(async () => (await cacheKeys(page, COVERS)).length).toBe(COVER_LIMIT);
  const keys = await cacheKeys(page, COVERS);
  expect(keys).not.toContain('/icon.svg?n=0');
});
