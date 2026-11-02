import { test, expect, type Page } from '@playwright/test';
import { LEVELS, solve } from '../../src/puzzle';
import { thresholdsForLevel } from '../../src/progression';
import { chooseLevel, continueGame, extractPieces } from './navigation';

test.use({ viewport: { width: 390, height: 844 } });
const first = LEVELS[0];
async function saved(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem('svela-save-v1')!).levels[key], first.key);
}

test('hidden time starts with ordinary play, survives reload and excludes pauses before any move', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await chooseLevel(page, 0);
  await expect(page.locator('#trial-status, #trial-clock, #trial-ready-dialog, #begin-trial')).toHaveCount(0);
  await page.clock.fastForward(7_500);
  await page.locator('#pause-game').click();
  const before = (await saved(page)).attempt;
  expect(before.elapsedMs).toBeGreaterThanOrEqual(7_500);
  expect(before.eligible).toBe(true);
  await page.clock.fastForward(60_000);
  await page.reload();
  await continueGame(page);
  await extractPieces(page, 1);
  const resumed = (await saved(page)).attempt;
  expect(resumed.elapsedMs).toBeGreaterThanOrEqual(before.elapsedMs);
  expect(resumed.elapsedMs - before.elapsedMs).toBeLessThan(5_000);
  expect(resumed.eligible).toBe(true);
  await page.reload();
  await continueGame(page);
  await extractPieces(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!));
  expect(state.bestTimes[first.key]).toBeGreaterThanOrEqual(before.elapsedMs);
  expect(state.bestTimes[first.key]).toBeLessThan(before.elapsedMs + 8_000);
});

test('assistance cooldown grows and persists through pause and reload without disqualifying the relic', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await chooseLevel(page, 0);
  await page.locator('#hint').click();
  await expect(page.locator('#hint')).toBeDisabled();
  expect((await saved(page)).attempt).toMatchObject({ hintsUsed: 1, eligible: true });
  expect((await saved(page)).attempt.hintWaitMs).toBeGreaterThan(4_000);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('#hint')!.click());
  expect((await saved(page)).attempt.hintsUsed).toBe(1);
  await page.clock.fastForward(5_000);
  await expect(page.locator('#hint')).toBeEnabled();
  await page.locator('#hint').click();
  expect((await saved(page)).attempt.hintWaitMs).toBeGreaterThan(9_000);
  await page.locator('#pause-game').click();
  const paused = (await saved(page)).attempt;
  await page.clock.fastForward(60_000);
  await page.reload();
  await continueGame(page);
  await expect(page.locator('#hint')).toBeDisabled();
  const restored = (await saved(page)).attempt;
  expect(restored.hintsUsed).toBe(2);
  expect(restored.hintWaitMs).toBeGreaterThan(paused.hintWaitMs - 3_000);
  await page.clock.fastForward(10_000);
  await expect(page.locator('#hint')).toBeEnabled();
  await page.locator('#hint').click();
  expect((await saved(page)).attempt.hintWaitMs).toBeGreaterThan(14_000);
  expect((await saved(page)).attempt.hintsUsed).toBe(3);
  await extractPieces(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-record')).toBeVisible();
  await expect(page.locator('#win-rarity')).toHaveText('EPICO');
  expect((await saved(page)).attempt).toMatchObject({ hintsUsed: 3, eligible: true, finished: true });
});

test('the same relic evolves from common to epic and never downgrades on a slower replay or undo', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await chooseLevel(page, 0);
  await page.clock.fastForward(thresholdsForLevel(first).uncommonMs + 1_000);
  await extractPieces(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-rarity')).toHaveText('COMUNE');
  await page.screenshot({ path: 'test-results/relic-common-result.png' });
  await page.locator('#win-collection').click();
  await expect(page.locator('#relic-rarity')).toHaveText('Comune');
  await page.screenshot({ path: 'test-results/relic-common-detail.png' });
  await page.locator('#relic-play').click();
  expect((await saved(page)).attempt.hintsUsed).toBe(0);
  await extractPieces(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-rarity')).toHaveText('EPICO');
  const best = await page.evaluate(key => JSON.parse(localStorage.getItem('svela-save-v1')!).bestTimes[key], first.key);
  await page.locator('#win-collection').click();
  await expect(page.locator('#relic-rarity')).toHaveText('Epico');
  await page.screenshot({ path: 'test-results/relic-epic-detail.png' });
  await page.locator('#relic-play').click();
  await page.clock.fastForward(thresholdsForLevel(first).uncommonMs + 1_000);
  await extractPieces(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-rarity')).toHaveText('EPICO');
  await page.locator('#admire').click();
  await page.locator('#undo').click();
  await extractPieces(page, 1);
  await expect(page.locator('#win-dialog')).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!));
  expect(state.bestTimes[first.key]).toBe(best);
  expect(state.levels[first.key].rarity).toBe('epic');
  expect(state.levels[first.key].attempt.eligible).toBe(false);
});

test('legacy partial boards keep their discovery without receiving an invented fast record', async ({ page }) => {
  const order = solve(first.pieces)!;
  await page.addInitScript(({key, removedIds}) => {
    if (!localStorage.getItem('svela-save-v1')) localStorage.setItem('svela-save-v1', JSON.stringify({version:2,activeLevel:key,completed:[],levels:{[key]:{removedIds}},bestTimes:{},tutorial:{rotated:true,blockedSeen:true}}));
  }, {key:first.key,removedIds:order.slice(0,-1)});
  await page.goto('/');
  await continueGame(page);
  await extractPieces(page, 1);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-rarity')).toHaveText('COMUNE');
  await expect(page.locator('#win-record')).toBeHidden();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!));
  expect(state.completed).toContain(first.key);
  expect(state.bestTimes[first.key]).toBeUndefined();
});

test('instructions and dialogs created after startup suspend both time and assistance until closed', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await chooseLevel(page, 0);
  await page.locator('#hint').click();
  await page.locator('#pause-game').click();
  const paused = (await saved(page)).attempt;
  await page.locator('#pause-settings').click();
  await page.locator('#help').click();
  await page.clock.fastForward(60_000);
  await page.locator('#help-dialog .dialog-close').click();
  await page.locator('#close-settings').click();
  await page.locator('#resume-game').click();
  await extractPieces(page, 1);
  const resumed = (await saved(page)).attempt;
  expect(resumed.elapsedMs - paused.elapsedMs).toBeLessThan(4_000);
  expect(resumed.hintWaitMs).toBeGreaterThan(0);
  // Account dialogs are installed dynamically; the invariant applies to any
  // modal added after startup, without relying on startup-only listeners.
  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.id = 'late-dialog';
    document.body.append(dialog);
    dialog.showModal();
  });
  await page.clock.fastForward(60_000);
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#late-dialog')!.close());
  await page.clock.fastForward(5_000);
  await expect(page.locator('#hint')).toBeEnabled();
  await page.locator('#hint').click();
  const after = (await saved(page)).attempt;
  expect(after.elapsedMs - resumed.elapsedMs).toBeLessThan(10_000);
  expect(after.hintsUsed).toBe(2);
});
