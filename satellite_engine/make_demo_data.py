"""Generate a small synthetic GeoTIFF image + mask pair under data/satellite/raw/ so the
full pipeline (tile -> train -> infer -> API) can be exercised end-to-end without real imagery."""
import numpy as np
import rasterio
from rasterio.transform import from_origin

from config import RAW_ROOT

SIZE = 1024


def main() -> None:
    (RAW_ROOT / "images").mkdir(parents=True, exist_ok=True)
    (RAW_ROOT / "masks").mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(0)
    transform = from_origin(0, 0, 1, 1)

    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    # Diagonal band spanning the full width so both the west (train) and east
    # (val) geographic split regions contain positive pixels.
    blob = np.abs((yy - SIZE * 0.5) - (xx - SIZE * 0.5) * 0.3) < SIZE * 0.12
    mask = blob.astype(np.uint8)

    image = rng.integers(40, 120, size=(3, SIZE, SIZE), dtype=np.uint8)
    image[1][blob] = rng.integers(140, 200, size=blob.sum())  # greener where "forest"

    profile = {
        "driver": "GTiff",
        "height": SIZE,
        "width": SIZE,
        "count": 3,
        "dtype": "uint8",
        "crs": "EPSG:4326",
        "transform": transform,
    }
    with rasterio.open(RAW_ROOT / "images" / "demo.tif", "w", **profile) as dst:
        dst.write(image)

    mask_profile = dict(profile, count=1)
    with rasterio.open(RAW_ROOT / "masks" / "demo.tif", "w", **mask_profile) as dst:
        dst.write(mask, 1)

    print(f"wrote {RAW_ROOT / 'images' / 'demo.tif'} and matching mask ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
