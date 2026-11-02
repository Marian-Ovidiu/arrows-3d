import { accountRpc, AccountFeatureError } from './account.ts';
import { LEVELS } from './puzzle.ts';
export type LeaderboardKind = 'discoveries' | 'time';
export interface LeaderboardEntry { rank: number; name: string; value: number; isYou: boolean }
function level(key: string): void {
  if (!LEVELS.some((entry) => entry.key === key && entry.id > 0)) throw new AccountFeatureError('invalid', 'Scegli un livello della collezione.');
}
function history(key: string, ids: readonly string[]): string[] {
  level(key);
  const catalog = LEVELS.find((entry) => entry.key === key)!;
  if (ids.length !== catalog.pieces.length || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || id.length > 64)) throw new AccountFeatureError('invalid', 'Completa il livello prima di registrare la scoperta.');
  return [...ids];
}
export async function getLeaderboard(kind: LeaderboardKind, levelKey?: string): Promise<LeaderboardEntry[]> {
  if (kind === 'time') level(levelKey ?? '');
  const result = await accountRpc<unknown>('get_leaderboard', { p_kind: kind, p_level_key: levelKey ?? null, p_limit: 50, p_offset: 0 });
  if (!Array.isArray(result)) throw new AccountFeatureError('server', 'La classifica non è disponibile. Riprova.');
  return result.slice(0, 50).flatMap((row) => {
    if (!row || !Number.isSafeInteger(Number(row.rank)) || Number(row.rank) < 1 || !Number.isSafeInteger(Number(row.value)) || Number(row.value) < 0 || typeof row.name !== 'string') return [];
    return [{ rank: Number(row.rank), name: row.name.slice(0, 80), value: Number(row.value), isYou: row.is_you === true }];
  });
}
export async function submitDiscovery(levelKey: string, removedIds: readonly string[]): Promise<void> {
  await accountRpc('submit_discovery', { p_level_key: levelKey, p_removed_ids: history(levelKey, removedIds) });
}
export async function startTimedRun(levelKey: string): Promise<{ id: string }> {
  level(levelKey);
  const result = await accountRpc<{ id: string }>('start_timed_run', { p_level_key: levelKey });
  if (!result || typeof result.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(result.id)) throw new AccountFeatureError('server', 'Impossibile avviare la partita. Riprova.');
  return result;
}
export async function finishTimedRun(id: string, removedIds: readonly string[]): Promise<{ elapsedMs: number; bestMs: number }> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || removedIds.length > 500 || removedIds.some((entry) => typeof entry !== 'string' || entry.length > 64)) throw new AccountFeatureError('invalid', 'La partita non è valida.');
  const result = await accountRpc<{ elapsed_ms: number; best_ms: number }>('finish_timed_run', { p_run_id: id, p_removed_ids: [...removedIds] });
  if (!result || !Number.isSafeInteger(Number(result.elapsed_ms)) || Number(result.elapsed_ms) <= 0 || !Number.isSafeInteger(Number(result.best_ms)) || Number(result.best_ms) <= 0) throw new AccountFeatureError('server', 'Impossibile registrare il tempo. Riprova.');
  return { elapsedMs: Number(result.elapsed_ms), bestMs: Number(result.best_ms) };
}
