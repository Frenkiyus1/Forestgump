import os
import uuid
from contextlib import asynccontextmanager

import rasterio
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from config import CHECKPOINT_PATH, OUTPUT_DIR, UPLOAD_DIR
from infer_geotiff import predict_large
from model import load_checkpoint

_forced_device = os.getenv("SATELLITE_DEVICE")
DEVICE = torch.device(_forced_device) if _forced_device else torch.device("mps" if torch.backends.mps.is_available() else "cpu")
MODEL: torch.nn.Module | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global MODEL
    UPLOAD_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    if CHECKPOINT_PATH.exists():
        MODEL = load_checkpoint(str(CHECKPOINT_PATH), DEVICE)
    yield


app = FastAPI(title="Forestgump Satellite AI", version="0.1.0", lifespan=lifespan)


class Health(BaseModel):
    status: str
    device: str
    model_loaded: bool


class PredictResult(BaseModel):
    job_id: str
    mask_path: str
    target_area_pct: float


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok", device=str(DEVICE), model_loaded=MODEL is not None)


@app.post("/predict", response_model=PredictResult)
async def predict(file: UploadFile = File(...)) -> PredictResult:
    if MODEL is None:
        raise HTTPException(503, "model not loaded, train a checkpoint first")
    if not file.filename or not file.filename.lower().endswith((".tif", ".tiff")):
        raise HTTPException(400, "only GeoTIFF (.tif/.tiff) accepted")

    job = uuid.uuid4().hex
    src = UPLOAD_DIR / f"{job}.tif"
    dst = OUTPUT_DIR / f"{job}_mask.tif"

    with src.open("wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    try:
        with rasterio.open(src):
            pass
    except rasterio.errors.RasterioIOError:
        raise HTTPException(400, "uploaded file is not a valid GeoTIFF")

    area_pct = predict_large(str(src), str(dst), MODEL, DEVICE)
    return PredictResult(job_id=job, mask_path=str(dst), target_area_pct=area_pct)
