"""SaliGuard AI Engine - Dịch vụ dự báo độ mặn (XGBoost).

Nhận CHUỖI quan trắc gần đây {ts, temp, ec, level} từ Backend qua HTTP POST,
dựng đặc trưng time-series (lag, thống kê trượt, pha thuỷ triều) và trả về dự
báo độ mặn cho 24h và 48h tới. Nếu không tìm thấy model đã huấn luyện, dịch vụ
tự động chuyển sang chế độ mock (giá trị ngẫu nhiên) để Backend vẫn hoạt động.
"""

import os
import random
from datetime import datetime, timezone

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

from features import FEATURE_NAMES, build_features

MODEL_PATH: str = os.getenv("MODEL_PATH", "xgboost_model.json")
# Model riêng cho dự báo 48h. Nếu không có, 48h sẽ tái dùng model 24h
# (xem chú thích trong predict()) — không bịa giá trị bằng nhau như trước.
MODEL_48H_PATH: str = os.getenv("MODEL_48H_PATH", "xgboost_model_48h.json")

app = FastAPI(title="SaliGuard AI Engine", version="1.0.0")

# --- Nạp model XGBoost (nếu có) ---
model = None
model48 = None
MOCK_MODE: bool = True


def _load_model(path: str):
    """Nạp một Booster XGBoost từ file; trả về None nếu không có/không nạp được."""
    import xgboost as xgb

    if not os.path.exists(path):
        print(f"[AI] WARNING: Model file '{path}' not found.")
        return None
    booster = xgb.Booster()
    booster.load_model(path)
    print(f"[AI] Loaded XGBoost model from '{path}'.")
    return booster


try:
    import xgboost as xgb  # noqa: F401 - kiểm tra thư viện đã cài chưa

    model = _load_model(MODEL_PATH)
    model48 = _load_model(MODEL_48H_PATH)
    MOCK_MODE = model is None
    if MOCK_MODE:
        print("[AI] Running in MOCK mode (random forecasts).")
except ImportError:
    print(
        "[AI] WARNING: 'xgboost' is not installed. "
        "Running in MOCK mode (random forecasts)."
    )
except Exception as exc:  # noqa: BLE001 - log mọi lỗi load model rồi fallback mock
    print(f"[AI] WARNING: Failed to load model ({exc}). Running in MOCK mode.")
    model = None
    model48 = None
    MOCK_MODE = True


class Reading(BaseModel):
    """Một điểm quan trắc trong chuỗi lịch sử."""

    ts: str  # ISO timestamp
    temp: float
    ec: float
    level: float


class PredictRequest(BaseModel):
    """Payload đầu vào: chuỗi quan trắc gần đây (ascending, cuối = hiện tại)."""

    history: list[Reading]


class PredictResponse(BaseModel):
    """Kết quả dự báo trả về cho Backend."""

    forecast_24h: float
    forecast_48h: float


def _to_epoch(ts: str) -> float:
    """ISO timestamp -> epoch giây (chấp nhận hậu tố 'Z')."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc).timestamp()


@app.get("/health")
def health() -> dict:
    """Kiểm tra trạng thái dịch vụ và chế độ chạy."""
    return {"status": "ok", "mode": "mock" if MOCK_MODE else "model"}


@app.post("/predict", response_model=PredictResponse)
def predict(data: PredictRequest) -> PredictResponse:
    """Dự báo độ mặn 24h và 48h tới từ chuỗi quan trắc gần đây."""
    if MOCK_MODE or model is None or not data.history:
        # Mock: 48h biến động mạnh hơn 24h, là giá trị ĐỘC LẬP (không bằng 24h).
        forecast24: float = round(random.uniform(1.0, 6.0), 2)
        forecast48: float = round(random.uniform(1.0, 7.0), 2)
        return PredictResponse(forecast_24h=forecast24, forecast_48h=forecast48)

    import xgboost as xgb

    # Sắp xếp tăng dần theo thời gian (đề phòng backend gửi lệch thứ tự).
    rows = sorted(data.history, key=lambda r: _to_epoch(r.ts))
    ts = np.array([_to_epoch(r.ts) for r in rows], dtype=float)
    ec = np.array([r.ec for r in rows], dtype=float)
    temp = np.array([r.temp for r in rows], dtype=float)
    level = np.array([r.level for r in rows], dtype=float)

    features = build_features(ts, ec, temp, level).reshape(1, -1)
    dmatrix = xgb.DMatrix(features, feature_names=FEATURE_NAMES)

    forecast24 = round(float(model.predict(dmatrix)[0]), 2)
    # 48h: dùng model 48h riêng nếu có; nếu chưa train thì tái dùng model 24h.
    horizon_model = model48 if model48 is not None else model
    forecast48 = round(float(horizon_model.predict(dmatrix)[0]), 2)

    return PredictResponse(forecast_24h=forecast24, forecast_48h=forecast48)
