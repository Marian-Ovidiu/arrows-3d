import { expect, type Page } from '@playwright/test';

export async function continueGame(page: Page) {
  await expect(page.locator('#home-screen')).toBeVisible();
  await page.locator('#play-game').click();
  await expect(page.locator('#home-screen')).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
}

export async function chooseLevel(page: Page, index: number) {
  if (await page.locator('#home-screen').isVisible()) {
    await page.locator('#open-journey').click();
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
