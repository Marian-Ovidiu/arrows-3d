import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountStorage } from '../src/account-storage.ts';
import { AccountSync } from '../src/account-sync.ts';
import { accountKey, GUEST_KEY, readAccount, type KeyValueStore } from '../src/account-store.ts';
import { createSaveState, type SaveState } from '../src/save-state.ts';
import { LEVELS } from '../src/puzzle.ts';

class MemoryStore implements KeyValueStore {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
class NativeStore {
  values = new Map<string, string>();
  writes: { key: string; value: string }[] = [];
  unavailable = false;
  async keys() { return { keys: [...this.values.keys()] }; }
  async get({ key }: { key: string }) { return { value: this.values.get(key) ?? null }; }
  async set(options: { key: string; value: string }) {
    if (this.unavailable) throw new Error('Disk unavailable');
    this.writes.push(options);
    this.values.set(options.key, options.value);
  }
}
const save = (index: number): SaveState => ({ ...createSaveState(), activeLevel: LEVELS[index].key });
const user = (id: string) => ({ id, email: `${id}@test.invalid`, name: id });
function setup() {
  const local = new MemoryStore();
  const native = new NativeStore();
  const storage = new AccountStorage(local, native, () => [...local.values.keys()]);
  return { local, native, storage };
}

test('native guest hydration refreshes a manager created before async Preferences', async () => {
  const { local, native, storage } = setup();
  local.setItem(GUEST_KEY, JSON.stringify(save(1)));
  native.values.set(GUEST_KEY, JSON.stringify(save(2)));
  const manager = new AccountSync(storage, null);
  assert.equal(manager.save.activeLevel, LEVELS[1].key);
  await storage.prepare();
  manager.externalChange(GUEST_KEY);
  assert.equal(manager.save.activeLevel, LEVELS[2].key);
  assert.equal(local.getItem(GUEST_KEY), native.values.get(GUEST_KEY));
});

test('native account caches and auth/PKCE restore while account writes preserve guest', async () => {
  const { native, storage } = setup();
  const guest = JSON.stringify(save(1));
  native.values.set(GUEST_KEY, guest);
  native.values.set(accountKey('a'), JSON.stringify({ save: save(2), revision: 7, dirty: true, editId: 'old' }));
  native.values.set('sb-project-auth-token', 'session');
  native.values.set('sb-project-auth-token-code-verifier', 'pkce');
  await storage.prepare();
  assert.equal(storage.getItem('sb-project-auth-token'), 'session');
  assert.equal(storage.getItem('sb-project-auth-token-code-verifier'), 'pkce');
  const manager = new AccountSync(storage, null);
  await manager.setUser(user('a'));
  assert.equal(manager.save.activeLevel, LEVELS[2].key);
  manager.saveLocal(save(3));
  await storage.flush();
  assert.equal(native.values.get(GUEST_KEY), guest);
  assert.equal(readAccount(storage, 'a')?.save.activeLevel, LEVELS[3].key);
  assert.equal(JSON.parse(native.values.get(accountKey('a'))!).save.activeLevel, LEVELS[3].key);
  await manager.setUser(user('b'));
  manager.saveLocal(save(4));
  await storage.flush();
  assert.equal(readAccount(storage, 'a')?.save.activeLevel, LEVELS[3].key);
  assert.equal(readAccount(storage, 'b')?.save.activeLevel, LEVELS[4].key);
  await manager.setUser(null);
  assert.equal(manager.save.activeLevel, LEVELS[1].key);
});

test('WebView fallback migrates to native storage before the next launch', async () => {
  const { local, native, storage } = setup();
  local.setItem(GUEST_KEY, JSON.stringify(save(2)));
  local.setItem('sb-project-auth-token', 'existing-session');
  await storage.prepare();
  await storage.flush();
  assert.equal(native.values.get(GUEST_KEY), local.getItem(GUEST_KEY));
  assert.equal(native.values.get('sb-project-auth-token'), 'existing-session');
});

test('native writes preserve order, report disk failures, and retry an unchanged snapshot', async () => {
  const { native, storage } = setup();
  native.unavailable = true;
  storage.setItem(GUEST_KEY, 'first');
  await assert.rejects(storage.flush(), /Disk unavailable/);
  assert.equal(storage.getItem(GUEST_KEY), 'first');
  native.unavailable = false;
  await storage.flush();
  assert.equal(native.values.get(GUEST_KEY), 'first');
  native.unavailable = true;
  storage.setItem(GUEST_KEY, 'old');
  await assert.rejects(storage.flush(), /Disk unavailable/);
  native.unavailable = false;
  storage.setItem(GUEST_KEY, 'new');
  await storage.flush();
  assert.equal(native.values.get(GUEST_KEY), 'new');
  assert.deepEqual(native.writes.map(write => write.value), ['first', 'new']);
});

test('a write during hydration wins over a late native read', async () => {
  const { native, storage } = setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const get = native.get.bind(native);
  native.get = async options => {
    const old = await get(options);
    if (options.key === GUEST_KEY) await gate;
    return old;
  };
  native.values.set(GUEST_KEY, 'old');
  const prepare = storage.prepare();
  await new Promise(resolve => setTimeout(resolve, 0));
  storage.setItem(GUEST_KEY, 'new');
  release();
  await prepare;
  await storage.flush();
  assert.equal(storage.getItem(GUEST_KEY), 'new');
  assert.equal(native.values.get(GUEST_KEY), 'new');
});

test('logout deletion remains authoritative when the WebView retains a stale token', async () => {
  const { local, native, storage } = setup();
  const key = 'sb-project-auth-token';
  local.setItem(key, 'old-session');
  native.values.set(key, 'old-session');
  await storage.prepare();
  local.removeItem = () => { throw new Error('Cache unavailable'); };
  storage.removeItem(key);
  await storage.flush();
  assert.equal(storage.getItem(key), null);
  const relaunched = new AccountStorage(local, native, () => [...local.values.keys()]);
  await relaunched.prepare();
  assert.equal(relaunched.getItem(key), null);
  assert.equal(local.getItem(key), 'old-session');
});

test('native saves work with an unavailable WebView cache; web storage errors still propagate', async () => {
  const broken: KeyValueStore = {
    getItem: () => { throw new Error('Cache unavailable'); },
    setItem: () => { throw new Error('Cache unavailable'); },
    removeItem: () => { throw new Error('Cache unavailable'); },
  };
  const native = new NativeStore();
  const storage = new AccountStorage(broken, native);
  storage.setItem(GUEST_KEY, 'progress');
  await storage.flush();
  assert.equal(storage.getItem(GUEST_KEY), 'progress');
  assert.equal(native.values.get(GUEST_KEY), 'progress');
  assert.throws(() => new AccountStorage(broken).setItem(GUEST_KEY, 'progress'), /Cache unavailable/);
});
