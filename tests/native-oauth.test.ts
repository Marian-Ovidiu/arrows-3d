import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginNativeOAuth, clearNativeOAuth, nativeAuthCallback, NATIVE_AUTH_REDIRECT } from '../src/native-oauth.ts';

function fixture() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
test('native callback requires an initiated, unexpired login and exact route', () => {
  const store = fixture();
  const callback = `${NATIVE_AUTH_REDIRECT}?code=one-use-code`;
  assert.equal(nativeAuthCallback(callback, store, 1000), null);
  beginNativeOAuth(store, 1000);
  assert.deepEqual(nativeAuthCallback(callback, store, 2000), { code: 'one-use-code' });
  for (const raw of ['not a URL', 'https://auth/callback?code=x', 'com.svela.puzzle://evil/callback?code=x', 'com.svela.puzzle://auth/other?code=x', 'com.svela.puzzle://user@auth/callback?code=x', `${NATIVE_AUTH_REDIRECT}?code=x&code=y`, `${NATIVE_AUTH_REDIRECT}?code=`, `${NATIVE_AUTH_REDIRECT}#access_token=stolen`]) {
    assert.equal(nativeAuthCallback(raw, store, 2000), null, raw);
  }
  assert.equal(nativeAuthCallback(callback, store, 999), null);
  assert.equal(nativeAuthCallback(callback, store, 601001), null);
  clearNativeOAuth(store);
  assert.equal(nativeAuthCallback(callback, store, 2000), null);
});
test('OAuth denial returns a generic error without trusting external descriptions', () => {
  const store = fixture();
  beginNativeOAuth(store, 1000);
  assert.deepEqual(nativeAuthCallback(`${NATIVE_AUTH_REDIRECT}?error=access_denied&error_description=untrusted`, store, 2000), { error: true });
  assert.deepEqual(nativeAuthCallback(`${NATIVE_AUTH_REDIRECT}?error=access_denied#error=access_denied`, store, 2000), { error: true });
  assert.deepEqual(nativeAuthCallback(`${NATIVE_AUTH_REDIRECT}#error=access_denied`, store, 2000), { error: true });
});
