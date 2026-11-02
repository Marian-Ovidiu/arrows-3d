import { LEVELS, CHAPTERS, CAMPAIGN_INDEXES, type Level } from './puzzle';
import { accountState, AccountFeatureError } from './account';
import { getLeaderboard, submitDiscovery, type LeaderboardKind } from './leaderboard';
import type { SaveState } from './save-state';
import { formatTime } from './time-trial';
import { relicRarity, thresholdsForLevel } from './progression';
import { icon, relicIcon, chapterIcon, pips, RARITY_PIPS } from './ui-icons';

export const RARITIES = { common: 'Comune', uncommon: 'Insolito', rare: 'Raro', epic: 'Epico' } as const;
const RARITY_GROUPS = { common: 'Comuni', uncommon: 'Insolite', rare: 'Rare', epic: 'Epiche' } as const;
type Hooks = {
  getSave(): SaveState;
  screen(next: 'home' | 'collection' | 'rankings'): void;
  preview(level: Level, discovered: boolean): void;
  play(index: number, restart?: boolean): void;
  account(): void;
};

/** The catalog drives every shelf and selector: no fixed level count in the UI. */
export function initMetagame(hooks: Hooks) {
  const container = document.createElement('div');
  container.innerHTML = `
    <section id="collection-screen" class="screen collection-screen" aria-label="Reliquie">
      <header class="screen-header rise"><h2>Reliquie</h2><span class="header-counter" id="collection-count"></span></header>
      <div class="meter rise" aria-hidden="true"><span id="collection-meter"></span></div>
      <p id="collection-progress" class="sr-only"></p>
      <div class="collection-filters rise" role="group" aria-label="Filtra per rarità">${(['all', 'common', 'uncommon', 'rare', 'epic'] as const).map(rarity => `<button data-rarity="${rarity}" aria-pressed="${rarity === 'all'}"${rarity === 'all' ? '' : ` aria-label="${RARITY_GROUPS[rarity]}"`}>${rarity === 'all' ? 'Tutte' : pips(RARITY_PIPS[rarity])}</button>`).join('')}</div>
      <div id="relic-shelves"></div>
    </section>
    <section id="relic-detail" class="relic-detail" role="dialog" aria-labelledby="relic-name" hidden>
      <div class="detail-top"><button id="relic-close" class="round-button" aria-label="Torna alle reliquie">${icon('back')}</button><span class="chip" id="relic-chapter"></span></div>
      <div class="relic-stage" id="relic-stage" aria-label="Osserva il reperto in 3D"></div>
      <div class="relic-details">
        <span class="rarity-line"><span id="relic-pips"></span><span class="rarity-badge" id="relic-rarity"></span></span>
        <h3 id="relic-name"></h3>
        <p id="relic-lore"></p>
        <p id="relic-record" class="chip relic-record"></p>
        <details id="relic-quality" class="relic-quality"><summary>Qualità della reliquia</summary><p>Rigioca per affinare questo reperto. La qualità migliore resta tua.</p><dl id="relic-thresholds"></dl></details>
        <div class="relic-actions"><button id="relic-play" class="play-button"></button></div>
      </div>
    </section>
    <section id="rankings-screen" class="screen rankings-screen" aria-label="Classifica">
      <header class="screen-header rise"><h2>Classifica</h2><button id="ranking-refresh" class="round-button" aria-label="Aggiorna">${icon('refresh')}</button></header>
      <div class="segmented ranking-tabs rise" role="group" aria-label="Tipo di classifica"><button data-ranking="discoveries" aria-pressed="true">${icon('gem')}Scoperte</button><button data-ranking="time" aria-pressed="false">${icon('clock')}Tempi</button></div>
      <div class="level-stepper" id="ranking-level-label" hidden><button id="ranking-prev" class="round-button" aria-label="Livello precedente">${icon('prev')}</button><select id="ranking-level" aria-label="Livello">${CAMPAIGN_INDEXES.map(index => `<option value="${LEVELS[index].key}">${index + 1} · ${LEVELS[index].name}</option>`).join('')}</select><button id="ranking-next" class="round-button" aria-label="Livello successivo">${icon('forward')}</button></div>
      <div class="ranking-message" id="ranking-message"><span class="message-art" aria-hidden="true">${icon('trophy')}</span><p id="ranking-status" class="ranking-status" role="status"></p><button id="ranking-account" class="play-button">${icon('user')}Accedi</button></div>
      <ol id="ranking-list" class="ranking-list" aria-label="Graduatoria"></ol>
      <div class="personal-ranking" id="personal-ranking" aria-label="La tua posizione"></div>
    </section>`;
  document.getElementById('app')!.append(...Array.from(container.children));
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  let selected = CAMPAIGN_INDEXES[0];
  let rarityFilter = 'all';
  let kind: LeaderboardKind = 'discoveries';
  let requestVersion = 0;
  let showingRankings = false;
  let yourRank: number | null = null;

  function selectRelic(index: number) {
    selected = index;
    const level = LEVELS[index];
    const save = hooks.getSave();
    const unlocked = save.completed.includes(level.key);
    const rarity = relicRarity(level, save);
    const detail = el('relic-detail');
    closing?.cancel();
    detail.hidden = false;
    detail.dataset.tone = unlocked ? rarity : 'unknown';
    el('relic-chapter').innerHTML = `${chapterIcon(level.chapter)}<span>${index + 1}</span>`;
    el('relic-chapter').setAttribute('aria-label', `${CHAPTERS.find(chapter => chapter.id === level.chapter)!.name}, livello ${index + 1}`);
    el('relic-name').textContent = unlocked ? level.artifact : 'Una meraviglia da svelare';
    el('relic-lore').textContent = unlocked ? level.lore : '';
    el('relic-pips').innerHTML = unlocked ? pips(RARITY_PIPS[rarity]) : '';
    el('relic-rarity').textContent = unlocked ? RARITIES[rarity] : '';
    el('relic-pips').parentElement!.hidden = !unlocked;
    const best = save.bestTimes[level.key];
    el('relic-record').innerHTML = unlocked && best ? `${icon('clock')}<span class="sr-only">Record personale</span>${formatTime(best)}` : unlocked ? '' : `${icon('view')}${level.pieces.length}`;
    el('relic-record').hidden = !el('relic-record').innerHTML;
    el('relic-quality').hidden = !unlocked;
    const thresholds = thresholdsForLevel(level);
    el('relic-thresholds').innerHTML = (['epic', 'rare', 'uncommon'] as const).map(quality => `<div><dt>${RARITIES[quality]}</dt><dd>entro ${formatTime(thresholds[`${quality}Ms`])}</dd></div>`).join('');
    el('relic-play').innerHTML = unlocked ? `${icon('restart')}Rigioca` : `${icon('play')}Gioca`;
    el('relic-play').setAttribute('aria-label', unlocked ? 'Rigioca il livello' : 'Gioca il livello');
    document.querySelectorAll<HTMLElement>('[data-relic]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.relic) === index)));
    hooks.preview(level, unlocked);
  }
  let closing: Animation | null = null;
  function closeDetail() {
    const detail = el('relic-detail');
    if (detail.hidden || closing) return;
    document.querySelector<HTMLElement>(`[data-relic="${selected}"]`)?.focus({ preventScroll: true });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !detail.animate) { detail.hidden = true; return; }
    // Slide away instead of vanishing; reopening mid-way cancels the exit.
    closing = detail.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(48px)' }], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)' });
    closing.onfinish = () => { closing = null; detail.hidden = true; };
    closing.oncancel = () => { closing = null; };
  }
  function refreshCollection() {
    const save = hooks.getSave();
    const count = CAMPAIGN_INDEXES.filter(index => save.completed.includes(LEVELS[index].key)).length;
    const total = CAMPAIGN_INDEXES.length;
    el('collection-progress').textContent = `${count} / ${total} reperti svelati · ${CHAPTERS.filter(chapter => CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === chapter.id).every(index => save.completed.includes(LEVELS[index].key))).length} / ${CHAPTERS.length} collezioni complete`;
    el('collection-count').innerHTML = `${icon('gem')}<span>${count}</span><small>/${total}</small>`;
    el('collection-meter').style.transform = `scaleX(${count / total})`;
    let order = 0;
    el('relic-shelves').innerHTML = CHAPTERS.map(chapter => {
      const indexes = CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === chapter.id);
      const collected = indexes.filter(index => save.completed.includes(LEVELS[index].key)).length;
      const visible = indexes.filter(index => rarityFilter === 'all' || (save.completed.includes(LEVELS[index].key) && relicRarity(LEVELS[index], save) === rarityFilter));
      if (!visible.length) return '';
      const complete = collected === indexes.length;
      return `<section class="relic-shelf ${complete ? 'shelf-complete' : ''}" data-chapter="${chapter.id}"><header><span class="shelf-icon">${chapterIcon(chapter.id)}</span><h3>${chapter.name}</h3><span class="shelf-count">${complete ? `${icon('check')}${collected}/${indexes.length}` : `${collected}/${indexes.length}`}</span></header><div class="relic-grid">${visible.map(index => {
        const level = LEVELS[index], unlocked = save.completed.includes(level.key);
        const rarity = relicRarity(level, save);
        return `<button class="relic-card ${unlocked ? 'is-discovered' : 'is-mystery'}" data-relic="${index}" data-tone="${unlocked ? rarity : 'unknown'}" aria-pressed="${index === selected}" aria-label="${unlocked ? `${level.artifact}, ${RARITIES[rarity]}` : `Reperto sconosciuto, scoperta ${index + 1}`}" style="--i:${order++}">${relicIcon(level.reward)}${unlocked ? pips(RARITY_PIPS[rarity]) : ''}</button>`;
      }).join('')}</div></section>`;
    }).join('');
    if (!el('relic-shelves').childElementCount) el('relic-shelves').innerHTML = '<p class="ranking-status">Non hai ancora reliquie di questa qualità.</p>';
    el('relic-shelves').querySelectorAll<HTMLElement>('[data-relic]').forEach(button => button.addEventListener('click', () => selectRelic(Number(button.dataset.relic))));
    if (!el('relic-detail').hidden) selectRelic(selected);
  }
  function personalRanking() {
    const save = hooks.getSave();
    const key = el<HTMLSelectElement>('ranking-level').value;
    const count = CAMPAIGN_INDEXES.filter(index => save.completed.includes(LEVELS[index].key)).length;
    const box = el('personal-ranking');
    const rank = document.createElement('span'); rank.className = 'you-rank'; rank.textContent = yourRank ? String(yourRank) : '–';
    const avatar = document.createElement('span'); avatar.className = 'you-avatar'; avatar.setAttribute('aria-hidden', 'true');
    const name = accountState().user?.name;
    if (name) avatar.textContent = name.trim().charAt(0).toUpperCase(); else avatar.innerHTML = icon('user');
    const label = document.createElement('strong'); label.textContent = 'Tu';
    const value = document.createElement('span'); value.className = 'you-value';
    value.textContent = kind === 'discoveries' ? String(count) : save.bestTimes[key] ? formatTime(save.bestTimes[key]) : '—';
    value.insertAdjacentHTML('afterbegin', icon(kind === 'discoveries' ? 'gem' : 'clock'));
    box.replaceChildren(rank, avatar, label, value);
    el('ranking-account').hidden = !!accountState().user;
  }
  function setStatus(text: string) {
    el('ranking-status').textContent = text;
    el('ranking-message').hidden = !text;
  }
  async function refreshRankings() {
    const version = ++requestVersion;
    const owner = accountState().user?.id;
    const requestedKind = kind;
    const key = el<HTMLSelectElement>('ranking-level').value;
    yourRank = null;
    personalRanking();
    el('ranking-list').replaceChildren();
    el('ranking-list').classList.remove('has-podium');
    if (!owner) {
      setStatus(accountState().configured ? 'Accedi per entrare in classifica.' : 'Le classifiche online arriveranno quando il servizio sarà collegato.');
      return;
    }
    setStatus('Un momento…');
    el('ranking-message').classList.add('is-loading');
    try {
      const save = hooks.getSave();
      let pendingDiscoveries = false;
      // Registration is best effort: one rejected proof cannot hide readable rankings.
      for (const index of CAMPAIGN_INDEXES) {
        const level = LEVELS[index];
        const ids = save.levels[level.key]?.solutionIds ?? save.levels[level.key]?.removedIds;
        if (ids?.length === level.pieces.length) {
          try { await submitDiscovery(level.key, ids); }
          catch (error) {
            if (!(error instanceof AccountFeatureError) || !['invalid', 'migration'].includes(error.code)) throw error;
            pendingDiscoveries = true;
          }
        }
        if (version !== requestVersion || owner !== accountState().user?.id) return;
      }
      const rows = await getLeaderboard(requestedKind, requestedKind === 'time' ? key : undefined);
      if (version !== requestVersion || owner !== accountState().user?.id) return;
      el('ranking-message').classList.remove('is-loading');
      setStatus(pendingDiscoveries ? 'Alcune scoperte attendono la verifica online. I progressi restano salvati.' : rows.length ? '' : 'La prima traccia può essere la tua.');
      el('ranking-list').classList.toggle('has-podium', rows.length >= 3);
      rows.forEach((row, order) => {
        const item = document.createElement('li');
        item.className = row.isYou ? 'ranking-row is-you' : 'ranking-row';
        item.style.setProperty('--i', String(order));
        if (row.rank <= 3) item.dataset.medal = String(row.rank);
        const rank = document.createElement('span'); rank.className = 'ranking-position'; rank.textContent = String(row.rank);
        const avatar = document.createElement('span'); avatar.className = 'ranking-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = row.name.trim().charAt(0).toUpperCase() || '?';
        const name = document.createElement('strong'); name.textContent = `${row.name}${row.isYou ? ' · tu' : ''}`;
        const value = document.createElement('span'); value.className = 'ranking-value';
        value.textContent = requestedKind === 'time' ? formatTime(row.value) : String(row.value);
        if (requestedKind === 'discoveries') value.insertAdjacentHTML('beforeend', '<span class="sr-only"> livelli</span>');
        item.append(rank, avatar, name, value); el('ranking-list').append(item);
        if (row.isYou) yourRank = row.rank;
      });
      personalRanking();
    } catch (error) {
      if (version !== requestVersion || owner !== accountState().user?.id) return;
      el('ranking-message').classList.remove('is-loading');
      setStatus(error instanceof Error ? error.message : 'Classifica non disponibile. Riprova tra poco.');
    }
  }
  function stepLevel(delta: number) {
    const select = el<HTMLSelectElement>('ranking-level');
    const next = Math.min(select.options.length - 1, Math.max(0, select.selectedIndex + delta));
    if (next === select.selectedIndex) return;
    select.selectedIndex = next;
    void refreshRankings();
  }
  el('relic-close').addEventListener('click', closeDetail);
  el('relic-play').addEventListener('click', () => hooks.play(selected, hooks.getSave().completed.includes(LEVELS[selected].key)));
  document.querySelectorAll<HTMLElement>('.collection-filters [data-rarity]').forEach(button => button.addEventListener('click', () => {
    rarityFilter = button.dataset.rarity!;
    document.querySelectorAll<HTMLElement>('.collection-filters [data-rarity]').forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    refreshCollection();
  }));
  document.querySelectorAll<HTMLElement>('[data-ranking]').forEach(button => button.addEventListener('click', () => {
    kind = button.dataset.ranking as LeaderboardKind;
    document.querySelectorAll<HTMLElement>('[data-ranking]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    el('ranking-level-label').hidden = kind !== 'time';
    void refreshRankings();
  }));
  el('ranking-level').addEventListener('change', () => void refreshRankings());
  el('ranking-prev').addEventListener('click', () => stepLevel(-1));
  el('ranking-next').addEventListener('click', () => stepLevel(1));
  el('ranking-refresh').addEventListener('click', () => void refreshRankings());
  el('ranking-account').addEventListener('click', hooks.account);
  return {
    openCollection(index?: number) {
      showingRankings = false; ++requestVersion;
      const focus = index !== undefined && CAMPAIGN_INDEXES.includes(index);
      if (focus) selected = index;
      else el('relic-detail').hidden = true;
      hooks.screen('collection'); refreshCollection();
      if (focus) selectRelic(index);
      (focus ? el('relic-close') : document.getElementById('tab-collection'))?.focus({ preventScroll: true });
    },
    openRankings(index?: number) {
      showingRankings = true;
      if (index !== undefined && CAMPAIGN_INDEXES.includes(index)) el<HTMLSelectElement>('ranking-level').value = LEVELS[index].key;
      hooks.screen('rankings'); void refreshRankings();
      document.getElementById('tab-rankings')?.focus({ preventScroll: true });
    },
    refresh() { if (showingRankings) void refreshRankings(); else refreshCollection(); },
    closeDetail,
    detailOpen: () => !el('relic-detail').hidden && !closing,
  };
}
