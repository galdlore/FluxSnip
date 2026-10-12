import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '__MSG_ext_name__',
    description: '__MSG_ext_description__',
    default_locale: 'en',
    // unlimitedStorage: templates may embed base64 images (up to 200 KB each), which would hit
    // storage.local's 10 MB cap after a few dozen templates
    permissions: ['storage', 'unlimitedStorage'],
    action: {
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
  },
  zip: {
    exclude: [
      '**/*.map',
      'playground.html',
      'chunks/playground-*',
      'assets/playground-*',
      '**/playground/**',
      '*backup.png',
    ],
  },
});
