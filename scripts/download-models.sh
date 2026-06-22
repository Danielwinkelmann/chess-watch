#!/usr/bin/env bash
# Lädt die großen ML-Modelle in public/models. Einmalig nötig (werden danach
# vom Service Worker im Browser gecacht). Gesamtgröße ≈ 400 MB.
set -euo pipefail
cd "$(dirname "$0")/.."

YOLO_DIR="public/models/yolo"
GEMMA_DIR="public/models/commentary"
MP_DIR="public/models/mediapipe"
mkdir -p "$YOLO_DIR" "$GEMMA_DIR" "$MP_DIR"

dl() { # url dest
  if [ -f "$2" ]; then echo "✓ vorhanden: $2"; return; fi
  echo "↓ $2"
  curl -fL --retry 3 -o "$2" "$1"
}

# 1) YOLO Figuren+Brett-Erkennung (13 Klassen), ONNX
dl "https://huggingface.co/NAKSTStudio/yolov8m-chess-piece-detection/resolve/main/best.onnx" \
   "$YOLO_DIR/best.onnx"

# 2) Kommentar-Modell (Gemma 3 270M), GGUF q8_0 (~292 MB). Für schwächere Geräte
#    stattdessen q4_K_M erzeugen und hier verlinken.
dl "https://huggingface.co/NAKSTStudio/chess-gemma-commentary/resolve/main/chess-commentary-model_q8_0.gguf" \
   "$GEMMA_DIR/chess-gemma-q8_0.gguf"

# 3) MediaPipe Hand-Landmarker (~7 MB) für das Hand-Gate
dl "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" \
   "$MP_DIR/hand_landmarker.task"

echo "Fertig. Modelle liegen unter public/models/."
