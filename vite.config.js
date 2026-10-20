import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Build id for the backup file's appVersion: the commit being built (CI sets GITHUB_SHA), else the local HEAD, else 'dev'. A plain constant: it changes nothing else in the build.
const buildId = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (_) { return 'dev'; } })()

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'SparkCheck',
        short_name: 'SparkCheck',
        description: 'SparkCheck — Electrical Audit Software',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache manifest is generated from the real dist/ output (content-hashed
        // filenames), so it can never drift from what Vite actually built — and its
        // hash changes on every build, so there's no manual cache-version bump needed.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // The whole app is one JS chunk (~2.2 MB) — over Workbox's 2 MiB default, and a file over the limit is silently NOT precached (= no offline
        // support), which is a build ERROR in vite-plugin-pwa. Raise the limit rather than lose offline; splitting the chunk is the long-term fix.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  base: '/electrical-audit/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  server: {
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: false,
    testTimeout: 15000,   // the vitest default is 5 s; the slowest tests take 4-6 s in a full run, so every test gets 15 s unless its file sets its own
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
