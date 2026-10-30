import { expect, test } from '@playwright/test';

test('the installed app shell and game assets reload offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#play-game')).toBeVisible();
  await expect(page.locator('canvas')).toBeAttached();
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
    return (await fetch(link.href)).json();
  });
  expect(manifest.display).toBe('standalone');
  await page.locator('#play-game').click();
  await page.locator('canvas').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('n');
  await page.keyboard.press('Enter');
  await expect(page.locator('#progress-label')).toHaveText('1 / 4');
  await page.reload();
  await expect(page.locator('#play-game')).toHaveText('Continua');
  await page.locator('#play-game').click();
  await expect(page.locator('#progress-label')).toHaveText('1 / 4');
  await context.setOffline(false);
});
