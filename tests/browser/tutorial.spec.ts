import { test, expect, type Page } from '@playwright/test';
import { chooseLevel, continueGame, restartLevel } from './navigation';
import { PerspectiveCamera, Vector3 } from 'three';
import { LEVELS, TUTORIAL_INDEX } from '../../src/puzzle';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

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

async function cubePoint(page: Page, id: string) {
  await page.locator('#view').click();
  // Let residual orbit damping settle before projecting the known home view.
  await page.waitForTimeout(350);
  const box = (await page.locator('canvas').boundingBox())!;
  const camera = new PerspectiveCamera(34, box.width / box.height, .1, 80);
  camera.position.copy(new Vector3(1.05, .8, 1.3).normalize().multiplyScalar(8.8 * Math.max(1, 1 / camera.aspect)));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const piece = LEVELS[TUTORIAL_INDEX].pieces.find(p => p.id === id)!;
  const position = new Vector3(...piece.position).project(camera);
  return { x: box.x + (position.x + 1) / 2 * box.width, y: box.y + (1 - position.y) / 2 * box.height };
}
async function tapCube(page: Page, id: string) {
  const point = await cubePoint(page, id);
  await page.touchscreen.tap(point.x, point.y);
}
async function rotate(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + box.width * .5, y = box.y + box.height * .5;
  const touch = (x: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(x) });
  for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(x + step * 9) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('new player learns rotation, free light and blocking with actual touch input', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await continueGame(page);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'rotate');
  await expectProgress(page, 0, 4);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/tutorial-start-mobile.png', fullPage: true });
  await rotate(page);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'select');
  await expectCompactUi(page);
  // Rotation advances once and survives reloading without resetting the board.
  await page.reload();
  await continueGame(page);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'select');
  await tapCube(page, 'intro-first');
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'extract');
  await expect(page.locator('#announcement')).toHaveText('Freccia selezionata. Uscita libera.');
  await expectProgress(page, 0, 4);
  await page.screenshot({ path: 'test-results/tutorial-free-mobile.png', fullPage: true });
  await tapCube(page, 'intro-first');
  await expectProgress(page, 1, 4);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'blocked');
  await tapCube(page, 'intro-blocked');
  await expect(page.locator('#announcement')).toHaveText('Freccia selezionata. Percorso bloccato.');
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'unblock');
  await page.screenshot({ path: 'test-results/tutorial-blocked-mobile.png', fullPage: true });
  await tapCube(page, 'intro-blocked');
  await expectProgress(page, 1, 4);
  await page.reload();
  await continueGame(page);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'unblock');
  await tapCube(page, 'intro-blocker');
  await tapCube(page, 'intro-blocker');
  await expectProgress(page, 2, 4);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'finish');
  for (const [id, count] of [['intro-blocked', 3], ['intro-last', 4]] as const) {
    await tapCube(page, id); await tapCube(page, id);
    await expectProgress(page, count, 4);
  }
  await expect(page.locator('#win-dialog')).toBeVisible();
  await page.locator('#next-level').click();
  await expect(page.locator('[data-level="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tutorial-card')).toBeHidden();
  await expectCompactUi(page);
  await expectProgress(page, 0, 26);
  expect(errors).toEqual([]);
});

test('dragging a selected cube and pinching never extracts or selects on release', async ({ page }) => {
  await page.goto('/');
  await continueGame(page);
  await page.locator('canvas').focus();
  await page.keyboard.press('ArrowLeft');
  await tapCube(page, 'intro-first');
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'extract');
  const point = await cubePoint(page, 'intro-first');
  const cdp = await page.context().newCDPSession(page);
  const touch = (x: number) => [{ x, y: point.y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(point.x) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(point.x + 45) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(point.x) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expectProgress(page, 0, 4);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'extract');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...touch(point.x), { x: point.x + 50, y: point.y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [...touch(point.x - 15), { x: point.x + 70, y: point.y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: touch(point.x - 15) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expectProgress(page, 0, 4);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'extract');
  await cdp.detach();
  // The next independent tap still works after the two-finger sequence.
  await tapCube(page, 'intro-first');
  await expectProgress(page, 1, 4);
});

test('introduction can be skipped, resumed, undone and restarted independently', async ({ page }) => {
  await page.goto('/');
  await continueGame(page);
  await page.locator('#skip-tutorial').click();
  await page.locator('#hint').click();
  await page.locator('canvas').focus(); await page.keyboard.press('Enter');
  await expectProgress(page, 1, 26);
  await chooseLevel(page, 3);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'rotate');
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowRight');
  await tapCube(page, 'intro-first'); await tapCube(page, 'intro-first');
  await expectProgress(page, 1, 4);
  await page.locator('#undo').click();
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'select');
  await restartLevel(page);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'rotate');
  await chooseLevel(page, 0);
  await expectProgress(page, 1, 26);
  await page.reload();
  await continueGame(page);
  await expect(page.locator('[data-level="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expectProgress(page, 1, 26);
});

test('guide and controls remain usable on narrow phones, desktop and landscape', async ({ page }) => {
  await page.goto('/');
  await continueGame(page);
  await expect(page.locator('#tutorial-card')).toHaveAttribute('data-step', 'rotate');
  for (const [width, height, name] of [[320,740,'small'], [390,844,'portrait'], [1440,960,'desktop'], [844,390,'landscape']] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const guide = (await page.locator('#tutorial-card').boundingBox())!;
    const canvas = (await page.locator('canvas').boundingBox())!;
    const noOverlap = guide.y + guide.height <= canvas.y || canvas.x + canvas.width <= guide.x;
    expect(noOverlap, `${name}: guide covers canvas`).toBe(true);
    await expectCompactUi(page);
    await expectProgress(page, 0, 4);
    await expectTouchTargets(page);
    await page.screenshot({ path: `test-results/tutorial-layout-${name}.png`, fullPage: true });
  }
});
