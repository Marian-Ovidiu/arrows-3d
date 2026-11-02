import { test, expect, type Page } from '@playwright/test';
import { LEVELS, CHAPTERS, CAMPAIGN_INDEXES, TUTORIAL_INDEX, solve } from '../../src/puzzle';
import { chooseLevel, continueGame, extractPieces } from './navigation';

test.use({ viewport: { width: 390, height: 844 } });

test('all fifty discoveries and locked relic shelves fit phone and desktop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#tab-journey').click();
  await expect(page.locator('[data-level]')).toHaveCount(LEVELS.length);
  await expect(page.locator('.journey-chapter')).toHaveCount(CHAPTERS.length);
  await page.locator('[data-level="14"]').click();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[14].pieces.length}`);
  await page.screenshot({ path: 'test-results/campaign-last-phone.png' });
  await page.locator('#pause-game').click();
  await page.locator('#pause-collection').click();
  await expect(page.locator('#collection-progress')).toHaveText('0 / 50 reperti svelati · 0 / 10 collezioni complete');
  await expect(page.locator('[data-relic]')).toHaveCount(CAMPAIGN_INDEXES.length);
  await expect(page.locator('.is-discovered')).toHaveCount(0);
  await expect(page.locator('#relic-trial, #trial-ready-dialog, #trial-status')).toHaveCount(0);
  await expect(page.locator('#relic-stage canvas')).toBeVisible();
  for (const [width, height, name] of [[320,740,'small'],[390,844,'phone'],[1440,960,'desktop'],[844,390,'landscape']] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('#collection-screen').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const buttons = page.locator('#collection-screen button');
    for (const button of await buttons.all()) {
      if (!await button.isVisible()) continue;
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `test-results/collection-${name}.png` });
  }
  await page.locator('#relic-close').click();
  await expect(page.locator('#relic-detail')).toBeHidden();
  await page.locator('[data-rarity="epic"]').click();
  await expect(page.locator('[data-relic]')).toHaveCount(0);
  await page.locator('[data-rarity="all"]').click();
  await page.locator('[data-relic="14"]').click();
  await expect(page.locator('#relic-name')).toHaveText('Una meraviglia da svelare');
  await page.locator('#relic-play').click();
  await expect(page.locator('#scene canvas')).toBeVisible();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[14].pieces.length}`);
  expect(errors).toEqual([]);
});

test('an ordinary completion reveals its earned quality and personal time, then replay preserves the relic', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  await expect(page.locator('#trial-status, #trial-ready-dialog')).toHaveCount(0);
  await extractPieces(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-rarity')).toContainText('EPICO');
  await expect(page.locator('#win-record')).toBeVisible();
  await page.locator('#win-collection').click();
  await expect(page.locator('#relic-name')).toHaveText(LEVELS[0].artifact);
  await expect(page.locator('#relic-rarity')).toHaveText('Epico');
  await expect(page.locator('[data-relic="0"]')).toHaveClass(/is-discovered/);
  await expect(page.locator('#relic-record')).toContainText('Record personale');
  await page.screenshot({ path: 'test-results/relic-earned-phone.png' });
  const best = await page.evaluate(key => JSON.parse(localStorage.getItem('svela-save-v1')!).bestTimes[key], LEVELS[0].key);
  expect(best).toBeGreaterThan(0);
  await page.locator('#relic-play').click();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[0].pieces.length}`);
  await page.locator('#hint').click();
  await expect(page.locator('#hint')).toBeDisabled();
  await extractPieces(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-rarity')).toContainText('EPICO');
  await expect(page.locator('#win-record')).toBeVisible();
  await page.reload();
  await page.locator('#tab-collection').click();
  await page.locator('[data-relic="0"]').click();
  await expect(page.locator('#relic-rarity')).toHaveText('Epico');
  await expect(page.locator('#collection-progress')).toContainText('1 / 50');
});

test('guest rankings show personal progress and explain online participation without fabricated entries', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tab-rankings').click();
  await expect(page.locator('#personal-ranking .you-value')).toHaveText('0');
  await expect(page.locator('#ranking-list li')).toHaveCount(0);
  await expect(page.locator('#ranking-status')).toContainText(/Accedi|servizio sarà collegato/);
  await page.locator('[data-ranking="time"]').click();
  await expect(page.locator('#ranking-level option')).toHaveCount(CAMPAIGN_INDEXES.length);
  await page.locator('#ranking-level').selectOption(LEVELS[14].key);
  await expect(page.locator('#personal-ranking .you-value')).toHaveText('—');
  await page.screenshot({ path: 'test-results/rankings-phone.png' });
});

test('completed chapters build their miniature display and the last level leads to the collection', async ({ page }) => {
  const completed = LEVELS.map(level => level.key);
  const levels = Object.fromEntries(LEVELS.map(level => [level.key, { removedIds: solve(level.pieces)! }]));
  await page.addInitScript(save => { if (!localStorage.getItem('svela-save-v1')) localStorage.setItem('svela-save-v1', JSON.stringify(save)); }, { version: 2, activeLevel: LEVELS[CAMPAIGN_INDEXES.at(-1)!].key, completed, levels, bestTimes: {}, tutorial: { rotated: true, blockedSeen: true } });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.locator('#play-game').click();
  await expect(page.locator('#collection-screen')).toBeVisible();
  await expect(page.locator('#collection-progress')).toHaveText('50 / 50 reperti svelati · 10 / 10 collezioni complete');
  await expect(page.locator('.shelf-complete')).toHaveCount(CHAPTERS.length);
  await expect(page.locator('#relic-name')).toHaveText(LEVELS[CAMPAIGN_INDEXES.at(-1)!].artifact);
  await expect(page.locator('#relic-rarity')).toHaveText('Epico');
  await page.screenshot({ path: 'test-results/collection-complete-desktop.png' });
});

test('legacy demo migration preserves the tutorial and starts the new collection empty', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('svela-save-v1')) localStorage.setItem('svela-save-v1', JSON.stringify({ version: 1, activeLevel: 0, completed: [0,1,2,3], levels: { '0': { removedIds: ['1-0'] }, '3': { removedIds: ['intro-first','intro-blocker','intro-blocked','intro-last'] } }, tutorial: { rotated: true, blockedSeen: true } }));
  });
  await page.goto('/');
  await continueGame(page);
  await expect(page.locator('#tutorial-card')).toBeHidden();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[0].pieces.length}`);
  await page.locator('#pause-game').click();
  await page.locator('#pause-collection').click();
  await expect(page.locator('#collection-progress')).toContainText('0 / 50');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!));
  expect(save.version).toBe(2);
  expect(save.completed).toEqual([LEVELS[TUTORIAL_INDEX].key]);
});
