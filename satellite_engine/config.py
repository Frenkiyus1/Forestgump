import os
from pathlib import Path

TILE_SIZE = int(os.getenv("SATELLITE_TILE_SIZE", "256"))
TRAIN_STRIDE = int(os.getenv("SATELLITE_TRAIN_STRIDE", "256"))
INFER_STRIDE = int(os.getenv("SATELLITE_INFER_STRIDE", "192"))

DATA_ROOT = Path(os.getenv("SATELLITE_DATA_ROOT", "../data/satellite"))
TILES_ROOT = DATA_ROOT / "tiles"
RAW_ROOT = DATA_ROOT / "raw"
SPLITS_ROOT = DATA_ROOT / "splits"

MODEL_NAME = os.getenv("SATELLITE_MODEL_NAME", "nvidia/mit-b0")
NUM_CLASSES = 2
CHECKPOINT_PATH = Path(os.getenv("SATELLITE_CHECKPOINT", "models/segformer_b0_best.pt"))

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
