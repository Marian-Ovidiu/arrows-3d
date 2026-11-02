import { test, expect, type Page } from '@playwright/test';
import { chooseLevel, continueGame, restartLevel } from './navigation';
import { LEVELS } from '../../src/puzzle';

const FIRST_TOTAL = LEVELS[0].pieces.length;
const SECOND_TOTAL = LEVELS[1].pieces.length;

async function expectProgress(page: Page, count: number, total: number) {
  const badge = page.locator('#progress-label');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(`${count} / ${total}`);
  await expect(badge).toHaveAttribute('aria-label', `${count} di ${total} pezzi liberati`);
}

async function expectCompactUi(page: Page) {
  await expect(page.locator('.footer, aside.intro, .orbit-caption, .keyboard-select, #selection-panel, #selection-title, #extract, #cycle, #level-name, #artifact-label, #scene-label')).toHaveCount(0);
}

async function expectTouchTargets(page: Page) {
  for (const button of await page.getByRole('button').all()) {
    if (!await button.isVisible()) continue;
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}

async function removeOne(page: Page, count: number, total = FIRST_TOTAL) {
  await page.getByRole('button', { name: 'Suggerimento: trova una freccia libera' }).click();
  await expect(page.locator('#announcement')).toHaveText('Freccia selezionata. Uscita libera.');
  await page.locator('canvas').focus();
  await page.keyboard.press('Enter');
  await expectProgress(page, count, total);
}

test('resume, undo and independent level progress survive reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await chooseLevel(page, 0);
  await removeOne(page, 1); await removeOne(page, 2);
  await page.reload();
  await continueGame(page);
  await expectProgress(page, 2, FIRST_TOTAL);
  await page.getByRole('button', { name: 'Annulla l’ultima estrazione' }).click();
  await expectProgress(page, 1, FIRST_TOTAL);
  await chooseLevel(page, 1);
  await removeOne(page, 1, SECOND_TOTAL);
  await chooseLevel(page, 0);
  await expectProgress(page, 1, FIRST_TOTAL);
  await restartLevel(page);
  await expectProgress(page, 0, FIRST_TOTAL);
  await chooseLevel(page, 1);
  await page.reload();
  await continueGame(page);
  await expect(page.locator('[data-level="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expectProgress(page, 1, SECOND_TOTAL);
  expect(errors).toEqual([]);
});

test('all assets are local and touch layout fits portrait and landscape', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') { external.push(url.href); return route.abort(); }
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await chooseLevel(page, 0);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#app')).not.toHaveAttribute('inert');
  await page.evaluate(() => document.fonts.ready);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expectCompactUi(page);
  await expectProgress(page, 0, FIRST_TOTAL);
  await expectTouchTargets(page);
  await removeOne(page, 1);
  await page.screenshot({ path: 'test-results/mobile-390.png', fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const id of ['pause-game', 'hint', 'view', 'undo']) await expect(page.locator(`#${id}`)).toBeInViewport();
  await expectCompactUi(page);
  await expectProgress(page, 1, FIRST_TOTAL);
  await expectTouchTargets(page);
  await page.screenshot({ path: 'test-results/mobile-landscape.png', fullPage: false });
});

test('first level completes, keeps collection and can be replayed', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  for (let count = 1; count <= FIRST_TOTAL; count++) await removeOne(page, count);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-title')).toHaveText(LEVELS[0].artifact);
  await page.getByRole('button', { name: 'Resta a guardare' }).click();
  await page.reload();
  await continueGame(page);
  await expect(page.locator('[data-level="1"]')).toHaveAttribute('aria-pressed', 'true');
  await chooseLevel(page, 0);
  await expectProgress(page, FIRST_TOTAL, FIRST_TOTAL);
  await expect(page.locator('[data-level="0"] .tab-check')).toHaveAttribute('aria-label', 'completato');
  await page.getByRole('button', { name: 'Annulla l’ultima estrazione' }).click();
  await expectProgress(page, FIRST_TOTAL - 1, FIRST_TOTAL);
  await removeOne(page, FIRST_TOTAL);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();
  await expect(page.locator('[data-level="1"]')).toHaveAttribute('aria-pressed', 'true');
});

test('suspending during extraction saves a consistent board and pauses drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const state = window as unknown as { drawCount: number };
    state.drawCount = 0;
    const original = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) { state.drawCount++; return original.apply(this, args); };
  });
  await page.goto('/');
  await chooseLevel(page, 0);
  await page.locator('#hint').click();
  await page.locator('canvas').focus();
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectProgress(page, 1, FIRST_TOTAL);
  const before = await page.evaluate(() => (window as unknown as { drawCount: number }).drawCount);
  // Explicit bounded observation interval for battery-related rendering behavior.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { drawCount: number }).drawCount)).toBe(before);
  await page.reload();
  await continueGame(page);
  await expectProgress(page, 1, FIRST_TOTAL);
});

test('corrupt saved data does not prevent starting a game', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('svela-save-v1', '{broken'));
  await page.goto('/');
  await chooseLevel(page, 0);
  await expectProgress(page, 0, FIRST_TOTAL);
  await removeOne(page, 1);
});

test('home, journey and pause keep local progress ready to continue', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#home-screen')).toBeVisible();
  await expect(page.locator('#play-game')).toHaveText('Gioca');
  await expect(page.locator('#pause-game')).toBeHidden();
  await expectTouchTargets(page);
  await page.locator('#tab-journey').click();
  await expect(page.locator('#journey-screen')).toBeVisible();
  await expectTouchTargets(page);
  await page.locator('#tab-home').click();
  await expect(page.locator('#home-screen')).toBeVisible();
  await chooseLevel(page, 0);
  await removeOne(page, 1);
  await page.locator('#pause-game').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await expectTouchTargets(page);
  await page.locator('#resume-game').click();
  await expect(page.locator('#pause-dialog')).toBeHidden();
  await expectProgress(page, 1, FIRST_TOTAL);
  await page.locator('#pause-game').click();
  await page.locator('#pause-journey').click();
  await expect(page.locator('#journey-screen')).toBeVisible();
  await expect(page.locator('[data-level="0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tab-home').click();
  await expect(page.locator('#play-game')).toHaveText('Continua');
  await continueGame(page);
  await expectProgress(page, 1, FIRST_TOTAL);
  await page.locator('#pause-game').click();
  await page.locator('#pause-home').click();
  await expect(page.locator('#home-screen')).toBeVisible();
  await page.reload();
  await expect(page.locator('#play-game')).toHaveText('Continua');
  await continueGame(page);
  await expectProgress(page, 1, FIRST_TOTAL);
});
