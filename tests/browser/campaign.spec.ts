import { test, expect, type Page } from '@playwright/test';
import { LEVELS, CAMPAIGN_INDEXES, TUTORIAL_INDEX, solve } from '../../src/puzzle';
import { chooseLevel, continueGame } from './navigation';

test.use({ viewport: { width: 390, height: 844 } });

async function finishWithHints(page: Page, index = 0) {
  await page.evaluate(count => {
    for (let i = 0; i < count; i++) {
      document.querySelector<HTMLButtonElement>('#hint')!.click();
      document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  }, LEVELS[index].pieces.length);
  await expect(page.locator('#win-dialog')).toBeVisible();
}

async function solveWithoutAssistance(page: Page, index = 0, count = Infinity) {
  const level = LEVELS[index];
  const order = solve(level.pieces)!.slice(0, count);
  await page.evaluate(({ ids, order }) => {
    const key = (key: string) => document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    const remaining = [...ids];
    for (const id of order) {
      for (let n = 0; n <= remaining.indexOf(id); n++) key('n');
      key('Enter');
      remaining.splice(remaining.indexOf(id), 1);
    }
  }, { ids: level.pieces.map(piece => piece.id), order });
}

test('all fifteen discoveries and locked relic shelves fit phone and desktop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#open-journey').click();
  await expect(page.locator('[data-level]')).toHaveCount(16);
  await expect(page.locator('.journey-chapter')).toHaveCount(3);
  await page.locator('[data-level="14"]').click();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[14].pieces.length}`);
  await page.screenshot({ path: 'test-results/campaign-last-phone.png' });
  await page.locator('#pause-game').click();
  await page.locator('#pause-collection').click();
  await expect(page.locator('#collection-progress')).toHaveText('0 / 15 reperti svelati · 0 / 3 collezioni complete');
  await expect(page.locator('[data-relic]')).toHaveCount(15);
  await expect(page.locator('.is-discovered')).toHaveCount(0);
  await expect(page.locator('#relic-trial')).toBeHidden();
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
  await page.locator('[data-rarity="epic"]').click();
  await expect(page.locator('[data-relic]')).toHaveCount(1);
  await page.locator('[data-relic="14"]').click();
  await expect(page.locator('#relic-name')).toHaveText('Una meraviglia da svelare');
  await page.locator('#relic-play').click();
  await expect(page.locator('#scene canvas')).toBeVisible();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[14].pieces.length}`);
  expect(errors).toEqual([]);
});

test('discovering a relic unlocks its sculpture and time trial permanently through reset and reload', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  await finishWithHints(page);
  await expect(page.locator('#win-rarity')).toContainText('COMUNE');
  await page.locator('#win-collection').click();
  await expect(page.locator('#relic-name')).toHaveText(LEVELS[0].artifact);
  await expect(page.locator('[data-relic="0"]')).toHaveClass(/is-discovered/);
  await expect(page.locator('#relic-trial')).toBeVisible();
  await page.screenshot({ path: 'test-results/relic-discovered-phone.png' });
  await page.locator('#relic-trial').click();
  await expect(page.locator('#trial-ready-dialog')).toBeVisible();
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${LEVELS[0].pieces.length}`);
  await page.locator('#begin-trial').click();
  await expect(page.locator('#trial-label')).toHaveText('RECORD PERSONALE');
  await page.waitForTimeout(90);
  await solveWithoutAssistance(page);
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-record')).toContainText('Nuovo record personale');
  const best = await page.evaluate(key => JSON.parse(localStorage.getItem('svela-save-v1')!).bestTimes[key], LEVELS[0].key);
  expect(best).toBeGreaterThan(0);
  await page.reload();
  await page.locator('#open-collection').click();
  await expect(page.locator('#relic-record')).toContainText('Record personale');
  await expect(page.locator('#collection-progress')).toContainText('1 / 15');
  await page.locator('#relic-trial').click();
  await page.locator('#begin-trial').click();
  await page.locator('#hint').click();
  await expect(page.locator('#trial-label')).toHaveText('PROVA INTERROTTA · GIOCO LIBERO');
  await finishWithHints(page);
  await expect(page.locator('#win-record')).toBeHidden();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem('svela-save-v1')!).bestTimes[key], LEVELS[0].key)).toBe(best);
});

test('pause, undo and backgrounding end competitive attempts without taking away a relic', async ({ page }) => {
  await page.addInitScript(({ key, tutorialKey }) => {
    if (!localStorage.getItem('svela-save-v1')) localStorage.setItem('svela-save-v1', JSON.stringify({ version: 2, activeLevel: key, completed: [key,tutorialKey], levels: {}, bestTimes: {}, tutorial: { rotated: true, blockedSeen: true } }));
  }, { key: LEVELS[0].key, tutorialKey: LEVELS[TUTORIAL_INDEX].key });
  await page.goto('/');
  await continueGame(page);
  for (const action of ['pause', 'undo', 'background']) {
    await page.locator('#pause-game').click();
    await page.locator('#pause-trial').click();
    await page.locator('#begin-trial').click();
    if (action === 'pause') {
      await page.locator('#pause-game').click();
      await page.locator('#resume-game').click();
    } else if (action === 'undo') {
      await solveWithoutAssistance(page, 0, 1);
      await page.locator('#undo').click();
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await expect(page.locator('#trial-label')).toHaveText('PROVA INTERROTTA · GIOCO LIBERO');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem('svela-save-v1')!).completed.includes(key), LEVELS[0].key)).toBe(true);
  }
});

test('guest rankings show personal progress and explain online participation without fabricated entries', async ({ page }) => {
  await page.goto('/');
  await page.locator('#open-rankings').click();
  await expect(page.locator('#personal-ranking')).toHaveText('Il tuo viaggio · 0 livelli completati');
  await expect(page.locator('#ranking-list li')).toHaveCount(0);
  await expect(page.locator('#ranking-status')).toContainText(/Accedi|servizio sarà collegato/);
  await page.locator('[data-ranking="time"]').click();
  await expect(page.locator('#ranking-level option')).toHaveCount(CAMPAIGN_INDEXES.length);
  await page.locator('#ranking-level').selectOption(LEVELS[14].key);
  await expect(page.locator('#personal-ranking')).toContainText('ancora da scrivere');
  await page.screenshot({ path: 'test-results/rankings-phone.png' });
});

test('completed chapters build their miniature display and the last level leads to the collection', async ({ page }) => {
  const completed = LEVELS.map(level => level.key);
  const levels = Object.fromEntries(LEVELS.map(level => [level.key, { removedIds: solve(level.pieces)! }]));
  await page.addInitScript(save => { if (!localStorage.getItem('svela-save-v1')) localStorage.setItem('svela-save-v1', JSON.stringify(save)); }, { version: 2, activeLevel: LEVELS[14].key, completed, levels, bestTimes: {}, tutorial: { rotated: true, blockedSeen: true } });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.locator('#play-game').click();
  await expect(page.locator('#collection-screen')).toBeVisible();
  await expect(page.locator('#collection-progress')).toHaveText('15 / 15 reperti svelati · 3 / 3 collezioni complete');
  await expect(page.locator('.shelf-complete')).toHaveCount(3);
  await expect(page.locator('#relic-name')).toHaveText(LEVELS[14].artifact);
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
  await expect(page.locator('#collection-progress')).toContainText('0 / 15');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!));
  expect(save.version).toBe(2);
  expect(save.completed).toEqual([LEVELS[TUTORIAL_INDEX].key]);
});
