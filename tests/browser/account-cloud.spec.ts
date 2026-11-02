import { test, expect } from '@playwright/test';

// Run against a build configured with https://svela-test.supabase.co and a dummy public key.
// All requests to that host are intercepted; no Google login or external accounts are used.
test('account sync, profile, logout isolation and deletion failure/retry', async ({ page }) => {
  test.skip(!process.env.SVELA_ACCOUNT_TEST, 'Requires the isolated configured test build');
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'amica@example.test', aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString(), app_metadata: {provider:'google'}, user_metadata: {given_name:'Amica',full_name:'Amica Rossi'} };
  const save = {version:2,activeLevel:'tutorial-v1',completed:[],levels:{},bestTimes:{},tutorial:{rotated:true,blockedSeen:false}};
  let cloud: { save: any; revision: number; updated_at: string } = {save,revision:1,updated_at:new Date().toISOString()};
  let deleted = false; let failDeletion = true;
  await page.addInitScript(({user}) => {
    localStorage.setItem('sb-svela-test-auth-token', JSON.stringify({ access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user }));
  }, {user});
  await page.route('https://svela-test.supabase.co/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    const body = request.postDataJSON();
    let response: unknown;
    if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') user.user_metadata = {...user.user_metadata,...body.data};
      response = user;
    } else if (url.pathname === '/auth/v1/logout') response = {};
    else if (url.pathname === '/rest/v1/game_progress') response = cloud;
    else if (url.pathname.endsWith('/save_game_progress')) {
      if (body.p_expected_revision === cloud.revision) cloud = {save:body.p_save,revision:cloud.revision+1,updated_at:new Date().toISOString()};
      response = {...cloud,ok:body.p_expected_revision === cloud.revision-1};
    } else if (url.pathname.endsWith('/delete_own_account')) { if (failDeletion) { await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'temporary failure'})}); return; } deleted = true; response = true; }
    else { await route.abort(); return; }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto('/');
  await page.locator('#home-account').click();
  await expect(page.locator('#account-email')).toHaveText(user.email);
  await expect(page.locator('#account-status')).toContainText('sincronizzati');
  await expect(page.locator('#account-name')).toHaveValue('Amica');
  await page.locator('#account-name').fill('Esploratrice');
  await page.getByRole('button',{name:'Salva nome',exact:true}).click();
  await expect(page.locator('#account-name')).toHaveValue('Esploratrice');
  await page.getByRole('button',{name:'Chiudi account',exact:true}).click();
  await page.locator('#play-game').click();
  await page.locator('canvas').focus(); await page.keyboard.press('n'); await page.keyboard.press('Enter');
  await expect(page.locator('#progress-label')).toHaveText('1 / 4');
  await expect.poll(() => cloud.save.levels['tutorial-v1']?.removedIds.length).toBe(1);
  await page.locator('#pause-game').click(); await page.locator('#pause-home').click();
  await page.locator('#home-account').click();
  // A different device has reset its own snapshot; no maximum-progress merge is permitted.
  cloud = {save:{...save,tutorial:{rotated:false,blockedSeen:false}},revision:cloud.revision+1,updated_at:new Date().toISOString()};
  await page.locator('#account-sync').click();
  await expect(page.locator('#account-status')).toContainText('sincronizzati');
  // Clean cache adopts cloud; next launch must show the reset rather than one removed cube.
  if (await page.locator('#account-dialog').isVisible()) await page.getByRole('button',{name:'Chiudi account',exact:true}).click();
  await page.locator('#home-account').click();
  await page.locator('#account-logout').click();
  await expect(page.locator('#account-dialog')).not.toBeVisible();
  await page.locator('#home-account').click();
  await expect(page.locator('#account-guest')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb-svela-test-auth-token'))).toBeNull();
  await page.locator('#account-play-guest').click();
  await page.locator('#play-game').click();
  await expect(page.locator('#progress-label')).toHaveText('0 / 4');
  // The init fixture supplies a new login on reload, without opening Google.
  await page.reload();
  await page.locator('#home-account').click();
  await expect(page.locator('#account-email')).toHaveText(user.email);
  await page.locator('#account-delete-start').click();
  await page.locator('#delete-word').fill('ELIMINA');
  await page.getByRole('button',{name:'Elimina definitivamente',exact:true}).click();
  await expect(page.locator('#account-confirm [role=alert]')).toBeVisible();
  expect(deleted).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('svela-account-v1:')))).toBe(true);
  failDeletion = false;
  await page.getByRole('button',{name:'Elimina definitivamente',exact:true}).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(page.locator('#account-confirm')).not.toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('svela-account-v1:')))).toEqual([]);
});
