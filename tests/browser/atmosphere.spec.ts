import { test, expect } from '@playwright/test';
import { LEVELS, TUTORIAL_INDEX } from '../../src/puzzle';
import { chooseLevel } from './navigation';

test('chapter scenery supports small screens, full orbit and normal puzzle input', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL/.test(message.text())) errors.push(message.text()); });
  await page.goto('/');
  for (const [index, width, height, name] of [[0,390,844,'forest-phone'],[5,390,844,'observatory-phone'],[10,390,844,'archive-phone'],[14,320,740,'large-puzzle-small'],[14,844,390,'large-puzzle-landscape'],[0,1440,960,'forest-desktop']] as const) {
    await page.setViewportSize({ width, height });
    await chooseLevel(page, index);
    await expect(page.locator('#app')).toHaveAttribute('data-chapter', String(LEVELS[index].chapter));
    await expect(page.locator('#app')).toHaveAttribute('data-environment-source', 'blender');
    await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[index].pieces.length}`);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/atmosphere-${name}.png` });
  }
  await chooseLevel(page, 14);
  await page.locator('canvas').focus();
  for (let index = 0; index < 15; index++) await page.keyboard.press('ArrowDown');
  await page.screenshot({ path: 'test-results/atmosphere-underside.png' });
  await page.locator('#hint').click();
  await page.locator('canvas').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#progress-label')).toHaveText(`1 / ${LEVELS[14].pieces.length}`);
  await page.locator('#undo').click();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[14].pieces.length}`);
  await chooseLevel(page, TUTORIAL_INDEX);
  await expect(page.locator('#app')).toHaveAttribute('data-chapter', '0');
  await page.locator('#pause-game').click(); await page.locator('#pause-home').click();
  await expect(page.locator('#app')).toHaveAttribute('data-chapter', '0');
  await page.locator('#open-collection').click();
  await expect(page.locator('#relic-stage canvas')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-chapter', '0');
  expect(errors).toEqual([]);
});

test('unavailable scenery models preserve gameplay with the procedural fallback', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/models/environments/*.glb', route => route.abort());
  await page.goto('/');
  await chooseLevel(page, 5);
  await expect(page.locator('#app')).toHaveAttribute('data-environment-source', 'procedural');
  await page.locator('#hint').click();
  await page.locator('canvas').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#progress-label')).toHaveText(`1 / ${LEVELS[5].pieces.length}`);
  expect(errors).toEqual([]);
});

test('the offline cache includes all three local chapter models', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  for (const index of [0,5,10]) {
    await chooseLevel(page, index);
    await expect(page.locator('#app')).toHaveAttribute('data-environment-source', 'blender');
  }
  await context.setOffline(false);
});
