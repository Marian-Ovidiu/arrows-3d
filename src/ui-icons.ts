import type { RewardKind } from './puzzle';

const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** Stroke icons drawn on a 24px grid; colour comes from `currentColor`. */
const ICONS = {
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
  map: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  gem: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M12 20 9 9l3-5 3 5z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  forward: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  view: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>',
  clock: `<path d="${ring(12, 13.5, 7.5)}"/><path d="M12 9.5v4l2.5 2M10 2.5h4M12 2.5V6"/>`,
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  help: `<path d="${ring(12, 12, 9)}"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5v.01"/>`,
  check: '<path d="M5 12l5 5 9-10"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  sparkle: '<path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="currentColor" stroke="none"/>',
  leaf: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19 14 10"/>',
  planet: `<path d="${ring(12, 12, 5)}"/><ellipse cx="12" cy="12" rx="10.5" ry="3.5" transform="rotate(-22 12 12)"/>`,
  arch: '<path d="M6 21V10a6 6 0 0 1 12 0v11M3.5 21h17"/>',
  garden: '<path d="M4 18h16M7 18V8m10 10V8M5 8h14M12 8V3M12 7C7 7 7 3 7 3c4 0 5 2 5 4m0 0c5 0 5-4 5-4-4 0-5 2-5 4M9 12v2m6-2v2"/>',
  forge: '<path d="M4 8h16l-4 5H9l-1 5H5l2-5-3-2zM6 21h12M10 5l2-3 2 3"/>',
  citadel: '<path d="M4 21V8h4v4h8V8h4v13M8 21v-9m8 9v-9M10 21v-5h4v5M3 8l3-5 3 5m6 0 3-5 3 5"/>',
  depths: '<path d="M4 20 7 10l5 4 5-10 3 16zM7 10l5 10 5-16M3 5h2m-1-1v2M18 3h2"/>',
  maritime: '<path d="M12 3v16M9 5h6M4 13c0 9 16 9 16 0M4 13l-1 5m1-5 5 2M20 13l1 5m-1-5-5 2M3 22q4-3 9 0 5-3 9 0"/>',
  wind: '<path d="M3 8h13a3 3 0 1 0-3-3M3 12h17M3 16h10a3 3 0 1 1-3 3"/>',
  nexus: '<path d="M12 3 3 8v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8M12 3v10M8 10l4-3 4 3"/>',
} as const;

