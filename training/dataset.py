"""ChessReD-Dataset → (Bild, 64er-Label-Vektor) für den 64×13-Klassifikator.

Quelle: https://data.4tu.nl/datasets/99b5c721-280b-450b-b058-b2900b69a90f
Annotationen: annotations.json (COCO-artig). Stellung ist PRO FIGUR als
algebraisches Feld kodiert (z. B. "e4"); leere Felder fehlen → wir füllen sie.

Feld-Index = 8*ROWS.index(rank) + COLS.index(file) mit ROWS="87654321" →
a8=0, b8=1, …, h8=7, a7=8, …, h1=63  (= FEN-Lesereihenfolge).
"""
import json
import os
from typing import Optional

import torch
from PIL import Image
from torch.utils.data import Dataset

COLS = "abcdefgh"
ROWS = "87654321"  # Rang 8 zuerst (FEN-Reihenfolge)


def square_to_index(sq: str) -> int:
    return 8 * ROWS.index(sq[1]) + COLS.index(sq[0])


def _split_ids(splits_entry) -> set:
    # Robust gegen {"image_ids": [...]} oder direkt [...].
    if isinstance(splits_entry, dict):
        for k in ("image_ids", "images", "ids"):
            if k in splits_entry:
                return set(splits_entry[k])
        # evtl. {"grandmaster": {...}} o.ä. – alle Listen einsammeln
        ids = set()
        for v in splits_entry.values():
            if isinstance(v, list):
                ids.update(v)
            elif isinstance(v, dict):
                for kk in ("image_ids", "images", "ids"):
                    if kk in v:
                        ids.update(v[kk])
        return ids
    return set(splits_entry)


class ChessReD(Dataset):
    def __init__(self, dataroot: str, split: str, transform: Optional[object] = None):
        self.dataroot = dataroot
        with open(os.path.join(dataroot, "annotations.json")) as f:
            ann = json.load(f)

        cats = ann["categories"]
        self.id2name = {int(c["id"]): c["name"] for c in cats}
        self.empty_id = next(int(c["id"]) for c in cats if c["name"] == "empty")
        self.num_classes = max(self.id2name) + 1  # i. d. R. 13

        ids = _split_ids(ann["splits"][split])
        self.images = [im for im in ann["images"] if im["id"] in ids]

        # Figuren nach image_id gruppieren.
        pieces_root = ann["annotations"]
        pieces = pieces_root["pieces"] if isinstance(pieces_root, dict) else pieces_root
        self.pieces: dict[int, list] = {}
        for p in pieces:
            self.pieces.setdefault(p["image_id"], []).append(p)

        self.transform = transform

    def __len__(self) -> int:
        return len(self.images)

    def __getitem__(self, i: int):
        im = self.images[i]
        path = os.path.join(self.dataroot, im["path"])
        img = Image.open(path).convert("RGB")
        if self.transform:
            img = self.transform(img)

        target = torch.full((64,), self.empty_id, dtype=torch.long)
        for p in self.pieces.get(im["id"], []):
            target[square_to_index(p["chessboard_position"])] = int(p["category_id"])
        return img, target

    # Feld-Index → FEN-Zeichen (für Decode/Export).
    def id2fen(self) -> dict[int, str]:
        name2fen = {
            "white-pawn": "P", "white-knight": "N", "white-bishop": "B",
            "white-rook": "R", "white-queen": "Q", "white-king": "K",
            "black-pawn": "p", "black-knight": "n", "black-bishop": "b",
            "black-rook": "r", "black-queen": "q", "black-king": "k",
            "empty": "",
        }
        # Namen können Bindestrich/Unterstrich nutzen → normalisieren.
        def norm(n: str) -> str:
            return n.replace("_", "-")
        return {i: name2fen[norm(n)] for i, n in self.id2name.items()}
