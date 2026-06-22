# Chess Watch

Installierbare **PWA**, die ein physisches Schachbrett per Webcam erkennt, die
Stellung live als digitales Brett spiegelt, mit **Stockfish** bewertet und zu
jedem Zug **Live-Kommentare** erzeugt. Partien lassen sich aufzeichnen, lokal
(IndexedDB) speichern und Zug für Zug mit Kommentaren nachspielen. Alle großen
ML-Modelle werden einmalig geladen und im Browser gecacht (offline-fähig).

## Stack

- **React + Vite + TypeScript**, PWA via `vite-plugin-pwa` (Workbox)
- **Erkennung:** [`NAKSTStudio/yolov8m-chess-piece-detection`](https://huggingface.co/NAKSTStudio/yolov8m-chess-piece-detection)
  (13 Klassen: `board` + 12 Figuren) über `onnxruntime-web` (WebGPU + WASM-Fallback)
- **Hand-Gate:** MediaPipe Hand-Landmarker (pausiert die Erkennung beim Ziehen)
- **Kommentar:** [`NAKSTStudio/chess-gemma-commentary`](https://huggingface.co/NAKSTStudio/chess-gemma-commentary)
  (Gemma 3 270M, GGUF) über `@wllama/wllama` – Fallback: Heuristik aus Stockfish-Eval
- **Engine:** Stockfish 18 (`stockfish` npm, UCI im Worker)
- **Brett/Logik:** `react-chessboard` v5 + `chess.js`
- **Speicher:** `dexie` (IndexedDB), offline-first für späteren Account-Sync

## Setup

```bash
npm install
npm run download-models   # lädt YOLO + Gemma + MediaPipe nach public/models (~400 MB)
npm run dev               # Entwicklung
# bzw. Produktionsbuild:
npm run build && npm run preview
```

> **Wichtig – Cross-Origin-Isolation:** Die App setzt `COOP`/`COEP`-Header für
> SharedArrayBuffer (multithreaded WASM). In Dev/Preview erledigt das Vite; beim
> Hosting müssen dieselben Header am Server gesetzt werden:
> `Cross-Origin-Opener-Policy: same-origin` und
> `Cross-Origin-Embedder-Policy: require-corp`.

> **Bilderkennung & Dev-Server:** Im `vite dev` scheitert das Laden der
> onnxruntime-web-WASM (Vite hängt `?import` an den dynamischen Loader-Import an).
> Für die Webcam-Erkennung daher `npm run build && npm run preview` nutzen; der
> digitale Kern (Brett, Engine, Kommentare, Speicher) läuft auch im Dev-Server.

## Modelle

`scripts/download-models.sh` lädt:

| Modell | Datei | Größe |
| --- | --- | --- |
| YOLO Figuren+Brett | `public/models/yolo/best.onnx` | ~104 MB |
| Gemma Kommentare | `public/models/commentary/chess-gemma-q8_0.gguf` | ~292 MB |
| MediaPipe Hand | `public/models/mediapipe/hand_landmarker.task` | ~8 MB |

Die Modelle sind **nicht** im Repo (siehe `.gitignore`). Im Browser werden sie
nach dem ersten Laden vom Service Worker (CacheFirst) gecacht.

## Genauigkeit der Webcam-Erkennung

Das 8×8-Raster wird automatisch aus der `board`-Box abgeleitet (kein manuelles
Kalibrieren). Beste Ergebnisse bei top-down/leicht schräger Kamera; steile Winkel
und Verdeckung senken die Genauigkeit. Nur von `chess.js` als legal bestätigte
Züge werden übernommen (verwirft Fehlerkennungen).

## Lizenzen

Öffentliches Repo. Stockfish ist GPL-3.0, das YOLO-Modell AGPL-3.0 – beides für
ein offenes Projekt unproblematisch.
