import { LEVELS, TUTORIAL_INDEX, getExit } from './puzzle.ts';

/** Level references are zero-based indexes into LEVELS. */
export interface SaveState {
  version: 1;
  activeLevel: number;
  completed: number[];
  levels: Record<string, { removedIds: string[] }>;
  tutorial: { rotated: boolean; blockedSeen: boolean };
}

export function createSaveState(): SaveState {
  return { version: 1, activeLevel: TUTORIAL_INDEX, completed: [], levels: {}, tutorial: { rotated: false, blockedSeen: false } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLevelIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < LEVELS.length;
}

/**
 * Treat storage as untrusted. Each history retains its longest legal prefix;
 * an invalid entry and everything after it are discarded, preserving undo order.
 * Unknown versions and oversized/corrupt payloads reset to an isolated default.
 */
export function parseSaveState(raw: string | null): SaveState {
  const state = createSaveState();
  if (!raw || raw.length > 100_000) return state;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return state; }
  if (!isObject(value) || value.version !== 1) return state;
  if (isLevelIndex(value.activeLevel)) state.activeLevel = value.activeLevel;
  if (isObject(value.tutorial)) {
    state.tutorial.rotated = value.tutorial.rotated === true;
    state.tutorial.blockedSeen = value.tutorial.blockedSeen === true;
  }
  if (Array.isArray(value.completed)) {
    state.completed = [...new Set(value.completed.filter(isLevelIndex))].sort((a, b) => a - b);
  }
  if (!isObject(value.levels)) return state;
  for (let index = 0; index < LEVELS.length; index++) {
    const saved = value.levels[String(index)];
    if (!isObject(saved) || !Array.isArray(saved.removedIds)) continue;
    let remaining = [...LEVELS[index].pieces];
    const removedIds: string[] = [];
    // At most one entry per piece can be valid, bounding reconstruction work.
    for (const id of saved.removedIds.slice(0, remaining.length)) {
      if (typeof id !== 'string') break;
      const piece = remaining.find((candidate) => candidate.id === id);
      if (!piece || !getExit(piece, remaining).free) break;
      removedIds.push(id);
      remaining = remaining.filter((candidate) => candidate.id !== id);
    }
    state.levels[String(index)] = { removedIds };
    if (remaining.length === 0 && !state.completed.includes(index)) state.completed.push(index);
  }
  state.completed.sort((a, b) => a - b);
  return state;
}
