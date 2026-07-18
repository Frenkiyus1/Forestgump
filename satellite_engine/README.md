# satellite_engine

Satellite image semantic segmentation module for ForestGump (Forestgump). Adds
`/health` and `/predict` endpoints on top of a SegFormer-B0 model fine-tuned on
tiled GeoTIFF imagery. Runs as its own FastAPI service, separate from
`ai_engine`, and is called over HTTP the same way the backend calls `ai_engine`.

## Setup

```bash
cd satellite_engine
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

Check MPS (Apple Silicon GPU) availability:

```bash
python -c "import torch; print(torch.backends.mps.is_available())"
```

## Data layout

```
data/satellite/
├── raw/images/<name>.tif     # source GeoTIFF images
├── raw/masks/<name>.tif      # matching masks, same filename, pixel 0/1
├── tiles/images/*.png        # generated 256x256 tiles
├── tiles/masks/*.png
└── splits/train.txt, val.txt
```

## Pipeline

```bash
source .venv/bin/activate

# 1. cut raw GeoTIFF pairs in data/satellite/raw/{images,masks} into tiles
python tile_geotiff.py

# 2. build train/val splits (split by geographic block, not random, to avoid leakage)
python make_splits.py

# 3. fine-tune SegFormer-B0
PYTORCH_ENABLE_MPS_FALLBACK=1 python train.py

# 4. run sliding-window inference on a large GeoTIFF
python infer_geotiff.py path/to/input.tif outputs/result_mask.tif

# 5. serve the API
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

## API

```bash
curl http://127.0.0.1:8010/health

curl -F "file=@../data/satellite/raw/images/demo.tif" \
     http://127.0.0.1:8010/predict
```

`/predict` returns `{"job_id": ..., "mask_path": ..., "target_area_pct": ...}`.
The output mask GeoTIFF preserves the source CRS/transform.

## Smoke test

```bash
python test_smoke.py
```

## Notes

- Training is offline only; the API never trains, it only loads
  `models/segformer_b0_best.pt` and runs inference.
- Inference uses `np.memmap` under `$TMPDIR` so RAM usage doesn't scale with
  image size.
- If MPS throws "operator not implemented", set
  `PYTORCH_ENABLE_MPS_FALLBACK=1` or fall back to CPU.
- Known issue on this torch/transformers combo: SegFormer's backward pass can
  hit `RuntimeError: view size is not compatible...` on MPS (a stride bug,
  not an unimplemented op — `PYTORCH_ENABLE_MPS_FALLBACK` does not fix it).
  Set `SATELLITE_DEVICE=cpu` to force CPU for `train.py`, `infer_geotiff.py`,
  and `app.py` if you hit this.
