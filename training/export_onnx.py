"""Exportiert den trainierten Klassifikator nach ONNX (für onnxruntime-web).

ImageNet-Normalisierung wird IN DEN GRAPH gebacken → die App füttert rohes
RGB in [0,1] (NCHW, fixe Größe). Output: logits [1,832]. Decode (view 64×13 →
argmax → FEN) macht die App.

  python export_onnx.py --ckpt runs/effb0/best.pt --out ../public/models/recognizer
"""
import argparse
import json
import os

import timm
import torch
import torch.nn as nn

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class Wrapped(nn.Module):
    """Bäckt die Normalisierung ein: Eingabe = RGB in [0,1]."""
    def __init__(self, backbone: nn.Module):
        super().__init__()
        self.backbone = backbone
        self.register_buffer("mean", torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor(IMAGENET_STD).view(1, 3, 1, 1))

    def forward(self, x):
        return self.backbone((x - self.mean) / self.std)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--out", default="../public/models/recognizer")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    ck = torch.load(args.ckpt, map_location="cpu")
    backbone = timm.create_model(ck["backbone"], pretrained=False, num_classes=64 * 13)
    backbone.load_state_dict(ck["model"])
    backbone.eval()
    model = Wrapped(backbone).eval()

    size = ck["img_size"]
    dummy = torch.rand(1, 3, size, size)
    onnx_path = os.path.join(args.out, "recognizer.onnx")
    torch.onnx.export(
        model, dummy, onnx_path,
        input_names=["input"], output_names=["logits"], opset_version=17,
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
    )
    print(f"ONNX → {onnx_path}  (Eingabe {size}×{size}, RGB 0..1)")

    # Labels + Meta für die App (Index 0..63 → 13 Klassen; id2fen).
    meta = {
        "input_size": size,
        "square_order": "a8..h8,a7..h1 (FEN)",
        "id2fen": {str(k): v for k, v in ck["id2fen"].items()},
    }
    with open(os.path.join(args.out, "recognizer.json"), "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"Meta → {os.path.join(args.out, 'recognizer.json')}")

    # Optional: vereinfachen (für Web schlanker).
    try:
        import onnx
        from onnxsim import simplify
        m = onnx.load(onnx_path)
        ms, ok = simplify(m)
        if ok:
            onnx.save(ms, onnx_path)
            print("onnxsim: vereinfacht ✓")
    except Exception as e:  # noqa: BLE001
        print(f"onnxsim übersprungen: {e}")


if __name__ == "__main__":
    main()
