"""Sliding-window inference over a GeoTIFF too large to hold in RAM; averages overlapping
tile probabilities and writes a mask GeoTIFF that preserves the source CRS/transform."""
import os
import tempfile
from pathlib import Path

import numpy as np
import rasterio
import torch
from rasterio.windows import Window

from config import INFER_STRIDE, TILE_SIZE
from dataset import MEAN, STD
from tile_geotiff import normalize_to_uint8

_MEAN = np.array(MEAN, dtype="float32").reshape(3, 1, 1)
_STD = np.array(STD, dtype="float32").reshape(3, 1, 1)


def predict_large(src_path: str, dst_path: str, model, device: torch.device, tile: int = TILE_SIZE, stride: int = INFER_STRIDE) -> None:
    with rasterio.open(src_path) as src:
        tmp_dir = Path(tempfile.gettempdir())
        prob_sum = np.memmap(tmp_dir / "satellite_prob_sum.dat", mode="w+", dtype="float32", shape=(src.height, src.width))
        count = np.memmap(tmp_dir / "satellite_count.dat", mode="w+", dtype="uint16", shape=(src.height, src.width))
        prob_sum[:] = 0
        count[:] = 0

        for y in range(0, src.height, stride):
            for x in range(0, src.width, stride):
                h = min(tile, src.height - y)
                w = min(tile, src.width - x)
                raw = src.read(
                    [1, 2, 3],
                    window=Window(x, y, w, h),
                    boundless=True,
                    fill_value=0,
                    out_shape=(3, tile, tile),
                )
                # Must mirror tile_geotiff.py's preprocessing exactly: percentile
                # stretch to uint8, then the same ImageNet normalization used in training.
                arr = normalize_to_uint8(raw).astype("float32") / 255.0
                arr = (arr - _MEAN) / _STD  # must match SatelliteDataset's A.Normalize
                z = torch.from_numpy(arr).unsqueeze(0).to(device)
                with torch.inference_mode():
                    logits = model(pixel_values=z).logits
                    logits = torch.nn.functional.interpolate(logits, size=(tile, tile), mode="bilinear", align_corners=False)
                    p = logits.softmax(1)[0, 1, :h, :w].cpu().numpy()
                prob_sum[y : y + h, x : x + w] += p
                count[y : y + h, x : x + w] += 1

        mask = (prob_sum / np.maximum(count, 1) >= 0.5).astype("uint8")
        profile = src.profile.copy()
        profile.update(count=1, dtype="uint8", compress="lzw", nodata=0)
        with rasterio.open(dst_path, "w", **profile) as dst:
            dst.write(mask, 1)

        area_pct = float(mask.mean() * 100)
        return area_pct


if __name__ == "__main__":
    import sys

    from model import load_checkpoint
    from config import CHECKPOINT_PATH

    if len(sys.argv) != 3:
        raise SystemExit("usage: python infer_geotiff.py <src.tif> <dst.tif>")

    _forced_device = os.getenv("SATELLITE_DEVICE")
    device = torch.device(_forced_device) if _forced_device else torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    model = load_checkpoint(str(CHECKPOINT_PATH), device)
    pct = predict_large(sys.argv[1], sys.argv[2], model, device)
    print(f"wrote {sys.argv[2]}, target area = {pct:.2f}%")
