# Chess-Watch — End-to-End-Erkennung (Finetuning)

Trainiert einen **End-to-End-Klassifikator**: ganzes Brettfoto → 64 Felder ×
13 Klassen → FEN. **Keine Bounding-Boxes, keine Eck-Kalibrierung, kein
Raster-Mapping** — ein Netz, ein Durchlauf, direkt die Stellung. Genau die
„one shot"-Erkennung, die wir wollen, robust gegen schräge Webcam-Winkel.

Datensatz: **ChessReD** (10.800 reale Fotos realer Holzbretter aus echten
Winkeln). Architektur: timm-Backbone (EfficientNet-B0) → `Linear(feat, 64*13)`,
pro Feld 13-Klassen-Cross-Entropy. Referenz: ThanosM97/end-to-end-chess-recognition
(arXiv 2310.04086).

## Dateien

| Datei | Zweck |
|---|---|
| `dataset.py` | ChessReD → `(Bild, 64er-Label)`; Feld-Index in FEN-Reihenfolge |
| `train.py` | Training (AMP, Perspektiv-Augmentierung, per-Feld + per-Brett-Metrik) |
| `export_onnx.py` | Checkpoint → `recognizer.onnx` (+ `recognizer.json` mit `id2fen`) |
| `download_chessred.py` | ChessReD von 4TU laden |
| `requirements.txt` | Abhängigkeiten |

## Setup auf dem Hetzner GEX44 (RTX 4000 Ada, 20 GB)

```bash
# CUDA-Treiber prüfen
nvidia-smi

# Projekt holen
git clone https://github.com/<dein-user>/chess-watch.git
cd chess-watch/training

python3 -m venv .venv && source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt        # Torch-CUDA-Wheel passend zur Treiberversion

# Datensatz laden (mehrere GB → genug Platz unter /data)
python download_chessred.py --dataroot /data/chessred
```

## Training

```bash
python train.py \
  --dataroot /data/chessred \
  --backbone efficientnet_b0 \
  --img-size 512 --batch 48 --epochs 40 \
  --out runs/effb0
```

- **Headline-Metrik:** `per-board` (Anteil komplett korrekt erkannter Bretter).
  Bestes Modell landet als `runs/effb0/best.pt`.
- Bei OOM: `--batch` senken (24/16) oder `--img-size 384`.
- Stärker/genauer: `--backbone efficientnet_b2` (mehr VRAM, langsamer).
- Im Hintergrund laufen lassen: `nohup ... &` oder `tmux`.

## Export für die App

```bash
python export_onnx.py --ckpt runs/effb0/best.pt --out ../public/models/recognizer
```

Erzeugt:
- `recognizer.onnx` — Eingabe `input` `[1,3,512,512]`, **RGB in [0,1]**
  (ImageNet-Normalisierung ist in den Graph gebacken), Ausgabe `logits` `[1,832]`.
- `recognizer.json` — `input_size`, Feldreihenfolge, `id2fen` (Index→FEN-Zeichen).

## App-Integration (Vertrag)

Die App muss nur:
1. Brettfoto auf `512×512` resizen, RGB nach `[0,1]`, NCHW.
2. ORT-web-Inferenz → `logits[832]`.
3. `reshape(64, 13)` → pro Feld `argmax` → Klasse → `id2fen` → FEN-Zeichen.
4. Felder in Reihenfolge `a8..h8, a7..h1` (FEN-Lesereihenfolge) zu FEN
   zusammensetzen (Leerfelder zu Zahlen verdichten).

Damit entfällt der bisherige Pfad mit `detect.ts` + Eck-Kalibrierung +
`mapDetectionsWithCorners` für die Foto→FEN-Funktion komplett.

## Warum end-to-end (statt Detektor wie YOLO / RF-DETR)

Detektoren (YOLO, **RF-DETR**) geben **Figuren-Boxen** aus — danach braucht es
immer noch Brettecken/Homographie, um jede Box einem Feld zuzuordnen. Genau
diese zweite Stufe ist bei schrägen Winkeln und 3D-Figuren fehleranfällig und
verlangt das manuelle Eck-Antippen. Der End-to-End-Ansatz überspringt das: das
Netz lernt Feld-Zuordnung **und** Figur gemeinsam aus echten Fotos. Ein
Detektor-Finetuning (RF-DETR auf ChessReD2K-Boxen) bleibt als möglicher
zweiter Erkennungspfad denkbar, ist aber nicht dieser Weg.
