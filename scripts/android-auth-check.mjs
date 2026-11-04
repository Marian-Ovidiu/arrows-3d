// Probe only the OAuth redirect configuration. No Google account or login is used.
import { NATIVE_AUTH_REDIRECT } from '../src/native-oauth.ts';
import { createHash, randomBytes } from 'node:crypto';
try { process.loadEnvFile('.env.local'); } catch { /* CI may inject public config. */ }
const base = process.env.VITE_SUPABASE_URL;
if (!base) throw new Error('VITE_SUPABASE_URL is required');
const authorize = new URL('/auth/v1/authorize', base);
authorize.searchParams.set('provider', 'google');
authorize.searchParams.set('redirect_to', NATIVE_AUTH_REDIRECT);
authorize.searchParams.set('code_challenge', createHash('sha256').update(randomBytes(32)).digest('base64url'));
authorize.searchParams.set('code_challenge_method', 's256');
const response = await fetch(authorize, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
const provider = new URL(response.headers.get('location') ?? base);
if (provider.hostname !== 'accounts.google.com' || !provider.searchParams.get('state')) {
  console.error(JSON.stringify({ status: response.status, destination: provider.origin + provider.pathname, error: provider.searchParams.get('error'), description: provider.searchParams.get('error_description') }));
  throw new Error('Google OAuth did not return a provider redirect');
}
const cancel = new URL('/auth/v1/callback', base);
cancel.searchParams.set('state', provider.searchParams.get('state'));
cancel.searchParams.set('error', 'access_denied');
const cookies = response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
const cancelled = await fetch(cancel, { redirect: 'manual', headers: { cookie: cookies }, signal: AbortSignal.timeout(15000) });
const destination = new URL(cancelled.headers.get('location') ?? base);
const route = `${destination.protocol}//${destination.host}${destination.pathname}`;
const allowed = route === NATIVE_AUTH_REDIRECT;
console.log(JSON.stringify({ googleEnabled: true, nativeRedirectAllowed: allowed, cancellationReturnsTo: route, errorInQuery: destination.searchParams.has('error'), errorInFragment: new URLSearchParams(destination.hash.slice(1)).has('error') }, null, 2));
if (!allowed) process.exitCode = 1;
