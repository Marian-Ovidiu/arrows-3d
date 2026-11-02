import { Capacitor } from '@capacitor/core';
import { accountState, initializeAccount, signInGoogle, subscribeAccount } from './account';
import { canPromptInstall, justInstalled, onInstallChange, promptInstall } from './pwa';
import { gateStep, installHelp, type GateStep, type InstallHelp } from './play-gate';
import { icon, type IconName } from './ui-icons';

type Step = { icon: IconName; title: string; text: string };
const STEPS: Record<Exclude<InstallHelp, 'prompt' | 'in-app' | 'unsupported'>, Step[]> = {
  ios: [
    { icon: 'share', title: 'Tocca Condividi', text: 'Il quadrato con la freccia, nella barra del browser.' },
    { icon: 'download', title: 'Aggiungi alla schermata Home', text: 'Scorri il menu se non lo vedi subito.' },
    { icon: 'home', title: 'Apri Svela', text: 'Dall’icona sulla schermata Home.' },
  ],
  android: [
    { icon: 'dots', title: 'Apri il menu del browser', text: 'I tre puntini in alto a destra.' },
    { icon: 'download', title: 'Installa app', text: 'Oppure “Aggiungi a schermata Home”.' },
    { icon: 'home', title: 'Apri Svela', text: 'Dall’icona tra le tue app.' },
  ],
  desktop: [
    { icon: 'download', title: 'Installa dalla barra degli indirizzi', text: 'L’icona a destra dell’indirizzo, oppure il menu ⋮ › Installa Svela.' },
    { icon: 'play', title: 'Gioca nella finestra di Svela', text: 'Si apre da sola dopo l’installazione.' },
  ],
  'mac-safari': [
    { icon: 'share', title: 'File › Aggiungi al Dock', text: 'Oppure dal pulsante Condividi.' },
    { icon: 'play', title: 'Apri Svela dal Dock', text: 'Si gioca nella sua finestra.' },
  ],
};

/**
 * A full-screen gate in front of the game: a browser tab first installs the app,
 * the installed app then asks for an account. The Android app and automated runs
 * are never gated; development opts in with `?gate` (or `?gate=login`).
 */
