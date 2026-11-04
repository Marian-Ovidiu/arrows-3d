import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AccountRemoteError, AccountSync, type AccountState, type AccountUser, type CloudProgress, type ProgressBackend } from './account-sync.ts';
import { accountKey, cleanSave, GUEST_KEY, type KeyValueStore } from './account-store.ts';
import { accountStorage, prepareAccountStorage, flushAccountStorage } from './account-storage.ts';
import { beginNativeOAuth, clearNativeOAuth, nativeAuthCallback, NATIVE_AUTH_REDIRECT } from './native-oauth.ts';
import { createSaveState, type SaveState } from './save-state.ts';
import { playerName } from './player-name.ts';
import { CATALOG_VERSION } from './puzzle.ts';
export type { AccountState } from './account-sync.ts';

declare global {
  interface ImportMeta { readonly env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string; VITE_SUPABASE_ANON_KEY?: string } }
}
const native = Capacitor.isNativePlatform();
const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim() ?? '';
// A secret/service key must never become an application credential.
function publicKey(value: string): boolean {
  if (value.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(atob(value.split('.')[1])).role === 'anon'; } catch { return false; }
}
const configured = /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url) && publicKey(key);
const store = accountStorage;
let client: SupabaseClient | null = null;
let initPromise: Promise<void> | null = null;
let authEvent = 0;
let clientGeneration = 0;
let latestAuthUserId: string | null = null;
let unsubscribeAuth: (() => void) | null = null;
const authStorageKey = configured ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : '';
// This adapter fences writes from a retired client, including a late token refresh.
function authStorage(generation: number): KeyValueStore {
  return {
    getItem: (name) => generation === clientGeneration ? store.getItem(name) : null,
    setItem: (name, value) => { if (generation === clientGeneration) store.setItem(name, value); },
    removeItem: (name) => { if (generation === clientGeneration) store.removeItem(name); },
  };
}
async function discardLocalSession(retired: SupabaseClient, expectedId?: string): Promise<void> {
  if (client !== retired || (expectedId && latestAuthUserId && latestAuthUserId !== expectedId)) return;
  ++clientGeneration;
  ++authEvent;
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  void retired.auth.stopAutoRefresh().catch(() => {});
  client = null;
  initPromise = null;
  for (const name of [authStorageKey, `${authStorageKey}-code-verifier`, `${authStorageKey}-user`]) {
    try { store.removeItem(name); } catch { /* In-memory fencing still prevents session resurrection. */ }
  }
}
let activeAction = false;
function remoteError(error: unknown): AccountRemoteError {
  const value = error as { status?: number; code?: string; name?: string } | null;
  if (value?.status === 401 || value?.status === 403 || ['PGRST301', 'PGRST302', 'refresh_token_not_found', 'session_not_found'].includes(value?.code ?? '')) return new AccountRemoteError('auth');
  if (value?.status && value.status >= 400 && value.status < 500) return new AccountRemoteError('server');
  return new AccountRemoteError('network');
}
async function bounded<T>(promise: PromiseLike<T>, timeout = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve(promise), new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new AccountRemoteError('network')), timeout); })]); }
  finally { clearTimeout(timer); }
}
function progress(value: unknown): CloudProgress {
  const record = value as { save?: SaveState; revision?: number; updated_at?: string } | null;
  if (!record || !Number.isSafeInteger(record.revision) || record.revision! < 1 || !record.save || ![1, 2].includes(record.save.version)) throw new AccountRemoteError('server');
  return { save: cleanSave(record.save), revision: record.revision!, updated_at: record.updated_at };
}
const backend: ProgressBackend = {
  async read() {
    if (!client) throw new AccountRemoteError('network');
    const { data, error } = await bounded(client.from('game_progress').select('save,revision,updated_at').maybeSingle());
    if (error) throw remoteError(error);
    return data ? progress(data) : null;
  },
  async write(save, revision) {
    if (!client) throw new AccountRemoteError('network');
    const { data, error } = await bounded(client.rpc('save_game_progress', { p_save: save, p_expected_revision: revision, p_catalog_version: CATALOG_VERSION, p_progress_version: 3 }));
    if (error) throw remoteError(error);
    if (!data || typeof data.ok !== 'boolean') throw new AccountRemoteError('server');
    if (data.ok === false && data.revision === 0 && data.save === null) return { save: createSaveState(), revision: 0, ok: false };
    return { ...progress(data), ok: data.ok };
  },
};
const manager = new AccountSync(store, configured ? backend : null);
export const accountState = (): AccountState => manager.state;
export const subscribeAccount = (listener: (state: AccountState) => void): (() => void) => manager.subscribe(listener);
export const onAccountSaveChange = (listener: (save: SaveState) => void): (() => void) => manager.onSave(listener);
export const writeAccountSave = (save: SaveState): void => manager.saveLocal(save);
export const currentAccountSave = (): SaveState => manager.save;
const userInfo = (user: User): AccountUser => ({ id: user.id, email: user.email ?? '', name: playerName(user.user_metadata) });

