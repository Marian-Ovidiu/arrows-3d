import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS } from '../src/puzzle.ts';
import { createSaveState, parseSaveState } from '../src/save-state.ts';
import { bestRarity, rarityForTime, relicRarity, thresholdsForLevel } from '../src/progression.ts';

const first = LEVELS[0];

test('all fifty levels have fixed distinct budgets with inclusive grade boundaries', () => {
  for (const level of LEVELS) {
    const { epicMs, rareMs, uncommonMs } = thresholdsForLevel(level);
    assert.ok(epicMs > 0 && rareMs > epicMs && uncommonMs > rareMs);
    assert.equal(rarityForTime(level.key, epicMs), 'epic');
    assert.equal(rarityForTime(level.key, epicMs + 1), 'rare');
    assert.equal(rarityForTime(level.key, rareMs), 'rare');
    assert.equal(rarityForTime(level.key, rareMs + 1), 'uncommon');
    assert.equal(rarityForTime(level.key, uncommonMs), 'uncommon');
    assert.equal(rarityForTime(level.key, uncommonMs + 1), 'common');
  }
  assert.notDeepEqual(thresholdsForLevel(LEVELS[0]), thresholdsForLevel(LEVELS[1]));
  assert.ok(thresholdsForLevel(LEVELS.find(level => level.id === 50)!).epicMs > thresholdsForLevel(first).epicMs);
});

test('invalid and unknown times never award a grade', () => {
  for (const elapsed of [-1, 0, 0.5, NaN, Infinity, 86_400_001]) assert.equal(rarityForTime(first.key, elapsed), 'common');
  assert.equal(rarityForTime('unknown', 1), 'common');
});

test('new uncollected relics are common even if a stray old best exists', () => {
  const save = createSaveState();
  save.bestTimes[first.key] = 1;
  assert.equal(relicRarity(first, save), 'common');
});

test('legacy discovery keeps its original grade and old records can only improve it', () => {
  for (const level of LEVELS.slice(0, 15)) {
    const save = parseSaveState(JSON.stringify({ ...createSaveState(), completed: [level.key] }));
    assert.equal(relicRarity(level, save), level.rarity);
    save.bestTimes[level.key] = thresholdsForLevel(level).uncommonMs + 1;
    assert.equal(relicRarity(level, save), level.rarity);
    save.bestTimes[level.key] = 1;
    assert.equal(relicRarity(level, save), 'epic');
  }
});

test('stored earned grades survive resets and slower replays without falling back to catalog grades', () => {
  const epicCatalog = LEVELS.find(level => level.rarity === 'epic')!;
  const save = createSaveState();
  save.completed.push(epicCatalog.key);
  save.levels[epicCatalog.key] = { removedIds: [], rarity: 'common' };
  assert.equal(relicRarity(epicCatalog, save), 'common');
  save.levels[epicCatalog.key].rarity = bestRarity('common', 'rare');
  save.bestTimes[epicCatalog.key] = thresholdsForLevel(epicCatalog).uncommonMs;
  assert.equal(relicRarity(epicCatalog, parseSaveState(JSON.stringify(save))), 'rare');
  assert.equal(bestRarity('epic', 'common'), 'epic');
  assert.equal(bestRarity('uncommon', 'rare'), 'rare');
});