const RELICS: Record<RewardKind, string> = {
  seed: 'M12 3c4.5 4.5 5.5 10 0 18c-5.5-8-4.5-13.5 0-18zM12 9v8',
  leaf: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19L14 10',
  mushroom: 'M3.5 12a8.5 7 0 0 1 17 0zM9 12v6a3 3 0 0 0 6 0v-6',
  talisman: `${ring(12, 13, 6)}M12 3v4M12 10l3 3-3 3-3-3z`,
  spirit: 'M6.5 20V11a5.5 5.5 0 0 1 11 0v9l-2.75-2-2.75 2-2.75-2zM10 11v1M14 11v1',
  compass: `${ring(12, 12, 8.5)}M15.5 8.5l-2 5-5 2 2-5z`,
  crystal: 'M12 3l5 6-5 12-5-12zM7 9h10',
  moon: 'M15 3.5a8.5 8.5 0 1 0 5.5 12.5A7 7 0 0 1 15 3.5z',
  planet: `${ring(12, 12, 5)}M3 16.5c-1.5 2.5 16-3 18-8.5`,
  astrolabe: `${ring(12, 12, 8.5)}${ring(12, 12, 3)}M12 3.5v17M3.5 12h17`,
  key: `${ring(8, 8, 4)}M11 11l9 9M16 16l2-2M18.5 18.5l2-2`,
  hourglass: 'M6 3h12M6 21h12M7.5 3c0 5 9 6 9 9s-9 4-9 9M16.5 3c0 5-9 6-9 9s9 4 9 9',
  portal: 'M6 21V10a6 6 0 0 1 12 0v11M3.5 21h17M10 21v-8a2 2 0 0 1 4 0v8',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z',
  bell: 'M5 17c2-2 2-5 2-8a5 5 0 0 1 10 0c0 3 0 6 2 8zM10 20h4M12 2v2',
  feather: 'M5 21 18 4M7 18C1 10 11 1 19 3c2 9-3 15-12 15M8 13l5 1M11 9h5',
  flower: 'M12 13v8M12 18l-5-3M12 17l5-3M12 4c4-5 8 1 4 4 6 0 3 7-1 5-1 5-7 4-6 0-5 2-8-4-3-6-3-4 2-8 6-3zM12 7v3',
  lantern: 'M7 7h10l2 12H5zM6 21h12M8 7V5a4 4 0 0 1 8 0v2M12 10v6M9 19l3-3 3 3',
  nest: 'M3 12c0 12 18 12 18 0M4 15h16M6 18h12M7 12c-3-8 5-8 5-1M12 11c0-9 8-7 6 1M3 12q9 4 18 0',
  ember: 'M13 2c1 6-6 7-3 12 2 0 3-3 3-3 6 6 0 13-5 9-7-5-1-11 2-13 0 2 1 3 2 4 2-3 2-6 1-9z',
  hammer: 'M3 7 8 2l8 8-5 5zM12 13l8 8 2-2-8-8M5 5l8 8',
  anvil: 'M3 7h18l-5 5h-3v4l4 4H6l4-4v-4H5zM3 5h13',
  gear: 'M9 3h6l1 4 4 1 2 5-3 2-1 5-5 1-2-3-5-1-2-5 3-2zM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  phoenix: 'M12 20V9M12 12C5 12 3 8 2 4l7 3 3 5c3-4 5-5 10-8-1 5-4 8-10 8M9 21l3-7 3 7M10 6l2-4 3 3-3 3',
  mirror: 'M17 9a5 7 0 1 0-10 0 5 7 0 0 0 10 0M12 16v6M10 22h4M10 7l3-3',
  mask: 'M4 5q8-5 16 0v8c0 5-8 9-8 9s-8-4-8-9zM7 9h3m4 0h3M12 10l-1 4h2M9 17q3-2 6 0',
  crown: 'M3 6l5 4 4-7 4 7 5-4-2 13H5zM5 16h14',
  prism: 'M12 3 3 20h18zM12 3v17M15 12l7-3M16 15h6M17 18l5 3',
  castle: 'M3 21V7h5v5h8V7h5v14M3 7l2.5-4L8 7m8 0 2.5-4L21 7M10 21v-6h4v6M8 10h8',
  pearl: 'M3 15c0 9 18 9 18 0-5 3-13 3-18 0zM16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0M18 3v3m-1.5-1.5h3',
  coral: 'M11 21V10l-4-5M11 15l7-5V4M11 18l-7-4V9M7 10l-4-2M18 9l3-3M11 11l3-4V3M8 21h7',
  shell: 'M12 21C-5 10 6-4 12 6c6-10 17 4 0 15zM12 21V6M12 21 6 9M12 21l6-12M9 21h6',
  jellyfish: 'M4 11a8 8 0 0 1 16 0zM6 11c-4 5 4 5 0 10M10 11c-4 5 4 5 0 10M14 11c-4 5 4 5 0 10M18 11c-4 5 4 5 0 10',
  leviathan: 'M4 21c-5-8 5-12 10-8 7 5 10-9 3-9-4 0-3 5 1 4M8 13l-2-5 6 5M16 13l2 5 3-5M4 21l5-2-1 4M19 5v.1',
  anchor: 'M15 5a3 3 0 1 0-6 0 3 3 0 0 0 6 0M12 8v13M7 11h10M3 14c0 9 18 9 18 0M3 14l4 3M21 14l-4 3',
  wave: 'M3 19c5 0 3-12 11-14 8-2 10 9 3 9 3-5-3-8-4-2-1 5 4 7 8 7z',
  ship: 'M3 16h18l-4 6H7zM12 2v14M10 4l-7 10h7zM14 5l7 9h-7z',
  conch: 'M18 16c9-10-8-18-13-9-5 11 12 13 11 5-1-6-9-3-6 1 2 2 5-1 2-2M17 15l4 6-7 1-3-5',
  trident: 'M12 2v20M5 5v6l7 4 7-4V5M3 7l2-4 2 4M17 7l2-4 2 4M10 5l2-3 2 3',
  flute: 'M4 19 19 4l2 2L6 21zM9 16v.1M12 13v.1M15 10v.1M18 7v.1M3 18l4 4',
  kite: 'M12 2 4 10l8 7 8-7zM12 2v15M4 10h16M12 17q-6 2 0 5M10 20l4 2',
  chime: 'M5 6h14M12 2v4M6 6v4m4-4v6m4-6v5m4-5v3M5 10h2v8H5zM9 12h2v10H9zM13 11h2v9h-2zM17 9h2v7h-2z',
  fanfare: 'M3 11h8l10-6v14l-10-6H3zM7 13v7l5-2v-4M7 8v3M10 8v3',
  griffin: 'M11 20V8l3-4 5 3-5 2v3M11 12 3 3l1 8 7 4M14 12l7-6-1 7-6 3M8 21l3-5 3 5M6 20c-5-6 1-8 3-6',
  rune: 'M12 2 4 7v10l8 5 8-5V7zM9 17V6l7 5-7 3 7 4',
  eye: 'M2 12q10-15 20 0-10 15-20 0zM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0M12 2v3M5 4l2 3M19 4l-2 3',
  chalice: 'M7 3h10l-2 8-3 3-3-3zM12 14v6M7 22h10M7 5H3c0 6 4 7 7 7M17 5h4c0 6-4 7-7 7',
  infinity: 'M12 12C0-5-4 26 12 12c16-14 12 17 0 0',
  heart: 'M12 21C-6 9 5-3 12 6c7-9 18 3 0 15zM7 8l3 3 5-2',
  world: `${ring(12, 12, 8.5)}M3.5 12h17M12 3.5c3.5 3 3.5 14 0 17M12 3.5c-3.5 3-3.5 14 0 17`,
};

export type IconName = keyof typeof ICONS;

export const icon = (name: IconName) =>
  `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export const relicIcon = (kind: RewardKind) =>
  `<svg class="relic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${RELICS[kind]}"/></svg>`;

const CHAPTER_ICONS: readonly IconName[] = ['sparkle', 'leaf', 'planet', 'arch', 'garden', 'forge', 'citadel', 'depths', 'maritime', 'wind', 'nexus'];
export const chapterIcon = (chapter: number) => icon(CHAPTER_ICONS[chapter] ?? 'sparkle');

/** Rarity reads as colour plus a count of pips, never colour alone. */
export const RARITY_PIPS = { common: 1, uncommon: 2, rare: 3, epic: 4 } as const;
export const pips = (count: number) => `<span class="pips" aria-hidden="true">${'<i></i>'.repeat(count)}</span>`;
