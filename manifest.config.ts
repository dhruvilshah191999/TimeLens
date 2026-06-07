import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

// CRXJS copies `public/` to the dist root, so icon paths are root-relative.
export default defineManifest({
  manifest_version: 3,
  name: 'TimeLens',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  // <all_urls> is needed to read page titles for intent classification.
  // We never transmit this data anywhere external in V1.
  permissions: [
    'tabs',
    'storage',
    'idle',
    'alarms',
    'contextMenus',
    'webNavigation',
    // Read favicons from Chrome's LOCAL cache only (chrome-extension://…/_favicon/).
    // No network requests — nothing about your browsing leaves the device.
    'favicon',
  ],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  options_page: 'src/dashboard/index.html',
})
