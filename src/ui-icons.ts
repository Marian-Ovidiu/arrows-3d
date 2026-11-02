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
  world: `${ring(12, 12, 8.5)}M3.5 12h17M12 3.5c3.5 3 3.5 14 0 17M12 3.5c-3.5 3-3.5 14 0 17`,
};

export type IconName = keyof typeof ICONS;

export const icon = (name: IconName) =>
  `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export const relicIcon = (kind: RewardKind) =>
  `<svg class="relic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${RELICS[kind]}"/></svg>`;

export const chapterIcon = (chapter: number) => icon(chapter === 1 ? 'leaf' : chapter === 2 ? 'planet' : chapter === 3 ? 'arch' : 'sparkle');

/** Rarity reads as colour plus a count of pips, never colour alone. */
export const RARITY_PIPS = { common: 1, uncommon: 2, rare: 3, epic: 4 } as const;
export const pips = (count: number) => `<span class="pips" aria-hidden="true">${'<i></i>'.repeat(count)}</span>`;
