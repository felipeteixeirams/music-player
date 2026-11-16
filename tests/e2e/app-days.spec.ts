import { expect, test, type Page } from '@playwright/test';
import { stubApi } from './fixtures';

/** The app-day writes (`POST /rest/v1/app_days`) that left the page, in order. */
function trackDayWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/rest/v1/app_days')) writes.push(request.url());
  });
  return writes;
}

const wakeUp = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

test('INV-ADMIN-03: o dia de uso é gravado ao abrir e não de novo nas voltas ao primeiro plano do mesmo dia', async ({ page }) => {
  const writes = trackDayWrites(page);
  await stubApi(page);
  await page.goto('/');
  await expect.poll(() => writes.length).toBe(1);

  await wakeUp(page);
  await wakeUp(page);
  await page.waitForTimeout(300);
  expect(writes).toHaveLength(1);
});

test('INV-ADMIN-03: uma gravação que falha é tentada de novo na próxima volta ao primeiro plano', async ({ page }) => {
  const writes = trackDayWrites(page);
  await stubApi(page);
  // Registered after stubApi, so it answers the first day write before the stub does
  let failFirst = true;
  await page.route('**/rest/v1/app_days*', (route) => {
    if (route.request().method() === 'POST' && failFirst) {
      failFirst = false;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"falha"}' });
    }
    return route.fallback();
  });
  await page.goto('/');
  await expect.poll(() => writes.length).toBe(1);

  await wakeUp(page);
  await expect.poll(() => writes.length).toBe(2);
  await wakeUp(page);
  await page.waitForTimeout(300);
  expect(writes).toHaveLength(2);
});
