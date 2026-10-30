import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5189',
    headless: true,
    reducedMotion: 'reduce',
    launchOptions: {
      executablePath: existsSync(macChrome) ? macChrome : undefined,
      args: ['--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5189 --strictPort',
    url: 'http://127.0.0.1:5189',
    reuseExistingServer: false,
  },
});
