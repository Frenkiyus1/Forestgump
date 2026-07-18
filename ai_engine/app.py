"""Forestgump AI Engine - Đánh giá rủi ro + sinh bản tin cảnh báo thiên tai Điện Biên.

Nhận dự báo thời tiết nhiều ngày (từ backend/src/weather-ingest.ts, nguồn
Open-Meteo/OpenWeatherMap) qua HTTP POST, áp dụng rule engine (risk_engine.py,
thresholds.py — KHÔNG phải machine learning) để đánh giá rủi ro rét đậm/rét
hại, mưa lớn/lũ quét, sương mù, rồi sinh bản tin cảnh báo bằng LLM
(bulletin.py). Rule-based nên luôn hoạt động, không có mock mode.
"""

from fastapi import FastAPI
from pydantic import BaseModel

from bulletin import generate_bulletin
from risk_engine import ForecastInput, LocationInput, RiskAssessment, compute_risk

app = FastAPI(title="Forestgump AI Engine", version="1.0.0")


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
