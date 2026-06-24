"""Lädt ChessReD von 4TU.ResearchData herunter (headless, ohne GUI-Deps).

ChessReD (10.800 reale Fotos realer Bretter aus schrägen Winkeln) liegt auf
4TU.ResearchData. Der offizielle Downloader ist eine tkinter-GUI und läuft auf
einem Server nicht — daher laden wir die zwei Dateien direkt (URLs/MD5 aus dem
offiziellen cfg/chessred.yaml) per curl (resumebar) und entpacken images.zip.

  python download_chessred.py --dataroot /data/chessred

Ergebnis unter --dataroot:
  annotations.json           (~22 MB)
  images/...                 (alle Fotos; Pfade wie in annotations["images"][i]["path"])

Manueller Download (falls nötig):
  https://data.4tu.nl/datasets/99b5c721-280b-450b-b058-b2900b69a90f
"""
import argparse
import hashlib
import os
import subprocess
import sys
import zipfile

BASE = "https://data.4tu.nl/file/99b5c721-280b-450b-b058-b2900b69a90f"
ANNOTATIONS = {
    "url": f"{BASE}/3cae6364-daca-4967-b426-1e4b68cdb64c",
    "name": "annotations.json",
    "md5": "d34bca5ad46ec7a8df96a1d3c36784f3",
}
IMAGES = {
    "url": f"{BASE}/6329e969-616e-48e3-b893-a0379d1c15ba",
    "name": "images.zip",
    "md5": "32e23ed535239dc517a6499762d9847e",
}


def curl(url: str, dest: str) -> None:
    # -C - = fortsetzbar, falls der Lauf abbricht und neu gestartet wird.
    subprocess.run(["curl", "-fL", "-C", "-", "--retry", "5", "-o", dest, url], check=True)


def md5_ok(path: str, expected: str) -> bool:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest() == expected


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataroot", required=True)
    ap.add_argument("--skip-md5", action="store_true", help="MD5-Prüfung überspringen")
    args = ap.parse_args()
    os.makedirs(args.dataroot, exist_ok=True)

    ann_path = os.path.join(args.dataroot, ANNOTATIONS["name"])
    zip_path = os.path.join(args.dataroot, IMAGES["name"])

    print(f"↓ {ANNOTATIONS['name']} (~22 MB)")
    curl(ANNOTATIONS["url"], ann_path)

    print(f"↓ {IMAGES['name']} (~23 GB – dauert je nach Leitung)")
    curl(IMAGES["url"], zip_path)

    if not args.skip_md5:
        print("Prüfe MD5 …")
        if not md5_ok(zip_path, IMAGES["md5"]):
            sys.exit("✗ MD5 von images.zip stimmt nicht – Download unvollständig/korrupt.")
        print("✓ MD5 ok")

    print("Entpacke images.zip …")
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(args.dataroot)
    os.remove(zip_path)

    if os.path.exists(ann_path) and os.path.isdir(os.path.join(args.dataroot, "images")):
        print(f"✓ Fertig. ChessReD unter {args.dataroot}")
    else:
        print("⚠ Etwas fehlt – prüfe die Ausgabe oben.")


if __name__ == "__main__":
    main()
