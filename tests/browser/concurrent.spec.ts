import { expect, test, type Page } from '@playwright/test';
import { chooseLevel, continueGame, extractPieces } from './navigation';
import { LEVELS, TUTORIAL_INDEX } from '../../src/puzzle';

const FIRST_TOTAL = LEVELS[0].pieces.length;

// Keep the full 560 ms flight: every burst below runs in one JS turn, before
// the renderer can advance any animation, regardless of machine speed.
test.use({ reducedMotion: 'no-preference' });

async function burst(page: Page, count: number) {
  return extractPieces(page, count);
}

async function savedIds(page: Page): Promise<string[]> {
  return page.evaluate(levelKey => JSON.parse(localStorage.getItem('svela-save-v1')!).levels[levelKey].removedIds, LEVELS[0].key);
}

test('three cubes commit immediately while their extraction flights overlap', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  const snapshots = await burst(page, 3);
  expect(snapshots.map(snapshot => snapshot.progress)).toEqual([`1 / ${FIRST_TOTAL}`, `2 / ${FIRST_TOTAL}`, `3 / ${FIRST_TOTAL}`]);
  expect(snapshots.map(snapshot => snapshot.removed.length)).toEqual([1, 2, 3]);
  expect(new Set(snapshots[2].removed).size).toBe(3);
  expect(snapshots[2].removed.slice(0, 2)).toEqual(snapshots[1].removed);
  await page.waitForTimeout(700);
  await expect(page.locator('#progress-label')).toHaveText(`3 / ${FIRST_TOTAL}`);
  expect(await savedIds(page)).toEqual(snapshots[2].removed);
});

test('undo restores the most recent flying cube and it can be extracted again immediately', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  const result = await page.evaluate(levelKey => {
    const removed = (): string[] => JSON.parse(localStorage.getItem('svela-save-v1')!).levels[levelKey].removedIds;
    const extract = () => {
      const key = (key: string) => document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      for (let n = 0; n < 100; n++) { key('n'); if (document.querySelector('#announcement')!.textContent === 'Freccia selezionata. Uscita libera.') break; }
      key('Enter');
    };
    extract(); extract(); extract();
    const before = removed();
    document.querySelector<HTMLButtonElement>('#undo')!.click();
    const afterUndo = removed();
    const undoProgress = document.querySelector('#progress-label')!.textContent;
    // Undo appends the restored cube to the remaining keyboard order.
    for (let n = 0; n < 8 - before.length + 1; n++) document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return { before, afterUndo, undoProgress, afterReextract: removed(), progress: document.querySelector('#progress-label')!.textContent };
  }, LEVELS[0].key);
  expect(result.before).toHaveLength(3);
  expect(result.afterUndo).toEqual(result.before.slice(0, 2));
  expect(result.undoProgress).toBe(`2 / ${FIRST_TOTAL}`);
  expect(result.afterReextract).toEqual(result.before);
  expect(result.progress).toBe(`3 / ${FIRST_TOTAL}`);
  await page.waitForTimeout(700);
  expect(await savedIds(page)).toEqual(result.before);
  // Old flight completion must not remove the restored cube or append history.
  for (const remainingCount of [2, 1, 0]) {
    await page.locator('#undo').click();
    await expect(page.locator('#progress-label')).toHaveText(`${remainingCount} / ${FIRST_TOTAL}`);
  }
  await expect(page.locator('#undo')).toBeDisabled();
  expect(await savedIds(page)).toEqual([]);
});

test('pausing persists overlapping flights and restarting clears them without late commits', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  const removed = await page.evaluate(levelKey => {
    for (let index = 0; index < 3; index++) {
      const key = (key: string) => document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      for (let n = 0; n < 100; n++) { key('n'); if (document.querySelector('#announcement')!.textContent === 'Freccia selezionata. Uscita libera.') break; }
      key('Enter');
    }
    document.querySelector<HTMLButtonElement>('#pause-game')!.click();
    return JSON.parse(localStorage.getItem('svela-save-v1')!).levels[levelKey].removedIds as string[];
  }, LEVELS[0].key);
  expect(removed).toHaveLength(3);
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.reload();
  await continueGame(page);
  await expect(page.locator('#progress-label')).toHaveText(`3 / ${FIRST_TOTAL}`);
  expect(await savedIds(page)).toEqual(removed);
  const reset = await page.evaluate(() => {
    for (let index = 0; index < 2; index++) {
      const key = (key: string) => document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      for (let n = 0; n < 100; n++) { key('n'); if (document.querySelector('#announcement')!.textContent === 'Freccia selezionata. Uscita libera.') break; }
      key('Enter');
    }
    const before = document.querySelector('#progress-label')!.textContent;
    document.querySelector<HTMLButtonElement>('#pause-game')!.click();
    document.querySelector<HTMLButtonElement>('#restart')!.click();
    return { before, after: document.querySelector('#progress-label')!.textContent };
  });
  expect(reset).toEqual({ before: `5 / ${FIRST_TOTAL}`, after: `0 / ${FIRST_TOTAL}` });
  await page.waitForTimeout(700);
  await expect(page.locator('#progress-label')).toHaveText(`0 / ${FIRST_TOTAL}`);
  expect(await savedIds(page)).toEqual([]);
  const [first] = await burst(page, 1);
  expect(first.progress).toBe(`1 / ${FIRST_TOTAL}`);
  expect(first.removed).toHaveLength(1);
});

test('a nudging blocked cube becomes extractable as soon as its blocker starts flying', async ({ page }) => {
  await page.goto('/');
  await continueGame(page);
  const result = await page.evaluate(levelKey => {
    const key = (key: string) => document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true}));
    const counts: (string|null)[] = [];
    const attempt = () => { key('n'); key('Enter'); counts.push(document.querySelector('#progress-label')!.textContent); };
    key('ArrowRight');
    attempt(); // first free cube
    attempt(); // terracotta cube: blocked, nudge begins
    attempt(); // its blocker begins flying
    attempt(); // terracotta is already free, despite its unfinished nudge
    attempt(); // final cube, all four flights can still be active
    key('Enter'); // cannot commit the departing cube twice
    document.querySelector<HTMLButtonElement>('#undo')!.click();
    const save = JSON.parse(localStorage.getItem('svela-save-v1')!);
    return {counts, removed:save.levels[levelKey].removedIds, progress:document.querySelector('#progress-label')!.textContent};
  }, LEVELS[TUTORIAL_INDEX].key);
  expect(result.counts).toEqual(['1 / 4','1 / 4','2 / 4','3 / 4','4 / 4']);
  expect(result.removed).toEqual(['intro-first','intro-blocker','intro-blocked']);
  expect(result.progress).toBe('3 / 4');
  // All previous flight callbacks and the cancelled win delay have elapsed.
  await page.waitForTimeout(1200);
  await expect(page.locator('#win-dialog')).toBeHidden();
  await expect(page.locator('#progress-label')).toHaveText('3 / 4');
  await page.locator('canvas').focus();
  await page.keyboard.press('n'); await page.keyboard.press('Enter');
  await expect(page.locator('#progress-label')).toHaveText('4 / 4');
  await expect(page.locator('#win-dialog')).toBeVisible();
});
