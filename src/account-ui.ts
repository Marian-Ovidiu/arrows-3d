import { icon } from './ui-icons';
import { accountState, subscribeAccount, signInGoogle, signOutAccount, deleteAccount, updateDisplayName, syncAccount, resolveAccountConflict, importGuestProgress } from './account';

export function initAccountUi(beforeAction: () => Promise<void>) {
  const button = document.createElement('button');
  button.id = 'home-account'; button.className = 'round-button avatar-button'; button.setAttribute('aria-label', 'Il tuo account');
  button.innerHTML = icon('user');
  document.getElementById('top-bar-start')!.append(button);
  const settings = document.createElement('button'); settings.className = 'setting-row'; settings.innerHTML = `${icon('user')}<span>Il tuo account</span>${icon('forward')}`;
  document.querySelector('.local-save-note')!.before(settings);
  const dialog = document.createElement('dialog'); dialog.id = 'account-dialog'; dialog.className = 'sheet account-dialog'; dialog.setAttribute('aria-labelledby', 'account-title');
  dialog.innerHTML = `<button class="dialog-close round-button" aria-label="Chiudi account">${icon('close')}</button><h2 class="sheet-title" id="account-title">Account</h2>
    <p id="account-status" class="account-copy" role="status"></p><p id="account-error" class="account-error" role="alert" hidden></p>
    <div id="account-guest"><p class="account-copy">Ritrova le tue scoperte su ogni dispositivo.</p><button id="google-login" class="google-login"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>Continua con Google</button><button id="account-play-guest" class="menu-option">Continua senza account</button></div>
    <div id="account-member" hidden><form id="profile-form"><label for="account-name">Nome nel gioco</label><input id="account-name" maxlength="80" autocomplete="nickname" aria-describedby="account-name-note" required><p id="account-name-note" class="account-copy">Visibile in classifica.</p><p id="account-email" class="account-copy"></p><button class="menu-option" type="submit">Salva nome</button></form><button id="account-sync" class="menu-option">Sincronizza ora</button><button id="account-import" class="menu-option" hidden>Usa i progressi di questo dispositivo</button><div id="account-conflict" hidden><p class="account-copy">La partita è cambiata su un altro dispositivo. Quale vuoi conservare?</p><button id="keep-local" class="menu-option">Conserva questa partita</button><button id="keep-cloud" class="menu-option">Carica la partita online</button></div><button id="account-logout" class="menu-option">Esci dall’account</button><button id="account-delete-start" class="menu-option account-danger">Elimina account</button></div>`;
  document.getElementById('app')!.append(dialog);
  const confirm = document.createElement('dialog'); confirm.className = 'sheet account-dialog'; confirm.id = 'account-confirm';
  confirm.innerHTML = '<h2>Eliminare tutto?</h2><p class="account-copy">L’account e tutti i progressi online verranno cancellati definitivamente. Questa operazione non si può annullare.</p><form><label for="delete-word">Scrivi ELIMINA per confermare</label><input id="delete-word" autocomplete="off" required pattern="ELIMINA"><p class="account-error" role="alert" hidden></p><button class="menu-option account-danger" type="submit">Elimina definitivamente</button><button class="menu-option" type="button">Annulla</button></form>';
  document.getElementById('app')!.append(confirm);
  const importDialog = document.createElement('dialog'); importDialog.className = 'sheet account-dialog';
  importDialog.innerHTML = '<h2>Riparti da qui?</h2><p class="account-copy">I progressi salvati come ospite su questo dispositivo sostituiranno la partita del tuo account.</p><button class="menu-option" data-confirm>Usa questi progressi</button><button class="menu-option" data-cancel>Annulla</button>';
  document.getElementById('app')!.append(importDialog);
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  let busy = false;
  async function run(action: () => Promise<void>, destructive = false) {
    if (busy) return; busy = true; render(); el('account-error').hidden = true;
    try { await beforeAction(); await action(); }
    catch { const target = destructive ? confirm.querySelector<HTMLElement>('[role=alert]')! : el('account-error'); target.textContent = 'Operazione non riuscita. Controlla la connessione e riprova.'; target.hidden = false; }
    finally { busy = false; render(); }
  }
  function open() { dialog.showModal(); render(); }
  button.onclick = open; settings.onclick = open;
  dialog.querySelector<HTMLButtonElement>('.dialog-close')!.onclick = () => dialog.close();
  el('account-play-guest').onclick = () => dialog.close();
  el('google-login').onclick = () => void run(signInGoogle);
  el('account-sync').onclick = () => void run(syncAccount);
  el('account-logout').onclick = () => void run(signOutAccount);
  el('keep-local').onclick = () => void run(() => resolveAccountConflict('local'));
  el('keep-cloud').onclick = () => void run(() => resolveAccountConflict('cloud'));
  el('account-import').onclick = () => importDialog.showModal();
  importDialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = () => importDialog.close();
  importDialog.querySelector<HTMLButtonElement>('[data-confirm]')!.onclick = () => { importDialog.close(); void run(importGuestProgress); };
  el('profile-form').onsubmit = event => { event.preventDefault(); const name = el<HTMLInputElement>('account-name').value.trim(); void run(() => updateDisplayName(name)); };
  el('account-delete-start').onclick = () => { el<HTMLInputElement>('delete-word').value = ''; confirm.querySelector<HTMLElement>('[role=alert]')!.hidden = true; confirm.showModal(); };
  confirm.querySelector<HTMLButtonElement>('[type=button]')!.onclick = () => { if (!busy) confirm.close(); };
  confirm.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  confirm.querySelector('form')!.onsubmit = event => { event.preventDefault(); if (el<HTMLInputElement>('delete-word').value !== 'ELIMINA') return; void run(async () => { await deleteAccount(); confirm.close(); if (dialog.open) dialog.close(); }, true); };
  function render() {
    const state = accountState();
    el('account-status').textContent = state.nativeUnsupported ? 'L’accesso Google sarà disponibile nella versione web.' : !state.configured ? 'Gli account saranno disponibili presto. Intanto il tuo viaggio resta salvato qui.' : state.message;
    el('account-guest').hidden = !!state.user; el('account-member').hidden = !state.user;
    el('account-conflict').hidden = state.status !== 'conflict';
    el('account-import').hidden = !state.guestImportAvailable;
    el('account-email').textContent = state.user?.email ?? '';
    const initial = state.user?.name?.trim().charAt(0).toUpperCase();
    if (initial) { if (button.textContent !== initial) button.textContent = initial; }
    else if (!button.querySelector('svg')) button.innerHTML = icon('user');
    button.classList.toggle('has-initial', !!initial);
    const name = el<HTMLInputElement>('account-name'); if (document.activeElement !== name) name.value = state.user?.name ?? '';
    dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b => { b.disabled = busy; });
    confirm.querySelectorAll<HTMLButtonElement>('button').forEach(b => { b.disabled = busy; });
    el<HTMLButtonElement>('google-login').disabled = busy || !state.configured || state.nativeUnsupported || !state.ready;
    document.querySelector('.local-save-note')!.textContent = state.user ? 'I progressi sono salvati sul dispositivo e sincronizzati con il tuo account.' : 'I progressi sono salvati su questo dispositivo.';
  }
  subscribeAccount(render); render();
}
