import { LEVELS, TUTORIAL_INDEX, getExit } from './puzzle.ts';

/** Stable catalog keys make progress independent of the menu order. */
export interface SaveState {
  version: 2;
  activeLevel: string;
  completed: string[];
  levels: Record<string, { removedIds: string[]; solutionIds?: string[] }>;
  bestTimes: Record<string, number>;
  tutorial: { rotated: boolean; blockedSeen: boolean };
}
export const MAX_SAVE_BYTES = 2_000_000;
export const MAX_BEST_TIME_MS = 86_400_000;
export function createSaveState(): SaveState {
  return { version: 2, activeLevel: LEVELS[TUTORIAL_INDEX].key, completed: [], levels: {}, bestTimes: {}, tutorial: { rotated: false, blockedSeen: false } };
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Untrusted histories retain only their longest legal chronological prefix. */
export function parseSaveState(raw: string | null): SaveState {
  const state = createSaveState();
  if (!raw || raw.length > MAX_SAVE_BYTES) return state;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return state; }
  if (!isObject(value) || (value.version !== 1 && value.version !== 2)) return state;
  const catalog = new Map(LEVELS.map((level) => [level.key, level]));
  const tutorialKey = LEVELS[TUTORIAL_INDEX].key;
  const legacy = value.version === 1;
  if (legacy) {
    // The three retired demonstration puzzles are unrelated to the campaign.
    if ((typeof value.activeLevel === 'number' && value.activeLevel >= 0 && value.activeLevel <= 2)
      || (Array.isArray(value.completed) && value.completed.includes(3))) state.activeLevel = LEVELS[0].key;
    if (Array.isArray(value.completed) && value.completed.includes(3)) state.completed.push(tutorialKey);
  } else {
    if (typeof value.activeLevel === 'string' && catalog.has(value.activeLevel)) state.activeLevel = value.activeLevel;
    if (Array.isArray(value.completed)) {
      state.completed = [...new Set(value.completed.filter((key): key is string => typeof key === 'string' && catalog.has(key)))].sort();
    }
    if (isObject(value.bestTimes)) {
      for (const [key, time] of Object.entries(value.bestTimes)) {
        if (catalog.has(key) && typeof time === 'number' && Number.isInteger(time) && time > 0 && time <= MAX_BEST_TIME_MS) state.bestTimes[key] = time;
      }
    }
  }
  if (isObject(value.tutorial)) {
    state.tutorial.rotated = value.tutorial.rotated === true;
    state.tutorial.blockedSeen = value.tutorial.blockedSeen === true;
  }
  if (isObject(value.levels)) {
    // Iterate only supplied histories; unknown keys cannot cause reconstruction.
    for (const [savedKey, saved] of Object.entries(value.levels)) {
      const key = legacy ? (savedKey === '3' ? tutorialKey : '') : savedKey;
      const level = catalog.get(key);
      if (!level || !isObject(saved) || !Array.isArray(saved.removedIds)) continue;
      let remaining = [...level.pieces];
      const removedIds: string[] = [];
      for (let index = 0; index < saved.removedIds.length && index < level.pieces.length; index++) {
        const id: unknown = saved.removedIds[index];
        if (typeof id !== 'string') break;
        const piece = remaining.find((candidate) => candidate.id === id);
        if (!piece || !getExit(piece, remaining).free) break;
        removedIds.push(id);
        remaining = remaining.filter((candidate) => candidate.id !== id);
      }
      const history: SaveState['levels'][string] = { removedIds };
      if (!remaining.length) history.solutionIds = [...removedIds];
      else if (Array.isArray(saved.solutionIds) && saved.solutionIds.length === level.pieces.length) {
        let unsolved = [...level.pieces];
        const proof: string[] = [];
        for (const id of saved.solutionIds) {
          if (typeof id !== 'string') break;
          const piece = unsolved.find((candidate) => candidate.id === id);
          if (!piece || !getExit(piece, unsolved).free) break;
          proof.push(id);
          unsolved = unsolved.filter((candidate) => candidate.id !== id);
        }
        if (!unsolved.length) history.solutionIds = proof;
      }
      state.levels[key] = history;
      if (history.solutionIds && !state.completed.includes(key)) state.completed.push(key);
    }
  }
  if (legacy && state.completed.includes(tutorialKey)) state.activeLevel = LEVELS[0].key;
  state.completed.sort();
  return state;
}
