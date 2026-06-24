"""Lädt ChessReD von 4TU.ResearchData herunter.

ChessReD (10.800 reale Fotos realer Bretter aus schrägen Winkeln) liegt auf
4TU.ResearchData. Wir nutzen den offiziellen Downloader des ChessReD-Repos,
der die Bild-Archive + annotations.json zieht und entpackt.

  python download_chessred.py --dataroot /data/chessred

Danach liegt unter --dataroot:
  annotations.json
  images/...           (alle Fotos, Pfade wie in annotations.json["images"][i]["path"])

Bei Problemen: manueller Download
  https://data.4tu.nl/datasets/99b5c721-280b-450b-b058-b2900b69a90f  (~24,6 GB)
"""
import argparse
import os
import subprocess
import sys
import tempfile

REPO = "https://github.com/ThanosM97/end-to-end-chess-recognition.git"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataroot", required=True, help="Zielverzeichnis für ChessReD")
    args = ap.parse_args()
    os.makedirs(args.dataroot, exist_ok=True)

    # Offiziellen Downloader holen und ausführen (zieht von 4TU + entpackt).
    with tempfile.TemporaryDirectory() as tmp:
        print(f"Klone offiziellen Downloader → {tmp}")
        subprocess.run(["git", "clone", "--depth", "1", REPO, tmp], check=True)
        script = os.path.join(tmp, "chessred.py")
        if not os.path.exists(script):
            sys.exit(f"chessred.py nicht im Repo gefunden ({script}). "
                     "Manuell laden: siehe Modulkopf.")
        print("Starte Download (mehrere GB, dauert je nach Leitung).")
        subprocess.run([sys.executable, script, "--dataroot", args.dataroot,
                        "--download"], check=True)

    ann = os.path.join(args.dataroot, "annotations.json")
    if os.path.exists(ann):
        print(f"✓ Fertig. annotations.json unter {ann}")
    else:
        print("⚠ annotations.json nicht gefunden – prüfe die Ausgabe oben / "
              "lade ggf. manuell (Link im Modulkopf).")


if __name__ == "__main__":
    main()
