"""Create train/val splits from tile filenames, split by geographic block (west/east) to avoid
adjacent-tile leakage between train and validation."""
import re
from pathlib import Path

from config import SPLITS_ROOT, TILES_ROOT

VAL_FRACTION = 0.2


def main() -> None:
    images_dir = TILES_ROOT / "images"
    names = sorted(p.name for p in images_dir.glob("*.png"))
    if not names:
        raise SystemExit(f"no tiles found in {images_dir}, run tile_geotiff.py first")

    parsed = []
    for name in names:
        m = re.search(r"_x(\d+)_y(\d+)\.png$", name)
        x = int(m.group(1)) if m else 0
        parsed.append((x, name))

    max_x = max(x for x, _ in parsed)
    cutoff = max_x * (1 - VAL_FRACTION)

    train = [name for x, name in parsed if x < cutoff]
    val = [name for x, name in parsed if x >= cutoff]

    SPLITS_ROOT.mkdir(parents=True, exist_ok=True)
    (SPLITS_ROOT / "train.txt").write_text("\n".join(train) + "\n")
    (SPLITS_ROOT / "val.txt").write_text("\n".join(val) + "\n")
    print(f"train: {len(train)} tiles, val: {len(val)} tiles")


if __name__ == "__main__":
    main()
