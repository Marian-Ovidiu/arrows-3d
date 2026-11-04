import test from 'node:test';
import assert from 'node:assert/strict';
import { gateStep, installHelp, type GateContext } from '../src/play-gate.ts';

const base: GateContext = { enforced: true, native: false, standalone: true, configured: true, checking: false, signedIn: false, reachable: true, guestForNow: false };

test('a browser tab must install first; development and tests play directly', () => {
  assert.equal(gateStep({ ...base, standalone: false }), 'install');
  assert.equal(gateStep({ ...base, standalone: false, signedIn: true }), 'install');
  assert.equal(gateStep({ ...base, standalone: false, enforced: false }), null);
  assert.equal(gateStep({ ...base, standalone: false, native: true, enforced: false }), null);
});

test('native Android skips installation and follows the installed PWA account gate', () => {
  const native = { ...base, native: true, standalone: false };
  assert.equal(gateStep(native), 'login');
  assert.equal(gateStep({ ...native, checking: true }), 'checking');
  assert.equal(gateStep({ ...native, checking: true, reachable: false }), 'checking');
  assert.equal(gateStep({ ...native, signedIn: true }), null);
  assert.equal(gateStep({ ...native, configured: false }), null);
  assert.equal(gateStep({ ...native, reachable: false }), 'offline');
  assert.equal(gateStep({ ...native, reachable: false, guestForNow: true }), null);
  // Returning online requires sign-in again after the offline guest fallback.
  assert.equal(gateStep({ ...native, guestForNow: true }), 'login');
});

test('the installed app asks for sign-in, and falls back to guest play when the service is out of reach', () => {
  assert.equal(gateStep(base), 'login');
  assert.equal(gateStep({ ...base, checking: true }), 'checking');
  assert.equal(gateStep({ ...base, signedIn: true }), null);
  assert.equal(gateStep({ ...base, configured: false }), null);
  assert.equal(gateStep({ ...base, reachable: false }), 'offline');
  assert.equal(gateStep({ ...base, reachable: false, guestForNow: true }), null);
  // Back online, the request returns even after choosing to play as a guest.
  assert.equal(gateStep({ ...base, guestForNow: true }), 'login');
});

test('install help follows what each browser can do', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
  const instagram = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0';
  const webview = 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36';
  const firefox = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0';
  const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  assert.equal(installHelp(android, 5, true), 'prompt');
  assert.equal(installHelp(iphone, 5, false), 'ios');
  assert.equal(installHelp(ipad, 5, false), 'ios');
  assert.equal(installHelp(ipad, 0, false), 'mac-safari');
  assert.equal(installHelp(android, 5, false), 'android');
  assert.equal(installHelp(instagram, 5, true), 'in-app');
  assert.equal(installHelp(webview, 5, false), 'in-app');
  assert.equal(installHelp(firefox, 0, false), 'unsupported');
  assert.equal(installHelp(chrome, 0, false), 'desktop');
});
