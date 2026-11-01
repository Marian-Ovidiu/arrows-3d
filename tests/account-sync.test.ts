import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountSync, AccountRemoteError, type CloudProgress, type ProgressBackend } from '../src/account-sync.ts';
import { accountKey, GUEST_KEY, readAccount, type KeyValueStore } from '../src/account-store.ts';
import { LEVELS } from '../src/puzzle.ts';
import { createSaveState, type SaveState } from '../src/save-state.ts';

class MemoryStore implements KeyValueStore {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const levelKey = (index: number): string => LEVELS[index].key;
function save(index: number): SaveState { return { ...createSaveState(), activeLevel: levelKey(index) }; }
const user = (id: string) => ({ id, email: `${id}@test.invalid`, name: id });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class Backend implements ProgressBackend {
  record: CloudProgress | null = null;
  offline = false;
  authError = false;
  writes: { save: SaveState; revision: number }[] = [];
  readGate: Promise<CloudProgress | null> | null = null;
  writeGate: Promise<void> | null = null;
  async read() {
    if (this.authError) throw new AccountRemoteError('auth');
    if (this.offline) throw new AccountRemoteError('network');
    return this.readGate ?? structuredClone(this.record);
  }
  async write(save: SaveState, revision: number) {
    this.writes.push({ save: structuredClone(save), revision });
    if (this.writeGate) { const gate = this.writeGate; this.writeGate = null; await gate; }
    if (this.offline) throw new AccountRemoteError('network');
    if ((this.record?.revision ?? 0) !== revision) return { ...structuredClone(this.record!), ok: false };
    this.record = { save: structuredClone(save), revision: revision + 1 };
    return { ...structuredClone(this.record), ok: true };
  }
}
const setup = () => {
  const store = new MemoryStore();
  const backend = new Backend();
  // Long debounce keeps tests deterministic; each test drives sync explicitly.
  const engine = new AccountSync(store, backend, false, 1_000_000);
  return { store, backend, engine };
};

test('cloud is canonical at first login; guest import is explicit and users are isolated', async () => {
  const { store, backend, engine } = setup();
  engine.saveLocal(save(2));
  backend.record = { save: save(3), revision: 8 };
  await engine.setUser(user('a'));
  assert.equal(engine.save.activeLevel, levelKey(3));
  assert.equal(engine.state.guestImportAvailable, true);
  assert.equal(backend.writes.length, 0);
  await engine.importGuest();
  assert.equal(engine.save.activeLevel, levelKey(2));
  assert.equal(backend.writes[0].revision, 8);
  await engine.setUser(null);
  assert.equal(engine.save.activeLevel, levelKey(2));
  backend.record = null;
  await engine.setUser(user('b'));
  assert.deepEqual(engine.save, createSaveState());
  assert.equal(readAccount(store, 'a')?.save.activeLevel, levelKey(2));
  assert.equal(readAccount(store, 'b'), null);
  assert.equal(JSON.parse(store.getItem(GUEST_KEY)!).activeLevel, levelKey(2));
  engine.suspend();
});

test('offline outbox survives restart, retries, and preserves full reset instead of merging maxima', async () => {
  const { store, backend, engine } = setup();
  backend.record = { save: { ...save(4), completed: [levelKey(1), levelKey(2)] }, revision: 4 };
  await engine.setUser(user('a'));
  backend.offline = true;
  engine.saveLocal(createSaveState());
  await engine.sync();
  assert.equal(engine.state.status, 'offline');
  assert.equal(readAccount(store, 'a')?.dirty, true);
  engine.suspend();
  const restarted = new AccountSync(store, backend, false, 1_000_000);
  await restarted.setUser(user('a'));
  assert.deepEqual(restarted.save, createSaveState());
  backend.offline = false;
  await restarted.sync();
  assert.deepEqual(backend.record?.save, createSaveState());
  assert.equal(backend.record?.revision, 5);
  assert.equal(readAccount(store, 'a')?.dirty, false);
  restarted.suspend();
});

test('CAS conflict never merges and choosing local still compares latest revision', async () => {
  const { engine, backend } = setup();
  backend.record = { save: save(1), revision: 1 };
  await engine.setUser(user('a'));
  engine.saveLocal(save(2));
  backend.record = { save: save(3), revision: 2 };
  await engine.sync();
  assert.equal(engine.state.status, 'conflict');
  assert.equal(engine.save.activeLevel, levelKey(2));
  assert.equal(backend.writes.length, 0);
  backend.record = { save: save(4), revision: 3 };
  await engine.resolve('local');
  assert.equal(backend.writes[0].revision, 3);
  assert.equal(backend.record?.save.activeLevel, levelKey(2));
  engine.suspend();
});

test('choosing cloud replaces local progress and emits reload once', async () => {
  const { engine, backend } = setup();
  backend.record = { save: save(1), revision: 1 };
  await engine.setUser(user('a'));
  engine.saveLocal(save(2));
  backend.record = { save: save(3), revision: 2 };
  await engine.sync();
  const replacements: SaveState[] = [];
  engine.onSave((value) => replacements.push(value));
  await engine.resolve('cloud');
  assert.equal(replacements.length, 1);
  assert.equal(engine.save.activeLevel, levelKey(3));
  assert.equal(engine.state.status, 'synced');
  engine.suspend();
});

test('in-flight edits upload in order against the new revision without reloading local game', async () => {
  const { engine, backend } = setup();
  await engine.setUser(user('a'));
  let reloads = 0;
  engine.onSave(() => reloads++);
  engine.saveLocal(save(1));
  const gate = deferred<void>();
  backend.writeGate = gate.promise;
  const uploading = engine.sync();
  await Promise.resolve();
  assert.equal(backend.writes.length, 1);
  engine.saveLocal(save(2));
  gate.resolve();
  await uploading;
  assert.deepEqual(backend.writes.map((entry) => entry.revision), [0, 1]);
  assert.equal(backend.record?.save.activeLevel, levelKey(2));
  assert.equal(reloads, 0);
  engine.suspend();
});

test('logout restores guest synchronously and stale account request cannot replace it or another user', async () => {
  const { engine, backend } = setup();
  engine.saveLocal(save(1));
  const gate = deferred<CloudProgress | null>();
  backend.readGate = gate.promise;
  const login = engine.setUser(user('a'));
  engine.saveLocal(save(2));
  const logout = engine.setUser(null);
  assert.equal(engine.save.activeLevel, levelKey(1));
  await logout;
  backend.readGate = null;
  await engine.setUser(user('b'));
  gate.resolve({ save: save(3), revision: 99 });
  await login;
  assert.deepEqual(engine.save, createSaveState());
  assert.equal(engine.state.user?.id, 'b');
  assert.equal(backend.writes.length, 0);
  engine.suspend();
});

test('CAS race at write is surfaced; selecting local again cannot silently win a newer write', async () => {
  const { engine, backend } = setup();
  await engine.setUser(user('a'));
  engine.saveLocal(save(1));
  const gate = deferred<void>();
  backend.writeGate = gate.promise;
  const uploading = engine.sync();
  await Promise.resolve();
  backend.record = { save: save(2), revision: 1 };
  gate.resolve();
  await uploading;
  assert.equal(engine.state.status, 'conflict');
  assert.equal(engine.save.activeLevel, levelKey(1));
  assert.equal(backend.record.save.activeLevel, levelKey(2));
  engine.suspend();
});

test('cross-tab change during read or upload preserves conflict and never overwrites external outbox', async () => {
  for (const during of ['read', 'write']) {
    const { engine, backend, store } = setup();
    await engine.setUser(user('a'));
    engine.saveLocal(save(1));
    const readGate = deferred<CloudProgress | null>();
    const writeGate = deferred<void>();
    if (during === 'read') backend.readGate = readGate.promise;
    else backend.writeGate = writeGate.promise;
    const syncing = engine.sync();
    await Promise.resolve();
    const other = { save: save(2), revision: 0, dirty: true, editId: 'another-tab' };
    store.setItem(accountKey('a'), JSON.stringify(other));
    engine.externalChange(accountKey('a'));
    readGate.resolve(null);
    writeGate.resolve();
    await syncing;
    assert.equal(engine.state.status, 'conflict');
    assert.equal(engine.save.activeLevel, levelKey(1));
    assert.equal(readAccount(store, 'a')?.editId, 'another-tab');
    engine.suspend();
  }
});

test('session expiry stops cloud requests until auth is renewed', async () => {
  const { engine, backend, store } = setup();
  await engine.setUser(user('a'));
  backend.authError = true;
  engine.saveLocal(save(2));
  await engine.sync();
  assert.equal(engine.state.status, 'error');
  assert.match(engine.state.message, /Sessione scaduta/);
  backend.authError = false;
  await engine.sync();
  assert.equal(backend.writes.length, 0);
  assert.equal(readAccount(store, 'a')?.dirty, true);
  await engine.setUser(user('a'));
  await engine.sync();
  assert.equal(backend.writes.length, 1);
  engine.suspend();
});

test('failed account deletion keeps scoped outbox; success clears only that owner', async () => {
  const { engine, backend, store } = setup();
  engine.saveLocal(save(1));
  await engine.setUser(user('a'));
  backend.offline = true;
  engine.saveLocal(save(2));
  engine.suspend(); // Wrapper suspends requests before calling delete_own_account.
  // Server failed: wrapper must not invoke clearDeletedUser.
  assert.equal(readAccount(store, 'a')?.dirty, true);
  assert.equal(engine.state.user?.id, 'a');
  backend.offline = false;
  engine.resume();
  await engine.sync();
  store.setItem(accountKey('b'), JSON.stringify({ save: save(3), revision: 3, dirty: true, editId: 'b' }));
  await engine.clearDeletedUser();
  assert.equal(readAccount(store, 'a'), null);
  assert.equal(readAccount(store, 'b')?.save.activeLevel, levelKey(3));
  assert.equal(engine.save.activeLevel, levelKey(1));
  assert.equal(engine.state.user, null);
});

test('no-op persistence neither dirties a clean cache nor starts an upload', async () => {
  const { engine, backend, store } = setup();
  backend.record = { save: save(2), revision: 2 };
  await engine.setUser(user('a'));
  engine.saveLocal(engine.save);
  assert.equal(readAccount(store, 'a')?.dirty, false);
  await engine.sync();
  assert.equal(backend.writes.length, 0);
  engine.suspend();
});
