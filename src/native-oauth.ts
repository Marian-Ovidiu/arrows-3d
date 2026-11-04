import type { KeyValueStore } from './account-store.ts';

// Reverse-domain scheme is owned by this app. PKCE binds the returned code to
// the verifier stored on this device; tokens are never accepted from links.
export const NATIVE_AUTH_REDIRECT = 'com.svela.puzzle://auth/callback';
const PENDING_KEY = 'svela-oauth-pending';
const MAX_AGE = 10 * 60_000;

export function beginNativeOAuth(store: KeyValueStore, now = Date.now()): void {
  store.setItem(PENDING_KEY, String(now));
}
export function clearNativeOAuth(store: KeyValueStore): void { store.removeItem(PENDING_KEY); }

export type NativeAuthCallback = { code: string } | { error: true };
/** Strict routing, initiated flows only, no implicit tokens or arbitrary URLs. */
export function nativeAuthCallback(raw: string, store: KeyValueStore, now = Date.now()): NativeAuthCallback | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const expected = new URL(NATIVE_AUTH_REDIRECT);
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname || url.username || url.password) return null;
  const started = Number(store.getItem(PENDING_KEY));
  if (!started || now < started || now - started > MAX_AGE) return null;
  // Supabase may repeat OAuth errors in both the query and the fragment.
  if (url.searchParams.has('error') || new URLSearchParams(url.hash.slice(1)).has('error')) return { error: true };
  if (url.hash) return null;
  const codes = url.searchParams.getAll('code');
  return codes.length === 1 && codes[0] && codes[0].length <= 4096 ? { code: codes[0] } : null;
}
