import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../public/icons/', import.meta.url));
await mkdir(directory, { recursive: true });
const svg = (maskable) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="#ad4d34"/><path d="M${maskable ? '177 335L335 177M182 177h153v153' : '143 369L369 143M151 143h218v218'}" fill="none" stroke="#fff8ec" stroke-width="${maskable ? 32 : 42}" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
for (const [name, size, maskable] of [['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true], ['apple-touch-icon', 180, true]]) {
  await sharp(svg(maskable)).resize(size).png().toFile(`${directory}${name}.png`);
}
console.log('Generated Svela PWA icons.');
