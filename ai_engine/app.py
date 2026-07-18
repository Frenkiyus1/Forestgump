"""Forestgump AI Engine - Đánh giá rủi ro + sinh bản tin cảnh báo thiên tai Điện Biên.

Nhận dự báo thời tiết nhiều ngày (từ backend/src/weather-ingest.ts, nguồn
Open-Meteo/OpenWeatherMap) qua HTTP POST, áp dụng rule engine (risk_engine.py,
thresholds.py — KHÔNG phải machine learning) để đánh giá rủi ro rét đậm/rét
hại, mưa lớn/lũ quét, sương mù, rồi sinh bản tin cảnh báo bằng template cố
định đã kiểm duyệt trước (bulletin.py — CỐ TÌNH KHÔNG dùng LLM tự do sinh
nội dung an toàn tính mạng). Rule-based nên luôn hoạt động, không có mock
mode.

Ngoài ra có 3 nhánh ML chạy SONG SONG, KHÔNG thay thế rule engine:
- [OPTIONAL/DEMO] /predict-flood-risk dùng XGBoost nhị phân (train_flood.py)
  làm THAM KHẢO bổ sung cho xác suất lũ quét.
- [SHADOW/DEMO] /assess-risk-ml dùng XGBoost multi-hazard (ml_engine.py,
  distill từ compute_risk() trên dữ liệu tổng hợp) tính lại đúng 3 hiểm hoạ
  của /assess-risk để so sánh/demo — tự fallback rule engine nếu model chưa
  sẵn sàng.
- [THAM KHẢO] /assess-terrain-risk (+ biến thể -live, /terrain-communes):
  XGBoost hồi quy risk SẠT LỞ + LŨ QUÉT theo 130 xã, train từ đặc trưng địa
  hình DEM thật (docs/dienbien_risk_theo_xa.csv, train_terrain.py); biến thể
  -live thay số liệu mưa tĩnh trong CSV bằng mưa live từ Open-Meteo + lưu
  lượng sông GloFAS (live_features.py) — tự fallback baseline CSV nếu model
  chưa train.
compute_risk() (risk_engine.py) vẫn là nguồn đánh giá CHÍNH cho /assess-risk
và bản tin cảnh báo thật. Xem cảnh báo đầy đủ trong train_flood.py,
ml_engine.py, train_terrain.py.
"""

from pathlib import Path
from typing import Literal, Optional

import xgboost as xgb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from bulletin import generate_bulletin
from live_features import LiveFlood, LiveRain, fetch_live_flood, fetch_live_rain
from ml_engine import assess_risk_ml, is_model_ready
from risk_engine import ForecastInput, LocationInput, RiskAssessment, compute_risk
from terrain_engine import TerrainMode, get_registry, predict_terrain_risk
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


# ---------------------------------------------------------------------------
# [THAM KHẢO] Nhánh ML #3 — rủi ro SẠT LỞ + LŨ QUÉT theo 130 xã Điện Biên
# (terrain_engine.py, train từ docs/dienbien_risk_theo_xa.csv). KHÔNG thay
# thế /assess-risk; tự fallback baseline CSV nếu chưa chạy train_terrain.py.
# ---------------------------------------------------------------------------


class CommuneSummary(BaseModel):
    """Thông tin tĩnh 1 xã trong danh bạ 130 xã (dienbien_risk_theo_xa.csv)."""

    name: str
    centroid_lat: float
    centroid_lon: float
    slope_mean_deg: float
    twi_mean: float
    baseline_warning_satlo: int  # cấp 1-5, snapshot lúc build CSV
    baseline_warning_luquet: int


@app.get("/terrain-communes", response_model=list[CommuneSummary])
def terrain_communes() -> list[CommuneSummary]:
    """Danh bạ 130 xã có đặc trưng địa hình DEM + cấp cảnh báo baseline —
    nguồn cho dropdown/bản đồ phía dashboard."""
    return [
        CommuneSummary(
            name=c.name,
            centroid_lat=c.centroid_lat,
            centroid_lon=c.centroid_lon,
            slope_mean_deg=c.slope_mean,
            twi_mean=c.twi_mean,
            baseline_warning_satlo=c.baseline_level_satlo,
            baseline_warning_luquet=c.baseline_level_luquet,
        )
        for c in get_registry().communes.values()
    ]


class TerrainHazardResult(BaseModel):
    """Kết quả 1 hiểm hoạ: risk score 0-1 + cấp cảnh báo 1-5 (ngưỡng 0.2/0.4/0.6/0.8)."""

    risk_score: float
    warning_level: int
    mode: TerrainMode  # "model" | "csv_baseline" (fallback khi chưa train)


class AssessTerrainRiskRequest(BaseModel):
    """Payload /assess-terrain-risk — số liệu mưa bỏ trống thì dùng snapshot CSV."""

    commune: str  # tên xã đúng cột NAME_3 trong CSV (vd. "Mường Phăng")
    rain_1h_mm: Optional[float] = None
    rain_24h_mm: Optional[float] = None
    rain_72h_mm: Optional[float] = None
    rain_next_24h_mm: Optional[float] = None


