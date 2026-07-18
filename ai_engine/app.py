"""Forestgump AI Engine - Đánh giá rủi ro + sinh bản tin cảnh báo thiên tai Điện Biên.

Nhận dự báo thời tiết nhiều ngày (từ backend/src/weather-ingest.ts, nguồn
Open-Meteo/OpenWeatherMap) qua HTTP POST, áp dụng rule engine (risk_engine.py,
thresholds.py — KHÔNG phải machine learning) để đánh giá rủi ro rét đậm/rét
hại, mưa lớn/lũ quét, sương mù, rồi sinh bản tin cảnh báo bằng template cố
định đã kiểm duyệt trước (bulletin.py — CỐ TÌNH KHÔNG dùng LLM tự do sinh
nội dung an toàn tính mạng). Rule-based nên luôn hoạt động, không có mock
mode.

Ngoài ra có 2 endpoint ML chạy SONG SONG, KHÔNG thay thế rule engine:
- [OPTIONAL/DEMO] /predict-flood-risk dùng XGBoost nhị phân (train_flood.py)
  làm THAM KHẢO bổ sung cho xác suất lũ quét.
- [SHADOW/DEMO] /assess-risk-ml dùng XGBoost multi-hazard (ml_engine.py,
  distill từ compute_risk() trên dữ liệu tổng hợp) tính lại đúng 3 hiểm hoạ
  của /assess-risk để so sánh/demo — tự fallback rule engine nếu model chưa
  sẵn sàng.
compute_risk() (risk_engine.py) vẫn là nguồn đánh giá CHÍNH cho /assess-risk
và bản tin cảnh báo thật. Xem cảnh báo đầy đủ trong train_flood.py, ml_engine.py.
"""

from pathlib import Path
from typing import Literal, Optional

import xgboost as xgb
from fastapi import FastAPI
from pydantic import BaseModel

from bulletin import generate_bulletin
from ml_engine import assess_risk_ml, is_model_ready
from risk_engine import ForecastInput, LocationInput, RiskAssessment, compute_risk
from train_flood import FEATURE_NAMES as FLOOD_FEATURE_NAMES
from train_flood import _true_flood_probability, build_flood_features
from thresholds import TERRAIN_FLOOD_MULTIPLIER

app = FastAPI(title="Forestgump AI Engine", version="1.0.0")

# [OPTIONAL/DEMO] Model lũ quét XGBoost — nạp nếu đã chạy `python train_flood.py`
# (sinh flood_model.json). Chưa train thì /predict-flood-risk tự fallback về
# công thức mock (mode="mock", xem predict_flood_risk() bên dưới) — KHÔNG lỗi
# 500, giữ đúng nguyên tắc AI Engine luôn trả lời được.
_FLOOD_MODEL_PATH = Path(__file__).parent / "flood_model.json"
_flood_booster: Optional[xgb.Booster] = None
if _FLOOD_MODEL_PATH.exists():
    try:
        _flood_booster = xgb.Booster()
        _flood_booster.load_model(str(_FLOOD_MODEL_PATH))
    except Exception as exc:  # noqa: BLE001 - lỗi nạp model không được làm sập service
        print(f"[APP] WARNING: lỗi nạp flood_model.json, dùng mock: {exc}")
        _flood_booster = None


@app.get("/health")
def health() -> dict:
    """Kiểm tra trạng thái dịch vụ."""
    return {"status": "ok"}


class DayAssessment(BaseModel):
    """Kết quả đánh giá rủi ro + bản tin cảnh báo cho 1 ngày."""

    risk: RiskAssessment
    bulletin: str


class AssessRiskRequest(BaseModel):
    """Payload đầu vào: 1 địa điểm + dự báo 3-7 ngày (khớp bảng weather_forecast)."""

    location: LocationInput
    forecast: list[ForecastInput]


class AssessRiskResponse(BaseModel):
    location_code: str
    days: list[DayAssessment]


