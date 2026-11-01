import { test, expect } from '@playwright/test';

test('guest can open account and continue without losing progress', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#home-account').click();
  await expect(page.locator('#account-dialog')).toBeVisible();
  if ((await page.locator('#account-status').textContent())?.includes('disponibili presto')) {
    await expect(page.locator('#google-login')).toBeDisabled();
  } else {
    await expect(page.locator('#google-login')).toBeEnabled();
  }
  await page.screenshot({ path: 'test-results/account-phone.png' });
  await page.locator('#account-play-guest').click();
  await page.locator('#play-game').click();
  const scene = page.locator('canvas');
  await scene.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('n');
  await page.keyboard.press('Enter');
  await expect(page.locator('#progress-label')).toHaveText('1 / 4');
  await page.locator('#pause-game').click();
  await page.locator('#pause-settings').click();
  await page.getByRole('button', { name: 'Il tuo account', exact: true }).click();
  await page.locator('#account-play-guest').click();
  await page.locator('#close-settings').click();
  await page.reload();
  await page.locator('#play-game').click();
  await expect(page.locator('#progress-label')).toHaveText('1 / 4');
});
