import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const res = path.join(root, 'android/app/src/main/res');
const arrow = '<path d="M34 74L74 34M35 34h39v39" fill="none" stroke="#fff8ec" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
const svg = (background, round = false) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">${background ? `<rect width="108" height="108" rx="${round ? 54 : 22}" fill="#ad4d34"/>` : ''}${arrow}</svg>`);
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  const dir = path.join(res, `mipmap-${density}`);
  await sharp(svg(true)).resize(size).png().toFile(path.join(dir, 'ic_launcher.png'));
  await sharp(svg(true, true)).resize(size).png().toFile(path.join(dir, 'ic_launcher_round.png'));
  // Adaptive icon safe zone: keep the mark inside the central 66/108 area.
  const foreground = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108"><g transform="translate(17 17) scale(.685)">${arrow}</g></svg>`);
  await sharp(foreground).resize(Math.round(size * 108 / 48)).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
}
for (const entry of await readdir(res, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue;
  const target = path.join(res, entry.name, 'splash.png');
  let metadata;
  try { metadata = await sharp(target).metadata(); } catch { continue; }
  const { width, height } = metadata;
  const iconSize = Math.round(Math.min(width, height) * 0.18);
  const mark = await sharp(svg(true)).resize(iconSize).png().toBuffer();
  // Read the template dimensions first; output a newly generated Svela image.
  const output = await sharp({ create: { width, height, channels: 4, background: '#f5f3ec' } }).composite([{ input: mark, gravity: 'center' }]).png().toBuffer();
  await writeFile(target, output);
}
console.log('Svela Android icons and launch images generated. No windows opened.');
