import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function offlineApp(): Plugin {
  return {
    name: 'svela-offline-app',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = new Map<string, string | Uint8Array>();
      for (const [name, output] of Object.entries(bundle)) {
        files.set(name, output.type === 'chunk' ? output.code : output.source);
      }
      const addPublic = (directory: string, prefix = '') => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const name = prefix + entry.name;
          if (entry.isDirectory()) addPublic(join(directory, entry.name), `${name}/`);
          else files.set(name, readFileSync(join(directory, entry.name)));
        }
      };
      addPublic('public');
      const hash = createHash('sha256');
      for (const [name, data] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(name).update(data);
      const version = hash.digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const ROOT = self.registration.scope;
const PREFIX = 'svela-offline:' + ROOT + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify([...files.keys()])}.map(path => new URL(path, ROOT).href);
const KNOWN = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
// An update waits until the page says no level is in progress, then takes over at once.
self.addEventListener('message', event => {
  if (event.data === 'svela-activate-update') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  const key = request.mode === 'navigate' ? new URL('index.html', ROOT).href : url.href;
  if (!KNOWN.has(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(request)));
});
` });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [offlineApp()],
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
