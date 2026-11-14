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
  // No host permissions: the `tabs` permission already exposes the active
  // tab's URL and title, which is all classification needs. Nothing is ever
  // transmitted anywhere.
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
