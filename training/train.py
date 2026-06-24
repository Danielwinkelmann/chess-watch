"""Trainiert einen 64×13-Feld-Klassifikator auf ChessReD.

Backbone via timm (leicht, browser-tauglich). Kopf = Linear(feat, 64*13=832).
Logits [B,832] → view(B,64,13). Pro Feld 13-Klassen-Cross-Entropy.

Beispiel (Hetzner GEX44 / RTX 4000 Ada, 20 GB):
  python train.py --dataroot /data/chessred --backbone efficientnet_b0 \
      --img-size 512 --batch 48 --epochs 40 --out runs/effb0

Metriken: per-square accuracy + per-board exact-match (Headline-Metrik).
"""
import argparse
import os

import timm
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import transforms as T
from tqdm import tqdm

from dataset import ChessReD

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def build_transforms(img_size: int):
    train = T.Compose([
        T.Resize((img_size, img_size)),
        # Winkel-Robustheit (Referenz lässt das weg → unsere Stärke):
        T.RandomApply([T.RandomPerspective(distortion_scale=0.25, p=1.0)], p=0.5),
        T.RandomRotation(10),
        T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    val = T.Compose([
        T.Resize((img_size, img_size)),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    return train, val


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    sq_correct = sq_total = board_correct = board_total = 0
    for img, target in tqdm(loader, desc="val", leave=False):
        img, target = img.to(device, non_blocking=True), target.to(device)
        logits = model(img).view(-1, 64, 13)
        pred = logits.argmax(-1)  # [B,64]
        sq_correct += (pred == target).sum().item()
        sq_total += target.numel()
        board_correct += (pred == target).all(dim=1).sum().item()
        board_total += target.size(0)
    return sq_correct / sq_total, board_correct / board_total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataroot", required=True)
    ap.add_argument("--backbone", default="efficientnet_b0")
    ap.add_argument("--img-size", type=int, default=512)
    ap.add_argument("--batch", type=int, default=48)
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--out", default="runs/model")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tf_train, tf_val = build_transforms(args.img_size)

    ds_train = ChessReD(args.dataroot, "train", tf_train)
    ds_val = ChessReD(args.dataroot, "val", tf_val)
    assert ds_train.num_classes == 13, f"erwartet 13 Klassen, bekam {ds_train.num_classes}"
    dl_train = DataLoader(ds_train, args.batch, shuffle=True, num_workers=args.workers,
                          pin_memory=True, drop_last=True, persistent_workers=True)
    dl_val = DataLoader(ds_val, args.batch, shuffle=False, num_workers=args.workers,
                        pin_memory=True, persistent_workers=True)

    model = timm.create_model(args.backbone, pretrained=True, num_classes=64 * 13)
    model = model.to(device, memory_format=torch.channels_last)

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, args.epochs)
    scaler = torch.cuda.amp.GradScaler()

    best = -1.0
    for ep in range(args.epochs):
        model.train()
        pbar = tqdm(dl_train, desc=f"ep {ep+1}/{args.epochs}")
        for img, target in pbar:
            img = img.to(device, non_blocking=True, memory_format=torch.channels_last)
            target = target.to(device, non_blocking=True)  # [B,64]
            opt.zero_grad(set_to_none=True)
            with torch.cuda.amp.autocast():
                logits = model(img).view(-1, 64, 13).permute(0, 2, 1)  # [B,13,64]
                loss = F.cross_entropy(logits, target)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            pbar.set_postfix(loss=f"{loss.item():.3f}")
        sched.step()

        sq_acc, board_acc = evaluate(model, dl_val, device)
        print(f"[ep {ep+1}] val per-square={sq_acc:.4f}  per-board={board_acc:.4f}")
        torch.save({"model": model.state_dict(), "backbone": args.backbone,
                    "img_size": args.img_size, "id2fen": ds_train.id2fen()},
                   os.path.join(args.out, "last.pt"))
        if board_acc > best:
            best = board_acc
            torch.save({"model": model.state_dict(), "backbone": args.backbone,
                        "img_size": args.img_size, "id2fen": ds_train.id2fen()},
                       os.path.join(args.out, "best.pt"))
            print(f"  ✓ neues Best (per-board {best:.4f}) gespeichert")

    print(f"Fertig. Bestes per-board: {best:.4f}. Checkpoint: {args.out}/best.pt")


if __name__ == "__main__":
    main()
