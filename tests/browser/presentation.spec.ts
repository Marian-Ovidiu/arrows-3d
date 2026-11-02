import { test, expect } from '@playwright/test';

test('title, discovery path and pause present a complete game on phone and desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#play-game')).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height, name] of [[390,844,'phone'],[320,740,'small'],[1440,960,'desktop'],[844,390,'landscape']] as const) {
    await page.setViewportSize({width,height});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('#play-game')).toBeInViewport();
    await expect(page.locator('#tab-journey')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/home-${name}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#tab-journey').click();
  await page.screenshot({path:'test-results/journey-phone.png'});
  await page.locator('[data-level="0"]').click();
  await expect(page.locator('#game-hud')).toBeInViewport();
  await page.screenshot({path:'test-results/game-phone.png'});
  await page.locator('#pause-game').click();
  await page.screenshot({path:'test-results/pause-phone.png'});
  await page.locator('#pause-settings').click();
  const toggle = page.locator('#sound-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await page.screenshot({path:'test-results/settings-phone.png'});
  await page.reload();
  await page.locator('#home-settings').click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await page.locator('#close-settings').click();
  await expect(page.locator('#home-screen')).toBeVisible();
});
