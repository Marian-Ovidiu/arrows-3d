import { LEVELS, CHAPTERS, CAMPAIGN_INDEXES, type Level } from './puzzle';
import { accountState } from './account';
import { getLeaderboard, submitDiscovery, type LeaderboardKind } from './leaderboard';
import type { SaveState } from './save-state';
import { formatTime } from './time-trial';

export const RARITIES = { common: 'Comune', uncommon: 'Insolito', rare: 'Raro', epic: 'Epico' } as const;
const SYMBOLS: Record<Level['reward'], string> = {
  seed: '❧', leaf: '❦', mushroom: '♧', talisman: '◈', spirit: '✧', compass: '✥', crystal: '◇', moon: '☽', planet: '♄', astrolabe: '◎', key: '⚿', hourglass: '⋈', portal: '⋒', star: '✦', world: '◉',
};
type Hooks = {
  getSave(): SaveState;
  screen(next: 'home' | 'collection' | 'rankings'): void;
  preview(level: Level, discovered: boolean): void;
  play(index: number): void;
  trial(index: number): void;
  account(): void;
};

/** The catalog drives every shelf and selector: no fixed level count in the UI. */
export function initMetagame(hooks: Hooks) {
  const container = document.createElement('div');
  container.innerHTML = `
    <section id="collection-screen" class="collection-screen" aria-label="La stanza delle reliquie" hidden>
      <button id="collection-back" class="icon-button screen-back" aria-label="Torna al menu">←</button>
      <header class="museum-heading"><span class="eyebrow">PICCOLE TRACCE DI MONDI PERDUTI</span><h2>La stanza delle reliquie</h2><p id="collection-progress"></p></header>
      <div class="museum-inspector">
        <div class="relic-stage" id="relic-stage" aria-label="Osserva il reperto in 3D"></div>
        <div class="relic-details"><span class="rarity-badge" id="relic-rarity"></span><h3 id="relic-name"></h3><p id="relic-lore"></p><p id="relic-record" class="relic-record"></p><div class="relic-actions"><button id="relic-play" class="primary-button"></button><button id="relic-trial" class="secondary-button">Prova a tempo</button></div><span class="viewer-note" id="viewer-note"></span></div>
      </div>
      <div class="collection-filters" role="group" aria-label="Filtra i reperti per rarità">${(['all', 'common', 'uncommon', 'rare', 'epic'] as const).map(rarity => `<button data-rarity="${rarity}" aria-pressed="${rarity === 'all'}">${rarity === 'all' ? 'Tutti' : RARITIES[rarity]}</button>`).join('')}</div>
      <div id="relic-shelves"></div><p class="museum-footer">Ogni scoperta resta tua. Il tempo è una sfida in più.</p>
    </section>
    <section id="rankings-screen" class="rankings-screen" aria-label="Classifiche" hidden>
      <button id="rankings-back" class="icon-button screen-back" aria-label="Torna al menu">←</button>
      <header class="museum-heading"><span class="eyebrow">OGNI VIAGGIO LASCIA UNA TRACCIA</span><h2>Gli esploratori</h2><p>Scoperte condivise, piccole sfide personali.</p></header>
      <div class="rankings-content"><div class="ranking-tabs" role="group" aria-label="Tipo di classifica"><button data-ranking="discoveries" aria-pressed="true">Livelli completati</button><button data-ranking="time" aria-pressed="false">Tempi per livello</button></div>
      <label class="ranking-level-label" id="ranking-level-label" hidden>La tua prossima sfida<select id="ranking-level">${CAMPAIGN_INDEXES.map(index => `<option value="${LEVELS[index].key}">${String(index + 1).padStart(2, '0')} · ${LEVELS[index].name}</option>`).join('')}</select></label>
      <div class="personal-ranking" id="personal-ranking"></div><p id="ranking-note" class="ranking-note"></p><div class="ranking-toolbar"><button id="ranking-refresh" class="secondary-button">Aggiorna</button><button id="ranking-account" class="secondary-button">Accedi per partecipare</button></div>
      <p id="ranking-status" class="ranking-status" role="status"></p><ol id="ranking-list" class="ranking-list" aria-label="Graduatoria"></ol><p class="ranking-explainer">Le scoperte contano una volta sola. Le classifiche dei tempi raccolgono prove senza pause o aiuti, misurate dal server sullo stesso livello.</p></div>
    </section>`;
  document.getElementById('app')!.append(...Array.from(container.children));
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  let selected = CAMPAIGN_INDEXES[0];
  let rarityFilter = 'all';
  let kind: LeaderboardKind = 'discoveries';
  let requestVersion = 0;
  let showingRankings = false;

  function selectRelic(index: number) {
    selected = index;
    const level = LEVELS[index];
    const save = hooks.getSave();
    const unlocked = save.completed.includes(level.key);
    el('relic-name').textContent = unlocked ? level.artifact : 'Una meraviglia da svelare';
    el('relic-lore').textContent = unlocked ? level.lore : `Una presenza attende nel ${CHAPTERS.find(chapter => chapter.id === level.chapter)!.name}. Libera la figura per scoprirla.`;
    el('relic-rarity').textContent = unlocked ? RARITIES[level.rarity] : `SCOPERTA ${String(index + 1).padStart(2, '0')}`;
    el('relic-rarity').dataset.rarity = unlocked ? level.rarity : 'unknown';
    el('relic-record').textContent = save.bestTimes[level.key] ? `Record personale · ${formatTime(save.bestTimes[level.key])}` : unlocked ? 'Svelato. Ora puoi provare a battere il tuo tempo.' : `${level.name} · ${level.pieces.length} pezzi`;
    el('relic-play').textContent = unlocked ? 'Rivedi il livello' : 'Vai alla scoperta';
    el<HTMLButtonElement>('relic-trial').hidden = !unlocked;
    el('viewer-note').textContent = unlocked ? 'Trascina per osservare · pizzica per avvicinarti' : 'La sagoma custodisce ancora il suo segreto.';
    document.querySelectorAll<HTMLElement>('[data-relic]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.relic) === index)));
    hooks.preview(level, unlocked);
  }
  function refreshCollection() {
    const save = hooks.getSave();
    const count = CAMPAIGN_INDEXES.filter(index => save.completed.includes(LEVELS[index].key)).length;
    el('collection-progress').textContent = `${count} / ${CAMPAIGN_INDEXES.length} reperti svelati · ${CHAPTERS.filter(chapter => CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === chapter.id).every(index => save.completed.includes(LEVELS[index].key))).length} / ${CHAPTERS.length} collezioni complete`;
    el('relic-shelves').innerHTML = CHAPTERS.map(chapter => {
      const indexes = CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === chapter.id);
      const collected = indexes.filter(index => save.completed.includes(LEVELS[index].key)).length;
      const visible = indexes.filter(index => rarityFilter === 'all' || LEVELS[index].rarity === rarityFilter);
      if (!visible.length) return '';
      return `<section class="relic-shelf ${collected === indexes.length ? 'shelf-complete' : ''}" data-chapter="${chapter.id}"><header><div><span class="eyebrow">COLLEZIONE ${String(chapter.id).padStart(2, '0')}</span><h3>${chapter.name}</h3></div><span class="shelf-count">${collected === indexes.length ? '✧ Completa' : `${collected} / ${indexes.length}`}</span></header><p class="shelf-description">${collected === indexes.length ? 'Il piccolo mondo si è ricomposto. Tutti i suoi segreti sono qui.' : chapter.description}</p><div class="relic-grid">${visible.map(index => {
        const level = LEVELS[index], unlocked = save.completed.includes(level.key);
        return `<button class="relic-card ${unlocked ? 'is-discovered' : 'is-mystery'}" data-relic="${index}" data-rarity-tone="${unlocked ? level.rarity : 'unknown'}" aria-pressed="${index === selected}" aria-label="${unlocked ? level.artifact : `Reperto sconosciuto, scoperta ${index + 1}`}"><span class="relic-card-number">${String(index + 1).padStart(2, '0')}</span><span class="relic-card-symbol" aria-hidden="true">${unlocked ? SYMBOLS[level.reward] : '◇'}</span><strong>${unlocked ? level.artifact : 'Da svelare'}</strong><span class="relic-card-rarity">${unlocked ? RARITIES[level.rarity] : '???'}</span></button>`;
      }).join('')}</div>${collected === indexes.length ? `<div class="shelf-diorama" aria-label="Collezione completa: il piccolo mondo si è ricomposto"><span>✧</span><span>♧</span><span>◈</span><span>❦</span><span>✧</span></div>` : ''}</section>`;
    }).join('');
    el('relic-shelves').querySelectorAll<HTMLElement>('[data-relic]').forEach(button => button.addEventListener('click', () => selectRelic(Number(button.dataset.relic))));
    selectRelic(selected);
  }
  function personalRanking() {
    const save = hooks.getSave();
    const key = el<HTMLSelectElement>('ranking-level').value;
    const count = CAMPAIGN_INDEXES.filter(index => save.completed.includes(LEVELS[index].key)).length;
    el('personal-ranking').textContent = kind === 'discoveries' ? `Il tuo viaggio · ${count} livelli completati` : save.bestTimes[key] ? `Il tuo record personale · ${formatTime(save.bestTimes[key])}` : 'Il tuo record personale · ancora da scrivere';
    el('ranking-account').hidden = !!accountState().user;
    el('ranking-note').textContent = kind === 'discoveries' ? 'Un posto per ogni esploratore. Chi ha lo stesso numero di scoperte condivide la posizione.' : 'Il tuo miglior tentativo, confrontato con gli altri esploratori.';
  }
  async function refreshRankings() {
    const version = ++requestVersion;
    const owner = accountState().user?.id;
    const requestedKind = kind;
    const key = el<HTMLSelectElement>('ranking-level').value;
    personalRanking();
    el('ranking-list').replaceChildren();
    if (!owner) {
      el('ranking-status').textContent = accountState().configured ? 'Accedi al tuo account per consultare le classifiche e condividere i risultati. Puoi già collezionare reperti e migliorare i tuoi record personali.' : 'Le classifiche online saranno disponibili quando il servizio sarà collegato. La collezione e i record personali funzionano anche offline.';
      return;
    }
    el('ranking-status').textContent = 'Raccogliamo le tracce degli esploratori…';
    try {
      const save = hooks.getSave();
      // Completed offline histories can join the count ranking on reconnect.
      for (const index of CAMPAIGN_INDEXES) {
        const level = LEVELS[index];
        const ids = save.levels[level.key]?.solutionIds ?? save.levels[level.key]?.removedIds;
        if (ids?.length === level.pieces.length) await submitDiscovery(level.key, ids);
        if (version !== requestVersion || owner !== accountState().user?.id) return;
      }
      const rows = await getLeaderboard(requestedKind, requestedKind === 'time' ? key : undefined);
      if (version !== requestVersion || owner !== accountState().user?.id) return;
      el('ranking-status').textContent = rows.length ? 'I primi 50 esploratori' : 'La prima traccia potrebbe essere la tua.';
      for (const row of rows) {
        const item = document.createElement('li');
        item.className = row.isYou ? 'ranking-row is-you' : 'ranking-row';
        const rank = document.createElement('span'); rank.className = 'ranking-position'; rank.textContent = String(row.rank);
        const name = document.createElement('strong'); name.textContent = `${row.name}${row.isYou ? ' · tu' : ''}`;
        const value = document.createElement('span'); value.textContent = requestedKind === 'time' ? formatTime(row.value) : `${row.value} livelli`;
        item.append(rank, name, value); el('ranking-list').append(item);
      }
    } catch (error) {
      if (version === requestVersion && owner === accountState().user?.id) el('ranking-status').textContent = error instanceof Error ? error.message : 'La classifica non è disponibile. Riprova tra poco.';
    }
  }
  el('collection-back').addEventListener('click', () => hooks.screen('home'));
  el('rankings-back').addEventListener('click', () => { showingRankings = false; ++requestVersion; hooks.screen('home'); });
  el('relic-play').addEventListener('click', () => hooks.play(selected));
  el('relic-trial').addEventListener('click', () => hooks.trial(selected));
  document.querySelectorAll<HTMLElement>('[data-rarity]').forEach(button => button.addEventListener('click', () => {
    rarityFilter = button.dataset.rarity!;
    document.querySelectorAll<HTMLElement>('[data-rarity]').forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    refreshCollection();
  }));
  document.querySelectorAll<HTMLElement>('[data-ranking]').forEach(button => button.addEventListener('click', () => {
    kind = button.dataset.ranking as LeaderboardKind;
    document.querySelectorAll<HTMLElement>('[data-ranking]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    el('ranking-level-label').hidden = kind !== 'time';
    void refreshRankings();
  }));
  el('ranking-level').addEventListener('change', () => void refreshRankings());
  el('ranking-refresh').addEventListener('click', () => void refreshRankings());
  el('ranking-account').addEventListener('click', hooks.account);
  return {
    openCollection(index?: number) {
      showingRankings = false; ++requestVersion;
      if (index !== undefined && CAMPAIGN_INDEXES.includes(index)) selected = index;
      hooks.screen('collection'); refreshCollection();
      el('collection-back').focus({ preventScroll: true });
    },
    openRankings(index?: number) {
      showingRankings = true;
      if (index !== undefined && CAMPAIGN_INDEXES.includes(index)) el<HTMLSelectElement>('ranking-level').value = LEVELS[index].key;
      hooks.screen('rankings'); void refreshRankings();
      el('rankings-back').focus({ preventScroll: true });
    },
    refresh() { if (showingRankings) void refreshRankings(); else refreshCollection(); },
  };
}
