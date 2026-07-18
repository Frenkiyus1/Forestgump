"""Cut a large GeoTIFF image + mask pair into fixed-size tiles without loading the whole raster into RAM."""
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window

from config import TILE_SIZE, TRAIN_STRIDE


def normalize_to_uint8(x: np.ndarray) -> np.ndarray:
    out = np.zeros_like(x, dtype=np.uint8)
    for c in range(x.shape[0]):
        band = x[c].astype(np.float32)
        valid = np.isfinite(band)
        if not valid.any():
            continue
        lo, hi = np.percentile(band[valid], [2, 98])
        band = np.clip((band - lo) / max(hi - lo, 1e-6), 0, 1)
        out[c] = (band * 255).astype(np.uint8)
    return out


def tile_pair(image_path: str, mask_path: str, out_dir: str, tile: int = TILE_SIZE, stride: int = TRAIN_STRIDE) -> int:
    out = Path(out_dir)
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "masks").mkdir(parents=True, exist_ok=True)

    count = 0
    with rasterio.open(image_path) as src, rasterio.open(mask_path) as msrc:
        assert src.width == msrc.width and src.height == msrc.height
        for y in range(0, src.height - tile + 1, stride):
            for x in range(0, src.width - tile + 1, stride):
                win = Window(x, y, tile, tile)
                image = src.read([1, 2, 3], window=win)
                mask = msrc.read(1, window=win)
                if np.mean(image == 0) > 0.95:
                    continue
                image = normalize_to_uint8(image).transpose(1, 2, 0)
                mask = (mask > 0).astype(np.uint8)
                stem = f"{Path(image_path).stem}_x{x:06d}_y{y:06d}"
                Image.fromarray(image).save(out / "images" / f"{stem}.png")
                Image.fromarray(mask).save(out / "masks" / f"{stem}.png")
                count += 1
    return count


if __name__ == "__main__":
    from config import RAW_ROOT, TILES_ROOT

    image_dir = RAW_ROOT / "images"
    mask_dir = RAW_ROOT / "masks"
    total = 0
    for image_path in sorted(image_dir.glob("*.tif")):
        mask_path = mask_dir / image_path.name
        if not mask_path.exists():
            print(f"skip {image_path.name}: no matching mask")
            continue
        n = tile_pair(str(image_path), str(mask_path), str(TILES_ROOT))
        print(f"{image_path.name}: {n} tiles")
        total += n
    print(f"total tiles: {total}")
