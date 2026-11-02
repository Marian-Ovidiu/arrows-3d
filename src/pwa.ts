import { Capacitor } from '@capacitor/core';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pending: InstallPrompt | undefined;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

/** True once the browser offers its own install dialog. */
export const canPromptInstall = () => !!pending;
/** True after this page accepted an installation. */
export const justInstalled = () => installed;
export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Shows the browser install dialog; resolves true when the player accepts. */
export async function promptInstall(): Promise<boolean> {
  const prompt = pending;
  if (!prompt) return false;
  pending = undefined;
  notify();
  try {
    await prompt.prompt();
    return (await prompt.userChoice).outcome === 'accepted';
  } catch {
    // Browser dismissal or revoked availability leaves the page as it was.
    return false;
  }
}

let registration: ServiceWorkerRegistration | undefined;
let safeToReload = () => true;
let reloading = false;
/**
 * Switch to a downloaded version as soon as no level is in progress. Progress is
 * saved on every move, so a reload from a menu loses nothing.
 */
export function applyPendingUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting || !navigator.serviceWorker.controller || reloading || !safeToReload()) return;
  reloading = true;
  waiting.postMessage('svela-activate-update');
}
function checkForUpdate() {
  if (!registration || document.hidden) return;
  void registration.update().catch(() => { /* Offline: the cached version keeps working. */ });
}

/** Call after the menu markup exists. Installation stays a user initiated action. */
export function initPwa(isSafeToReload: () => boolean = () => true): void {
  safeToReload = isSafeToReload;
  const button = document.querySelector<HTMLButtonElement>('#install-game');
  if (button) button.hidden = true;
  if (Capacitor.isNativePlatform()) return;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pending = event as InstallPrompt;
    if (button) button.hidden = false;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    pending = undefined;
    installed = true;
    if (button) button.hidden = true;
    notify();
  });
  button?.addEventListener('click', () => {
    button.hidden = true;
    void promptInstall();
  });

  const env = (import.meta as ImportMeta & { env: { PROD: boolean; BASE_URL: string } }).env;
  if (!env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
  const register = async () => {
    const base = new URL(env.BASE_URL, document.baseURI);
    try {
      // updateViaCache: the browser always asks the server for sw.js, never its HTTP cache.
      registration = await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' });
    } catch { return; /* Offline installation can retry on the next visit. */ }
    registration.addEventListener('updatefound', () => {
      const worker = registration!.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed') applyPendingUpdate(); });
    });
    applyPendingUpdate();
    checkForUpdate();
    // An installed app is rarely closed: look again whenever it returns, and every 30 minutes.
    document.addEventListener('visibilitychange', checkForUpdate);
    setInterval(checkForUpdate, 30 * 60_000);
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}
