import { Capacitor } from '@capacitor/core';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Call after the menu markup exists. Installation stays a user initiated action. */
export function initPwa(): void {
  const button = document.querySelector<HTMLButtonElement>('#install-game');
  if (button) button.hidden = true;
  if (Capacitor.isNativePlatform()) return;

  let pending: InstallPrompt | undefined;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pending = event as InstallPrompt;
    if (button) button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    pending = undefined;
    if (button) button.hidden = true;
  });
  button?.addEventListener('click', async () => {
    const prompt = pending;
    if (!prompt) return;
    pending = undefined;
    button.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // Browser dismissal or revoked availability leaves the game usable.
    }
  });

  const env = (import.meta as ImportMeta & { env: { PROD: boolean; BASE_URL: string } }).env;
  if (!env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    const base = new URL(env.BASE_URL, document.baseURI);
    void navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname })
      .catch(() => { /* Offline installation can retry on the next visit. */ });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
