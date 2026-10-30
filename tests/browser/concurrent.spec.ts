import { expect, test, type Page } from '@playwright/test';
import { chooseLevel, continueGame } from './navigation';

// Keep the full 560 ms flight: every burst below runs in one JS turn, before
// the renderer can advance any animation, regardless of machine speed.
test.use({ reducedMotion: 'no-preference' });

async function burst(page: Page, count: number) {
  return page.evaluate(count => {
    const snapshots: { progress: string | null; removed: string[] }[] = [];
    for (let index = 0; index < count; index++) {
      document.querySelector<HTMLButtonElement>('#hint')!.click();
      document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const save = JSON.parse(localStorage.getItem('svela-save-v1')!);
      snapshots.push({ progress: document.querySelector('#progress-label')!.textContent, removed: save.levels['0'].removedIds });
    }
    return snapshots;
  }, count);
}

async function savedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('svela-save-v1')!).levels['0'].removedIds);
}

test('three cubes commit immediately while their extraction flights overlap', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  const snapshots = await burst(page, 3);
  expect(snapshots.map(snapshot => snapshot.progress)).toEqual(['1 / 26', '2 / 26', '3 / 26']);
  expect(snapshots.map(snapshot => snapshot.removed.length)).toEqual([1, 2, 3]);
  expect(new Set(snapshots[2].removed).size).toBe(3);
  expect(snapshots[2].removed.slice(0, 2)).toEqual(snapshots[1].removed);
  await page.waitForTimeout(700);
  await expect(page.locator('#progress-label')).toHaveText('3 / 26');
  expect(await savedIds(page)).toEqual(snapshots[2].removed);
});

test('undo restores the most recent flying cube and it can be extracted again immediately', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  const result = await page.evaluate(() => {
    const removed = (): string[] => JSON.parse(localStorage.getItem('svela-save-v1')!).levels['0'].removedIds;
    const extract = () => {
      document.querySelector<HTMLButtonElement>('#hint')!.click();
      document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    extract(); extract(); extract();
    const before = removed();
    document.querySelector<HTMLButtonElement>('#undo')!.click();
    const afterUndo = removed();
    const undoProgress = document.querySelector('#progress-label')!.textContent;
    extract();
    return { before, afterUndo, undoProgress, afterReextract: removed(), progress: document.querySelector('#progress-label')!.textContent };
  });
  expect(result.before).toHaveLength(3);
  expect(result.afterUndo).toEqual(result.before.slice(0, 2));
  expect(result.undoProgress).toBe('2 / 26');
  expect(result.afterReextract).toEqual(result.before);
  expect(result.progress).toBe('3 / 26');
  await page.waitForTimeout(700);
  expect(await savedIds(page)).toEqual(result.before);
  // Old flight completion must not remove the restored cube or append history.
  for (const remainingCount of [2, 1, 0]) {
    await page.locator('#undo').click();
    await expect(page.locator('#progress-label')).toHaveText(`${remainingCount} / 26`);
  }
  await expect(page.locator('#undo')).toBeDisabled();
  expect(await savedIds(page)).toEqual([]);
});

test('pausing persists overlapping flights and restarting clears them without late commits', async ({ page }) => {
  await page.goto('/');
  await chooseLevel(page, 0);
  const removed = await page.evaluate(() => {
    for (let index = 0; index < 3; index++) {
      document.querySelector<HTMLButtonElement>('#hint')!.click();
      document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    document.querySelector<HTMLButtonElement>('#pause-game')!.click();
    return JSON.parse(localStorage.getItem('svela-save-v1')!).levels['0'].removedIds as string[];
  });
  expect(removed).toHaveLength(3);
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.reload();
  await continueGame(page);
  await expect(page.locator('#progress-label')).toHaveText('3 / 26');
  expect(await savedIds(page)).toEqual(removed);
  const reset = await page.evaluate(() => {
    for (let index = 0; index < 2; index++) {
      document.querySelector<HTMLButtonElement>('#hint')!.click();
      document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    const before = document.querySelector('#progress-label')!.textContent;
    document.querySelector<HTMLButtonElement>('#pause-game')!.click();
    document.querySelector<HTMLButtonElement>('#restart')!.click();
    return { before, after: document.querySelector('#progress-label')!.textContent };
  });
  expect(reset).toEqual({ before: '5 / 26', after: '0 / 26' });
  await page.waitForTimeout(700);
  await expect(page.locator('#progress-label')).toHaveText('0 / 26');
  expect(await savedIds(page)).toEqual([]);
  const [first] = await burst(page, 1);
  expect(first.progress).toBe('1 / 26');
  expect(first.removed).toHaveLength(1);
});

test('a nudging blocked cube becomes extractable as soon as its blocker starts flying', async ({ page }) => {
  await page.goto('/');
  await continueGame(page);
  const result = await page.evaluate(() => {
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
    return {counts, removed:save.levels['3'].removedIds, progress:document.querySelector('#progress-label')!.textContent};
  });
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
