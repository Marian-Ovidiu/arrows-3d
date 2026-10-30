import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Development identifier. Choose the permanent application ID before Play publication.
  appId: 'com.svela.puzzle',
  appName: 'Svela',
  webDir: 'dist',
  backgroundColor: '#f5f3ec',
  android: {
    backgroundColor: '#f5f3ec',
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'LIGHT' },
  },
};

export default config;