function cleanAuthUrl(): void {
  if (typeof window === 'undefined') return;
  const current = new URL(window.location.href);
  for (const name of ['code', 'error', 'error_code', 'error_description', 'sb_flow_id']) current.searchParams.delete(name);
  // Retain unrelated application query parameters and hash routes.
  const hash = new URLSearchParams(current.hash.slice(1));
  if (hash.has('access_token') || hash.has('error') || hash.has('refresh_token')) {
    for (const name of ['access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'provider_token', 'provider_refresh_token', 'error', 'error_code', 'error_description']) hash.delete(name);
    current.hash = hash.toString();
  }
  window.history.replaceState(window.history.state, '', current.pathname + current.search + current.hash);
}
function applySession(session: Session | null, expired = false): void {
  latestAuthUserId = session?.user.id ?? null;
  void manager.setUser(session?.user ? userInfo(session.user) : null, expired ? 'Sessione terminata. Accedi nuovamente per i progressi del tuo account.' : '');
}
let nativeListenersReady: Promise<void> | undefined;
async function completeNativeAuth(raw: string): Promise<void> {
  const callback = nativeAuthCallback(raw, store);
  const current = client;
  if (!callback || !current) return;
  // Consume before awaiting to deduplicate getLaunchUrl/appUrlOpen delivery.
  clearNativeOAuth(store);
  const generation = clientGeneration;
  try {
    await flushAccountStorage();
    if ('error' in callback) {
      manager.message('Accesso Google annullato o non riuscito. Riprova.');
      return;
    }
    const { data, error } = await bounded(current.auth.exchangeCodeForSession(callback.code));
    if (generation !== clientGeneration || client !== current) return;
    if (error) throw error;
    await flushAccountStorage();
    ++authEvent;
    applySession(data.session);
  } catch {
    if (generation === clientGeneration) manager.message('Accesso Google non riuscito o link scaduto. Riprova.');
  } finally { await Browser.close().catch(() => {}); }
}
async function initializeNativeAuth(): Promise<void> {
  nativeListenersReady ??= (async () => {
    await App.addListener('appUrlOpen', ({ url }) => { void completeNativeAuth(url); });
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) { void client?.auth.startAutoRefresh(); void manager.sync(); }
      else { void client?.auth.stopAutoRefresh(); void flushAccountStorage().catch(() => {}); }
    });
  })();
  await nativeListenersReady;
  const launch = await App.getLaunchUrl();
  if (launch?.url) await completeNativeAuth(launch.url);
  const state = await App.getState();
  if (state.isActive) void client?.auth.startAutoRefresh();
  else void client?.auth.stopAutoRefresh();
}
export function initializeAccount(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await prepareAccountStorage();
      if (!manager.state.user) manager.externalChange(GUEST_KEY);
      if (!configured) return;
      const { createClient } = await import('@supabase/supabase-js');
      const generation = ++clientGeneration;
      client = createClient(url, key, {
        auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, storageKey: authStorageKey, storage: authStorage(generation) },
        global: { fetch: async (input, init) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const abort = () => controller.abort();
          init?.signal?.addEventListener('abort', abort, { once: true });
          try { return await fetch(input, { ...init, signal: controller.signal }); }
          finally { clearTimeout(timeout); init?.signal?.removeEventListener('abort', abort); }
        } },
      });
      const { data: authSubscription } = client.auth.onAuthStateChange((event, session) => {
        if (generation !== clientGeneration) return;
        latestAuthUserId = session?.user.id ?? null;
        const version = ++authEvent;
        // Never await another SDK call while its auth callback is executing.
        setTimeout(() => { if (generation === clientGeneration && version === authEvent) applySession(session, event === 'SIGNED_OUT' && !!manager.state.user && !activeAction); }, 0);
      });
      unsubscribeAuth = () => authSubscription.subscription.unsubscribe();
      if (native) await initializeNativeAuth();
      const location = typeof window === 'undefined' ? null : new URL(window.location.href);
      const code = location?.searchParams.get('code');
      if (location?.searchParams.has('error') || location?.hash.includes('error=')) {
        cleanAuthUrl();
        manager.message('Accesso Google annullato o non riuscito. Riprova.');
      } else if (code) {
        try {
          const { data, error } = await bounded(client.auth.exchangeCodeForSession(code));
          if (error) throw error;
          ++authEvent;
          applySession(data.session);
        } catch { manager.message('Accesso Google non riuscito o link scaduto. Riprova.'); }
        finally { cleanAuthUrl(); }
      }
      const before = authEvent;
      const { data, error } = await bounded(client.auth.getSession());
      if (error) throw error;
      if (before === authEvent) applySession(data.session);
    } catch { manager.message('Impossibile verificare l’accesso. Puoi continuare a giocare come ospite.', 'offline'); }
  })();
  return initPromise;
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void manager.sync(); });
  window.addEventListener('storage', (event) => manager.externalChange(event.key));
  window.addEventListener('focus', () => { void manager.sync(); });
}
function available(): SupabaseClient {
  if (!client || !configured) throw new Error('Il cloud non è ancora configurato.');
  return client;
}
async function action(work: () => Promise<void>): Promise<void> {
  if (activeAction) return;
  activeAction = true;
  try { await initializeAccount(); await work(); }
  catch (error) {
    const message = error instanceof Error && !(error instanceof AccountRemoteError) && ['Il cloud non è ancora configurato.', 'Accedi dalla versione web per usare il cloud.', 'Inserisci un nome tra 1 e 80 caratteri.', 'Accedi prima di modificare il profilo.'].includes(error.message) ? error.message : 'Operazione non riuscita. Controlla la connessione e riprova.';
    manager.message(message);
    throw new Error(message);
  } finally { activeAction = false; }
}
export const signInGoogle = (): Promise<void> => action(async () => {
  const supabase = available();
  if (native) {
    beginNativeOAuth(store);
    try {
      const { data, error } = await bounded(supabase.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' },
      } }));
      if (error || !data.url) throw error ?? new Error('OAuth URL missing');
      // Android may reclaim the WebView while Chrome is open: persist PKCE first.
      await flushAccountStorage();
      await Browser.open({ url: data.url, toolbarColor: '#163a35' });
    } catch (error) { clearNativeOAuth(store); await flushAccountStorage(); throw error; }
    return;
  }
  const redirect = new URL(window.location.href);
  for (const name of ['code', 'error', 'error_code', 'error_description', 'sb_flow_id']) redirect.searchParams.delete(name);
  const { error } = await bounded(supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect.toString(), queryParams: { prompt: 'select_account' } } }));
  if (error) throw error;
});
export const signOutAccount = (): Promise<void> => action(async () => {
  const supabase = available();
  const id = manager.state.user?.id;
  await bounded(manager.sync(), 2_000).catch(() => {});
  if (id !== manager.state.user?.id || (latestAuthUserId && latestAuthUserId !== id)) return;
  manager.suspend();
  // Local logout must work offline; the scoped outbox remains available on the next login.
  await bounded(supabase.auth.signOut({ scope: 'local' }), 2_000).catch(() => {});
  if (manager.state.user?.id !== id && manager.state.user !== null) return;
  await discardLocalSession(supabase, id);
  clearNativeOAuth(store);
  if (!latestAuthUserId || latestAuthUserId === id) await manager.setUser(null);
  await flushAccountStorage();
});
export const deleteAccount = (): Promise<void> => action(async () => {
  const supabase = available();
  const id = manager.state.user?.id;
  if (!id) throw new Error('Accedi prima di modificare il profilo.');
  // A server success is required before touching the durable outbox.
  manager.suspend();
  try {
    const { data, error } = await bounded(supabase.rpc('delete_own_account'));
    if (error || data !== true) throw error ?? new AccountRemoteError('server');
  } catch (error) {
    if (manager.state.user?.id === id) manager.resume();
    throw error;
  }
  // A different account may have arrived from another tab while deletion was in flight.
  if ((manager.state.user?.id && manager.state.user.id !== id) || (latestAuthUserId && latestAuthUserId !== id)) {
    store.removeItem(accountKey(id));
    return;
  }
  try {
    if (manager.state.user?.id === id) await manager.clearDeletedUser();
    else store.removeItem(accountKey(id));
  } finally {
    // Retire the token immediately; do not wait on a logout endpoint after server deletion.
    if (!latestAuthUserId || latestAuthUserId === id) void supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    await discardLocalSession(supabase, id);
    clearNativeOAuth(store);
    if (manager.state.user?.id === id) await manager.setUser(null, 'Account eliminato.');
    await flushAccountStorage();
  }
});
export const updateDisplayName = (name: string): Promise<void> => action(async () => {
  const value = name.trim();
  if (!value || value.length > 80) throw new Error('Inserisci un nome tra 1 e 80 caratteri.');
  if (!manager.state.user) throw new Error('Accedi prima di modificare il profilo.');
  const { data, error } = await bounded(available().auth.updateUser({ data: { display_name: value } }));
  if (error) throw error;
  if (data.user && data.user.id === manager.state.user?.id) await manager.setUser(userInfo(data.user));
});
export const syncAccount = (): Promise<void> => manager.sync();
export const resolveAccountConflict = (choice: 'local' | 'cloud'): Promise<void> => manager.resolve(choice);
export const importGuestProgress = (): Promise<void> => manager.importGuest();

