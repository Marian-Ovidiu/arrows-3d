import { test, expect } from '@playwright/test';
import { chooseLevel } from './navigation';
import { TUTORIAL_INDEX } from '../../src/puzzle';

test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

test('game canvas fills the viewport across phone sizes, safe areas and rotation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const [width, height, top, bottom, left, right] of [
    [390, 844, 47, 34, 0, 0], [844, 390, 0, 21, 47, 47],
    [320, 568, 20, 0, 0, 0], [360, 800, 0, 0, 0, 0], [390, 700, 0, 0, 0, 0],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(insets => {
      for (const [side, value] of Object.entries(insets)) document.documentElement.style.setProperty(`--safe-area-inset-${side}`, `${value}px`);
    }, { top, bottom, left, right });
    for (const level of [0, TUTORIAL_INDEX]) {
      await chooseLevel(page, level);
      await expect.poll(async () => {
        const canvas = (await page.locator('#scene canvas').boundingBox())!;
        return [Math.round(canvas.x), Math.round(canvas.y), Math.round(canvas.width), Math.round(canvas.height)];
      }).toEqual([0, 0, width, height]);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      for (const id of ['pause-game', 'hint', 'view', 'undo']) await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    await page.screenshot({ path: `test-results/viewport-${width}-${height}.png` });
  }
  expect(errors).toEqual([]);
});
