import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Cross-Origin-Isolation: nötig für SharedArrayBuffer (multithreaded WASM:
// Stockfish-MT, wllama-MT, onnxruntime-web Threads). Muss in Prod ebenso am
// Host gesetzt werden – ein Service Worker kann diese Header NICHT fälschen.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest erlaubt eigene SW-Logik (runtime caching der großen Modelle)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Modelle/WASM werden NICHT precacht (zu groß), sondern zur Laufzeit gecacht.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Chess Watch',
        short_name: 'ChessWatch',
        description: 'Schachbrett per Webcam erkennen, analysieren und kommentieren',
        theme_color: '#252525',
        background_color: '#f4f4f4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  worker: { format: 'es' },
  optimizeDeps: {
    // onnxruntime-web & wllama liefern WASM/Worker; nicht vorab bündeln.
    exclude: ['onnxruntime-web', '@wllama/wllama'],
  },
})
