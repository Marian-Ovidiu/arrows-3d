import { expect, test } from '@playwright/test';
import { CATALOG_VERSION } from '../../src/puzzle';
import { createSaveState, type SaveState } from '../../src/save-state';

// Use an isolated build with VITE_SUPABASE_URL=https://svela-test.supabase.co
// and a dummy sb_publishable_ key. The bridge and every backend request are mocked.
test('Android Google login survives app restart, syncs and isolates guest progress on logout', async ({ page }) => {
  test.skip(!process.env.SVELA_ACCOUNT_TEST, 'Requires the isolated configured test build');
  const guest = createSaveState();
  guest.tutorial.blockedSeen = true;
  const preferences = new Map<string, string>([['svela-save-v1', JSON.stringify(guest)]]);
  const user = {
    id: '00000000-0000-4000-8000-000000000002', email: 'android@example.test',
    aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString(),
    app_metadata: { provider: 'google' }, user_metadata: { given_name: 'Android' },
  };
  let cloud: { save: SaveState; revision: number; updated_at: string } = {
    save: { ...createSaveState(), tutorial: { rotated: true, blockedSeen: false } },
    revision: 1, updated_at: new Date().toISOString(),
  };
  const browserOpens: { url: string; verifier: string | undefined; pending: string | undefined }[] = [];
  const exchangedCodes: string[] = [];
  let launchUrl: string | undefined;
  let reads = 0;
  let browserCloses = 0;

  // Preferences lives outside the WebView, so it survives reload and clearing localStorage.
  await page.exposeBinding('__svelaNativeCall', async (_source, plugin: string, method: string, options: Record<string, string> = {}) => {
    if (plugin === 'Preferences') {
      if (method === 'keys') return { keys: [...preferences.keys()] };
      if (method === 'get') return { value: preferences.get(options.key) ?? null };
      if (method === 'set') { preferences.set(options.key, options.value); return {}; }
    }
    if (plugin === 'App') {
      if (method === 'getLaunchUrl') return launchUrl ? { url: launchUrl } : {};
      if (method === 'getState') return { isActive: true };
    }
    if (plugin === 'Browser') {
      if (method === 'open') {
        browserOpens.push({ url: options.url, verifier: preferences.get('sb-svela-test-auth-token-code-verifier'), pending: preferences.get('svela-oauth-pending') });
        return {};
      }
      if (method === 'close') { browserCloses++; return {}; }
    }
    throw new Error(`Unexpected native call: ${plugin}.${method}`);
  });
  await page.addInitScript(() => {
    const win = window as unknown as {
      androidBridge: object;
      Capacitor: object;
      __svelaNativeCall(plugin: string, method: string, options?: unknown): Promise<unknown>;
      __svelaAppEvent(event: string, data: unknown): void;
    };
    const listeners = new Map<string, Map<string, (data: unknown) => void>>();
    let callbackId = 0;
    win.androidBridge = {};
    win.Capacitor = {
      PluginHeaders: [
        { name: 'Preferences', methods: ['keys', 'get', 'set'].map(name => ({ name, rtype: 'promise' })) },
        { name: 'Browser', methods: ['open', 'close'].map(name => ({ name, rtype: 'promise' })) },
        { name: 'App', methods: [
          ...['getLaunchUrl', 'getState', 'removeListener'].map(name => ({ name, rtype: 'promise' })),
          { name: 'addListener', rtype: 'callback' },
        ] },
      ],
      nativePromise(plugin: string, method: string, options?: { eventName: string; callbackId: string }) {
        if (method === 'removeListener') { listeners.get(options!.eventName)?.delete(options!.callbackId); return Promise.resolve(); }
        return win.__svelaNativeCall(plugin, method, options);
      },
      nativeCallback(plugin: string, method: string, options: { eventName: string }, callback: (data: unknown) => void) {
        if (plugin !== 'App' || method !== 'addListener') throw new Error('Unexpected native callback');
        const id = String(++callbackId);
        if (!listeners.has(options.eventName)) listeners.set(options.eventName, new Map());
        listeners.get(options.eventName)!.set(id, callback);
        return id;
      },
    };
    win.__svelaAppEvent = (event, data) => listeners.get(event)?.forEach(callback => callback(data));
  });
  await page.route('https://svela-test.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postData() ? request.postDataJSON() : null;
    let response: unknown;
    if (url.pathname === '/auth/v1/token') {
      expect(url.searchParams.get('grant_type')).toBe('pkce');
      expect(body.code_verifier).toBeTruthy();
      exchangedCodes.push(body.auth_code);
      response = { access_token: 'android-test-access-token', refresh_token: 'android-test-refresh-token', token_type: 'bearer', expires_in: 3600, user };
    } else if (url.pathname === '/auth/v1/user') response = user;
    else if (url.pathname === '/auth/v1/logout') response = {};
    else if (url.pathname === '/rest/v1/game_progress') { reads++; response = cloud; }
    else if (url.pathname.endsWith('/save_game_progress')) {
      expect(body.p_catalog_version).toBe(CATALOG_VERSION);
      expect(body.p_progress_version).toBe(3);
      const ok = body.p_expected_revision === cloud.revision;
      if (ok) cloud = { save: body.p_save, revision: cloud.revision + 1, updated_at: new Date().toISOString() };
      response = { ...cloud, ok };
    } else { await route.abort(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });

  const gate = page.locator('#play-gate');
  const startLogin = async () => {
    await expect(gate.getByRole('heading')).toHaveText('Accedi per cominciare');
    await expect(gate.locator('[data-install]')).toHaveCount(0);
    const before = browserOpens.length;
    await gate.getByRole('button', { name: 'Continua con Google' }).click();
    await expect.poll(() => browserOpens.length).toBe(before + 1);
    const opened = browserOpens.at(-1)!;
    const oauth = new URL(opened.url);
    expect(oauth.origin).toBe('https://svela-test.supabase.co');
    expect(oauth.pathname).toBe('/auth/v1/authorize');
    expect(oauth.searchParams.get('provider')).toBe('google');
    expect(oauth.searchParams.get('redirect_to')).toBe('com.svela.puzzle://auth/callback');
    expect(oauth.searchParams.get('code_challenge_method')).toBe('s256');
    expect(oauth.searchParams.get('code_challenge')).toBeTruthy();
    // Both values must already be durable when Chrome opens.
    expect(opened.verifier).toBeTruthy();
    expect(Number(opened.pending)).toBeGreaterThan(Date.now() - 60_000);
  };

  await page.goto('/?gate');
  await startLogin();
  await page.evaluate(() => {
    (window as unknown as { __svelaAppEvent(event: string, data: unknown): void }).__svelaAppEvent('appUrlOpen', {
      url: 'com.svela.puzzle://auth/callback?error=access_denied#error=access_denied',
    });
  });
  await expect(gate.locator('[data-error]')).toContainText('annullato');
  await expect.poll(() => browserCloses).toBe(1);
  expect(exchangedCodes).toEqual([]);
  await startLogin();
  await page.evaluate(() => {
    const bridge = window as unknown as { __svelaAppEvent(event: string, data: unknown): void };
    const callback = { url: 'com.svela.puzzle://auth/callback?code=warm-code' };
    bridge.__svelaAppEvent('appUrlOpen', callback);
    bridge.__svelaAppEvent('appUrlOpen', callback);
  });
  await expect(gate).toBeHidden();
  await expect.poll(() => browserCloses).toBe(2);
  expect(exchangedCodes).toEqual(['warm-code']);
  await page.locator('#home-account').click();
  await expect(page.locator('#account-email')).toHaveText(user.email);
  await expect(page.locator('#account-status')).toContainText('sincronizzati');
  expect(reads).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Chiudi account', exact: true }).click();
  await page.locator('#play-game').click();
  await page.locator('canvas').focus();
  await page.keyboard.press('n');
  await page.keyboard.press('Enter');
  await expect(page.locator('#progress-label')).toHaveText('1 / 4');
  await expect.poll(() => cloud.save.levels['tutorial-v1']?.removedIds.length).toBe(1);
  expect(JSON.parse(preferences.get('svela-save-v1')!)).toEqual(guest);

  // A fresh WebView restores the session and account save from native Preferences alone.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(gate).toBeHidden();
  await page.locator('#home-account').click();
  await expect(page.locator('#account-email')).toHaveText(user.email);
  await expect(page.locator('#account-status')).toContainText('sincronizzati');
  await page.locator('#account-logout').click();
  await expect(gate.getByRole('heading')).toHaveText('Accedi per cominciare');
  expect(JSON.parse(preferences.get('svela-save-v1')!)).toEqual(guest);
  expect(await page.evaluate(() => localStorage.getItem('sb-svela-test-auth-token'))).toBeNull();

  // Android can reclaim the WebView while Chrome is open and deliver the code on launch.
  await startLogin();
  launchUrl = 'com.svela.puzzle://auth/callback?code=cold-code';
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(gate).toBeHidden();
  await page.locator('#home-account').click();
  await expect(page.locator('#account-email')).toHaveText(user.email);
  await expect(page.locator('#account-status')).toContainText('sincronizzati');
  expect(exchangedCodes).toEqual(['warm-code', 'cold-code']);
  expect(JSON.parse(preferences.get('svela-save-v1')!)).toEqual(guest);
});
