import { test, expect, type Page } from '@playwright/test';
import { LEVELS, CAMPAIGN_INDEXES, TUTORIAL_INDEX, solve } from '../../src/puzzle';
import { chooseLevel, continueGame } from './navigation';

test.use({ viewport: { width: 390, height: 844 } });
async function extract(page: Page, count: number) {
  await page.evaluate(count => {
    const canvas = document.querySelector('canvas')!;
    for (let i = 0; i < count; i++) {
      document.querySelector<HTMLButtonElement>('#hint')!.click();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  }, count);
}

test('a fifteen-level save preserves its undo history, records and tutorial in the expanded journey', async ({ page }) => {
  const old = LEVELS[14];
  const removedIds = solve(old.pieces)!.slice(0, 3);
  const save = { version: 2, activeLevel: old.key, completed: [LEVELS[0].key, LEVELS[TUTORIAL_INDEX].key], levels: { [old.key]: { removedIds } }, bestTimes: { [LEVELS[0].key]: 12345 }, tutorial: { rotated: true, blockedSeen: true } };
  await page.addInitScript(save => { if (!localStorage.getItem('svela-save-v1')) localStorage.setItem('svela-save-v1', JSON.stringify(save)); }, save);
  await page.goto('/');
  await continueGame(page);
  await expect(page.locator('#progress-label')).toHaveText(`3 / ${old.pieces.length}`);
  await page.locator('#undo').click();
  await expect(page.locator('#progress-label')).toHaveText(`2 / ${old.pieces.length}`);
  await chooseLevel(page, 15);
  await extract(page, 2);
  await page.reload();
  await continueGame(page);
  await expect(page.locator('#progress-label')).toHaveText(`2 / ${LEVELS[15].pieces.length}`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!));
  expect(stored.bestTimes).toEqual(save.bestTimes);
  expect(stored.completed).toEqual([...save.completed].sort());
  expect(stored.levels[old.key].removedIds).toEqual(removedIds.slice(0, 2));
  await chooseLevel(page, TUTORIAL_INDEX);
  await expect(page.locator('#progress-label')).toHaveText('0 / 4');
});

test('each new chapter renders, completes, reveals its relic and continues to the next puzzle', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL/.test(message.text())) errors.push(message.text()); });
  const missing: string[] = [];
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === 'http://127.0.0.1:5189') missing.push(response.url()); });
  await page.goto('/');
  for (const index of [15, 20, 25, 30, 35, 40, 45]) {
    await chooseLevel(page, index);
    await expect(page.locator('#app')).toHaveAttribute('data-environment-source', 'procedural');
    await expect(page.locator('#app')).toHaveAttribute('data-chapter', String(LEVELS[index].chapter));
    await page.screenshot({ path: `test-results/expansion-chapter-${LEVELS[index].chapter}-phone.png` });
    await extract(page, LEVELS[index].pieces.length);
    await expect(page.locator('#win-dialog')).toBeVisible();
    await expect(page.locator('#win-title')).toHaveText(LEVELS[index].artifact);
    await page.locator('#next-level').click();
    await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[index + 1].pieces.length}`);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!));
    expect(stored.completed).toContain(LEVELS[index].key);
    expect(stored.levels[LEVELS[index].key].solutionIds).toHaveLength(LEVELS[index].pieces.length);
  }
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});

test('level fifty finishes the journey and all new sculptures can be inspected on a small screen', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const last = CAMPAIGN_INDEXES.at(-1)!;
  const save = { version: 2, activeLevel: LEVELS[last].key, completed: LEVELS.filter(level => level.id < 50).map(level => level.key), levels: {}, bestTimes: {}, tutorial: { rotated: true, blockedSeen: true } };
  await page.addInitScript(save => { if (!localStorage.getItem('svela-save-v1')) localStorage.setItem('svela-save-v1', JSON.stringify(save)); }, save);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await continueGame(page);
  await extract(page, LEVELS[last].pieces.length);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-count')).toContainText('50/50');
  await page.locator('#next-level').click();
  await expect(page.locator('#collection-screen')).toBeVisible();
  await expect(page.locator('#collection-progress')).toHaveText('50 / 50 reperti svelati · 10 / 10 collezioni complete');
  for (let index = 15; index <= last; index++) {
    if (await page.locator('#relic-detail').isVisible()) await page.locator('#relic-close').click();
    await page.locator(`[data-relic="${index}"]`).click();
    await expect(page.locator('#relic-name')).toHaveText(LEVELS[index].artifact);
    await expect(page.locator('#relic-stage canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (index % 5 === 4) await page.screenshot({ path: `test-results/expansion-relic-${LEVELS[index].reward}-small.png` });
  }
  await page.screenshot({ path: 'test-results/expansion-finale-small.png' });
  expect(errors).toEqual([]);
});
