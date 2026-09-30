import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site at https://<user>.github.io/<repo>/
// Keep `base` equal to the repo name (with slashes) or the PWA will not load.
const REPO = 'fcn-monitor'

export default defineConfig({
  base: `/${REPO}/`,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'FCN Monitor',
        short_name: 'FCN',
        description: 'Fixed coupon note monitor — strike, knock-out and coupon status',
        start_url: `/${REPO}/`,
        scope: `/${REPO}/`,
        display: 'standalone',
        background_color: '#EEF1F4',
        theme_color: '#1B2733',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell is precached; price/notes data always tries the network first
        // so a fresh scheduled fetch shows up without a reinstall.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'fcn-data', networkTimeoutSeconds: 6 },
          },
        ],
      },
    }),
  ],
})
