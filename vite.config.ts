import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Cross-Origin-Isolation: nötig für SharedArrayBuffer (multithreaded WASM:
// Stockfish-MT, wllama-MT, onnxruntime-web Threads). Muss in Prod ebenso am
// Host gesetzt werden – ein Service Worker kann diese Header NICHT fälschen.
// 'credentialless' statt 'require-corp': behält die Cross-Origin-Isolation
// (SharedArrayBuffer/Threads), lädt aber Subressourcen & Vite-Modul-Worker ohne
// CORP-Header (sonst ERR_BLOCKED_BY_RESPONSE im Dev-Server). Chrome/Firefox ok;
// Safari fällt elegant auf Single-Thread zurück.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

// Erzwingt die COI-Header auf JEDER Antwort – auch auf Vite-internen Transform-/
// Worker-Responses, die `server.headers` sonst nicht erhalten (Modul-Worker
// scheitern dort mit ERR_BLOCKED_BY_RESPONSE).
function coiHeadersPlugin() {
  const apply = (server: { middlewares: { use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) => {
    server.middlewares.use((_req, res, next) => {
      for (const [k, v] of Object.entries(crossOriginIsolation)) res.setHeader(k, v)
      next()
    })
  }
  return {
    name: 'coi-headers',
    configureServer: apply,
    configurePreviewServer: apply,
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Auf GitHub Pages liegt die App unter /<repo>/ – via VITE_BASE im CI gesetzt.
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    coiHeadersPlugin(),
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
        theme_color: '#211c1b',
        background_color: '#161311',
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
