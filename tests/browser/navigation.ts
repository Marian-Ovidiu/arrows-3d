import { expect, type Page } from '@playwright/test';

export async function continueGame(page: Page) {
  await expect(page.locator('#home-screen')).toBeVisible();
  await page.locator('#play-game').click();
  await expect(page.locator('#home-screen')).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
}

export async function chooseLevel(page: Page, index: number) {
  if (await page.locator('#home-screen').isVisible()) {
    await page.locator('#tab-journey').click();
  } else if (!await page.locator('#journey-screen').isVisible()) {
    await page.locator('#pause-game').click();
    await expect(page.locator('#pause-dialog')).toBeVisible();
    await page.locator('#pause-journey').click();
  }
  await expect(page.locator('#journey-screen')).toBeVisible();
  await page.locator(`[data-level="${index}"]`).click();
  await expect(page.locator('#journey-screen')).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator(`[data-level="${index}"]`)).toHaveAttribute('aria-pressed', 'true');
}

export async function restartLevel(page: Page) {
  await page.locator('#pause-game').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#restart').click();
  await expect(page.locator('#pause-dialog')).toBeHidden();
}

/** Exercise ordinary keyboard play without bypassing the assistance cooldown. */
export async function extractPieces(page: Page, count = 500) {
  return page.evaluate(count => {
    const key = (key: string) => document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    const snapshots: { progress: string | null; removed: string[] }[] = [];
    for (let index = 0; index < count; index++) {
      const progress = document.querySelector('#progress-label')!.textContent!.split(' / ').map(Number);
      if (progress[0] === progress[1]) break;
      let found = false;
      for (let n = 0; n < progress[1] - progress[0]; n++) {
        key('n');
        if (document.querySelector('#announcement')!.textContent === 'Freccia selezionata. Uscita libera.') { found = true; break; }
      }
      if (!found) throw new Error('No free piece found through keyboard selection');
      key('Enter');
      const save = JSON.parse(localStorage.getItem('svela-save-v1')!);
      snapshots.push({ progress: document.querySelector('#progress-label')!.textContent, removed: save?.levels?.[save.activeLevel]?.removedIds ?? [] });
    }
    return snapshots;
  }, count);
}
