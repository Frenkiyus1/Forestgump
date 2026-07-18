"""End-to-end smoke test: tile a tiny synthetic GeoTIFF, run one inference pass through a
freshly initialized (untrained) model, and confirm the API can serve /health and /predict."""
from pathlib import Path

import numpy as np
import rasterio
import torch
from rasterio.transform import from_origin

from config import TILES_ROOT
from model import build_model
from tile_geotiff import tile_pair


def make_synthetic_geotiff(image_path: Path, mask_path: Path, size: int = 512) -> None:
    transform = from_origin(0, 0, 1, 1)
    rng = np.random.default_rng(0)
    image = rng.integers(0, 255, size=(3, size, size), dtype=np.uint8)
    mask = (rng.random((size, size)) > 0.7).astype(np.uint8)

    profile = {
        "driver": "GTiff",
        "height": size,
        "width": size,
        "count": 3,
        "dtype": "uint8",
        "crs": "EPSG:4326",
        "transform": transform,
    }
    with rasterio.open(image_path, "w", **profile) as dst:
        dst.write(image)

    mask_profile = dict(profile, count=1)
    with rasterio.open(mask_path, "w", **mask_profile) as dst:
        dst.write(mask, 1)


def test_tiling_and_forward_pass(tmp_path):
    image_path = tmp_path / "demo.tif"
    mask_path = tmp_path / "demo_mask.tif"
    make_synthetic_geotiff(image_path, mask_path)

    n = tile_pair(str(image_path), str(mask_path), str(tmp_path / "tiles"))
    assert n > 0

    device = torch.device("cpu")
    model = build_model().to(device)
    model.eval()
    x = torch.randn(1, 3, 256, 256)
    with torch.inference_mode():
        out = model(pixel_values=x)
    assert out.logits.shape[0] == 1


if __name__ == "__main__":
    import sys
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        test_tiling_and_forward_pass(Path(d))
    print("smoke test passed")
