import os
import random
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from config import CHECKPOINT_PATH, MODEL_NAME, NUM_CLASSES
from dataset import SatelliteDataset, read_names
from model import build_model

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

# SATELLITE_DEVICE lets you force "cpu" when MPS hits the known SegFormer
# backward-pass view/stride bug (see README troubleshooting section).
_forced_device = os.getenv("SATELLITE_DEVICE")
DEVICE = torch.device(_forced_device) if _forced_device else torch.device("mps" if torch.backends.mps.is_available() else "cpu")

EPOCHS = 8
BATCH_SIZE = 4
ACCUM_STEPS = 4
LR = 6e-5


def confusion(logits: torch.Tensor, y: torch.Tensor) -> tuple[int, int, int]:
    pred = logits.argmax(1)
    tp = ((pred == 1) & (y == 1)).sum().item()
    fp = ((pred == 1) & (y == 0)).sum().item()
    fn = ((pred == 0) & (y == 1)).sum().item()
    return tp, fp, fn


def main() -> None:
    train_ds = SatelliteDataset(read_names("train"), train=True)
    val_ds = SatelliteDataset(read_names("val"), train=False)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, pin_memory=False)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = build_model().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-2)

    best_iou = 0.0
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(EPOCHS):
        model.train()
        optimizer.zero_grad(set_to_none=True)
        running = 0.0
        for step, (x, y) in enumerate(tqdm(train_loader, desc=f"train {epoch + 1}")):
            x, y = x.to(DEVICE), y.to(DEVICE)
            out = model(pixel_values=x, labels=y)
            loss = out.loss / ACCUM_STEPS
            loss.backward()
            running += loss.item() * ACCUM_STEPS
            if (step + 1) % ACCUM_STEPS == 0 or step + 1 == len(train_loader):
                optimizer.step()
                optimizer.zero_grad(set_to_none=True)

        model.eval()
        tp = fp = fn = 0
        with torch.inference_mode():
            for x, y in val_loader:
                x, y = x.to(DEVICE), y.to(DEVICE)
                logits = model(pixel_values=x).logits
                logits = torch.nn.functional.interpolate(logits, size=y.shape[-2:], mode="bilinear", align_corners=False)
                a, b, c = confusion(logits, y)
                tp += a
                fp += b
                fn += c
        iou = tp / max(tp + fp + fn, 1)
        print({"epoch": epoch + 1, "loss": running / max(len(train_loader), 1), "val_iou": iou})

        if iou > best_iou:
            best_iou = iou
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "model_name": MODEL_NAME,
                    "num_classes": NUM_CLASSES,
                    "best_iou": best_iou,
                },
                CHECKPOINT_PATH,
            )

    print("best_iou=", best_iou)


if __name__ == "__main__":
    main()