class AssessTerrainRiskResponse(BaseModel):
    commune: str
    satlo: TerrainHazardResult  # sạt lở đất
    luquet: TerrainHazardResult  # lũ quét
    rain_used_mm: dict[str, float]  # số liệu mưa thực tế đã đưa vào model


def _lookup_commune(name: str):
    commune = get_registry().communes.get(name.strip())
    if commune is None:
        raise HTTPException(status_code=404, detail=f"Không có xã '{name}' trong danh bạ 130 xã")
    return commune


def _assess_terrain(
    commune_name: str,
    rain_1h_mm: Optional[float],
    rain_24h_mm: Optional[float],
    rain_72h_mm: Optional[float],
    rain_next_24h_mm: Optional[float],
) -> AssessTerrainRiskResponse:
    commune = _lookup_commune(commune_name)
    rain = {
        "rain_1h_mm": rain_1h_mm if rain_1h_mm is not None else commune.rain_1h_mm,
        "rain_24h_mm": rain_24h_mm if rain_24h_mm is not None else commune.rain_24h_mm,
        "rain_72h_mm": rain_72h_mm if rain_72h_mm is not None else commune.rain_72h_mm,
        "rain_next_24h_mm": (
            rain_next_24h_mm if rain_next_24h_mm is not None else commune.rain_next_24h_mm
        ),
    }
    prediction = predict_terrain_risk(commune, **rain)
    return AssessTerrainRiskResponse(
        commune=commune.name,
        satlo=TerrainHazardResult(**prediction["satlo"].__dict__),
        luquet=TerrainHazardResult(**prediction["luquet"].__dict__),
        rain_used_mm=rain,
    )


@app.post("/assess-terrain-risk", response_model=AssessTerrainRiskResponse)
def assess_terrain_risk(data: AssessTerrainRiskRequest) -> AssessTerrainRiskResponse:
    """[THAM KHẢO] Rủi ro sạt lở + lũ quét cho 1 xã theo model địa hình
    (train_terrain.py). Số liệu mưa không truyền thì dùng snapshot trong CSV.
    Không bao giờ 500 vì thiếu model — fallback mode="csv_baseline"."""
    return _assess_terrain(
        data.commune, data.rain_1h_mm, data.rain_24h_mm, data.rain_72h_mm, data.rain_next_24h_mm
    )


class LiveRainContext(BaseModel):
    """Số liệu live từ Open-Meteo đã đưa vào model + chỉ báo bổ sung."""

    fetched_at: str
    soil_moisture_0_7cm: Optional[float] = None  # m³/m³ (Open-Meteo, chỉ báo bổ sung)
    precip_prob_max_next_24h_pct: Optional[float] = None
    river_discharge_m3s: Optional[float] = None  # GloFAS hôm nay (Flood API)
    river_discharge_max_7d_m3s: Optional[float] = None  # đỉnh GloFAS 7 ngày tới


class AssessTerrainRiskLiveResponse(AssessTerrainRiskResponse):
    live_context: LiveRainContext


@app.get("/assess-terrain-risk-live", response_model=AssessTerrainRiskLiveResponse)
def assess_terrain_risk_live(commune: str) -> AssessTerrainRiskLiveResponse:
    """[THAM KHẢO] Như /assess-terrain-risk nhưng số liệu mưa lấy LIVE tại
    centroid xã: Open-Meteo Forecast API (mưa 1h/24h/72h vừa qua + dự báo 24h
    tới + độ ẩm đất + xác suất mưa) và Open-Meteo Flood API/GloFAS (lưu lượng
    sông — chỉ báo bổ sung trong live_context, không vào model). Lỗi Flood API
    không làm hỏng response; lỗi Forecast API trả 502."""
    record = _lookup_commune(commune)
    try:
        live_rain: LiveRain = fetch_live_rain(record.centroid_lat, record.centroid_lon)
    except Exception as exc:  # noqa: BLE001 - gói lỗi mạng thành 502 thay vì 500 chung chung
        raise HTTPException(status_code=502, detail=f"Lỗi gọi Open-Meteo: {exc}") from exc
    live_flood: LiveFlood = fetch_live_flood(record.centroid_lat, record.centroid_lon)

    base = _assess_terrain(
        record.name,
        live_rain.rain_1h_mm,
        live_rain.rain_24h_mm,
        live_rain.rain_72h_mm,
        live_rain.rain_next_24h_mm,
    )
    return AssessTerrainRiskLiveResponse(
        **base.__dict__,
        live_context=LiveRainContext(
            fetched_at=live_rain.fetched_at,
            soil_moisture_0_7cm=live_rain.soil_moisture_0_7cm,
            precip_prob_max_next_24h_pct=live_rain.precip_prob_max_next_24h_pct,
            river_discharge_m3s=live_flood.river_discharge_m3s,
            river_discharge_max_7d_m3s=live_flood.river_discharge_max_7d_m3s,
        ),
    )