@app.post("/assess-risk", response_model=AssessRiskResponse)
def assess_risk(data: AssessRiskRequest) -> AssessRiskResponse:
    """Đánh giá rủi ro (rét đậm/rét hại, mưa lớn/lũ quét, sương mù dày) + bản tin
    cảnh báo cho từng ngày trong dự báo Điện Biên. Rule-based (risk_engine.py),
    không phụ thuộc model ML nên luôn hoạt động (không có mock mode)."""
    days: list[DayAssessment] = []
    for day_forecast in data.forecast:
        risk = compute_risk(data.location, day_forecast)
        bulletin = generate_bulletin(data.location, risk)
        days.append(DayAssessment(risk=risk, bulletin=bulletin))
    return AssessRiskResponse(location_code=data.location.code, days=days)


class AssessRiskMlResponse(BaseModel):
    location_code: str
    mode: Literal["model", "fallback_rule_engine"]
    days: list[DayAssessment]


@app.post("/assess-risk-ml", response_model=AssessRiskMlResponse)
def assess_risk_ml_endpoint(data: AssessRiskRequest) -> AssessRiskMlResponse:
    """[SHADOW/DEMO] Đánh giá rủi ro bằng XGBoost multi-hazard
    (ml_engine.assess_risk_ml, distill từ risk_engine.compute_risk trên dữ
    liệu TỔNG HỢP) thay vì rule engine trực tiếp — CHẠY SONG SONG
    `/assess-risk`, KHÔNG dùng làm nguồn quyết định cho cảnh báo thật (xem
    `ai_engine/README.md` mục 6).

    Cùng payload/response shape với `/assess-risk` (dùng lại DayAssessment,
    generate_bulletin) — chỉ khác nguồn tính risk. Tự fallback rule engine
    nếu model chưa train/lỗi load (assess_risk_ml không bao giờ raise), nên
    endpoint này cũng không bao giờ lỗi 500; trường `mode` cho biết nguồn
    thật sự đã dùng cho TOÀN BỘ response (3 model multi-hazard nạp/fallback
    cùng lúc, không lệch giữa các ngày/hiểm hoạ)."""
    mode: Literal["model", "fallback_rule_engine"] = "model" if is_model_ready() else "fallback_rule_engine"
    days: list[DayAssessment] = []
    for day_forecast in data.forecast:
        risk = assess_risk_ml(data.location, day_forecast)
        bulletin = generate_bulletin(data.location, risk)
        days.append(DayAssessment(risk=risk, bulletin=bulletin))
    return AssessRiskMlResponse(location_code=data.location.code, mode=mode, days=days)


class PredictFloodRiskRequest(BaseModel):
    """Payload cho /predict-flood-risk — khớp build_flood_features (train_flood.py)."""

    rain_24h_mm: float
    rain_12h_mm: float
    terrain: str
    elevation_m: float
    humidity_pct: float


class PredictFloodRiskResponse(BaseModel):
    flood_probability: float  # 0-1
    mode: Literal["mock", "model"]


@app.post("/predict-flood-risk", response_model=PredictFloodRiskResponse)
def predict_flood_risk(data: PredictFloodRiskRequest) -> PredictFloodRiskResponse:
    """[OPTIONAL/DEMO] Xác suất lũ quét bổ sung bằng XGBoost (train_flood.py) —
    THAM KHẢO, KHÔNG thay thế compute_risk() (rule-based, vẫn là nguồn đánh
    giá chính dùng cho /assess-risk và bản tin cảnh báo thật).

    mode="model" nếu đã chạy `python train_flood.py` (có flood_model.json);
    mode="mock" nếu chưa — dùng lại chính công thức sigmoid dùng để SINH NHÃN
    huấn luyện (train_flood._true_flood_probability), tức là công thức "hợp
    lý về hình dạng" chứ KHÔNG phải số liệu khí tượng đã thẩm định.
    """
    if _flood_booster is not None:
        features = build_flood_features(
            data.rain_24h_mm, data.rain_12h_mm, data.terrain, data.elevation_m, data.humidity_pct
        )
        dmatrix = xgb.DMatrix(features.reshape(1, -1), feature_names=FLOOD_FEATURE_NAMES)
        probability = float(_flood_booster.predict(dmatrix)[0])
        mode: Literal["mock", "model"] = "model"
    else:
        terrain_multiplier = TERRAIN_FLOOD_MULTIPLIER.get(data.terrain, 1.0)
        probability = _true_flood_probability(data.rain_24h_mm, data.rain_12h_mm, terrain_multiplier)
        mode = "mock"

    return PredictFloodRiskResponse(flood_probability=probability, mode=mode)
