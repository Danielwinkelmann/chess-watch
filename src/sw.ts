/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] }

// App-Shell (von vite-plugin-pwa injiziert)
precacheAndRoute(self.__WB_MANIFEST as never)

// Große ML-Modelle (ONNX/GGUF) + WASM-Engines: CacheFirst, einmal laden,
// dann offline aus dem Cache. wllama cacht das GGUF selbst (Cache API),
// hier zusätzlich ONNX & Stockfish-WASM same-origin abgesichert.
registerRoute(
  ({ url }) =>
    url.pathname.includes('/models/') ||
    url.pathname.includes('/engine/') ||
    url.pathname.includes('/ort/'),
  new CacheFirst({
    cacheName: 'chess-watch-models',
    // Keine Expiration: Modelle sind groß und versionieren über den Dateinamen.
  }),
)

self.addEventListener('message', (e) => {
  if ((e.data as { type?: string })?.type === 'SKIP_WAITING') self.skipWaiting()
})
