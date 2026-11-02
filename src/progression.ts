import type { Level, Rarity } from './puzzle.ts';
import type { SaveState } from './save-state.ts';

export interface RarityThresholds { epicMs: number; rareMs: number; uncommonMs: number }

/** Provisional authored budgets, calibrated offline from piece count and dependency
 * depth: epic ≈ 1.8s/piece + 1.2s/layer + 12s; rare ≈ 1.6×, uncommon ≈ 3×.
 * Fixed milliseconds make replays stable and require no runtime puzzle solver.
 */
const THRESHOLDS: Readonly<Record<string, readonly [number, number, number]>> = {
  'bosco-01-v1': [30_000, 48_000, 90_000],
  'bosco-02-v1': [35_000, 56_000, 105_000],
  'bosco-03-v1': [38_000, 61_000, 114_000],
  'bosco-04-v1': [46_000, 74_000, 138_000],
  'bosco-05-v1': [52_000, 83_000, 156_000],
  'osservatorio-01-v1': [65_000, 104_000, 195_000],
  'osservatorio-02-v1': [73_000, 117_000, 219_000],
  'osservatorio-03-v1': [80_000, 128_000, 240_000],
  'osservatorio-04-v1': [78_000, 125_000, 234_000],
  'osservatorio-05-v1': [90_000, 144_000, 270_000],
  'archivio-01-v1': [107_000, 171_000, 321_000],
  'archivio-02-v1': [91_000, 146_000, 273_000],
  'archivio-03-v1': [116_000, 186_000, 348_000],
  'archivio-04-v1': [132_000, 211_000, 396_000],
  'archivio-05-v1': [149_000, 238_000, 447_000],
  'giardini-01-v2': [97_000, 155_000, 291_000],
  'giardini-02-v2': [95_000, 152_000, 285_000],
  'giardini-03-v2': [114_000, 182_000, 342_000],
  'giardini-04-v2': [96_000, 154_000, 288_000],
  'giardini-05-v2': [117_000, 187_000, 351_000],
  'fucina-01-v2': [103_000, 165_000, 309_000],
  'fucina-02-v2': [102_000, 163_000, 306_000],
  'fucina-03-v2': [130_000, 208_000, 390_000],
  'fucina-04-v2': [121_000, 194_000, 363_000],
  'fucina-05-v2': [126_000, 202_000, 378_000],
  'cittadella-01-v2': [118_000, 189_000, 354_000],
  'cittadella-02-v2': [100_000, 160_000, 300_000],
  'cittadella-03-v2': [117_000, 187_000, 351_000],
  'cittadella-04-v2': [122_000, 195_000, 366_000],
  'cittadella-05-v2': [134_000, 214_000, 402_000],
  'abissi-01-v2': [107_000, 171_000, 321_000],
  'abissi-02-v2': [122_000, 195_000, 366_000],
  'abissi-03-v2': [115_000, 184_000, 345_000],
  'abissi-04-v2': [139_000, 222_000, 417_000],
  'abissi-05-v2': [115_000, 184_000, 345_000],
  'maree-01-v2': [112_000, 179_000, 336_000],
  'maree-02-v2': [125_000, 200_000, 375_000],
  'maree-03-v2': [109_000, 174_000, 327_000],
  'maree-04-v2': [117_000, 187_000, 351_000],
  'maree-05-v2': [147_000, 235_000, 441_000],
  'santuario-01-v2': [116_000, 186_000, 348_000],
  'santuario-02-v2': [114_000, 182_000, 342_000],
  'santuario-03-v2': [119_000, 190_000, 357_000],
  'santuario-04-v2': [122_000, 195_000, 366_000],
  'santuario-05-v2': [136_000, 218_000, 408_000],
  'cuore-01-v2': [128_000, 205_000, 384_000],
  'cuore-02-v2': [115_000, 184_000, 345_000],
  'cuore-03-v2': [121_000, 194_000, 363_000],
  'cuore-04-v2': [145_000, 232_000, 435_000],
  'cuore-05-v2': [147_000, 235_000, 441_000],
  'tutorial-v1': [22_000, 35_000, 66_000],
};

export function thresholdsForLevel(level: Level): RarityThresholds {
  const [epicMs, rareMs, uncommonMs] = THRESHOLDS[level.key] ?? [60_000, 96_000, 180_000];
  return { epicMs, rareMs, uncommonMs };
}

export function rarityForTime(levelKey: string, elapsedMs: number): Rarity {
  const thresholds = THRESHOLDS[levelKey];
  if (!thresholds || !Number.isInteger(elapsedMs) || elapsedMs <= 0 || elapsedMs > 86_400_000) return 'common';
  if (elapsedMs <= thresholds[0]) return 'epic';
  if (elapsedMs <= thresholds[1]) return 'rare';
  if (elapsedMs <= thresholds[2]) return 'uncommon';
  return 'common';
}

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic'];
export function bestRarity(a: Rarity, b: Rarity): Rarity {
  return RARITIES[Math.max(RARITIES.indexOf(a), RARITIES.indexOf(b))];
}

/** Historical discoveries retain their old catalog grade; later play can only
 * improve it. A stored grade records the earned quality of a new discovery.
 */
export function relicRarity(level: Level, save: SaveState): Rarity {
  if (!save.completed.includes(level.key)) return 'common';
  const stored = save.levels[level.key]?.rarity ?? level.rarity;
  return bestRarity(stored, rarityForTime(level.key, save.bestTimes[level.key]));
}