export function initPlayGate(hooks: { canInterrupt(): boolean; onOpenChange(open: boolean): void }) {
  const params = new URLSearchParams(location.search);
  const env = (import.meta as ImportMeta & { env: { PROD: boolean } }).env;
  const enforced = params.has('gate') || (env.PROD && !navigator.webdriver);
  const displayMode = matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)');
  const standalone = () => displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true || params.get('gate') === 'login';
  let checking = true;
  let guestForNow = false;
  let busy = false;
  let shown: GateStep | 'installed' = null;
  let shownHelp: InstallHelp | null = null;

  const gate = document.createElement('section');
  gate.id = 'play-gate'; gate.className = 'play-gate';
  gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true'); gate.setAttribute('aria-labelledby', 'gate-title');
  gate.hidden = true;
  document.body.append(gate);

  const logo = `<p class="gate-logo" aria-hidden="true">svela<span class="logo-sparkle">${icon('sparkle')}</span></p>`;
  const steps = (list: Step[]) => `<ol class="help-steps">${list.map(step => `<li>${icon(step.icon)}<strong>${step.title}</strong><span>${step.text}</span></li>`).join('')}</ol>`;
  const copyLink = `<button class="menu-option gate-copy" data-copy>${icon('link')}Copia il link</button>`;

  function installCard(help: InstallHelp) {
    const intro = '<h2 id="gate-title">Installa Svela per giocare</h2><p class="gate-copy-text">Svela si gioca dall’app: a schermo intero, anche offline, con i progressi sempre al sicuro.</p>';
    const already = '<p class="gate-note">Già installata? Aprila dalla schermata Home o dalle tue app.</p>';
    if (help === 'prompt') return `${intro}<button class="play-button" data-install>${icon('download')}Installa</button>${already}`;
    if (help === 'in-app') return `<h2 id="gate-title">Apri Svela nel browser</h2><p class="gate-copy-text">Questa app non può installare giochi. Tocca il menu ⋯ e scegli “Apri nel browser”, oppure copia il link e incollalo in Safari o Chrome.</p>${copyLink}`;
    if (help === 'unsupported') return `<h2 id="gate-title">Serve un altro browser</h2><p class="gate-copy-text">Questo browser non installa app. Apri Svela in Chrome, Edge o Safari per installarla.</p>${copyLink}`;
    return `${intro}${steps(STEPS[help])}${already}`;
  }
  function card(step: GateStep | 'installed', help: InstallHelp) {
    if (step === 'installed') return `<span class="sheet-badge" aria-hidden="true">${icon('check')}</span><h2 id="gate-title">Svela è installata!</h2><p class="gate-copy-text">Aprila dalla schermata Home o dalle tue app per cominciare a giocare.</p>`;
    if (step === 'install') return installCard(help);
    if (step === 'checking') return '<h2 id="gate-title">Un momento…</h2><p class="gate-copy-text" role="status">Controlliamo il tuo account.</p>';
    if (step === 'offline') return `<span class="sheet-badge" aria-hidden="true">${icon('user')}</span><h2 id="gate-title">Accesso non disponibile</h2><p class="gate-copy-text">Sei offline o il servizio non risponde. Puoi giocare subito: ti chiederemo di accedere appena torni online, e i progressi restano su questo dispositivo.</p><button class="play-button" data-guest>${icon('play')}Gioca</button>`;
    return `<span class="sheet-badge" aria-hidden="true">${icon('user')}</span><h2 id="gate-title">Accedi per cominciare</h2><p class="gate-copy-text">Le tue scoperte, i tempi e le classifiche ti seguono su ogni dispositivo.</p><button class="google-login" data-login><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>Continua con Google</button><p class="account-error" role="alert" data-error hidden></p>`;
  }

  function current(): GateStep | 'installed' {
    const state = accountState();
    const step = gateStep({
      enforced, native: Capacitor.isNativePlatform(), standalone: standalone(), configured: state.configured,
      checking, signedIn: !!state.user, reachable: navigator.onLine && state.status !== 'offline', guestForNow,
    });
    return step === 'install' && justInstalled() ? 'installed' : step;
  }
  function render() {
    const step = current();
    // A new requirement never interrupts a level: it waits for the next menu.
    if (step && !shown && !hooks.canInterrupt()) return;
    const help = installHelp(navigator.userAgent, navigator.maxTouchPoints, canPromptInstall());
    if (step !== shown || (step === 'install' && help !== shownHelp)) {
      shown = step; shownHelp = help;
      if (step) gate.innerHTML = `${logo}<div class="gate-card">${card(step, help)}</div>`;
    }
    const error = gate.querySelector<HTMLElement>('[data-error]');
    const state = accountState();
    if (error) { error.textContent = state.status === 'error' ? state.message : ''; error.hidden = !error.textContent; }
    gate.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = busy; });
    if (gate.hidden === !step) return;
    gate.hidden = !step;
    hooks.onOpenChange(!!step);
    if (step) gate.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }

  gate.addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest('button');
    if (!button || busy) return;
    if (button.hasAttribute('data-install')) { await promptInstall(); render(); }
    if (button.hasAttribute('data-guest')) { guestForNow = true; render(); }
    if (button.hasAttribute('data-copy')) {
      try { await navigator.clipboard.writeText(location.href); button.innerHTML = `${icon('check')}Link copiato`; }
      catch { button.textContent = location.href; }
    }
    if (button.hasAttribute('data-login')) {
      busy = true; render();
      try { await signInGoogle(); } catch { /* The account message explains what went wrong. */ }
      finally { busy = false; render(); }
    }
  });

  subscribeAccount(render);
  onInstallChange(render);
  displayMode.addEventListener('change', render);
  // Back online with a working service, the sign-in request returns at the next menu.
  window.addEventListener('online', () => { if (accountState().status !== 'offline') guestForNow = false; render(); });
  window.addEventListener('offline', render);
  render();
  void initializeAccount().finally(() => { checking = false; render(); });
  return { refresh: render, open: () => !gate.hidden };
}
