import { test, expect } from '@playwright/test';
import { LEVELS, TUTORIAL_INDEX, solve } from '../../src/puzzle';

test('online rankings submit durable proofs, render safe names and use the server timed-run result', async ({ page }) => {
  test.skip(!process.env.SVELA_ACCOUNT_TEST, 'Requires the isolated test build, with every backend request intercepted');
  const level = LEVELS[0];
  const proof = solve(level.pieces)!;
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'explorer@example.test', aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString(), app_metadata: { provider: 'google' }, user_metadata: { display_name: 'Esploratrice' } };
  let cloud: any = { save: { version: 2, activeLevel: level.key, completed: [level.key, LEVELS[TUTORIAL_INDEX].key], levels: { [level.key]: { removedIds: [], solutionIds: proof } }, bestTimes: {}, tutorial: { rotated: true, blockedSeen: true } }, revision: 1 };
  const discoveries: any[] = [], starts: any[] = [], finishes: any[] = [];
  await page.addInitScript(user => localStorage.setItem('sb-svela-test-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user })), user);
  await page.route('https://svela-test.supabase.co/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const body = request.postDataJSON();
    let result: unknown;
    if (path === '/auth/v1/user') result = user;
    else if (path === '/rest/v1/game_progress') result = cloud;
    else if (path.endsWith('/save_game_progress')) {
      const ok = body.p_expected_revision === cloud.revision;
      if (ok) cloud = { save: body.p_save, revision: cloud.revision + 1 };
      result = { ...cloud, ok };
    } else if (path.endsWith('/submit_discovery')) { discoveries.push(body); result = true; }
    else if (path.endsWith('/get_leaderboard')) result = [{ rank: 1, name: '<img src=x onerror=alert(1)>', value: body.p_kind === 'time' ? 12345 : 1, is_you: true }];
    else if (path.endsWith('/start_timed_run')) { starts.push(body); result = { id: '00000000-0000-4000-8000-000000000005' }; }
    else if (path.endsWith('/finish_timed_run')) { finishes.push(body); result = { elapsed_ms: 12345, best_ms: 12345 }; }
    else { await route.abort(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto('/');
  await page.locator('#home-account').click();
  await expect(page.locator('#account-status')).toContainText('sincronizzati');
  await page.getByRole('button', { name: 'Chiudi account', exact: true }).click();
  await page.locator('#tab-rankings').click();
  await expect(page.locator('#ranking-list li')).toHaveCount(1);
  await expect(page.locator('#ranking-list strong')).toHaveText('<img src=x onerror=alert(1)> · tu');
  await expect(page.locator('#ranking-list img')).toHaveCount(0);
  expect(discoveries.at(-1)).toEqual({ p_level_key: level.key, p_removed_ids: proof });
  await page.locator('[data-ranking="time"]').click();
  await expect(page.locator('#ranking-list li')).toContainText('00:12.345');
  await page.locator('#tab-collection').click();
  await page.locator('[data-relic="0"]').click();
  await page.locator('#relic-trial').click();
  await page.locator('#begin-trial').click();
  await expect(page.locator('#trial-label')).toHaveText('PROVA ONLINE');
  await page.evaluate(({ ids, order }) => {
    const key = (key: string) => document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    for (const id of order) {
      for (let n = 0; n <= ids.indexOf(id); n++) key('n');
      key('Enter'); ids.splice(ids.indexOf(id),1);
    }
  }, { ids: level.pieces.map(piece => piece.id), order: proof });
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#win-online')).toHaveText('Tempo online verificato · 00:12.345 · record 00:12.345');
  expect(starts).toEqual([{ p_level_key: level.key }]);
  expect(finishes).toEqual([{ p_run_id: '00000000-0000-4000-8000-000000000005', p_removed_ids: proof }]);
});