export type AccountFeatureErrorCode = 'configured' | 'guest' | 'offline' | 'migration' | 'invalid' | 'server';
export class AccountFeatureError extends Error {
  constructor(public readonly code: AccountFeatureErrorCode, message: string) { super(message); this.name = 'AccountFeatureError'; }
}
/** Shared authenticated, bounded RPC transport; never exposes a service credential. */
export async function accountRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!configured) throw new AccountFeatureError('configured', 'Le classifiche online non sono ancora configurate.');
  await initializeAccount();
  const owner = manager.state.user?.id;
  if (!owner || !client) throw new AccountFeatureError('guest', 'Accedi per partecipare alle classifiche.');
  try {
    const { data, error } = await bounded(client.rpc(name, args));
    if (owner !== manager.state.user?.id) throw new AccountFeatureError('guest', 'L’account è cambiato. Riprova dopo l’accesso.');
    if (error) {
      if (['PGRST202', '42883', '42P01'].includes(error.code)) throw new AccountFeatureError('migration', 'Le classifiche richiedono l’aggiornamento del database.');
      if (!error.code && /fetch|network|offline|abort/i.test(error.message)) throw new AccountFeatureError('offline', 'Connessione assente. I progressi restano salvati su questo dispositivo.');
      if (['28000', 'PGRST301', 'PGRST302'].includes(error.code)) throw new AccountFeatureError('guest', 'La sessione è scaduta. Accedi nuovamente.');
      if (error.code === '22023') {
        const messages: Record<string, string> = {
          submit_discovery: 'Questa scoperta non è stata ancora verificata online. I progressi restano salvati.',
          get_leaderboard: 'La classifica di questo livello non è ancora disponibile online.',
          start_timed_run: 'Il tempo online non è disponibile per questa partita. Puoi continuare a giocare.',
          finish_timed_run: 'La partita non è valida o è scaduta. Avviane una nuova.',
        };
        throw new AccountFeatureError('invalid', messages[name] ?? 'Richiesta non valida. Aggiorna e riprova.');
      }
      throw new AccountFeatureError('server', 'Impossibile aggiornare la classifica. Riprova.');
    }
    return data as T;
  } catch (error) {
    if (error instanceof AccountFeatureError) throw error;
    throw new AccountFeatureError('offline', 'Connessione assente. I progressi restano salvati su questo dispositivo.');
  }
}
